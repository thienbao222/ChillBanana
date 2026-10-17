import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as mockCallback } from "@/app/api/payment/mock-callback/route";
import { POST as adminRefund } from "@/app/api/admin/orders/[id]/refund/route";
import { GET as ipn } from "@/app/api/payment/vnpay-ipn/route";
import { POST as createPayment } from "@/app/api/payment/vnpay-create/route";
import { MockPaymentProvider, VnpayProvider } from "@/features/payments/providers";
import { applyPaymentCallback, refundOrderPayment } from "@/features/payments/service";
import { sendPaymentSuccessEmail } from "@/lib/mailer";
import { prisma } from "../helpers/db";
import { adminCookies, makeAdmin, makeOrder } from "../helpers/factories";
import { get, json, params, post } from "../helpers/request";
import { ipnPath } from "../helpers/vnpay";

afterEach(() => vi.unstubAllEnvs());

const mock = new MockPaymentProvider();
const play = async (orderCode: string, scenario: Parameters<MockPaymentProvider["buildCallbacks"]>[0], txnId?: string, amountVnd = 530_400) => {
  const results: string[] = [];
  for (const cb of mock.buildCallbacks(scenario, { orderCode, amountVnd, txnId })) results.push((await applyPaymentCallback(cb)).result);
  return results;
};
const txs = (orderId: string) => prisma.paymentTransaction.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
const orderOf = (id: string) => prisma.order.findUniqueOrThrow({ where: { id } });

describe("provider mock: các kết quả thanh toán", () => {
  it("success: đơn chuyển sang mua hàng, giao dịch MOCK được xác nhận", async () => {
    const o = await makeOrder();
    expect(await play(o.orderCode, "success", "M1")).toEqual(["confirmed"]);
    const after = await orderOf(o.id);
    expect(after).toMatchObject({ paymentStatus: "DEPOSITED_50", status: "PURCHASING_JP" });
    expect(await txs(o.id)).toMatchObject([{ provider: "MOCK", status: "CONFIRMED", amountVnd: 530_400, providerTransactionId: "M1" }]);
    expect(sendPaymentSuccessEmail).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["failed", "FAILED"],
    ["cancelled", "CANCELLED"],
    ["timeout", "TIMEOUT"],
    ["pending", "PENDING"],
  ] as const)("%s: ghi giao dịch %s, đơn vẫn chờ thanh toán", async (scenario, status) => {
    const o = await makeOrder();
    expect(await play(o.orderCode, scenario, "M2")).toEqual(["recorded"]);
    const after = await orderOf(o.id);
    expect(after).toMatchObject({ paymentStatus: "UNPAID", status: "PENDING_DEPOSIT" });
    const [tx] = await txs(o.id);
    expect(tx).toMatchObject({ provider: "MOCK", status, providerTransactionId: "M2" });
    if (status !== "PENDING") expect(tx.reference).toBeTruthy(); // lý do thất bại
    expect(sendPaymentSuccessEmail).not.toHaveBeenCalled();
  });

  it("pending rồi success cùng mã giao dịch: chỉ một giao dịch, được nâng lên CONFIRMED", async () => {
    const o = await makeOrder();
    await play(o.orderCode, "pending", "M3");
    expect(await play(o.orderCode, "success", "M3")).toEqual(["confirmed"]);
    expect(await txs(o.id)).toMatchObject([{ status: "CONFIRMED", providerTransactionId: "M3" }]);
    expect((await orderOf(o.id)).paymentStatus).toBe("DEPOSITED_50");
  });

  it("thất bại rồi khách thử lại và thành công: giao dịch thất bại được giữ, giao dịch mới xác nhận", async () => {
    const o = await makeOrder();
    await play(o.orderCode, "failed", "F1");
    expect(await play(o.orderCode, "success", "S1")).toEqual(["confirmed"]);
    const list = await txs(o.id);
    expect(list.map((t) => t.status).sort()).toEqual(["CONFIRMED", "FAILED"]);
  });

  it("duplicate (webhook trùng): chỉ ghi nhận một lần, email gửi một lần", async () => {
    const o = await makeOrder();
    expect(await play(o.orderCode, "duplicate", "D1")).toEqual(["confirmed", "already_paid"]);
    expect(await txs(o.id)).toHaveLength(1);
    expect(sendPaymentSuccessEmail).toHaveBeenCalledTimes(1);
  });

  it("thất bại gửi trùng cùng mã giao dịch không tạo thêm dòng", async () => {
    const o = await makeOrder();
    await play(o.orderCode, "failed", "F9");
    expect(await play(o.orderCode, "failed", "F9")).toEqual(["duplicate"]);
    expect(await txs(o.id)).toHaveLength(1);
  });

  it("thất bại đến sau khi đã thanh toán thì không ghi thêm và không đổi trạng thái", async () => {
    const o = await makeOrder();
    await play(o.orderCode, "success", "OK1");
    expect(await play(o.orderCode, "failed", "LATE1")).toEqual(["already_paid"]);
    expect(await txs(o.id)).toHaveLength(1);
    expect((await orderOf(o.id)).paymentStatus).toBe("DEPOSITED_50");
  });

  it("thành công sai số tiền bị từ chối và không đổi đơn", async () => {
    const o = await makeOrder();
    expect(await play(o.orderCode, "success", "BAD", 1_000)).toEqual(["invalid_amount"]);
    expect((await orderOf(o.id)).paymentStatus).toBe("UNPAID");
    expect(await txs(o.id)).toHaveLength(0);
  });

  it("đơn không tồn tại", async () => {
    expect(await play("CB-KHONG-CO", "failed", "X")).toEqual(["not_found"]);
    expect(await play("CB-KHONG-CO", "success", "X")).toEqual(["not_found"]);
  });

  it("hai callback thành công đồng thời: chỉ một giao dịch", async () => {
    const o = await makeOrder();
    const results = await Promise.all([play(o.orderCode, "success", "RACE"), play(o.orderCode, "success", "RACE")]);
    expect(results.flat().sort()).toEqual(["already_paid", "confirmed"]);
    expect(await txs(o.id)).toHaveLength(1);
  });
});

describe("route mô phỏng /api/payment/mock-callback", () => {
  it("không phải chế độ mock thì 404 (mặc định là VNPAY sandbox)", async () => {
    const o = await makeOrder();
    const res = await mockCallback(post("/api/payment/mock-callback", { orderCode: o.orderCode, scenario: "success" }));
    expect(res.status).toBe(404);
    expect((await orderOf(o.id)).paymentStatus).toBe("UNPAID");
  });

  it("production luôn 404 dù PAYMENT_PROVIDER=mock", async () => {
    vi.stubEnv("PAYMENT_PROVIDER", "mock");
    vi.stubEnv("VERCEL_ENV", "production");
    const o = await makeOrder();
    expect((await mockCallback(post("/api/payment/mock-callback", { orderCode: o.orderCode, scenario: "success" }))).status).toBe(404);
    expect((await orderOf(o.id)).paymentStatus).toBe("UNPAID");
  });

  it("chế độ mock: chạy kịch bản và trả kết quả đã đánh dấu mô phỏng", async () => {
    vi.stubEnv("PAYMENT_PROVIDER", "mock");
    const o = await makeOrder();
    const res = await mockCallback(post("/api/payment/mock-callback", { orderCode: o.orderCode, scenario: "duplicate" }));
    const body = await json(res);
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ simulated: true, results: ["confirmed", "already_paid"] });
    expect((await orderOf(o.id)).paymentStatus).toBe("DEPOSITED_50");
  });

  it("kịch bản lạ hoặc đơn không tồn tại bị từ chối", async () => {
    vi.stubEnv("PAYMENT_PROVIDER", "mock");
    const o = await makeOrder();
    expect((await mockCallback(post("/api/payment/mock-callback", { orderCode: o.orderCode, scenario: "boom" }))).status).toBe(400);
    expect((await mockCallback(post("/api/payment/mock-callback", { orderCode: "CB-NO", scenario: "success" }))).status).toBe(404);
  });

  it("vnpay-create ở chế độ mock trả phản hồi mô phỏng, không có URL thanh toán", async () => {
    vi.stubEnv("PAYMENT_PROVIDER", "mock");
    const o = await makeOrder();
    const body = await json(await createPayment(post("/api/payment/vnpay-create", { orderCode: o.orderCode })));
    expect(body).toMatchObject({ success: true, provider: "MOCK", simulated: true, paymentUrl: null });
  });
});

describe("VNPAY IPN: ghi lại giao dịch không thành công", () => {
  it("thất bại có mã giao dịch '0' được lưu với mã rỗng; hai đơn khác nhau không đè nhau", async () => {
    const a = await makeOrder();
    const b = await makeOrder();
    for (const o of [a, b]) {
      const r = await json<{ RspCode: string }>(await ipn(get(ipnPath({ orderCode: o.orderCode, amountVnd: 530_400, txnNo: "0", responseCode: "51", status: "02" }))));
      expect(r.RspCode).toBe("00");
    }
    expect(await txs(a.id)).toMatchObject([{ status: "FAILED", providerTransactionId: null }]);
    expect(await txs(b.id)).toMatchObject([{ status: "FAILED", providerTransactionId: null }]);
  });

  it("IPN thất bại gửi lại liên tiếp không tạo dòng trùng", async () => {
    const o = await makeOrder();
    const path = ipnPath({ orderCode: o.orderCode, amountVnd: 530_400, txnNo: "0", responseCode: "51", status: "02" });
    await ipn(get(path));
    await ipn(get(path));
    expect(await txs(o.id)).toHaveLength(1);
  });

  it("chữ ký sai không ghi gì", async () => {
    const o = await makeOrder();
    const path = ipnPath({ orderCode: o.orderCode, amountVnd: 530_400, responseCode: "51", status: "02" }, "khoa-sai");
    expect((await json<{ RspCode: string }>(await ipn(get(path)))).RspCode).toBe("97");
    expect(await txs(o.id)).toHaveLength(0);
  });
});

describe("hoàn tiền", () => {
  const paidAndCancelled = async () => {
    const o = await makeOrder();
    await play(o.orderCode, "success", "PAY1");
    await prisma.order.update({ where: { id: o.id }, data: { status: "CANCELLED" } });
    return o;
  };

  it("hoàn tiền mô phỏng: đơn REFUNDED, giao dịch REFUNDED, có log hành trình", async () => {
    const o = await paidAndCancelled();
    const r = await refundOrderPayment(mock, { orderCode: o.orderCode, reason: "Khách hủy" });
    expect(r).toEqual({ result: "refunded", providerRefundId: "MOCKREFUND-PAY1" });
    expect((await orderOf(o.id)).paymentStatus).toBe("REFUNDED");
    expect(await txs(o.id)).toMatchObject([{ status: "REFUNDED" }]);
    const logs = await prisma.trackingLog.findMany({ where: { orderId: o.id, title: "Đã hoàn tiền" } });
    expect(logs).toHaveLength(1);
    expect(logs[0].description).toContain("mô phỏng");
  });

  it("hoàn hai lần: lần hai bị từ chối, không ghi thêm", async () => {
    const o = await paidAndCancelled();
    await refundOrderPayment(mock, { orderCode: o.orderCode, reason: "x" });
    expect((await refundOrderPayment(mock, { orderCode: o.orderCode, reason: "x" })).result).toBe("not_refundable");
    expect(await prisma.trackingLog.count({ where: { orderId: o.id, title: "Đã hoàn tiền" } })).toBe(1);
  });

  it("chỉ hoàn cho đơn đã hủy và đã thanh toán", async () => {
    const unpaid = await makeOrder({ status: "CANCELLED" });
    expect((await refundOrderPayment(mock, { orderCode: unpaid.orderCode, reason: "x" })).result).toBe("not_refundable");

    const activePaid = await makeOrder();
    await play(activePaid.orderCode, "success", "A1");
    expect((await refundOrderPayment(mock, { orderCode: activePaid.orderCode, reason: "x" })).result).toBe("not_refundable");
    expect((await orderOf(activePaid.id)).paymentStatus).toBe("DEPOSITED_50");

    expect((await refundOrderPayment(mock, { orderCode: "CB-NO", reason: "x" })).result).toBe("not_found");
  });

  it("không có giao dịch xác nhận của nhà cung cấp này thì không hoàn", async () => {
    const o = await paidAndCancelled(); // giao dịch là MOCK
    const r = await refundOrderPayment(new VnpayProvider("vnpay-sandbox"), { orderCode: o.orderCode, reason: "x" });
    expect(r.result).toBe("no_transaction");
    expect((await orderOf(o.id)).paymentStatus).toBe("DEPOSITED_50");
  });

  it("nhà cung cấp từ chối hoàn (VNPAY chưa tích hợp) thì dữ liệu giữ nguyên", async () => {
    const o = await makeOrder();
    await applyPaymentCallback({ provider: "VNPAY", orderCode: o.orderCode, amountVnd: 530_400, outcome: "SUCCESS", providerTransactionId: "V1" });
    await prisma.order.update({ where: { id: o.id }, data: { status: "CANCELLED" } });
    const r = await refundOrderPayment(new VnpayProvider("vnpay-sandbox"), { orderCode: o.orderCode, reason: "x" });
    expect(r.result).toBe("provider_failed");
    expect((await orderOf(o.id)).paymentStatus).toBe("DEPOSITED_50");
    expect(await txs(o.id)).toMatchObject([{ status: "CONFIRMED" }]);
  });

  it("route admin: OPERATOR bị cấm, SUPER_ADMIN hoàn được và có audit log", async () => {
    vi.stubEnv("PAYMENT_PROVIDER", "mock");
    const o = await paidAndCancelled();
    await makeAdmin("nhanvien", "OPERATOR");
    await makeAdmin("boss", "SUPER_ADMIN");
    const call = (cookies?: Record<string, string>) =>
      adminRefund(post(`/api/admin/orders/${o.orderCode}/refund`, { reason: "Khách yêu cầu" }, { cookies }), params({ id: o.orderCode }));

    expect((await call()).status).toBe(401);
    expect((await call(adminCookies("nhanvien"))).status).toBe(403);
    expect((await orderOf(o.id)).paymentStatus).toBe("DEPOSITED_50");

    const ok = await call(adminCookies("boss"));
    expect(ok.status).toBe(200);
    expect(await json(ok)).toMatchObject({ success: true, simulated: true });
    expect((await orderOf(o.id)).paymentStatus).toBe("REFUNDED");
    expect(await prisma.auditLog.count({ where: { action: "ORDER_REFUNDED", actor: "boss" } })).toBe(1);

    expect((await call(adminCookies("boss"))).status).toBe(409); // đã hoàn
  });
});
