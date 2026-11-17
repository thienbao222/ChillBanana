import { describe, it, expect, vi, beforeEach } from "vitest";
import { parsePeriodRange, closePeriod, isPeriodClosed } from "@/features/finance/period-close";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    periodClose: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    auditLog: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue({}),
}));

describe("WP7.2 — Vận Hành, Đóng Sổ Tài Chính & Giám Sát Sức Khỏe Hệ Thống", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Phân tích kỳ kế toán parsePeriodRange", () => {
    it("chuyển đổi chính xác kỳ YYYY-MM sang khoảng thời gian UTC", () => {
      const range = parsePeriodRange("2026-10");
      expect(range.start.toISOString()).toBe("2026-10-01T00:00:00.000Z");
      expect(range.end.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    });

    it("từ chối định dạng kỳ không hợp lệ hoặc tháng ngoài 1-12", () => {
      expect(() => parsePeriodRange("2026/10")).toThrow("INVALID_PERIOD_FORMAT");
      expect(() => parsePeriodRange("2026-13")).toThrow("INVALID_PERIOD_MONTH");
      expect(() => parsePeriodRange("invalid")).toThrow("INVALID_PERIOD_FORMAT");
    });
  });

  describe("Quy trình Đóng Sổ Tài Chính (closePeriod)", () => {
    it("tính toán chính xác GMV, doanh thu dịch vụ, chi phí thực và lãi gộp của kỳ", async () => {
      vi.mocked(prisma.periodClose.findUnique).mockResolvedValue(null);

      const mockOrders = [
        {
          id: "ord-1",
          totalVnd: 1_000_000,
          serviceFeeVnd: 50_000,
          shippingFeeVnd: 150_000,
          handlingFeeVnd: 0,
          fxFeeVnd: 0,
          costLines: [
            { amountVnd: 800_000, isVoided: false }, // Chi phí mua hàng
            { amountVnd: 120_000, isVoided: false }, // Cước thực tế
          ],
        },
        {
          id: "ord-2",
          totalVnd: 2_000_000,
          serviceFeeVnd: 100_000,
          shippingFeeVnd: 200_000,
          handlingFeeVnd: 0,
          fxFeeVnd: 0,
          costLines: [
            { amountVnd: 1_600_000, isVoided: false },
            { amountVnd: 180_000, isVoided: false },
          ],
        },
      ];

      vi.mocked(prisma.order.findMany).mockResolvedValue(mockOrders as any);

      vi.mocked(prisma.periodClose.create).mockImplementation(async (args: any) => ({
        id: "pc-1",
        period: args.data.period,
        closedBy: args.data.closedBy,
        closedAt: new Date(),
        totalGmvVnd: args.data.totalGmvVnd,
        totalRevenueVnd: args.data.totalRevenueVnd,
        totalCostVnd: args.data.totalCostVnd,
        grossProfitVnd: args.data.grossProfitVnd,
        ordersCount: args.data.ordersCount,
        notes: args.data.notes,
      }) as any);

      const result = await closePeriod("2026-10", "super_admin", "Chốt sổ tháng 10/2026");

      expect(result.period).toBe("2026-10");
      expect(result.ordersCount).toBe(2);
      expect(result.totalGmvVnd).toBe(3_000_000);
      // Doanh thu dịch vụ = (50k + 150k) + (100k + 200k) = 500k
      expect(result.totalRevenueVnd).toBe(500_000);
      // Chi phí thực = (800k + 120k) + (1600k + 180k) = 2.700.000 đ
      expect(result.totalCostVnd).toBe(2_700_000);
      // Lãi gộp = 500k - 2.700k = -2.200.000 đ
      expect(result.grossProfitVnd).toBe(-2_200_000);
    });

    it("chặn việc đóng sổ trùng lặp lần 2 cho cùng 1 kỳ đã chốt", async () => {
      vi.mocked(prisma.periodClose.findUnique).mockResolvedValue({
        id: "pc-closed",
        period: "2026-10",
        closedBy: "chief_accountant",
        closedAt: new Date(),
      } as any);

      await expect(closePeriod("2026-10", "super_admin")).rejects.toThrow(
        "PERIOD_ALREADY_CLOSED"
      );
    });
  });

  describe("Kiểm tra trạng thái đóng sổ isPeriodClosed", () => {
    it("trả về true khi kỳ chứa ngày của đơn hàng đã được chốt sổ", async () => {
      vi.mocked(prisma.periodClose.findUnique).mockResolvedValue({ id: "pc-1" } as any);

      const orderDate = new Date("2026-10-15T10:00:00Z");
      const isClosed = await isPeriodClosed(orderDate);

      expect(isClosed).toBe(true);
      expect(prisma.periodClose.findUnique).toHaveBeenCalledWith({
        where: { period: "2026-10" },
      });
    });

    it("trả về false khi kỳ chưa được chốt sổ", async () => {
      vi.mocked(prisma.periodClose.findUnique).mockResolvedValue(null);

      const orderDate = new Date("2026-11-04T10:00:00Z");
      const isClosed = await isPeriodClosed(orderDate);

      expect(isClosed).toBe(false);
    });
  });
});

