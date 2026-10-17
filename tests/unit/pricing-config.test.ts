import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRICING_CONFIG,
  PRICING_CONFIG_FIELDS,
  pricingValuesEqual,
  validatePricingConfig,
  type PricingConfigValues,
} from "@/features/pricing/config";
import {
  AIR_SHIPPING_PER_KG,
  GROUP_BUY_MAX_WEIGHT_KG,
  GROUP_BUY_SHIPPING_DISCOUNT_RATE,
  MIN_ORDER_THRESHOLD_VND,
  SERVICE_FEE_RATE,
  calculateOrderPrice,
} from "@/features/pricing/calculator";

describe("cấu hình giá mặc định", () => {
  it("khớp các hằng số cũ (không đổi hành vi khi chưa có cấu hình trong database)", () => {
    expect(DEFAULT_PRICING_CONFIG).toEqual({
      serviceFeeRate: 0.04,
      minServiceFeeVnd: 20_000,
      airShippingPerKgVnd: 185_000,
      groupBuyDiscountRate: 0.25,
      groupBuyMaxWeightKg: 0.5,
      minOrderThresholdVnd: 300_000,
      reservationMinutes: 30,
    });
    expect(SERVICE_FEE_RATE).toBe(0.04);
    expect(AIR_SHIPPING_PER_KG).toBe(185_000);
    expect(GROUP_BUY_SHIPPING_DISCOUNT_RATE).toBe(0.25);
    expect(GROUP_BUY_MAX_WEIGHT_KG).toBe(0.5);
    expect(MIN_ORDER_THRESHOLD_VND).toBe(300_000);
  });

  it("calculateOrderPrice không truyền cấu hình thì cho kết quả như truyền mặc định", () => {
    expect(calculateOrderPrice(10_000, 0.5, 170, true)).toEqual(calculateOrderPrice(10_000, 0.5, 170, true, DEFAULT_PRICING_CONFIG));
  });
});

describe("calculateOrderPrice theo cấu hình tùy chỉnh", () => {
  const custom: PricingConfigValues = {
    ...DEFAULT_PRICING_CONFIG,
    serviceFeeRate: 0.1,
    minServiceFeeVnd: 50_000,
    airShippingPerKgVnd: 200_000,
    groupBuyDiscountRate: 0.5,
    groupBuyMaxWeightKg: 1,
    minOrderThresholdVnd: 500_000,
  };

  it("phí mua hộ và cước bay đổi theo cấu hình", () => {
    const p = calculateOrderPrice(10_000, 1, 170, false, custom); // hàng 1.700.000
    expect(p.serviceFeeVnd).toBe(170_000); // 10%
    expect(p.shippingFeeVnd).toBe(200_000);
    expect(p.totalVnd).toBe(1_700_000 + 170_000 + 200_000);
  });

  it("phí tối thiểu áp dụng khi tỷ lệ phí thấp hơn", () => {
    expect(calculateOrderPrice(1_000, 0, 170, false, custom).serviceFeeVnd).toBe(50_000);
  });

  it("giảm cước gộp đơn dùng mức giảm và ngưỡng cân nặng của cấu hình", () => {
    const group = calculateOrderPrice(10_000, 1, 170, true, custom);
    expect(group.shippingFeeVnd).toBe(100_000); // giảm 50% vì 1kg <= 1kg
    const heavy = calculateOrderPrice(10_000, 1.2, 170, true, custom);
    expect(heavy.shippingFeeVnd).toBe(Math.round(1.2 * 200_000));
  });

  it("ngưỡng đơn tối thiểu theo cấu hình", () => {
    const p = calculateOrderPrice(2_500, 0, 170, false, custom); // 425.000 + 50.000 = 475.000
    expect(p.isUnderMinOrder).toBe(true);
    expect(p.minOrderDiffVnd).toBe(25_000);
    expect(calculateOrderPrice(2_500, 0, 170, false, DEFAULT_PRICING_CONFIG).isUnderMinOrder).toBe(false);
  });
});

describe("validatePricingConfig", () => {
  it("chấp nhận cấu hình hợp lệ (cả số dạng chuỗi từ form)", () => {
    const r = validatePricingConfig({ ...DEFAULT_PRICING_CONFIG, serviceFeeRate: "0.05" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.serviceFeeRate).toBe(0.05);
  });

  it("thiếu trường, sai kiểu, ngoài khoảng, số thập phân ở trường nguyên đều bị từ chối", () => {
    const base = { ...DEFAULT_PRICING_CONFIG } as Record<string, unknown>;
    const bad: Record<string, unknown>[] = [
      { ...base, serviceFeeRate: undefined },
      { ...base, serviceFeeRate: "abc" },
      { ...base, serviceFeeRate: 0.9 },
      { ...base, serviceFeeRate: -0.01 },
      { ...base, airShippingPerKgVnd: 185_000.5 },
      { ...base, airShippingPerKgVnd: 5_000_000 },
      { ...base, reservationMinutes: 1 },
      { ...base, groupBuyDiscountRate: 1 },
      { ...base, minOrderThresholdVnd: Number.NaN },
    ];
    for (const input of bad) expect(validatePricingConfig(input).ok).toBe(false);
    expect(validatePricingConfig(null).ok).toBe(false);
    expect(validatePricingConfig("x").ok).toBe(false);
  });

  it("báo lỗi cho từng trường sai", () => {
    const r = validatePricingConfig({ ...DEFAULT_PRICING_CONFIG, serviceFeeRate: 5, reservationMinutes: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(2);
  });

  it("pricingValuesEqual so sánh đủ mọi trường", () => {
    expect(pricingValuesEqual(DEFAULT_PRICING_CONFIG, { ...DEFAULT_PRICING_CONFIG })).toBe(true);
    for (const field of PRICING_CONFIG_FIELDS) {
      expect(pricingValuesEqual(DEFAULT_PRICING_CONFIG, { ...DEFAULT_PRICING_CONFIG, [field]: DEFAULT_PRICING_CONFIG[field] + 1 })).toBe(false);
    }
  });
});
