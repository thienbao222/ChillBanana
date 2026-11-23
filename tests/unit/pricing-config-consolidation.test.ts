import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSystemConfig, invalidateSystemConfigCache, SYSTEM_CONFIG_DEFAULTS } from "@/lib/system-config";
import * as pricingConfigModule from "@/features/pricing/config";

describe("WP1.3 — Hợp nhất SystemConfig vào PricingConfig", () => {
  beforeEach(() => {
    invalidateSystemConfigCache();
    vi.restoreAllMocks();
  });

  it("getSystemConfig lấy trực tiếp từ getCurrentPricingConfig", async () => {
    const mockPricingValues = {
      serviceFeePercent: 6,
      serviceFeeMinimumVnd: 25_000,
      airShippingPerKgVnd: 200_000,
      groupBuyShippingDiscountPercent: 30,
      groupBuyMaxWeightKg: 0.5,
      minimumBaseOrderVnd: 350_000,
      fallbackJpyVndRate: 180,
      usdVndReferenceRate: 25_400,
      fxSpreadPercent: 1.5,
      groupBuyEnabled: false,
    };

    vi.spyOn(pricingConfigModule, "getCurrentPricingConfig").mockResolvedValue({
      version: 99,
      values: mockPricingValues,
      changedBy: "test-admin",
      changeReason: "Unit test consolidation",
      createdAt: new Date(),
    });

    const config = await getSystemConfig();

    expect(config.service_fee_percent).toBe(6);
    expect(config.min_service_fee_vnd).toBe(25_000);
    expect(config.air_shipping_per_kg_vnd).toBe(200_000);
    expect(config.group_buy_discount_percent).toBe(30);
    expect(config.floor_exchange_rate_jpy).toBe(180);
    expect(config.min_order_threshold_vnd).toBe(350_000);
  });

  it("fallback về SYSTEM_CONFIG_DEFAULTS nếu getCurrentPricingConfig ném lỗi", async () => {
    vi.spyOn(pricingConfigModule, "getCurrentPricingConfig").mockRejectedValue(new Error("DB offline"));

    const config = await getSystemConfig();
    expect(config).toEqual(SYSTEM_CONFIG_DEFAULTS);
  });

  it("invalidateSystemConfigCache gọi invalidatePricingConfigCache", () => {
    const spy = vi.spyOn(pricingConfigModule, "invalidatePricingConfigCache");
    invalidateSystemConfigCache();
    expect(spy).toHaveBeenCalled();
  });
});

