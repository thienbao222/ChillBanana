import { describe, it, expect } from "vitest";
import {
  calculateOrderPrice,
  DEFAULT_PRICING_CONFIG,
  PricingConfigValues,
} from "@/features/pricing/calculator";

describe("WP3.2 — Bộ giá v2 cấu hình hóa", () => {
  it("Cấu hình mặc định: bảo đảm 100% kết quả khớp toàn bộ công thức cũ (không đổi giá hiện hành)", () => {
    // Đơn 1000 JPY, 0.2 kg, rate 172
    const legacy = calculateOrderPrice(1000, 0.2, 172, false, DEFAULT_PRICING_CONFIG);

    expect(legacy.productPriceVnd).toBe(172000);
    expect(legacy.serviceFeeVnd).toBe(50000); // Tối thiểu 50.000đ
    expect(legacy.handlingFeeVnd).toBe(0);
    expect(legacy.fxFeeVnd).toBe(0);
    expect(legacy.taxEstimateVnd).toBe(0);
    expect(legacy.shippingFeeVnd).toBe(37000); // 0.2 * 185.000
    expect(legacy.totalVnd).toBe(259000); // 172.000 + 50.000 + 37.000
    expect(legacy.billableWeightKg).toBe(0.2);

    expect(legacy.breakdown).toEqual({
      goods: 172000,
      serviceFee: 50000,
      handlingFee: 0,
      fxFee: 0,
      shipping: 37000,
      billableWeightKg: 0.2,
      taxEstimate: 0,
      total: 259000,
    });
  });

  it("Cấu hình v2 mẫu: áp dụng phí 5% (tối thiểu 25k), cân tối thiểu 0.5kg, xử lý 20k, phí tỷ giá 1.5%", () => {
    const configV2: PricingConfigValues = {
      ...DEFAULT_PRICING_CONFIG,
      serviceFeePercent: 5,
      serviceFeeMinimumVnd: 25000,
      handlingFeeVnd: 20000,
      fxFeePercent: 1.5,
      minBillableWeightKg: 0.5,
    };

    // Đơn 3.850 ¥, nặng 0.3 kg (dưới cân tối thiểu 0.5 kg)
    const result = calculateOrderPrice(3850, 0.3, 172, false, configV2);

    // 1. Tiền hàng: 3.850 * 172 = 662.200đ
    expect(result.productPriceVnd).toBe(662200);

    // 2. Phí dịch vụ: 662.200 * 5% = 33.110đ (lớn hơn min 25.000đ)
    expect(result.serviceFeeVnd).toBe(33110);

    // 3. Phí xử lý cố định: 20.000đ
    expect(result.handlingFeeVnd).toBe(20000);

    // 4. Phí đổi ngoại tệ: 662.200 * 1.5% = 9.933đ
    expect(result.fxFeeVnd).toBe(9933);

    // 5. Cân tính cước: max(0.3, 0.5) = 0.5 kg
    expect(result.billableWeightKg).toBe(0.5);

    // 6. Cước bay: 0.5 * 185.000 = 92.500đ
    expect(result.shippingFeeVnd).toBe(92500);

    // 7. Tổng tiền = 662.200 + 33.110 + 20.000 + 9.933 + 92.500 = 817.743đ
    expect(result.totalVnd).toBe(817743);

    // 8. Breakdown trả về đầy đủ từng dòng cho UI
    expect(result.breakdown).toEqual({
      goods: 662200,
      serviceFee: 33110,
      handlingFee: 20000,
      fxFee: 9933,
      shipping: 92500,
      billableWeightKg: 0.5,
      taxEstimate: 0,
      total: 817743,
    });
  });

  it("Đơn hàng tại kho VN (fulfillmentOrigin = 'VN') không phát sinh cước bay ngay cả khi có cân tối thiểu", () => {
    const configV2: PricingConfigValues = {
      ...DEFAULT_PRICING_CONFIG,
      serviceFeePercent: 5,
      minBillableWeightKg: 0.5,
    };

    const vnOrder = calculateOrderPrice(2000, 0.3, 172, false, configV2, "VN");
    expect(vnOrder.shippingFeeVnd).toBe(0);
    expect(vnOrder.breakdown.shipping).toBe(0);
  });
});

