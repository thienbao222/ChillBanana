import { describe, expect, it } from "vitest";
import { GET as expire } from "@/app/api/cron/expire-order-reservations/route";
import { GET as autoTracking } from "@/app/api/cron/auto-tracking/route";
import { prisma } from "../helpers/db";
import { get, json } from "../helpers/request";
import { makeOrder, makeProduct } from "../helpers/factories";

const authed = { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } };

async function orderWithItem(over: Record<string, unknown>, quantity = 2) {
  const product = await makeProduct({ stockSlots: 3 }); // 3 còn lại sau khi đơn đã giữ 2
  const order = await makeOrder(over);
  await prisma.orderItem.create({
    data: { orderId: order.id, productId: product.id, itemType: "CATALOG", productName: product.name, quantity, priceJpy: 3000, weightKg: 0.4 },
  });
  return { product, order };
}

describe("cron hết hạn giữ hàng", () => {
  it("không có CRON_SECRET thì 503; sai secret thì 401; thiếu header thì 401", async () => {
    const saved = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    expect((await expire(get("/api/cron/expire-order-reservations"))).status).toBe(503);
    process.env.CRON_SECRET = saved;
    expect((await expire(get("/api/cron/expire-order-reservations"))).status).toBe(401);
    expect((await expire(get("/api/cron/expire-order-reservations", { headers: { authorization: "Bearer sai" } }))).status).toBe(401);
  });

  it("hủy đơn hết hạn, hoàn kho đúng một lần và ghi tracking", async () => {
    const { product, order } = await orderWithItem({ reservationExpiresAt: new Date(Date.now() - 60_000) });
    const res = await expire(get("/api/cron/expire-order-reservations", authed));
    const body = await json(res);
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ success: true, found: 1, released: 1, errors: 0 });

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { trackingLogs: true } });
    expect(after.status).toBe("CANCELLED");
    expect(after.reservationReleasedAt).not.toBeNull();
    expect(after.trackingLogs).toHaveLength(1);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stockSlots).toBe(5);

    // Chạy lần hai: không hoàn kho thêm.
    const again = await json(await expire(get("/api/cron/expire-order-reservations", authed)));
    expect(again.found).toBe(0);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stockSlots).toBe(5);
  });

  it("không đụng tới đơn chưa hết hạn hoặc đã thanh toán", async () => {
    const live = await orderWithItem({ reservationExpiresAt: new Date(Date.now() + 10 * 60_000) });
    const paid = await orderWithItem({ reservationExpiresAt: new Date(Date.now() - 60_000), paymentStatus: "DEPOSITED_50", status: "PURCHASING_JP" });
    const body = await json(await expire(get("/api/cron/expire-order-reservations", authed)));
    expect(body.found).toBe(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: live.order.id } })).status).toBe("PENDING_DEPOSIT");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: paid.order.id } })).status).toBe("PURCHASING_JP");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: paid.product.id } })).stockSlots).toBe(3);
  });

  it("hai lần chạy đồng thời vẫn chỉ hoàn kho một lần", async () => {
    const { product } = await orderWithItem({ reservationExpiresAt: new Date(Date.now() - 60_000) });
    await Promise.all([
      expire(get("/api/cron/expire-order-reservations", authed)),
      expire(get("/api/cron/expire-order-reservations", authed)),
    ]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stockSlots).toBe(5);
  });
});

describe("cron auto-tracking: xác thực", () => {
  it("từ chối khi thiếu hoặc sai CRON_SECRET", async () => {
    expect((await autoTracking(get("/api/cron/auto-tracking"))).status).toBe(401);
    expect((await autoTracking(get("/api/cron/auto-tracking", { headers: { authorization: "Bearer sai" } }))).status).toBe(401);
  });
});
