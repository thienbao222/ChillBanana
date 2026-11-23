import { describe, expect, it } from "vitest";
import { POST as createOrder } from "@/app/api/orders/route";
import { GET as getOrder, PATCH as patchOrder } from "@/app/api/orders/[id]/route";
import { prisma } from "../helpers/db";
import { cookieFrom, get, json, params, patch, post } from "../helpers/request";
import {
  adminCookies, customerCookies, guestOrderCookies, makeAdmin, makeCustomer, makeOrder, makeProduct, orderPayload,
} from "../helpers/factories";

async function createCatalogOrder(cookies?: Record<string, string>, quantity = 2) {
  const product = await makeProduct({ stockSlots: 5 });
  const res = await createOrder(post("/api/orders", orderPayload([{ id: product.id, quantity }]), { cookies }));
  const body = await json(res);
  return { product, res, order: body.order as { orderCode: string; id: string }, guestToken: cookieFrom(res, "cb_order_access") };
}

describe("GET /api/orders/[id]: chống truy cập trái phép", () => {
  it("không có quyền thì trả 404 giống hệt mã không tồn tại (chống dò mã đơn)", async () => {
    const { order } = await createCatalogOrder();
    const unauth = await getOrder(get(`/api/orders/${order.orderCode}`), params({ id: order.orderCode }));
    const unknown = await getOrder(get("/api/orders/CB-KHONG-TON-TAI"), params({ id: "CB-KHONG-TON-TAI" }));
    expect(unauth.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(await json(unauth)).toEqual(await json(unknown));
  });

  it("khách vãng lai có cookie truy cập xem được đơn của mình, không lộ email/customerId", async () => {
    const { order, guestToken } = await createCatalogOrder();
    const res = await getOrder(
      get(`/api/orders/${order.orderCode}`, { cookies: guestOrderCookies(guestToken!) }),
      params({ id: order.orderCode })
    );
    const body = await json(res);
    expect(res.status).toBe(200);
    expect(body.order.orderCode).toBe(order.orderCode);
    expect(body.order.customerEmail).toBeUndefined();
    expect(body.order.customerId).toBeUndefined();
  });

  it("cookie truy cập của đơn A không mở được đơn B", async () => {
    const a = await createCatalogOrder();
    const b = await createCatalogOrder();
    const res = await getOrder(
      get(`/api/orders/${b.order.orderCode}`, { cookies: guestOrderCookies(a.guestToken!) }),
      params({ id: b.order.orderCode })
    );
    expect(res.status).toBe(404);
  });

  it("khách khác không xem được đơn của chủ; chủ và admin thì xem được", async () => {
    const owner = await makeCustomer("owner@example.test");
    const stranger = await makeCustomer("stranger@example.test");
    const { order } = await createCatalogOrder(customerCookies(owner));
    const path = `/api/orders/${order.orderCode}`;

    const strangerRes = await getOrder(get(path, { cookies: customerCookies(stranger) }), params({ id: order.orderCode }));
    expect(strangerRes.status).toBe(404);

    const ownerRes = await getOrder(get(path, { cookies: customerCookies(owner) }), params({ id: order.orderCode }));
    expect(ownerRes.status).toBe(200);
    expect((await json(ownerRes)).order.canCancel).toBe(true);

    await makeAdmin("admin");
    const adminRes = await getOrder(get(path, { cookies: adminCookies("admin") }), params({ id: order.orderCode }));
    expect(adminRes.status).toBe(200);
  });
});

describe("PATCH /api/orders/[id]: phân quyền và quy trình", () => {
  it("chưa đăng nhập thì 401", async () => {
    const { order } = await createCatalogOrder();
    const res = await patchOrder(patch(`/api/orders/${order.orderCode}`, { action: "cancel", by: "CUSTOMER" }), params({ id: order.orderCode }));
    expect(res.status).toBe(401);
  });

  it("khách khác không hủy được đơn của người khác", async () => {
    const owner = await makeCustomer("owner@example.test");
    const stranger = await makeCustomer("stranger@example.test");
    const { order } = await createCatalogOrder(customerCookies(owner));
    const res = await patchOrder(
      patch(`/api/orders/${order.orderCode}`, { action: "cancel", by: "CUSTOMER" }, { cookies: customerCookies(stranger) }),
      params({ id: order.orderCode })
    );
    expect(res.status).toBe(401);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_DEPOSIT");
  });

  it("chủ đơn hủy đơn chưa thanh toán: hoàn kho, ghi tracking, không hủy lại được", async () => {
    const owner = await makeCustomer("owner@example.test");
    const { order, product } = await createCatalogOrder(customerCookies(owner), 2);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stockSlots).toBe(3);

    const call = () =>
      patchOrder(
        patch(`/api/orders/${order.orderCode}`, { action: "cancel", by: "CUSTOMER", reason: "Đổi ý" }, { cookies: customerCookies(owner) }),
        params({ id: order.orderCode })
      );
    const res = await call();
    expect(res.status).toBe(200);

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { trackingLogs: true } });
    expect(after.status).toBe("CANCELLED");
    expect(after.reservationReleasedAt).not.toBeNull();
    expect(after.reservationExpiresAt).toBeNull();
    expect(after.trackingLogs).toHaveLength(2);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stockSlots).toBe(5);

    const again = await call();
    expect(again.status).toBe(400); // đã hủy, không hoàn kho lần hai
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stockSlots).toBe(5);
  });

  it("khách chỉ được hủy: không tự đổi trạng thái sang bước mua hàng", async () => {
    const owner = await makeCustomer("owner@example.test");
    const { order } = await createCatalogOrder(customerCookies(owner));
    const res = await patchOrder(
      patch(`/api/orders/${order.orderCode}`, { status: "PURCHASING_JP" }, { cookies: customerCookies(owner) }),
      params({ id: order.orderCode })
    );
    expect(res.status).toBe(401);
  });

  it("khách không hủy được đơn đã thanh toán", async () => {
    const owner = await makeCustomer("owner@example.test");
    const { order } = await createCatalogOrder(customerCookies(owner));
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "DEPOSITED_50" } });
    const res = await patchOrder(
      patch(`/api/orders/${order.orderCode}`, { action: "cancel", by: "CUSTOMER" }, { cookies: customerCookies(owner) }),
      params({ id: order.orderCode })
    );
    expect(res.status).toBe(409);
  });

  it("admin không nhảy cóc trạng thái và không chuyển sang mua hàng khi chưa nhận cọc", async () => {
    await makeAdmin("admin");
    const o = await makeOrder();
    const cookies = adminCookies("admin");
    const skip = await patchOrder(patch(`/api/orders/${o.orderCode}`, { status: "IN_TRANSIT_AIR" }, { cookies }), params({ id: o.orderCode }));
    expect(skip.status).toBe(409);
    const unpaid = await patchOrder(patch(`/api/orders/${o.orderCode}`, { status: "PURCHASING_JP" }, { cookies }), params({ id: o.orderCode }));
    expect(unpaid.status).toBe(409);
  });

  it("admin không tự ý đổi trạng thái thanh toán ngoài thao tác hoàn tiền khi hủy", async () => {
    await makeAdmin("admin");
    const o = await makeOrder();
    const res = await patchOrder(
      patch(`/api/orders/${o.orderCode}`, { paymentStatus: "PAID_100" }, { cookies: adminCookies("admin") }),
      params({ id: o.orderCode })
    );
    expect(res.status).toBe(400);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).paymentStatus).toBe("UNPAID");
  });

  it("admin duyệt giá đơn ngoài catalog: tính lại giá ở server và ghi audit log", async () => {
    await makeAdmin("admin");
    const o = await makeOrder({ isPriceVerified: false, priceVerifiedAt: null, reservationExpiresAt: null, priceJpy: 1, productPriceVnd: 170, serviceFeeVnd: 20_000, shippingFeeVnd: 0, totalVnd: 20_170, depositAmountVnd: 10_085 });
    const res = await patchOrder(
      patch(`/api/orders/${o.orderCode}`, { isPriceVerified: true, priceJpy: 10_000, weightKg: 0.5 }, { cookies: adminCookies("admin") }),
      params({ id: o.orderCode })
    );
    expect(res.status).toBe(200);
    const after = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(after.isPriceVerified).toBe(true);
    expect(after.productPriceVnd).toBe(1_700_000); // 10.000¥ × tỷ giá đã chốt trên đơn (170)
    expect(after.serviceFeeVnd).toBe(102_000); // 6% của 1.700.000 = 102.000 đ (> 80.000 đ)
    expect(after.shippingFeeVnd).toBe(92_500);
    expect(after.totalVnd).toBe(1_894_500);
    expect(after.depositAmountVnd).toBe(901_000);

    const audit = await prisma.auditLog.findFirst({ where: { action: "ORDER_PRICE_APPROVED", entityId: o.orderCode } });
    expect(audit?.actor).toBe("admin");
  });

  it("không thể đổi báo giá sau khi đơn đã thanh toán", async () => {
    await makeAdmin("admin");
    const o = await makeOrder({ paymentStatus: "DEPOSITED_50" });
    const res = await patchOrder(
      patch(`/api/orders/${o.orderCode}`, { isPriceVerified: true, priceJpy: 99_999, weightKg: 1 }, { cookies: adminCookies("admin") }),
      params({ id: o.orderCode })
    );
    expect(res.status).toBe(409);
  });
});
