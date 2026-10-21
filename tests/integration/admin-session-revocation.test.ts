import { describe, expect, it } from "vitest";
import * as customers from "@/app/api/admin/customers/route";
import * as reports from "@/app/api/admin/reports/route";
import * as funnel from "@/app/api/admin/funnel/route";
import * as chatTrends from "@/app/api/admin/chat-trends/route";
import * as assistant from "@/app/api/admin/assistant/route";
import * as dailyInsights from "@/app/api/admin/daily-insights/route";
import * as purchaseTasks from "@/app/api/admin/purchase-tasks/route";
import * as purchaseTaskById from "@/app/api/admin/purchase-tasks/[id]/route";
import * as purchaseOrders from "@/app/api/admin/purchase-tasks/orders/route";
import * as analyticsChats from "@/app/api/analytics/chats/route";
import * as products from "@/app/api/products/route";
import * as orders from "@/app/api/orders/route";
import * as orderById from "@/app/api/orders/[id]/route";
import { prisma } from "../helpers/db";
import { adminCookies, makeAdmin, makeOrder } from "../helpers/factories";
import { del, get, params, patch, post, put } from "../helpers/request";

// Cookie phiên admin còn hạn nhưng tài khoản đã bị xóa khỏi database: mọi route quản trị phải từ chối ngay,
// không chỉ riêng một vài route (trước đây phần lớn route chỉ kiểm tra chữ ký cookie).
type Call = (cookies: Record<string, string>) => Promise<Response>;

const adminOnly: [string, Call][] = [
  ["GET /api/admin/customers", (cookies) => customers.GET(get("/api/admin/customers", { cookies }))],
  ["GET /api/admin/reports", (cookies) => reports.GET(get("/api/admin/reports", { cookies }))],
  ["GET /api/admin/funnel", (cookies) => funnel.GET(get("/api/admin/funnel", { cookies }))],
  ["GET /api/admin/chat-trends", (cookies) => chatTrends.GET(get("/api/admin/chat-trends", { cookies }))],
  ["POST /api/admin/assistant", (cookies) => assistant.POST(post("/api/admin/assistant", { message: "hi" }, { cookies }))],
  ["GET /api/admin/daily-insights", (cookies) => dailyInsights.GET(get("/api/admin/daily-insights", { cookies }))],
  ["POST /api/admin/daily-insights", (cookies) => dailyInsights.POST(post("/api/admin/daily-insights", {}, { cookies }))],
  ["GET /api/admin/purchase-tasks", (cookies) => purchaseTasks.GET(get("/api/admin/purchase-tasks", { cookies }))],
  ["POST /api/admin/purchase-tasks", (cookies) => purchaseTasks.POST(post("/api/admin/purchase-tasks", {}, { cookies }))],
  ["PATCH /api/admin/purchase-tasks/[id]", (cookies) => purchaseTaskById.PATCH(patch("/api/admin/purchase-tasks/x", {}, { cookies }), params({ id: "x" }))],
  ["GET /api/admin/purchase-tasks/orders", (cookies) => purchaseOrders.GET(get("/api/admin/purchase-tasks/orders", { cookies }))],
  ["GET /api/analytics/chats", (cookies) => analyticsChats.GET(get("/api/analytics/chats", { cookies }))],
  ["POST /api/products", (cookies) => products.POST(post("/api/products", { name: "x" }, { cookies }))],
  ["PUT /api/products", (cookies) => products.PUT(put("/api/products", { id: "x", name: "y" }, { cookies }))],
  ["DELETE /api/products", (cookies) => products.DELETE(del("/api/products?id=x", { cookies }))],
  ["GET /api/orders (danh sách toàn bộ đơn)", (cookies) => orders.GET(get("/api/orders", { cookies }))],
];

describe("cookie admin của tài khoản đã bị xóa mất hiệu lực trên mọi route quản trị", () => {
  it.each(adminOnly)("%s", async (_name, call) => {
    const res = await call(adminCookies("da-bi-xoa")); // cookie hợp lệ về chữ ký, không có dòng AdminUser
    expect(res.status).toBe(401);
  });

  it("xem chi tiết/sửa đơn bằng cookie admin đã bị xóa không được coi là admin", async () => {
    const o = await makeOrder();
    const cookies = adminCookies("da-bi-xoa");
    expect((await orderById.GET(get(`/api/orders/${o.orderCode}`, { cookies }), params({ id: o.orderCode }))).status).toBe(404);

    const res = await orderById.PATCH(patch(`/api/orders/${o.orderCode}`, { status: "PURCHASING_JP" }, { cookies }), params({ id: o.orderCode }));
    expect([401, 403, 404]).toContain(res.status);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("PENDING_DEPOSIT");
  });

  it("xóa admin giữa chừng: cùng một cookie đang dùng được thì ngay sau đó bị từ chối", async () => {
    const a = await makeAdmin("tam-thoi", "SUPER_ADMIN");
    const cookies = adminCookies("tam-thoi");
    expect((await customers.GET(get("/api/admin/customers", { cookies }))).status).toBe(200);
    expect((await funnel.GET(get("/api/admin/funnel", { cookies }))).status).toBe(200);
    await prisma.adminUser.delete({ where: { id: a.id } });
    expect((await customers.GET(get("/api/admin/customers", { cookies }))).status).toBe(401);
    expect((await funnel.GET(get("/api/admin/funnel", { cookies }))).status).toBe(401);
    expect((await orders.GET(get("/api/orders", { cookies }))).status).toBe(401);
  });

  it("admin còn tồn tại vẫn dùng được các route chung như trước", async () => {
    await makeAdmin("van-con");
    const cookies = adminCookies("van-con");
    expect((await orders.GET(get("/api/orders", { cookies }))).status).toBe(200);
    const o = await makeOrder();
    expect((await orderById.GET(get(`/api/orders/${o.orderCode}`, { cookies }), params({ id: o.orderCode }))).status).toBe(200);
  });
});
