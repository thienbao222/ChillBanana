import { describe, expect, it } from "vitest";
import { POST as createOrder } from "@/app/api/orders/route";
import * as adminPricing from "@/app/api/admin/pricing-config/route";
import { GET as publicPricing } from "@/app/api/pricing-config/route";
import { DEFAULT_PRICING_CONFIG } from "@/features/pricing/config";
import { getActivePricingConfig } from "@/features/pricing/config-store";
import { prisma } from "../helpers/db";
import { adminCookies, makeAdmin, makeProduct, orderPayload } from "../helpers/factories";
import { get, json, post } from "../helpers/request";

const place = async (productId: string, qty = 2, over: Record<string, unknown> = {}) => {
  const res = await createOrder(post("/api/orders", orderPayload([{ id: productId, quantity: qty }], over)));
  return { res, body: await json(res) };
};

const saveConfig = (cookies: Record<string, string>, over: Record<string, unknown> = {}) =>
  adminPricing.POST(post("/api/admin/pricing-config", { ...DEFAULT_PRICING_CONFIG, ...over }, { cookies }));

describe("cấu hình giá: đơn mới đổi theo, đơn cũ giữ nguyên", () => {
  it("chưa có cấu hình trong database thì dùng mặc định và vẫn lưu ảnh chụp giá", async () => {
    const p = await makeProduct({ priceJpy: 3000, weightKg: 0.4 });
    const { res, body } = await place(p.id);
    expect(res.status).toBe(200);
    expect(body.order.serviceFeeVnd).toBe(40_800);

    const snap = (await prisma.order.findUniqueOrThrow({ where: { id: body.order.id } })).pricingSnapshot as any;
    expect(snap.pricingConfigId).toBeNull();
    expect(snap.pricingConfigSource).toBe("default");
    expect(snap.config.serviceFeeRate).toBe(0.04);
    expect(snap.exchangeRate).toMatchObject({ value: 170, source: "test-fixed-rate" });
    expect(snap.breakdown).toMatchObject({ serviceFeeVnd: 40_800, totalVnd: 1_208_800, depositAmountVnd: 530_400 });
  });

  it("admin đổi phí dịch vụ: đơn mới tính theo phí mới, đơn cũ giữ snapshot cũ", async () => {
    await makeAdmin("boss", "SUPER_ADMIN");
    const cookies = adminCookies("boss");
    const p = await makeProduct({ priceJpy: 3000, weightKg: 0.4, stockSlots: 20 });

    const before = (await place(p.id)).body.order;
    expect(before.serviceFeeVnd).toBe(40_800); // 4%

    const saved = await saveConfig(cookies, { serviceFeeRate: 0.1, note: "Tăng phí quý 4" });
    expect(saved.status).toBe(200);

    const after = (await place(p.id)).body.order;
    expect(after.serviceFeeVnd).toBe(102_000); // 10% của 1.020.000
    expect(after.totalVnd).toBe(1_020_000 + 102_000 + 148_000);

    // Đơn cũ không đổi
    const oldRow = await prisma.order.findUniqueOrThrow({ where: { id: before.id } });
    expect(oldRow.serviceFeeVnd).toBe(40_800);
    expect((oldRow.pricingSnapshot as any).config.serviceFeeRate).toBe(0.04);
    const newRow = await prisma.order.findUniqueOrThrow({ where: { id: after.id } });
    expect((newRow.pricingSnapshot as any).config.serviceFeeRate).toBe(0.1);
    expect((newRow.pricingSnapshot as any).pricingConfigSource).toBe("database");
    expect((newRow.pricingSnapshot as any).pricingConfigId).toBeTruthy();
  });

  it("lưu lịch sử: mỗi lần lưu là một dòng mới, ghi người đổi, ghi chú và audit log", async () => {
    await makeAdmin("boss", "SUPER_ADMIN");
    const cookies = adminCookies("boss");
    await saveConfig(cookies, { serviceFeeRate: 0.05, note: "Lần 1" });
    await saveConfig(cookies, { serviceFeeRate: 0.06, note: "Lần 2" });

    const list = await json(await adminPricing.GET(get("/api/admin/pricing-config", { cookies })));
    expect(list.history).toHaveLength(2);
    expect(list.history.map((h: any) => h.note).sort()).toEqual(["Lần 1", "Lần 2"]);
    expect(list.history.every((h: any) => h.createdBy === "boss")).toBe(true);
    expect(list.active.serviceFeeRate).toBe(0.06);
    expect(list.active.source).toBe("database");

    const audits = await prisma.auditLog.findMany({ where: { action: "PRICING_CONFIG_CREATED" } });
    expect(audits).toHaveLength(2);
    expect((audits[0].metadata as any).before).toBeTruthy();
    expect((audits[0].metadata as any).after).toBeTruthy();
  });

  it("cấu hình có hiệu lực trong tương lai chưa được áp dụng", async () => {
    const future = new Date(Date.now() + 24 * 3600_000);
    await prisma.pricingConfig.create({ data: { ...DEFAULT_PRICING_CONFIG, serviceFeeRate: 0.2, effectiveFrom: future, createdBy: "boss" } });
    expect((await getActivePricingConfig()).values.serviceFeeRate).toBe(0.04);
    expect((await getActivePricingConfig(new Date(future.getTime() + 1000))).values.serviceFeeRate).toBe(0.2);
  });

  it("nhiều bản đã có hiệu lực thì lấy bản mới nhất theo ngày hiệu lực", async () => {
    const now = Date.now();
    await prisma.pricingConfig.create({ data: { ...DEFAULT_PRICING_CONFIG, serviceFeeRate: 0.07, effectiveFrom: new Date(now - 3 * 3600_000), createdBy: "a" } });
    await prisma.pricingConfig.create({ data: { ...DEFAULT_PRICING_CONFIG, serviceFeeRate: 0.08, effectiveFrom: new Date(now - 1 * 3600_000), createdBy: "a" } });
    expect((await getActivePricingConfig()).values.serviceFeeRate).toBe(0.08);
  });

  it("ngưỡng đơn tối thiểu và thời gian giữ hàng đọc từ cấu hình", async () => {
    await makeAdmin("boss", "SUPER_ADMIN");
    await saveConfig(adminCookies("boss"), { minOrderThresholdVnd: 2_000_000, reservationMinutes: 10 });
    const p = await makeProduct({ priceJpy: 3000, weightKg: 0.4, stockSlots: 20 });

    const low = await place(p.id, 2); // 1.060.800 < 2.000.000
    expect(low.res.status).toBe(400);
    expect(low.body.error).toContain("2.000.000");

    const ok = await place(p.id, 6); // 18.000¥ ×170 = 3.060.000 + phí
    expect(ok.res.status).toBe(200);
    const row = await prisma.order.findUniqueOrThrow({ where: { id: ok.body.order.id } });
    const minutes = (row.reservationExpiresAt!.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(9);
    expect(minutes).toBeLessThanOrEqual(10);
  });

  it("API công khai trả cấu hình đang áp dụng để giao diện ước tính khớp server", async () => {
    await makeAdmin("boss", "SUPER_ADMIN");
    await saveConfig(adminCookies("boss"), { airShippingPerKgVnd: 210_000 });
    const body = await json(await publicPricing());
    expect(body.pricing.airShippingPerKgVnd).toBe(210_000);
    expect(body.source).toBe("database");
    expect(JSON.stringify(body)).not.toContain("createdBy");
  });
});

describe("quyền và kiểm tra dữ liệu", () => {
  it("chưa đăng nhập: 401; OPERATOR xem được nhưng không được lưu (403)", async () => {
    expect((await adminPricing.GET(get("/api/admin/pricing-config"))).status).toBe(401);
    expect((await adminPricing.POST(post("/api/admin/pricing-config", DEFAULT_PRICING_CONFIG))).status).toBe(401);

    await makeAdmin("nhanvien", "OPERATOR");
    const cookies = adminCookies("nhanvien");
    expect((await adminPricing.GET(get("/api/admin/pricing-config", { cookies }))).status).toBe(200);
    expect((await saveConfig(cookies)).status).toBe(403);
    expect(await prisma.pricingConfig.count()).toBe(0);
  });

  it("dữ liệu không hợp lệ bị từ chối kèm chi tiết và không ghi gì", async () => {
    await makeAdmin("boss", "SUPER_ADMIN");
    const res = await saveConfig(adminCookies("boss"), { serviceFeeRate: 0.9, airShippingPerKgVnd: "abc" });
    expect(res.status).toBe(400);
    expect((await json(res)).details.length).toBeGreaterThanOrEqual(2);
    expect(await prisma.pricingConfig.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "PRICING_CONFIG_CREATED" } })).toBe(0);
  });

  it("ngày hiệu lực không hợp lệ bị từ chối; ngày quá khứ được hiểu là áp dụng ngay", async () => {
    await makeAdmin("boss", "SUPER_ADMIN");
    const cookies = adminCookies("boss");
    expect((await saveConfig(cookies, { effectiveFrom: "không phải ngày" })).status).toBe(400);
    const past = await saveConfig(cookies, { effectiveFrom: "2020-01-01T00:00:00Z", serviceFeeRate: 0.05 });
    expect(past.status).toBe(200);
    const row = await prisma.pricingConfig.findFirstOrThrow();
    expect(row.effectiveFrom.getFullYear()).toBeGreaterThanOrEqual(2026);
  });
});
