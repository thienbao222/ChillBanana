import { describe, it, expect } from "vitest";
import {
  calculateDepositV2,
  checkWeightTolerance,
  calculateWarehouseVnBalance,
  DEFAULT_DEPOSIT_POLICY,
} from "@/features/payments/policy";

describe("WP3.3 - Dòng tiền v2 & Chính sách cọc phân tầng", () => {
  describe("calculateDepositV2", () => {
    it("đơn < 1.000.000 đ yêu cầu cọc 100% để bảo vệ đơn nhỏ", () => {
      const res = calculateDepositV2(900_000);
      expect(res.tier).toBe("LOW");
      expect(res.depositPercent).toBe(100);
      expect(res.depositAmountVnd).toBe(900_000);
    });

    it("đơn 1.000.000 đ - 10.000.000 đ yêu cầu cọc 70%", () => {
      const res = calculateDepositV2(1_500_000);
      expect(res.tier).toBe("STANDARD");
      expect(res.depositPercent).toBe(70);
      expect(res.depositAmountVnd).toBe(1_050_000);
    });

    it("đơn > 10.000.000 đ yêu cầu cọc 50%", () => {
      const res = calculateDepositV2(15_000_000);
      expect(res.tier).toBe("HIGH");
      expect(res.depositPercent).toBe(50);
      expect(res.depositAmountVnd).toBe(7_500_000);
    });

    it("biên đúng tại mốc 1.000.000 đ là 70%", () => {
      const res = calculateDepositV2(1_000_000);
      expect(res.tier).toBe("STANDARD");
      expect(res.depositPercent).toBe(70);
      expect(res.depositAmountVnd).toBe(700_000);
    });

    it("tại mốc 10.000.000 đ thuộc tier STANDARD (70%), trên 10 triệu là HIGH (50%)", () => {
      const resAt10M = calculateDepositV2(10_000_000);
      expect(resAt10M.tier).toBe("STANDARD");
      expect(resAt10M.depositPercent).toBe(70);
      expect(resAt10M.depositAmountVnd).toBe(7_000_000);

      const resAbove10M = calculateDepositV2(10_000_001);
      expect(resAbove10M.tier).toBe("HIGH");
      expect(resAbove10M.depositPercent).toBe(50);
      expect(resAbove10M.depositAmountVnd).toBe(5_000_001);
    });
  });

  describe("checkWeightTolerance", () => {
    it("lệch trong ngưỡng 5% (1.0kg -> 1.04kg) không tính thêm phí", () => {
      const res = checkWeightTolerance(1.0, 1.04);
      expect(res.withinTolerance).toBe(true);
      expect(res.weightDiffKg).toBe(0.04);
      expect(res.percentageDiff).toBeCloseTo(4.0, 1);
    });

    it("lệch trong ngưỡng 50g (0.2kg -> 0.24kg, dù là 20%) vẫn được chấp nhận miễn phí", () => {
      const res = checkWeightTolerance(0.2, 0.24);
      expect(res.withinTolerance).toBe(true);
      expect(res.weightDiffKg).toBe(0.04);
    });

    it("lệch quá cả 5% và 50g (1.0kg -> 1.2kg) kích hoạt tính lại phí", () => {
      const res = checkWeightTolerance(1.0, 1.2);
      expect(res.withinTolerance).toBe(false);
      expect(res.weightDiffKg).toBe(0.2);
      expect(res.percentageDiff).toBe(20.0);
    });

    it("hàng thực tế nhẹ hơn báo giá không phạt phí", () => {
      const res = checkWeightTolerance(1.5, 1.2);
      expect(res.withinTolerance).toBe(true);
      expect(res.weightDiffKg).toBe(-0.3);
    });
  });

  describe("calculateWarehouseVnBalance", () => {
    it("tính chính xác số dư còn lại tại kho VN kèm phí ship nội địa", () => {
      const summary = calculateWarehouseVnBalance({
        totalVnd: 2_000_000,
        totalPaidVnd: 1_400_000, // Đã cọc 70%
        domesticVnShippingEstimateVnd: 35_000,
      });

      expect(summary.remainingGoodsBalanceVnd).toBe(600_000);
      expect(summary.totalRemainingVnd).toBe(635_000);
      expect(summary.isFullySettled).toBe(false);
    });

    it("khi đã thanh toán đủ 100% thì số dư hàng hóa bằng 0", () => {
      const summary = calculateWarehouseVnBalance({
        totalVnd: 2_000_000,
        totalPaidVnd: 2_000_000,
        domesticVnShippingEstimateVnd: 0,
      });

      expect(summary.remainingGoodsBalanceVnd).toBe(0);
      expect(summary.totalRemainingVnd).toBe(0);
      expect(summary.isFullySettled).toBe(true);
    });
  });
});
