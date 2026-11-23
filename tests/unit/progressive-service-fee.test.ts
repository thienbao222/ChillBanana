import { describe, it, expect } from "vitest";
import {
  SERVICE_FEE_TIER1_RATE,
  SERVICE_FEE_TIER2_RATE,
  SERVICE_FEE_TIER1_THRESHOLD_VND,
  SERVICE_FEE_MINIMUM_VND,
  calculateProgressiveServiceFee,
  calculateOrderPrice,
  DEFAULT_PRICING_CONFIG,
} from "@/features/pricing/calculator";

describe("Cơ chế Phí Dịch Vụ Mua Hộ Lũy Tiến 2 Bậc (6% / 5%)", () => {
  it("Các hằng số cấu hình định mức phải chuẩn xác", () => {
    expect(SERVICE_FEE_TIER1_RATE).toBe(0.06);
    expect(SERVICE_FEE_TIER2_RATE).toBe(0.05);
    expect(SERVICE_FEE_TIER1_THRESHOLD_VND).toBe(5_000_000);
    expect(SERVICE_FEE_MINIMUM_VND).toBe(80_000);
  });

  it("Đơn siêu nhỏ (200.000 đ): 6% là 12.000 đ < 80.000 đ -> Áp sàn bảo vệ 80.000 đ", () => {
    const res = calculateProgressiveServiceFee(200_000);
    expect(res.totalFeeVnd).toBe(80_000);
    expect(res.appliedMinimumFloor).toBe(true);
    expect(res.isVipEligible).toBe(false);
    expect(res.tier1BaseVnd).toBe(200_000);
    expect(res.tier1FeeVnd).toBe(80_000);
    expect(res.tier2BaseVnd).toBe(0);
    expect(res.tier2FeeVnd).toBe(0);
    expect(res.remainingToVipVnd).toBe(4_800_000);
  });

  it("Đơn 1.000.000 đ: 6% là 60.000 đ < 80.000 đ -> Áp sàn bảo vệ 80.000 đ", () => {
    const res = calculateProgressiveServiceFee(1_000_000);
    expect(res.totalFeeVnd).toBe(80_000);
    expect(res.appliedMinimumFloor).toBe(true);
    expect(res.isVipEligible).toBe(false);
    expect(res.remainingToVipVnd).toBe(4_000_000);
  });

  it("Đơn 2.000.000 đ: 6% là 120.000 đ > 80.000 đ -> Phí dịch vụ là 120.000 đ", () => {
    const res = calculateProgressiveServiceFee(2_000_000);
    expect(res.totalFeeVnd).toBe(120_000);
    expect(res.appliedMinimumFloor).toBe(false);
    expect(res.isVipEligible).toBe(false);
    expect(res.tier1FeeVnd).toBe(120_000);
    expect(res.tier2FeeVnd).toBe(0);
    expect(res.remainingToVipVnd).toBe(3_000_000);
  });

  it("Đơn đúng ngưỡng 5.000.000 đ: Bậc 1 đạt tối đa 300.000 đ", () => {
    const res = calculateProgressiveServiceFee(5_000_000);
    expect(res.totalFeeVnd).toBe(300_000);
    expect(res.tier1BaseVnd).toBe(5_000_000);
    expect(res.tier1FeeVnd).toBe(300_000);
    expect(res.tier2BaseVnd).toBe(0);
    expect(res.tier2FeeVnd).toBe(0);
    expect(res.isVipEligible).toBe(false);
    expect(res.remainingToVipVnd).toBe(0);
  });

  it("Đơn 6.000.000 đ: Kích hoạt Đặc quyền VIP 5% cho 1 triệu vượt (Phí = 300k + 50k = 350.000 đ)", () => {
    const res = calculateProgressiveServiceFee(6_000_000);
    expect(res.totalFeeVnd).toBe(350_000);
    expect(res.isVipEligible).toBe(true);
    expect(res.tier1BaseVnd).toBe(5_000_000);
    expect(res.tier1FeeVnd).toBe(300_000);
    expect(res.tier2BaseVnd).toBe(1_000_000);
    expect(res.tier2FeeVnd).toBe(50_000); // 1M * 5% = 50k
    expect(res.remainingToVipVnd).toBe(0);
  });

  it("Đơn 10.000.000 đ: 5M đầu (300k) + 5M vượt (250k) = 550.000 đ", () => {
    const res = calculateProgressiveServiceFee(10_000_000);
    expect(res.totalFeeVnd).toBe(550_000);
    expect(res.isVipEligible).toBe(true);
    expect(res.tier1FeeVnd).toBe(300_000);
    expect(res.tier2FeeVnd).toBe(250_000); // 5M * 5% = 250k
  });

  it("Đơn lớn 25.000.000 đ: 5M đầu (300k) + 20M vượt (1.000.000 đ) = 1.300.000 đ", () => {
    const res = calculateProgressiveServiceFee(25_000_000);
    expect(res.totalFeeVnd).toBe(1_300_000);
    expect(res.isVipEligible).toBe(true);
    expect(res.tier1FeeVnd).toBe(300_000);
    expect(res.tier2FeeVnd).toBe(1_000_000); // 20M * 5% = 1M
  });

  it("Tích hợp trong calculateOrderPrice: serviceFeeVnd và baseOrderCostVnd tính chính xác theo lũy tiến", () => {
    // Đơn 6.000.000 đ tiền hàng (khoảng 35.294 JPY với tỷ giá 170):
    // serviceFee = 350.000 đ
    // baseOrderCost = 6.000.000 + 350.000 = 6.350.000 đ
    const calc = calculateOrderPrice(35294, 1.0, 170, false, DEFAULT_PRICING_CONFIG);
    expect(calc.productPriceVnd).toBe(5_999_980);
    // 5.000.000 * 6% = 300.000, 999.980 * 5% = 49.999 -> Tổng 349.999 đ
    expect(calc.serviceFeeVnd).toBe(349_999);
    expect(Number.isInteger(calc.serviceFeeVnd)).toBe(true);
    expect(calc.serviceFeeBreakdown).toBeDefined();
    expect(calc.serviceFeeBreakdown?.isVipEligible).toBe(true);
  });
});
