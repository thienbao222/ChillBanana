import { describe, expect, it, vi } from "vitest";
import { GET as ipn } from "@/app/api/payment/vnpay-ipn/route";
import { POST as createPayment } from "@/app/api/payment/vnpay-create/route";
import { verifyVnpaySignature } from "@/lib/vnpay-payment";
import { sendPaymentSuccessEmail } from "@/lib/mailer";
import { prisma } from "../helpers/db";
import { get, json, post } from "../helpers/request";
import { makeOrder } from "../helpers/factories";
import { ipnPath } from "../helpers/vnpay";

const callIpn = async (path: string) => json<{ RspCode: string; Message: string }>(await ipn(get(path)));

describe("VNPAY IPN", () => {
  it("thanh toán hợp lệ: ghi nhận đúng một lần, chuyển đơn sang mua hàng", async () => {
    const o = await makeOrder();
    const r = await callIpn(ipnPath({ orderCode: o.orderCode, amountVnd: 530_400, txnNo: "T100" }));
    expect(r.RspCode).toBe("00");

    const after = await prisma.order.findUniqueOrThrow({ where: { id: o.id }, include: { paymentTransactions: true, trackingLogs: true } });
    expect(after.paymentStatus).toBe("DEPOSITED_50");
    expect(after.paymentMethod).toBe("VNPAY");
    expect(after.status).toBe("PURCHASING_JP");
    expect(after.reservationExpiresAt).toBeNull();
    expect(after.paymentTransactions).toHaveLength(1);
    expect(after.paymentTransactions[0]).toMatchObject({ provider: "VNPAY", amountVnd: 530_400, providerTransactionId: "T100", status: "CONFIRMED" });
    expect(after.trackingLogs).toHaveLength(1);
    expect(sendPaymentSuccessEmail).toHaveBeenCalledTimes(1);
  });

  it("đặt cọc 100% thì ghi PAID_100", async () => {
    const o = await makeOrder({ depositPercent: 100, depositAmountVnd: 1_060_800 });
    const r = await callIpn(ipnPath({ orderCode: o.orderCode, amountVnd: 1_060_800 }));
    expect(r.RspCode).toBe("00");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).paymentStatus).toBe("PAID_100");
  });

  it("chữ ký sai: từ chối (97) và không đổi đơn", async () => {
    const o = await makeOrder();
    const r = await callIpn(ipnPath({ orderCode: o.orderCode, amountVnd: 530_400 }, "khoa-bi-mat-sai"));
    expect(r.RspCode).toBe("97");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).paymentStatus).toBe("UNPAID");
    expect(await prisma.paymentTransaction.count()).toBe(0);
  });

  it("sửa số tiền nhưng giữ chữ ký cũ: bị từ chối", async () => {
    const o = await makeOrder();
    const good = ipnPath({ orderCode: o.orderCode, amountVnd: 530_400 });
    const tampered = good.replace("vnp_Amount=53040000", "vnp_Amount=100");
    expect(tampered).not.toBe(good);
    expect((await callIpn(tampered)).RspCode).toBe("97");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).paymentStatus).toBe("UNPAID");
  });

  it("chữ ký đúng nhưng số tiền khác số cọc: từ chối (04)", async () => {
    const o = await makeOrder();
    const r = await callIpn(ipnPath({ orderCode: o.orderCode, amountVnd: 1_000 }));
    expect(r.RspCode).toBe("04");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).paymentStatus).toBe("UNPAID");
  });

  it("gửi lại cùng IPN: không ghi nhận lần hai (02)", async () => {
    const o = await makeOrder();
    const path = ipnPath({ orderCode: o.orderCode, amountVnd: 530_400, txnNo: "T200" });
    expect((await callIpn(path)).RspCode).toBe("00");
    expect((await callIpn(path)).RspCode).toBe("02");
    expect(await prisma.paymentTransaction.count()).toBe(1);
    expect(sendPaymentSuccessEmail).toHaveBeenCalledTimes(1);
  });

  it("hai IPN đồng thời: chỉ một giao dịch được ghi", async () => {
    const o = await makeOrder();
    const path = ipnPath({ orderCode: o.orderCode, amountVnd: 530_400, txnNo: "T300" });
    const results = await Promise.all([callIpn(path), callIpn(path)]);
    expect(results.map((r) => r.RspCode).sort()).toEqual(["00", "02"]);
    expect(await prisma.paymentTransaction.count()).toBe(1);
  });

  it("không tìm thấy đơn (01)", async () => {
    expect((await callIpn(ipnPath({ orderCode: "CB-KHONG-CO", amountVnd: 1000 }))).RspCode).toBe("01");
  });

  it("đơn ngoài catalog chưa được duyệt giá thì không nhận thanh toán", async () => {
    const o = await makeOrder({ isPriceVerified: false });
    const r = await callIpn(ipnPath({ orderCode: o.orderCode, amountVnd: 530_400 }));
    expect(r.RspCode).toBe("04");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).paymentStatus).toBe("UNPAID");
  });

  it("đơn đã hủy không được nhận thanh toán", async () => {
    const o = await makeOrder({ status: "CANCELLED", reservationExpiresAt: null });
    const r = await callIpn(ipnPath({ orderCode: o.orderCode, amountVnd: 530_400 }));
    expect(r.RspCode).not.toBe("00");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).paymentStatus).toBe("UNPAID");
  });

  it("giao dịch thất bại tại VNPAY: không ghi nhận tiền nhưng lưu lại giao dịch để đối soát", async () => {
    const o = await makeOrder();
    const r = await callIpn(ipnPath({ orderCode: o.orderCode, amountVnd: 530_400, responseCode: "24", status: "02" }));
    expect(r.RspCode).toBe("00"); // đã nhận thông báo
    const after = await prisma.order.findUniqueOrThrow({ where: { id: o.id }, include: { paymentTransactions: true } });
    expect(after.paymentStatus).toBe("UNPAID");
    expect(after.status).toBe("PENDING_DEPOSIT");
    expect(after.paymentTransactions).toHaveLength(1);
    expect(after.paymentTransactions[0]).toMatchObject({ provider: "VNPAY", status: "CANCELLED", amountVnd: 530_400 });
  });

  it("thiếu VNPAY_HASH_SECRET thì từ chối mọi IPN", async () => {
    const o = await makeOrder();
    const path = ipnPath({ orderCode: o.orderCode, amountVnd: 530_400 });
    const saved = process.env.VNPAY_HASH_SECRET;
    delete process.env.VNPAY_HASH_SECRET;
    try {
      expect((await callIpn(path)).RspCode).toBe("97");
    } finally {
      process.env.VNPAY_HASH_SECRET = saved;
    }
  });
});

describe("POST /api/payment/vnpay-create", () => {
  const create = (orderCode?: string) => createPayment(post("/api/payment/vnpay-create", { orderCode }));

  it("tạo URL có chữ ký hợp lệ với số tiền do server tính", async () => {
    const o = await makeOrder();
    const res = await create(o.orderCode);
    const body = await json(res);
    expect(res.status).toBe(200);
    const url = new URL(body.paymentUrl);
    expect(url.origin + url.pathname).toBe(process.env.VNPAY_URL);
    expect(url.searchParams.get("vnp_Amount")).toBe("53040000");
    expect(url.searchParams.get("vnp_TxnRef")).toBe(o.orderCode);
    expect(verifyVnpaySignature(url.searchParams)).toBe(true);
  });

  it("gia hạn thời gian giữ hàng đủ cho cửa sổ thanh toán", async () => {
    const o = await makeOrder({ reservationExpiresAt: new Date(Date.now() + 5 * 60_000) });
    expect((await create(o.orderCode)).status).toBe(200);
    const after = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(after.reservationExpiresAt!.getTime() - Date.now()).toBeGreaterThan(16 * 60_000);
  });

  it.each([
    ["thiếu mã đơn", undefined, {}, 400],
    ["đơn không tồn tại", "CB-KHONG-CO", {}, 404],
    ["đơn đã thanh toán", "", { paymentStatus: "DEPOSITED_50" }, 400],
    ["đơn đã hủy", "", { status: "CANCELLED" }, 400],
    ["đơn chưa duyệt giá", "", { isPriceVerified: false }, 403],
    ["đã hết thời gian giữ hàng", "", { reservationExpiresAt: new Date(Date.now() - 60_000) }, 409],
  ])("từ chối: %s", async (_label, code, over, status) => {
    let orderCode = code;
    if (code === "") orderCode = (await makeOrder(over as Record<string, unknown>)).orderCode;
    expect((await create(orderCode)).status).toBe(status);
  });

  it("thiếu cấu hình cổng thanh toán thì trả 503", async () => {
    const o = await makeOrder();
    const saved = process.env.VNPAY_HASH_SECRET;
    delete process.env.VNPAY_HASH_SECRET;
    try {
      expect((await create(o.orderCode)).status).toBe(503);
    } finally {
      process.env.VNPAY_HASH_SECRET = saved;
    }
  });
});
