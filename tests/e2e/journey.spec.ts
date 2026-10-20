import { expect, test } from "@playwright/test";
import { prisma, resetDb, disconnectDb } from "../helpers/db";
import { PASSWORD, makeAdmin, makeProduct, orderPayload } from "../helpers/factories";
import { api } from "../helpers/http";
import { ipnPath } from "../helpers/vnpay";

// Hành trình đầy đủ qua HTTP trên server production thật + PostgreSQL:
// catalog → đặt hàng → tra cứu → thanh toán → xử lý đơn → hoàn tất, cùng các kịch bản bảo mật.

test.describe.configure({ mode: "serial" });

let productId = "";
let adminCookie = "";

test.beforeAll(async () => {
  await resetDb();
  await makeAdmin("admin", "SUPER_ADMIN", PASSWORD);
  productId = (await makeProduct({ name: "Kem dưỡng test", stockSlots: 5, priceJpy: 3000, weightKg: 0.4 })).id;
});

test.afterAll(async () => {
  await resetDb();
  await disconnectDb();
});

test("đăng nhập admin lấy cookie phiên", async () => {
  const res = await api.post("/api/admin/auth", { username: "admin", password: PASSWORD }, { headers: { "x-forwarded-for": "10.1.1.1" } });
  expect(res.status).toBe(200);
  adminCookie = res.cookie;
  expect(adminCookie).toContain("chillbanana_admin_session=");
});

test("khách vãng lai đi hết vòng đời đơn hàng", async () => {
  // 1. Catalog có sản phẩm, giá theo tỷ giá cố định của môi trường test
  const catalog = (await api.get("/api/products")).data;
  expect(catalog.exchangeRate).toBe(170);
  expect(catalog.products.map((p: { id: string }) => p.id)).toContain(productId);

  // 2. Đặt hàng
  const created = await api.post("/api/orders", orderPayload([{ id: productId, quantity: 2 }]));
  expect(created.status).toBe(200);
  const order = created.data.order;
  expect(order.totalVnd).toBe(1_208_800);
  const guest = created.cookie;
  expect(guest).toContain("cb_order_access=");

  // 3. Tra cứu: có cookie thì xem được, không có thì 404
  const mine = await api.get(`/api/orders/${order.orderCode}`, { cookie: guest });
  expect(mine.status).toBe(200);
  expect(mine.data.order.status).toBe("PENDING_DEPOSIT");
  expect((await api.get(`/api/orders/${order.orderCode}`)).status).toBe(404);

  // 4. Chưa nhận cọc thì admin không được chuyển sang mua hàng
  expect((await api.patch(`/api/orders/${order.orderCode}`, { status: "PURCHASING_JP" }, { cookie: adminCookie })).status).toBe(409);

  // 5. Admin ghi nhận chuyển khoản
  const paid = await api.post(`/api/admin/orders/${order.orderCode}/payments`, { amountVnd: 530_400, reference: "FT26101500999" }, { cookie: adminCookie });
  expect(paid.status).toBe(200);
  expect((await api.get(`/api/orders/${order.orderCode}`, { cookie: guest })).data.order.paymentStatus).toBe("DEPOSITED_50");

  // 6. Đi qua từng bước quy trình đến hoàn tất
  const flow = ["PURCHASING_JP", "WAREHOUSE_JP", "IN_TRANSIT_AIR", "WAREHOUSE_VN", "LOCAL_DELIVERY", "COMPLETED"];
  for (const status of flow) {
    const res = await api.patch(`/api/orders/${order.orderCode}`, { status }, { cookie: adminCookie });
    expect(res.status, `chuyển sang ${status}`).toBe(200);
  }
  const done = (await api.get(`/api/orders/${order.orderCode}`, { cookie: guest })).data.order;
  expect(done.status).toBe("COMPLETED");
  // Log: 1 khi tạo đơn + 1 khi admin ghi nhận chuyển khoản + 1 cho mỗi bước chuyển trạng thái.
  expect(done.trackingLogs.length).toBe(2 + flow.length);
  expect(done.trackingLogs.map((l: { title: string }) => l.title)).toContain("Đã ghi nhận tiền cọc 50%");

  // 7. Đơn đã hoàn tất không sửa được nữa
  expect((await api.patch(`/api/orders/${order.orderCode}`, { status: "PURCHASING_JP" }, { cookie: adminCookie })).status).toBe(400);

  // 8. Có dấu vết kiểm toán
  const actions = (await prisma.auditLog.findMany({ select: { action: true } })).map((a) => a.action);
  expect(actions).toContain("ADMIN_LOGIN");
  expect(actions).toContain("ORDER_PAYMENT_RECORDED");
  expect(actions).toContain("ORDER_UPDATED");
});

test("VNPAY sandbox: ghi nhận kịch bản nhưng giữ nguyên thanh toán và trạng thái đơn", async () => {
  const orderRes = await api.post("/api/orders", orderPayload([{ id: productId, quantity: 2 }], { paymentMethod: "VNPAY" }));
  const order = orderRes.data.order;
  const guest = orderRes.cookie;

  const pay = await api.post("/api/payment/vnpay-create", { orderCode: order.orderCode }, { cookie: guest });
  expect(pay.status).toBe(200);
  const url = new URL(pay.data.paymentUrl);
  expect(url.searchParams.get("vnp_Amount")).toBe(String(order.depositAmountVnd * 100));

  const path = ipnPath({ orderCode: order.orderCode, amountVnd: order.depositAmountVnd, txnNo: "E2E-1" });
  expect((await api.get(path)).data.RspCode).toBe("00");
  expect((await api.get(path)).data.RspCode).toBe("02"); // gửi lại
  const forged = path.replace(/vnp_SecureHash=[a-f0-9]+/, "vnp_SecureHash=" + "0".repeat(128));
  expect((await api.get(forged)).data.RspCode).toBe("97");

  const row = await prisma.order.findUniqueOrThrow({ where: { orderCode: order.orderCode }, include: { paymentTransactions: true } });
  expect(row.paymentStatus).toBe("UNPAID");
  expect(row.status).toBe("PENDING_DEPOSIT");
  expect(row.paymentTransactions).toHaveLength(0);
  expect((await prisma.paymentAttempt.findFirstOrThrow({ where: { orderId: row.id } })).status).toBe("CONFIRMED");
});

test("hết hàng: hai yêu cầu đồng thời vào suất cuối, chỉ một thành công", async () => {
  const last = await makeProduct({ name: "Suất cuối", stockSlots: 1 });
  const results = await Promise.all(
    ["a", "b"].map((who) => api.post("/api/orders", orderPayload([{ id: last.id, quantity: 1 }], { customerEmail: `${who}@example.test` })))
  );
  expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
  expect((await prisma.product.findUniqueOrThrow({ where: { id: last.id } })).stockSlots).toBe(0);
});

test("admin hủy đơn chưa thanh toán thì hoàn kho", async () => {
  const p = await makeProduct({ stockSlots: 4 });
  const { order } = (await api.post("/api/orders", orderPayload([{ id: p.id, quantity: 2 }]))).data;
  expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stockSlots).toBe(2);
  const cancel = await api.patch(`/api/orders/${order.orderCode}`, { action: "cancel", by: "ADMIN", reason: "Test" }, { cookie: adminCookie });
  expect(cancel.status).toBe(200);
  expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stockSlots).toBe(4);
});

test.describe("bảo mật qua HTTP", () => {
  test("API quản trị và danh sách đơn từ chối người chưa đăng nhập", async () => {
    for (const path of ["/api/orders", "/api/admin/customers", "/api/admin/reports", "/api/admin/api-keys", "/api/analytics/chats"]) {
      expect((await api.get(path)).status, path).toBe(401);
    }
    expect((await api.post("/api/products", { name: "x" })).status).toBe(401);
  });

  test("cron cần CRON_SECRET", async () => {
    expect((await api.get("/api/cron/expire-order-reservations")).status).toBe(401);
    const ok = await api.get("/api/cron/expire-order-reservations", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(ok.status).toBe(200);
  });

  test("đăng nhập admin sai nhiều lần thì bị khóa (429)", async () => {
    const headers = { "x-forwarded-for": "10.9.9.9" };
    for (let i = 0; i < 5; i++) {
      expect((await api.post("/api/admin/auth", { username: "admin", password: "sai" }, { headers })).status).toBe(401);
    }
    expect((await api.post("/api/admin/auth", { username: "admin", password: PASSWORD }, { headers })).status).toBe(429);
  });
});
