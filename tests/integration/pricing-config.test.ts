import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/admin/pricing-config/route";
import { adminCookies, makeAdmin } from "../helpers/factories";
import { get, json, post } from "../helpers/request";
import { DEFAULT_PRICING_CONFIG } from "@/features/pricing/calculator";
import { prisma } from "../helpers/db";

describe("versioned pricing configuration", () => {
  it("restricts read and write routes to super admins", async () => {
    expect((await GET(get("/api/admin/pricing-config"))).status).toBe(401);
    await makeAdmin("operator", "ADMIN");
    const response = await POST(post("/api/admin/pricing-config", { values: DEFAULT_PRICING_CONFIG, changeReason: "test" }, { cookies: adminCookies("operator") }));
    expect(response.status).toBe(403);
  });

  it("appends a version, keeps history, and audits changed fields", async () => {
    await makeAdmin();
    const values = { ...DEFAULT_PRICING_CONFIG, serviceFeePercent: 5.5, airShippingPerKgVnd: 195_000 };
    const response = await POST(post("/api/admin/pricing-config", { values, changeReason: "Cập nhật phí quý 4" }, { cookies: adminCookies() }));
    expect(response.status).toBe(201);
    expect((await json(response)).current).toMatchObject({ version: 1, values, changeReason: "Cập nhật phí quý 4" });

    const historyResponse = await GET(get("/api/admin/pricing-config", { cookies: adminCookies() }));
    const history = await json<{ current: { version: number }; history: Array<{ version: number }> }>(historyResponse);
    expect(history.current.version).toBe(1);
    expect(history.history.map((item) => item.version)).toEqual([1]);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "PRICING_CONFIG_UPDATED" } });
    expect(audit.metadata).toMatchObject({ changedFields: expect.arrayContaining(["serviceFeePercent", "airShippingPerKgVnd"]) });
  });

  it("rejects malformed values without writing a version", async () => {
    await makeAdmin();
    const response = await POST(post("/api/admin/pricing-config", { values: { ...DEFAULT_PRICING_CONFIG, groupBuyShippingDiscountPercent: 95 } }, { cookies: adminCookies() }));
    expect(response.status).toBe(400);
    expect(await prisma.pricingConfig.count()).toBe(0);
  });

  it("does not append a version or audit event when values are unchanged", async () => {
    await makeAdmin();
    await prisma.pricingConfig.create({
      data: { values: DEFAULT_PRICING_CONFIG, changedBy: "seed" },
    });
    const response = await POST(post("/api/admin/pricing-config", { values: DEFAULT_PRICING_CONFIG }, { cookies: adminCookies() }));
    expect(response.status).toBe(200);
    expect((await json(response)).unchanged).toBe(true);
    expect(await prisma.pricingConfig.count()).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "PRICING_CONFIG_UPDATED" } })).toBe(0);
  });
});
