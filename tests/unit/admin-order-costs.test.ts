import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getCosts, POST as handleCosts } from "@/app/api/admin/orders/[id]/costs/route";
import { PATCH as updatePurchaseTask } from "@/app/api/admin/purchase-tasks/[id]/route";
import { prisma } from "@/lib/prisma";
import * as adminGuard from "@/lib/admin-guard";
import { NextRequest } from "next/server";

describe("WP2.4 — Nhập chi phí thực và xem lãi gộp mỗi đơn", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(adminGuard, "requireAdmin").mockResolvedValue({
      ok: true,
      username: "admin_super",
      role: "SUPER_ADMIN",
    } as any);
    vi.spyOn(prisma.auditLog, "create").mockResolvedValue({ id: "audit-mock" } as any);
  });

  describe("API /api/admin/orders/[id]/costs", () => {
    it("GET: trả về danh sách chi phí, tổng chi phí và lãi gộp chính xác", async () => {
      const mockOrder = {
        id: "ord-1",
        orderCode: "CB-001",
        status: "COMPLETED",
        totalVnd: 773180,
        productPriceVnd: 654500,
        serviceFeeVnd: 26180,
        shippingFeeVnd: 92500,
        costLines: [
          { id: "c1", category: "GOODS_JPY", amountVnd: 550000, voidedAt: null },
          { id: "c2", category: "INTL_FREIGHT", amountVnd: 65000, voidedAt: null },
        ],
      };

      vi.spyOn(prisma.order, "findFirst").mockResolvedValue(mockOrder as any);

      const req = new NextRequest("http://localhost/api/admin/orders/ord-1/costs");
      const res = await getCosts(req, { params: Promise.resolve({ id: "ord-1" }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.summary.totalCostVnd).toBe(615000);
      expect(body.summary.grossProfitVnd).toBe(158180); // 773180 - 615000
      expect(body.summary.hasGoodsJpy).toBe(true);
    });

    it("POST: thêm dòng chi phí thực tế thành công và từ chối số tiền không nguyên", async () => {
      vi.spyOn(prisma.order, "findFirst").mockResolvedValue({ id: "ord-1", orderCode: "CB-001" } as any);
      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => {
        const tx = {
          orderCostLine: {
            create: vi.fn().mockResolvedValue({
              id: "c-new",
              orderId: "ord-1",
              category: "TOKYO_HANDLING",
              amountOriginal: 300,
              currency: "JPY",
              amountVnd: 51600,
              createdBy: "admin_super",
            }),
          },
          auditLog: { create: vi.fn().mockResolvedValue({ id: "a1" }) },
        };
        return callback(tx);
      });

      // Hợp lệ
      const reqValid = new NextRequest("http://localhost/api/admin/orders/ord-1/costs", {
        method: "POST",
        body: JSON.stringify({
          category: "TOKYO_HANDLING",
          amountOriginal: 300,
          currency: "JPY",
          fxRate: 172,
          amountVnd: 51600,
          note: "Phí đóng gói Tokyo",
        }),
      });
      const resValid = await handleCosts(reqValid, { params: Promise.resolve({ id: "ord-1" }) });
      expect(resValid.status).toBe(201);

      // Không hợp lệ: amountVnd là float
      const reqInvalid = new NextRequest("http://localhost/api/admin/orders/ord-1/costs", {
        method: "POST",
        body: JSON.stringify({
          category: "TOKYO_HANDLING",
          amountOriginal: 300,
          currency: "JPY",
          amountVnd: 51600.75, // Vi phạm bất biến số nguyên
        }),
      });
      const resInvalid = await handleCosts(reqInvalid, { params: Promise.resolve({ id: "ord-1" }) });
      expect(resInvalid.status).toBe(400);
      const invalidBody = await resInvalid.json();
      expect(invalidBody.error).toContain("amountVnd phải là số nguyên");
    });

    it("POST action=void: hủy dòng chi phí bằng cách gắn cờ voidedAt và bắt buộc nhập lý do", async () => {
      vi.spyOn(prisma.order, "findFirst").mockResolvedValue({ id: "ord-1", orderCode: "CB-001" } as any);

      // Thiếu lý do -> 400
      const reqNoReason = new NextRequest("http://localhost/api/admin/orders/ord-1/costs", {
        method: "POST",
        body: JSON.stringify({ action: "void", costLineId: "c1", reason: "" }),
      });
      const resNoReason = await handleCosts(reqNoReason, { params: Promise.resolve({ id: "ord-1" }) });
      expect(resNoReason.status).toBe(400);

      // Có lý do -> thành công
      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => {
        const tx = {
          orderCostLine: {
            findUnique: vi.fn().mockResolvedValue({
              id: "c1",
              orderId: "ord-1",
              category: "OTHER",
              amountVnd: 50000,
              voidedAt: null,
            }),
            update: vi.fn().mockResolvedValue({
              id: "c1",
              voidedAt: new Date(),
              note: "[HỦY: Nhập nhầm]",
            }),
          },
          auditLog: { create: vi.fn().mockResolvedValue({ id: "a2" }) },
        };
        return callback(tx);
      });

      const reqValidVoid = new NextRequest("http://localhost/api/admin/orders/ord-1/costs", {
        method: "POST",
        body: JSON.stringify({ action: "void", costLineId: "c1", reason: "Nhập nhầm" }),
      });
      const resValidVoid = await handleCosts(reqValidVoid, { params: Promise.resolve({ id: "ord-1" }) });
      expect(resValidVoid.status).toBe(200);
      const voidBody = await resValidVoid.json();
      expect(voidBody.success).toBe(true);
    });
  });

  describe("PurchaseTask completion and deviation alert", () => {
    it("Hoàn tất PurchaseTask: tạo OrderCostLine GOODS_JPY và phát cảnh báo nếu lệch giá > 5%", async () => {
      const mockTask = {
        id: "pt-123",
        status: "IN_PROGRESS",
        platform: "rakuten",
        order: {
          id: "ord-99",
          orderCode: "CB-DEV-01",
          productName: "Tai nghe Sony",
          priceJpy: 10000, // Giá báo ban đầu là 10.000 ¥
          exchangeRate: 172,
        },
      };

      vi.spyOn(prisma.purchaseTask, "findUnique").mockResolvedValue(mockTask as any);
      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => {
        const tx = {
          purchaseTask: {
            update: vi.fn().mockResolvedValue({ ...mockTask, status: "PURCHASED" }),
          },
          trackingLog: { create: vi.fn().mockResolvedValue({ id: "log-1" }) },
          orderCostLine: { create: vi.fn().mockResolvedValue({ id: "cost-jpy-1" }) },
        };
        return callback(tx);
      });

      // Mua với giá 11.000 ¥ (lệch +10% > 5%)
      const req = new NextRequest("http://localhost/api/admin/purchase-tasks/pt-123", {
        method: "PATCH",
        body: JSON.stringify({
          action: "complete",
          externalOrderId: "RAK-998877",
          staffName: "tanaka_jp",
          actualPriceJpy: 11000,
          fxRate: 173,
          receiptUrl: "https://example.com/receipt.jpg",
        }),
      });

      const res = await updatePurchaseTask(req, { params: Promise.resolve({ id: "pt-123" }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.warning).toBeDefined();
      expect(body.warning).toContain("Cảnh báo: Giá thực mua");
      expect(body.warning).toContain("10.0%");
    });
  });
});
