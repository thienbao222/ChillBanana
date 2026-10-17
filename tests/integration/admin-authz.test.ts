import { describe, expect, it } from "vitest";
import * as customers from "@/app/api/admin/customers/route";
import * as reports from "@/app/api/admin/reports/route";
import * as funnel from "@/app/api/admin/funnel/route";
import * as chatTrends from "@/app/api/admin/chat-trends/route";
import * as apiKeys from "@/app/api/admin/api-keys/route";
import * as auditLogs from "@/app/api/admin/audit-logs/route";
import * as assistant from "@/app/api/admin/assistant/route";
import * as dailyInsights from "@/app/api/admin/daily-insights/route";
import * as purchaseTasks from "@/app/api/admin/purchase-tasks/route";
import * as purchaseTaskById from "@/app/api/admin/purchase-tasks/[id]/route";
import * as purchaseOrders from "@/app/api/admin/purchase-tasks/orders/route";
import * as stitchAll from "@/app/api/admin/stitch-all/route";
import * as payments from "@/app/api/admin/orders/[id]/payments/route";
import * as analyticsChats from "@/app/api/analytics/chats/route";
import * as products from "@/app/api/products/route";
import * as profile from "@/app/api/customer/profile/route";
import { prisma } from "../helpers/db";
import { adminCookies, customerCookies, makeAdmin, makeCustomer, makeOrder, makeProduct } from "../helpers/factories";
import { del, get, json, params, patch, post, put } from "../helpers/request";

type Call = () => Promise<Response>;

// Mỗi mục: một lệnh gọi KHÔNG kèm cookie. Mọi mục phải bị từ chối.
const anonymous: [string, Call][] = [
  ["GET /api/admin/customers", () => customers.GET(get("/api/admin/customers"))],
  ["GET /api/admin/reports", () => reports.GET(get("/api/admin/reports"))],
  ["GET /api/admin/funnel", () => funnel.GET(get("/api/admin/funnel"))],
  ["GET /api/admin/chat-trends", () => chatTrends.GET(get("/api/admin/chat-trends"))],
  ["GET /api/admin/api-keys", () => apiKeys.GET(get("/api/admin/api-keys"))],
  ["GET /api/admin/audit-logs", () => auditLogs.GET(get("/api/admin/audit-logs"))],
  ["POST /api/admin/assistant", () => assistant.POST(post("/api/admin/assistant", { message: "hi" }))],
  ["GET /api/admin/daily-insights", () => dailyInsights.GET(get("/api/admin/daily-insights"))],
  ["POST /api/admin/daily-insights", () => dailyInsights.POST(post("/api/admin/daily-insights", {}))],
  ["GET /api/admin/purchase-tasks", () => purchaseTasks.GET(get("/api/admin/purchase-tasks"))],
  ["POST /api/admin/purchase-tasks", () => purchaseTasks.POST(post("/api/admin/purchase-tasks", {}))],
  ["PATCH /api/admin/purchase-tasks/[id]", () => purchaseTaskById.PATCH(patch("/api/admin/purchase-tasks/x", {}), params({ id: "x" }))],
  ["GET /api/admin/purchase-tasks/orders", () => purchaseOrders.GET(get("/api/admin/purchase-tasks/orders"))],
  ["POST /api/admin/stitch-all", () => stitchAll.POST(post("/api/admin/stitch-all", {}))],
  ["POST /api/admin/orders/[id]/payments", () => payments.POST(post("/api/admin/orders/x/payments", { amountVnd: 1, reference: "abcd" }), params({ id: "x" }))],
  ["GET /api/analytics/chats", () => analyticsChats.GET(get("/api/analytics/chats"))],
  ["POST /api/products", () => products.POST(post("/api/products", { name: "x" }))],
  ["PUT /api/products", () => products.PUT(put("/api/products", { id: "x", name: "y" }))],
  ["DELETE /api/products", () => products.DELETE(del("/api/products?id=x"))],
];

describe("route quản trị: không có cookie thì bị từ chối", () => {
  it.each(anonymous)("%s", async (_name, call) => {
    const res = await call();
    expect([401, 403]).toContain(res.status);
  });
});

describe("cookie không phải của admin không mở được route quản trị", () => {
  it("token khách hàng không có quyền admin", async () => {
    const c = await makeCustomer("khach@example.test");
    const res = await apiKeys.GET(get("/api/admin/api-keys", { cookies: customerCookies(c) }));
    expect(res.status).toBe(401);
    const res2 = await products.POST(post("/api/products", { name: "x" }, { cookies: customerCookies(c) }));
    expect(res2.status).toBe(401);
  });
});

describe("phân quyền theo vai trò (requireAdmin)", () => {
  it("SUPER_ADMIN truy cập được api-keys", async () => {
    await makeAdmin("boss", "SUPER_ADMIN");
    expect((await apiKeys.GET(get("/api/admin/api-keys", { cookies: adminCookies("boss") }))).status).toBe(200);
  });

  it("OPERATOR bị từ chối (403) ở api-keys và stitch-all", async () => {
    await makeAdmin("nhanvien", "OPERATOR");
    const cookies = adminCookies("nhanvien");
    expect((await apiKeys.GET(get("/api/admin/api-keys", { cookies }))).status).toBe(403);
    expect((await stitchAll.POST(post("/api/admin/stitch-all", {}, { cookies }))).status).toBe(403);
    expect((await auditLogs.GET(get("/api/admin/audit-logs", { cookies }))).status).toBe(403);
  });

  it("SUPER_ADMIN xem nhật ký nhưng API không trả metadata hoặc IP", async () => {
    await makeAdmin("boss", "SUPER_ADMIN");
    await prisma.auditLog.create({
      data: { actor: "boss", action: "TEST_AUDIT", summary: "Bản ghi kiểm tra", metadata: { internal: "secret" }, ip: "203.0.113.10" },
    });
    await prisma.auditLog.create({ data: { actor: "boss", action: "OTHER_EVENT", summary: "Không khớp bộ lọc" } });

    const response = await auditLogs.GET(get("/api/admin/audit-logs?action=TEST_AUDIT", { cookies: adminCookies("boss") }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.logs[0]).toMatchObject({ actor: "boss", action: "TEST_AUDIT", summary: "Bản ghi kiểm tra" });
    expect(data.logs[0]).not.toHaveProperty("metadata");
    expect(data.logs[0]).not.toHaveProperty("ip");
    expect(data.pagination.total).toBe(1);
  });

  it("tài khoản admin đã bị xóa khỏi DB thì cookie cũ mất hiệu lực ngay", async () => {
    const a = await makeAdmin("tam", "SUPER_ADMIN");
    const cookies = adminCookies("tam");
    expect((await apiKeys.GET(get("/api/admin/api-keys", { cookies }))).status).toBe(200);
    await prisma.adminUser.delete({ where: { id: a.id } });
    expect((await apiKeys.GET(get("/api/admin/api-keys", { cookies }))).status).toBe(401);
  });
});

describe("ghi nhận chuyển khoản thủ công", () => {
  it("ghi nhận đúng số tiền, lưu người xác nhận và audit log; không ghi nhận hai lần", async () => {
    await makeAdmin("ketoan", "OPERATOR");
    const o = await makeOrder();
    const cookies = adminCookies("ketoan");
    const call = (amountVnd: number, reference = "FT26101500123") =>
      payments.POST(post(`/api/admin/orders/${o.orderCode}/payments`, { amountVnd, reference }, { cookies }), params({ id: o.orderCode }));

    expect((await call(1_000)).status).toBe(400); // sai số tiền
    const ok = await call(530_400);
    expect(ok.status).toBe(200);

    const tx = await prisma.paymentTransaction.findFirstOrThrow({ where: { orderId: o.id } });
    expect(tx).toMatchObject({ provider: "MANUAL_BANK_TRANSFER", amountVnd: 530_400, confirmedByAdmin: "ketoan" });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).paymentStatus).toBe("DEPOSITED_50");
    expect(await prisma.auditLog.count({ where: { action: "ORDER_PAYMENT_RECORDED", actor: "ketoan" } })).toBe(1);

    expect((await call(530_400, "FT26101500124")).status).toBe(409); // đã ghi nhận
    expect(await prisma.paymentTransaction.count()).toBe(1);
  });

  it("từ chối mã tham chiếu quá ngắn", async () => {
    await makeAdmin("ketoan");
    const o = await makeOrder();
    const res = await payments.POST(
      post(`/api/admin/orders/${o.orderCode}/payments`, { amountVnd: 530_400, reference: "ab" }, { cookies: adminCookies("ketoan") }),
      params({ id: o.orderCode })
    );
    expect(res.status).toBe(400);
  });
});

describe("quản lý sản phẩm (admin) và audit log", () => {
  it("tạo, sửa, xóa sản phẩm đều được ghi audit log", async () => {
    await makeAdmin("admin");
    const cookies = adminCookies("admin");
    const created = await products.POST(post("/api/products", { name: "Sản phẩm mới", priceJpy: 3000, weightKg: 0.4, stockSlots: 4, category: "cosmetics" }, { cookies }));
    expect(created.status).toBe(201);
    const id = (await json(created)).product.id as string;

    expect((await products.PUT(put("/api/products", { id, name: "Tên mới", stockSlots: 9 }, { cookies }))).status).toBe(200);
    expect((await prisma.product.findUniqueOrThrow({ where: { id } })).stockSlots).toBe(9);
    expect((await products.DELETE(del(`/api/products?id=${id}`, { cookies }))).status).toBe(200);

    const actions = (await prisma.auditLog.findMany({ where: { entityId: id }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["PRODUCT_CREATE", "PRODUCT_UPDATE", "PRODUCT_DELETE"]);
  });

  it("danh sách sản phẩm công khai dùng tỷ giá hiện tại", async () => {
    await makeProduct({ priceJpy: 1000 });
    const body = await json(await products.GET(get("/api/products")));
    expect(body.exchangeRate).toBe(170);
    expect(body.products[0].priceVnd).toBe(170_000);
  });
});

describe("hồ sơ khách hàng", () => {
  it("chưa đăng nhập thì không xem được hồ sơ", async () => {
    expect((await profile.GET(get("/api/customer/profile"))).status).toBe(401);
  });

  it("hồ sơ không lộ passwordHash", async () => {
    const c = await makeCustomer("khach@example.test");
    const res = await profile.GET(get("/api/customer/profile", { cookies: customerCookies(c) }));
    const body = await json(res);
    expect(res.status).toBe(200);
    expect(body.profile.email).toBe("khach@example.test");
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expect(JSON.stringify(body)).not.toContain("scrypt$");
  });
});
