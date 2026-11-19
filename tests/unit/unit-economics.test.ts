import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  estimateMargin,
  DEFAULT_COST_ASSUMPTIONS,
} from "@/features/pricing/unit-economics";
import { DEFAULT_PRICING_CONFIG } from "@/features/pricing/calculator";
import { POST as runSimulation } from "@/app/api/admin/pricing-simulation/route";
import * as adminGuard from "@/lib/admin-guard";
import { NextRequest } from "next/server";

describe("WP3.1 — Mô phỏng đơn vị kinh tế và rào chắn lỗ", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(adminGuard, "requireAdmin").mockResolvedValue({
      ok: true,
      username: "admin_super",
      role: "SUPER_ADMIN",
    } as any);
    vi.spyOn(prisma.pricingConfig, "findFirst").mockResolvedValue(null);
  });

  describe("estimateMargin hàm thuần", () => {
    it("Khớp ví dụ 1: đơn 3.850 yên, 0,5 kg với phí mua hộ tối thiểu 80.000đ cải thiện lãi gộp lên +8.137đ", () => {
      const orderSample = {
        priceJpy: 3850,
        weightKg: 0.5,
        exchangeRate: 170, // Tỷ giá thị trường 170 JPY/VND của ví dụ
      };

      const result = estimateMargin(orderSample, DEFAULT_COST_ASSUMPTIONS, DEFAULT_PRICING_CONFIG);

      // Chi tiết doanh thu (với sàn phí mua hộ 80.000đ):
      // productPriceVnd = 3850 * 170 = 654.500
      // serviceFeeVnd = 80.000 (sàn phí 80k > 4% = 26.180)
      // shippingFeeVnd = 92.500
      // companyRevenue = 172.500
      expect(result.companyRevenueVnd).toBe(172500);

      // Chi phí ước tính:
      // fxCost = round(654500 * 1.2%) = 7.854
      // tokyoHandling = 300 * 170 = 51.000
      // actualFreight = 0.5 * 130000 = 65.000
      // vnDelivery = 35.000
      // baseOrderCost = 654500 + 80000 = 734500 -> deposit50 = 367250
      // paymentFee = round(367250 * 1.5%) = 5.509
      // totalOperationalCost = 7854 + 51000 + 65000 + 35000 + 5509 = 164.363
      expect(result.estimatedCosts.totalCostVnd).toBe(164363);

      // Lãi gộp: 172500 - 164363 = +8.137đ (cải thiện từ lỗ -21.638đ khi sàn phí là 50k)
      expect(result.grossProfitVnd).toBe(8137);
      expect(result.isBelowMargin).toBe(true);
    });

    it("Khớp ví dụ 2: đơn 2.000 yên, 0,3 kg với phí mua hộ tối thiểu 80.000đ cải thiện lãi gộp lên +3.270đ", () => {
      const orderSample = {
        priceJpy: 2000,
        weightKg: 0.3,
        exchangeRate: 170,
      };

      const result = estimateMargin(orderSample, DEFAULT_COST_ASSUMPTIONS, DEFAULT_PRICING_CONFIG);

      // Doanh thu (với sàn phí mua hộ 80.000đ):
      // productPriceVnd = 340.000
      // serviceFeeVnd = 80.000
      // shippingFeeVnd = 55.500
      // companyRevenue = 135.500
      expect(result.companyRevenueVnd).toBe(135500);

      // Chi phí:
      // fxCost = round(340000 * 1.2%) = 4.080
      // tokyoHandling = 51.000
      // actualFreight = 0.3 * 130000 = 39.000
      // vnDelivery = 35.000
      // baseOrderCost = 340000 + 80000 = 420000 -> deposit50 = 210000
      // paymentFee = round(210000 * 1.5%) = 3.150
      // totalCost = 4080 + 51000 + 39000 + 35000 + 3150 = 132.230
      expect(result.estimatedCosts.totalCostVnd).toBe(132230);

      // Lãi gộp: 135500 - 132230 = +3.270đ (cải thiện từ lỗ -26.505đ khi sàn phí là 50k)
      expect(result.grossProfitVnd).toBe(3270);
      expect(result.isBelowMargin).toBe(true);
    });

    it("Rào chắn lỗ: đơn đạt biên an toàn không bị gắn cờ belowMargin", () => {
      const largeOrder = {
        priceJpy: 50000, // 8.600.000 đ
        weightKg: 1.0,
        exchangeRate: 172,
      };

      // Giả sử dùng cấu hình giá v2 hoặc đơn lớn
      const customPricing = {
        ...DEFAULT_PRICING_CONFIG,
        serviceFeePercent: 10, // 10%
      };

      const result = estimateMargin(largeOrder, DEFAULT_COST_ASSUMPTIONS, customPricing);
      expect(result.grossProfitVnd).toBeGreaterThan(result.targetMarginThresholdVnd);
      expect(result.isBelowMargin).toBe(false);
    });
  });

  describe("API Mô phỏng giá /api/admin/pricing-simulation", () => {
    it("chạy mô phỏng và so sánh hai bộ giá trên danh sách đơn mẫu", async () => {
      const req = new NextRequest("http://localhost/api/admin/pricing-simulation", {
        method: "POST",
        body: JSON.stringify({
          sampleOrders: [
            { name: "Đơn mẫu 1", priceJpy: 3850, weightKg: 0.5, exchangeRate: 170 },
            { name: "Đơn mẫu 2", priceJpy: 2000, weightKg: 0.3, exchangeRate: 170 },
          ],
          pricingConfigB: {
            ...DEFAULT_PRICING_CONFIG,
            serviceFeePercent: 10,
          },
        }),
      });

      const res = await runSimulation(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.configA.results).toHaveLength(2);
      expect(data.configA.results[0].estimate.grossProfitVnd).toBe(8137);
      expect(data.configA.results[1].estimate.grossProfitVnd).toBe(3270);
      expect(data.configB).toBeDefined();
    });
  });
});
