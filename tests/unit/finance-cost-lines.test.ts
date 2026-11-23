import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createCostLine,
  voidCostLine,
  createReversal,
  COST_CATEGORIES,
} from "@/features/finance/cost-lines";
import { prisma } from "@/lib/prisma";

describe("WP2.1 — Schema thanh toán và dòng chi phí (OrderCostLine)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("createCostLine", () => {
    it("tạo thành công dòng chi phí và ghi audit log", async () => {
      const mockCreated = {
        id: "cost-123",
        orderId: "ord-abc",
        category: "GOODS_JPY",
        amountOriginal: 3850,
        currency: "JPY",
        fxRate: 172.5,
        amountVnd: 664125,
        note: "Mua tại Rakuten",
        receiptUrl: "https://example.com/receipt.pdf",
        createdBy: "purchaser_jp",
        createdAt: new Date(),
        voidedAt: null,
        purchaseTaskId: "pt-1",
        shipmentId: null,
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => {
        const tx = {
          orderCostLine: {
            create: vi.fn().mockResolvedValue(mockCreated),
          },
          auditLog: {
            create: vi.fn().mockResolvedValue({ id: "audit-1" }),
          },
        };
        return callback(tx);
      });

      const result = await createCostLine({
        orderId: "ord-abc",
        category: "GOODS_JPY",
        amountOriginal: 3850,
        currency: "JPY",
        fxRate: 172.5,
        amountVnd: 664125,
        note: "Mua tại Rakuten",
        receiptUrl: "https://example.com/receipt.pdf",
        createdBy: "purchaser_jp",
        purchaseTaskId: "pt-1",
      });

      expect(result.id).toBe("cost-123");
      expect(result.amountVnd).toBe(664125);
      expect(result.category).toBe("GOODS_JPY");
    });

    it("từ chối danh mục không hợp lệ", async () => {
      await expect(
        createCostLine({
          orderId: "ord-abc",
          category: "INVALID_CAT" as any,
          amountOriginal: 100,
          currency: "VND",
          amountVnd: 100,
          createdBy: "admin",
        })
      ).rejects.toThrow("Danh mục chi phí 'INVALID_CAT' không hợp lệ.");
    });

    it("từ chối số tiền không phải số nguyên", async () => {
      await expect(
        createCostLine({
          orderId: "ord-abc",
          category: "TOKYO_HANDLING",
          amountOriginal: 300,
          currency: "JPY",
          amountVnd: 51750.5, // Float, vi phạm bất biến VND nguyên
          createdBy: "admin",
        })
      ).rejects.toThrow("amountVnd phải là số nguyên");
    });
  });

  describe("voidCostLine", () => {
    it("vô hiệu hóa dòng chi phí bằng cờ voidedAt thay vì xóa cứng", async () => {
      const mockExisting = {
        id: "cost-123",
        orderId: "ord-abc",
        category: "TOKYO_HANDLING",
        amountVnd: 50000,
        note: "Phí ban đầu",
        voidedAt: null,
      };

      const mockUpdated = {
        ...mockExisting,
        voidedAt: new Date(),
        note: "Phí ban đầu [HỦY: Tính nhầm phí - bởi accountant1]",
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => {
        const tx = {
          orderCostLine: {
            findUnique: vi.fn().mockResolvedValue(mockExisting),
            update: vi.fn().mockResolvedValue(mockUpdated),
          },
          auditLog: {
            create: vi.fn().mockResolvedValue({ id: "audit-2" }),
          },
        };
        return callback(tx);
      });

      const result = await voidCostLine("cost-123", "Tính nhầm phí", "accountant1");
      expect(result.voidedAt).toBeInstanceOf(Date);
      expect(result.note).toContain("[HỦY: Tính nhầm phí - bởi accountant1]");
    });

    it("chặn việc void lại một dòng đã bị void trước đó", async () => {
      const mockAlreadyVoided = {
        id: "cost-123",
        orderId: "ord-abc",
        category: "TOKYO_HANDLING",
        amountVnd: 50000,
        note: "Đã hủy",
        voidedAt: new Date(),
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => {
        const tx = {
          orderCostLine: {
            findUnique: vi.fn().mockResolvedValue(mockAlreadyVoided),
          },
        };
        return callback(tx);
      });

      await expect(
        voidCostLine("cost-123", "Hủy lần hai", "accountant1")
      ).rejects.toThrow("Dòng chi phí này đã bị vô hiệu hóa trước đó.");
    });
  });

  describe("createReversal", () => {
    it("hoàn tác thanh toán bằng cách tạo bản ghi đảo REVERSAL và đánh dấu bản gốc VOIDED", async () => {
      const mockOriginal = {
        id: "pay-100",
        orderId: "ord-1",
        provider: "MANUAL_BANK_TRANSFER",
        amountVnd: 500000,
        status: "CONFIRMED",
        kind: "DEPOSIT",
        voidedAt: null,
        note: "Khách cọc VietQR",
        reference: "BILL123",
        shipmentId: null,
      };

      const mockVoidedOriginal = {
        ...mockOriginal,
        status: "VOIDED",
        voidedAt: new Date(),
        note: "Khách cọc VietQR [HOÀN TÁC: Khách chuyển nhầm thừa tiền - bởi admin1]",
      };

      const mockReversal = {
        id: "pay-rev-101",
        orderId: "ord-1",
        provider: "MANUAL_BANK_TRANSFER",
        amountVnd: -500000,
        status: "CONFIRMED",
        kind: "REVERSAL",
        reversalOfId: "pay-100",
        confirmedByAdmin: "admin1",
        note: "Hoàn tác cho giao dịch pay-100. Lý do: Khách chuyển nhầm thừa tiền",
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => {
        const tx = {
          paymentTransaction: {
            findUnique: vi.fn().mockResolvedValue(mockOriginal),
            update: vi.fn().mockResolvedValue(mockVoidedOriginal),
            create: vi.fn().mockResolvedValue(mockReversal),
          },
          auditLog: {
            create: vi.fn().mockResolvedValue({ id: "audit-3" }),
          },
        };
        return callback(tx);
      });

      const res = await createReversal("pay-100", "Khách chuyển nhầm thừa tiền", "admin1");

      expect(res.original.status).toBe("VOIDED");
      expect(res.original.voidedAt).toBeInstanceOf(Date);
      expect(res.reversal.kind).toBe("REVERSAL");
      expect(res.reversal.amountVnd).toBe(-500000);
      expect(res.reversal.reversalOfId).toBe("pay-100");
    });

    it("chặn việc tạo đảo cho giao dịch đã VOIDED hoặc đã là REVERSAL", async () => {
      const mockReversalTx = {
        id: "pay-rev-101",
        orderId: "ord-1",
        provider: "MANUAL_BANK_TRANSFER",
        amountVnd: -500000,
        status: "CONFIRMED",
        kind: "REVERSAL",
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => {
        const tx = {
          paymentTransaction: {
            findUnique: vi.fn().mockResolvedValue(mockReversalTx),
          },
        };
        return callback(tx);
      });

      await expect(
        createReversal("pay-rev-101", "Đảo lại", "admin")
      ).rejects.toThrow("Không thể tạo giao dịch đảo cho một giao dịch đảo.");
    });
  });
});

