import { describe, expect, it } from "vitest";
import {
  AIR_SHIPPING_PER_KG,
  DEFAULT_PRICING_CONFIG,
  GROUP_BUY_MAX_WEIGHT_KG,
  MIN_ORDER_THRESHOLD_VND,
  calculateOrderPrice,
} from "@/features/pricing/calculator";
import { validatePricingConfig } from "@/features/pricing/config";

describe("calculateOrderPrice", () => {
  it("tính giá cơ bản: hàng + phí 4% + cước theo cân nặng", () => {
    const p = calculateOrderPrice(10_000, 0.5, 170);
    expect(p.productPriceVnd).toBe(1_700_000);
    expect(p.serviceFeeVnd).toBe(68_000);
    expect(p.baseOrderCostVnd).toBe(1_768_000);
    expect(p.shippingFeeVnd).toBe(92_500);
    expect(p.totalVnd).toBe(1_860_500);
    expect(p.deposit50Vnd).toBe(884_000);
  });

  it("phí dịch vụ tối thiểu 50.000đ", () => {
    const p = calculateOrderPrice(1_000, 0, 170); // 4% của 170.000 = 6.800 < 50.000
    expect(p.serviceFeeVnd).toBe(50_000);
  });

  it("không tính cước khi chưa biết cân nặng", () => {
    expect(calculateOrderPrice(10_000, 0, 170).shippingFeeVnd).toBe(0);
  });

  it("làm tròn tiền hàng theo tỷ giá lẻ", () => {
    expect(calculateOrderPrice(333, 0, 171.6).productPriceVnd).toBe(Math.round(333 * 171.6));
  });

  it("gộp đơn giảm 25% cước nếu hàng nhẹ ≤ 0,5kg", () => {
    const solo = calculateOrderPrice(10_000, 0.5, 170, false);
    const group = calculateOrderPrice(10_000, 0.5, 170, true);
    expect(group.shippingFeeVnd).toBe(Math.round(0.5 * Math.round(AIR_SHIPPING_PER_KG * 0.75)));
    expect(group.shippingFeeVnd).toBeLessThan(solo.shippingFeeVnd);
  });

  it("gộp đơn không giảm cước khi hàng nặng hơn ngưỡng", () => {
    const heavy = GROUP_BUY_MAX_WEIGHT_KG + 0.1;
    expect(calculateOrderPrice(10_000, heavy, 170, true).shippingFeeVnd).toBe(
      calculateOrderPrice(10_000, heavy, 170, false).shippingFeeVnd
    );
  });

  it("đánh dấu dưới mức tối thiểu và số tiền còn thiếu", () => {
    const p = calculateOrderPrice(1_000, 0, 170); // 170.000 + 50.000 = 220.000
    expect(p.isUnderMinOrder).toBe(true);
    expect(p.minOrderDiffVnd).toBe(MIN_ORDER_THRESHOLD_VND - 220_000);
    const ok = calculateOrderPrice(10_000, 0, 170);
    expect(ok.isUnderMinOrder).toBe(false);
    expect(ok.minOrderDiffVnd).toBe(0);
  });

  it("đúng ngưỡng tối thiểu thì không bị coi là thiếu", () => {
    // 300.000 = hàng + phí: tìm giá ¥ cho base = 300.000 với tỷ giá 100 và phí tối thiểu 50.000
    const p = calculateOrderPrice(2_500, 0, 100); // 250.000 + 50.000
    expect(p.baseOrderCostVnd).toBe(300_000);
    expect(p.isUnderMinOrder).toBe(false);
  });

  it("đảm bảo phí mua hộ tối thiểu 50.000đ áp dụng cho mọi đơn nhỏ và số tiền luôn là số nguyên VND", () => {
    const p1 = calculateOrderPrice(500, 0, 170); // 85.000 * 4% = 3.400 -> 50.000
    expect(p1.serviceFeeVnd).toBe(50_000);
    expect(Number.isInteger(p1.serviceFeeVnd)).toBe(true);
    expect(Number.isInteger(p1.totalVnd)).toBe(true);

    const p2 = calculateOrderPrice(7_000, 0, 170); // 1.190.000 * 4% = 47.600 < 50.000 -> 50.000
    expect(p2.serviceFeeVnd).toBe(50_000);

    const p3 = calculateOrderPrice(8_000, 0, 170); // 1.360.000 * 4% = 54.400 > 50.000 -> 54.400
    expect(p3.serviceFeeVnd).toBe(54_400);
  });

  it("dùng được một phiên bản cấu hình giá tùy chỉnh", () => {
    const config = {
      serviceFeePercent: 5,
      serviceFeeMinimumVnd: 25_000,
      airShippingPerKgVnd: 200_000,
      groupBuyShippingDiscountPercent: 20,
      groupBuyMaxWeightKg: 0.75,
      minimumBaseOrderVnd: 250_000,
      fallbackJpyVndRate: 168,
      usdVndReferenceRate: 25_500,
    };
    expect(validatePricingConfig(config)).toEqual({ values: config });
    const quote = calculateOrderPrice(10_000, 0.5, 170, true, config);
    expect(quote.serviceFeeVnd).toBe(85_000);
    expect(quote.shippingFeeVnd).toBe(80_000);
  });

  it("từ chối cấu hình thiếu trường, giá trị ngoài giới hạn hoặc trường lạ", () => {
    expect("error" in validatePricingConfig({})).toBe(true);
    expect("error" in validatePricingConfig({ ...DEFAULT_PRICING_CONFIG, serviceFeePercent: 100 })).toBe(true);
    expect("error" in validatePricingConfig({ ...DEFAULT_PRICING_CONFIG, unknown: 1 })).toBe(true);
  });

  it("hàng có sẵn tại kho VN (fulfillmentOrigin = 'VN') không phát sinh cước bay quốc tế (0đ)", () => {
    const jpPrice = calculateOrderPrice(10_000, 1.5, 170, false, DEFAULT_PRICING_CONFIG, "JP");
    const vnPrice = calculateOrderPrice(10_000, 1.5, 170, false, DEFAULT_PRICING_CONFIG, "VN");

    expect(jpPrice.shippingFeeVnd).toBeGreaterThan(0);
    expect(vnPrice.shippingFeeVnd).toBe(0);
    expect(vnPrice.totalVnd).toBe(vnPrice.baseOrderCostVnd);
    expect(vnPrice.fulfillmentOrigin).toBe("VN");
  });

  it("thẩm định trường fxSpreadPercent (0% đến 20%, số thực hợp lệ)", () => {
    expect(validatePricingConfig({ ...DEFAULT_PRICING_CONFIG, fxSpreadPercent: 0 })).toMatchObject({
      values: { fxSpreadPercent: 0 },
    });
    expect(validatePricingConfig({ ...DEFAULT_PRICING_CONFIG, fxSpreadPercent: 3.6 })).toMatchObject({
      values: { fxSpreadPercent: 3.6 },
    });
    expect(validatePricingConfig({ ...DEFAULT_PRICING_CONFIG, fxSpreadPercent: 20 })).toMatchObject({
      values: { fxSpreadPercent: 20 },
    });
    // Vượt ngưỡng hoặc sai kiểu
    expect("error" in validatePricingConfig({ ...DEFAULT_PRICING_CONFIG, fxSpreadPercent: -0.1 })).toBe(true);
    expect("error" in validatePricingConfig({ ...DEFAULT_PRICING_CONFIG, fxSpreadPercent: 20.1 })).toBe(true);
    expect("error" in validatePricingConfig({ ...DEFAULT_PRICING_CONFIG, fxSpreadPercent: "3.6" as unknown as number })).toBe(true);
  });

  it("nguyên tắc bảo toàn số tiền: Tổng tiền luôn bằng Đã thanh toán + Còn lại khi nhận hàng (không hụt cước bay)", () => {
    // 1. Hàng JP có cước bay
    const jpResult = calculateOrderPrice(10_000, 1.2, 172, false, DEFAULT_PRICING_CONFIG, "JP");
    // Option cọc 50%:
    const deposit50 = jpResult.deposit50Vnd;
    const remaining50 = Math.max(0, jpResult.totalVnd - deposit50);
    expect(deposit50 + remaining50).toBe(jpResult.totalVnd);

    // Option thanh toán 100% (trả trước 100% base, cước bay trả khi nhận hàng):
    const deposit100 = jpResult.baseOrderCostVnd;
    const remaining100 = Math.max(0, jpResult.totalVnd - deposit100);
    expect(remaining100).toBe(jpResult.shippingFeeVnd);
    expect(deposit100 + remaining100).toBe(jpResult.totalVnd);

    // 2. Hàng VN không cước bay (shippingFee = 0)
    const vnResult = calculateOrderPrice(2_200, 0.3, 172, false, DEFAULT_PRICING_CONFIG, "VN");
    expect(vnResult.shippingFeeVnd).toBe(0);
    const vnDeposit100 = vnResult.baseOrderCostVnd;
    const vnRemaining100 = Math.max(0, vnResult.totalVnd - vnDeposit100);
    expect(vnRemaining100).toBe(0);
    expect(vnDeposit100 + vnRemaining100).toBe(vnResult.totalVnd);
  });
});
