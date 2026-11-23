import { describe, expect, it, vi } from "vitest";
import { fetchLiveExchangeRate } from "@/features/pricing/exchange-rate";
import { POST, GET } from "@/app/api/orders/route";
import { prisma } from "../helpers/db";
import { cookieFrom, get, json, post } from "../helpers/request";
import { adminCookies, customerCookies, makeAdmin, makeCustomer, makeProduct, orderPayload } from "../helpers/factories";
import { freshRate, staleRate } from "../helpers/rate";
import { sendOrderCreatedEmail } from "@/lib/mailer";

describe("POST /api/orders: đơn catalog", () => {
  it("tạo đơn hợp lệ, tính giá ở server và trừ tồn kho", async () => {
    const product = await makeProduct({ priceJpy: 3000, weightKg: 0.4, stockSlots: 5 });
    const res = await POST(post("/api/orders", orderPayload([{ id: product.id, quantity: 2 }])));
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    const order = body.order;
    // 6000¥ × 170 = 1.020.000; phí 4% = 40.800 -> sàn 80.000 đ; cước 0,8kg × 185.000 = 148.000
    expect(order.priceJpy).toBe(6000);
    expect(order.exchangeRate).toBe(170);
    expect(order.productPriceVnd).toBe(1_020_000);
    expect(order.serviceFeeVnd).toBe(80_000);
    expect(order.shippingFeeVnd).toBe(148_000);
    expect(order.totalVnd).toBe(1_248_000);
    expect(order.depositAmountVnd).toBe(770_000); // 70% của (1.020.000 + 80.000)
    expect(order.paymentStatus).toBe("UNPAID");
    expect(order.status).toBe("PENDING_DEPOSIT");
    expect(order.isPriceVerified).toBe(true);
    expect(order.orderItems).toHaveLength(1);
    expect(order.trackingLogs).toHaveLength(1);

    const msLeft = new Date(order.reservationExpiresAt).getTime() - Date.now();
    expect(msLeft).toBeGreaterThan(29 * 60_000);
    expect(msLeft).toBeLessThanOrEqual(30 * 60_000);

    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stockSlots).toBe(3);
    expect(cookieFrom(res, "cb_order_access")).toBeTruthy(); // khách vãng lai nhận quyền truy cập đơn
    expect(sendOrderCreatedEmail).toHaveBeenCalledTimes(1);
  });

  it("đặt cọc 100% thì số tiền cọc bằng tiền hàng + phí", async () => {
    const product = await makeProduct();
    const res = await POST(post("/api/orders", orderPayload([{ id: product.id, quantity: 2 }], { depositPercent: 100 })));
    const { order } = await json(res);
    expect(res.status).toBe(200);
    expect(order.depositAmountVnd).toBe(1_100_000);
    expect(order.depositPercent).toBe(100);
  });

  it("bỏ qua giá/tỷ giá do client gửi lên", async () => {
    const product = await makeProduct({ priceJpy: 3000 });
    const res = await POST(
      post("/api/orders", {
        ...orderPayload([{ id: product.id, quantity: 2 }]),
        priceJpy: 1,
        exchangeRate: 1,
        totalVnd: 1,
        depositAmountVnd: 1,
      })
    );
    const { order } = await json(res);
    expect(res.status).toBe(200);
    expect(order.priceJpy).toBe(6000);
    expect(order.exchangeRate).toBe(170);
    expect(order.totalVnd).toBe(1_248_000);
  });

  it("từ chối khi hết tồn kho và không thay đổi dữ liệu", async () => {
    const product = await makeProduct({ stockSlots: 1 });
    const res = await POST(post("/api/orders", orderPayload([{ id: product.id, quantity: 2 }])));
    expect(res.status).toBe(400);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stockSlots).toBe(1);
    expect(await prisma.order.count()).toBe(0);
  });

  it("hai người tranh nhau suất cuối: đúng một đơn thành công, tồn kho không âm", async () => {
    const product = await makeProduct({ stockSlots: 1 });
    const [a, b] = await Promise.all([
      POST(post("/api/orders", orderPayload([{ id: product.id, quantity: 1 }], { customerEmail: "a@example.test" }))),
      POST(post("/api/orders", orderPayload([{ id: product.id, quantity: 1 }], { customerEmail: "b@example.test" }))),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 400]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stockSlots).toBe(0);
    expect(await prisma.order.count()).toBe(1);
  });

  it("20 yêu cầu đồng thời vào 5 suất: chỉ 5 đơn thành công", async () => {
    const product = await makeProduct({ stockSlots: 5 });
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        POST(post("/api/orders", orderPayload([{ id: product.id, quantity: 1 }], { customerEmail: `u${i}@example.test` })))
      )
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(5);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stockSlots).toBe(0);
    expect(await prisma.order.count()).toBe(5);
  });

  it("từ chối khi tỷ giá không còn mới (stale) và không trừ tồn kho", async () => {
    vi.mocked(fetchLiveExchangeRate).mockResolvedValue(staleRate());
    const product = await makeProduct({ stockSlots: 5 });
    const res = await POST(post("/api/orders", orderPayload([{ id: product.id, quantity: 1 }])));
    expect(res.status).toBe(503);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stockSlots).toBe(5);
    expect(await prisma.order.count()).toBe(0);
  });

  it("dùng đúng tỷ giá hiện tại và lưu lại trên đơn", async () => {
    vi.mocked(fetchLiveExchangeRate).mockResolvedValue(freshRate(160));
    const product = await makeProduct({ priceJpy: 5000, weightKg: 0.5 });
    const { order } = await json(await POST(post("/api/orders", orderPayload([{ id: product.id, quantity: 1 }]))));
    expect(order.exchangeRate).toBe(160);
    expect(order.productPriceVnd).toBe(800_000);
  });

  it("từ chối đơn dưới mức tối thiểu 300.000đ và hoàn lại tồn kho (rollback)", async () => {
    const product = await makeProduct({ priceJpy: 1000, stockSlots: 5 }); // 170.000 + phí 20.000
    const res = await POST(post("/api/orders", orderPayload([{ id: product.id, quantity: 1 }])));
    expect(res.status).toBe(400);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stockSlots).toBe(5);
    expect(await prisma.order.count()).toBe(0);
  });

  it("từ chối tổng giá dưới 100¥ và rollback tồn kho", async () => {
    const product = await makeProduct({ priceJpy: 50, stockSlots: 5 });
    const res = await POST(post("/api/orders", orderPayload([{ id: product.id, quantity: 1 }])));
    expect(res.status).toBe(400);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stockSlots).toBe(5);
  });

  it.each([
    ["depositPercent không hợp lệ", { depositPercent: 30 }],
    ["thiếu tên khách", { customerName: "" }],
    ["số điện thoại quá ngắn", { customerPhone: "123" }],
    ["email sai định dạng", { customerEmail: "khong-phai-email" }],
    ["tên sản phẩm quá dài", { productName: "x".repeat(201) }],
    ["gửi từ Việt Nam sang Nhật", { direction: "VN_TO_JP" }],
    ["isGroupBuy không phải boolean", { isGroupBuy: "yes" }],
  ])("trả 400 khi %s", async (_label, over) => {
    const product = await makeProduct();
    const res = await POST(post("/api/orders", orderPayload([{ id: product.id, quantity: 1 }], over)));
    expect(res.status).toBe(400);
    expect(await prisma.order.count()).toBe(0);
  });

  it.each([0, -1, 100, 1.5, "abc"])("trả 400 khi số lượng = %s", async (quantity) => {
    const product = await makeProduct();
    const res = await POST(post("/api/orders", orderPayload([{ id: product.id, quantity: quantity as number }])));
    expect(res.status).toBe(400);
  });

  it("khách đã đăng nhập: đơn gắn với tài khoản và không phát cookie khách vãng lai", async () => {
    const customer = await makeCustomer("member@example.test");
    const product = await makeProduct();
    const res = await POST(
      post("/api/orders", orderPayload([{ id: product.id, quantity: 2 }], { customerEmail: "khac@example.test" }), {
        cookies: customerCookies(customer),
      })
    );
    const { order } = await json(res);
    expect(res.status).toBe(200);
    expect(order.customerId).toBe(customer.id);
    expect(order.customerType).toBe("REGISTERED");
    expect(order.customerEmail).toBe("member@example.test"); // lấy từ phiên, không tin email gửi lên
    expect(cookieFrom(res, "cb_order_access")).toBeUndefined();
  });
});

describe("POST /api/orders: đơn mua hộ từ link ngoài", () => {
  const external = (over: Record<string, unknown> = {}) => ({
    customerName: "Nguyễn Văn Test",
    customerPhone: "0901234567",
    customerAddress: "1 Đường Test, TP.HCM",
    customerEmail: "guest@example.test",
    productName: "Hàng ngoài catalog",
    originalUrl: "https://www.amazon.co.jp/dp/B000TEST",
    items: [{ id: "calc-1", name: "Hàng ngoài", priceJpy: 10_000, weightKg: 0.5, quantity: 1 }],
    ...over,
  });

  it("nhận link sàn được hỗ trợ; đơn chờ admin duyệt giá và không giữ hàng", async () => {
    const res = await POST(post("/api/orders", external()));
    const { order } = await json(res);
    expect(res.status).toBe(200);
    expect(order.isPriceVerified).toBe(false);
    expect(order.reservationExpiresAt).toBeNull();
    expect(order.orderItems[0].itemType).toBe("EXTERNAL");
    expect(order.productPriceVnd).toBe(1_700_000);
  });

  it.each([
    "https://evil-amazon.co.jp/dp/1",
    "https://notamazon.co.jp/dp/1",
    "https://amazon.co.jp.evil.com/dp/1",
    "http://localhost/admin",
    "https://127.0.0.1/x",
    "https://192.168.1.10/x",
    "https://10.0.0.5/x",
    "https://metadata.internal/x",
    "khong-phai-url",
  ])("từ chối link không hợp lệ: %s", async (originalUrl) => {
    const res = await POST(post("/api/orders", external({ originalUrl })));
    expect(res.status).toBe(400);
    expect(await prisma.order.count()).toBe(0);
  });

  it("từ chối khi thiếu link", async () => {
    const res = await POST(post("/api/orders", external({ originalUrl: "" })));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/orders: danh sách đơn", () => {
  it("chưa đăng nhập thì 401", async () => {
    expect((await GET(get("/api/orders"))).status).toBe(401);
  });

  it("khách chỉ thấy đơn của mình; admin thấy tất cả", async () => {
    const alice = await makeCustomer("alice@example.test");
    const bob = await makeCustomer("bob@example.test");
    const product = await makeProduct({ stockSlots: 10 });
    for (const c of [alice, alice, bob]) {
      await POST(post("/api/orders", orderPayload([{ id: product.id, quantity: 2 }]), { cookies: customerCookies(c) }));
    }
    const aliceRes = await json(await GET(get("/api/orders", { cookies: customerCookies(alice) })));
    expect(aliceRes.orders).toHaveLength(2);
    expect(aliceRes.orders.every((o: any) => o.customerId === alice.id)).toBe(true);

    await makeAdmin("admin");
    const adminRes = await json(await GET(get("/api/orders", { cookies: adminCookies("admin") })));
    expect(adminRes.orders).toHaveLength(3);
  });
});
