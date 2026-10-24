import { afterEach, describe, expect, it, vi } from "vitest";
import { detectSupportIntents } from "@/features/ai/customer/support-policy";
import {
  runCustomerSupportTools,
  type ProductCardData,
} from "@/features/ai/customer/support-tools";
import { prisma } from "@/lib/prisma";

vi.mock("@/features/pricing/config", () => ({
  getCurrentPricingConfig: vi.fn(async () => ({
    version: 1,
    values: {
      flatWeightThresholdKg: 0.5,
      flatShippingFeeVnd: 50000,
      perKgShippingRateVnd: 185000,
      fxSpreadPercent: 2,
      tier1MaxJpy: 10000,
      tier1ServiceFeePercent: 8,
      tier2MaxJpy: 50000,
      tier2ServiceFeePercent: 6,
      tier3ServiceFeePercent: 5,
      minServiceFeeVnd: 20000,
      baseInsurancePercent: 3,
      highValueInsurancePercent: 5,
    },
    changedBy: "test",
    changeReason: null,
    createdAt: new Date(),
  })),
}));

vi.mock("@/features/pricing/exchange-rate", () => ({
  fetchLiveExchangeRate: vi.fn(async () => ({
    rate: 165,
    roundedRate: 165,
    previousRate: 165,
    changePercent: 0,
    updatedAt: "2026-01-01T00:00:00Z",
    source: "mock",
    isFallback: false,
    isStale: false,
  })),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BƯỚC 5: Chức năng Thêm vào giỏ từ chat", () => {
  describe("detectSupportIntents: Intent add_to_cart", () => {
    it("nhận diện đúng intent khi khách yêu cầu thêm vào giỏ", () => {
      expect(detectSupportIntents("thêm vào giỏ").addToCart).toBe(true);
      expect(detectSupportIntents("cho vào giỏ hàng giúp mình").addToCart).toBe(true);
      expect(detectSupportIntents("bỏ vào giỏ hàng").addToCart).toBe(true);
      expect(detectSupportIntents("add to cart").addToCart).toBe(true);
      expect(detectSupportIntents("đặt mua món này").addToCart).toBe(true);
    });

    it("không kích hoạt add_to_cart khi chỉ hỏi thông tin thông thường", () => {
      expect(detectSupportIntents("Nồi cơm Zojirushi giá bao nhiêu?").addToCart).toBe(false);
      expect(detectSupportIntents("Tư vấn cách chọn size").addToCart).toBe(false);
      expect(detectSupportIntents("Chính sách vận chuyển thế nào").addToCart).toBe(false);
    });
  });

  describe("runCustomerSupportTools với intent add_to_cart", () => {
    it("khi khách nói 'thêm vào giỏ', dùng sản phẩm Catalog gần nhất trong lịch sử và trả productCards cho đúng sản phẩm đó", async () => {
      const mockProductCard: ProductCardData = {
        id: "prod-zojirushi-123",
        name: "Nồi cơm điện Zojirushi NP-XB10",
        imageUrl: "https://example.com/zojirushi.jpg",
        priceJpy: 15000,
        priceVnd: 2475000,
        inStock: true,
        weightKg: 4.2,
        originalStore: "Amazon JP",
        category: "gadgets",
      };

      const history = [
        { role: "user", text: "Tìm nồi cơm Zojirushi" },
        {
          role: "assistant",
          text: "Dạ đây là mẫu Nồi cơm điện Zojirushi NP-XB10 nội địa Nhật.",
          productCards: [mockProductCard],
        },
      ];

      const res = await runCustomerSupportTools({
        message: "thêm vào giỏ",
        customerId: null,
        guestOrderAccessToken: null,
        scrapedProduct: null,
        history,
      });

      // Phải trả về productCards đúng sản phẩm đó
      expect(res.productCards).toBeDefined();
      expect(res.productCards!.length).toBe(1);
      expect(res.productCards![0].id).toBe("prod-zojirushi-123");
      expect(res.productCards![0].name).toBe("Nồi cơm điện Zojirushi NP-XB10");

      // AI KHÔNG BAO GIỜ được tự khẳng định 'đã thêm vào giỏ', chỉ hướng dẫn bấm nút
      expect(res.guardedReply).toContain("Quý khách bấm nút Thêm vào giỏ bên dưới");
      expect(res.guardedReply).not.toContain("Đã thêm vào giỏ");
    });

    it("khi lịch sử chỉ có dạng text, tìm lại đúng sản phẩm Catalog trong database", async () => {
      const mockProduct = {
        id: "prod-uniqlo-456",
        name: "Áo khoác gió Uniqlo nam siêu nhẹ",
        imageUrl: "https://example.com/uniqlo.jpg",
        priceJpy: 3990,
        priceVnd: 658000,
        weightKg: 0.3,
        originalStore: "Uniqlo JP",
        category: "fashion",
        stockSlots: 5,
        description: "Áo khoác gió chống nước",
        voltageNote: null,
        createdAt: new Date(),
      };

      vi.spyOn(prisma.product, "findMany").mockResolvedValueOnce([mockProduct as any]);

      const history = [
        { role: "user", text: "Tìm áo khoác Uniqlo" },
        {
          role: "assistant",
          text: "Dạ có sản phẩm Áo khoác gió Uniqlo nam siêu nhẹ chính hãng.",
        },
      ];

      const res = await runCustomerSupportTools({
        message: "cho vào giỏ hàng giúp mình",
        customerId: null,
        guestOrderAccessToken: null,
        scrapedProduct: null,
        history,
      });

      expect(res.productCards).toBeDefined();
      expect(res.productCards!.length).toBe(1);
      expect(res.productCards![0].id).toBe("prod-uniqlo-456");
      expect(res.guardedReply).toContain("Quý khách bấm nút Thêm vào giỏ bên dưới");
      expect(res.guardedReply).not.toContain("Đã thêm vào giỏ");
    });

    it("khi không tìm thấy sản phẩm trong lịch sử, hướng dẫn khách chọn sản phẩm trước", async () => {
      vi.spyOn(prisma.product, "findMany").mockResolvedValueOnce([]);

      const history = [
        { role: "user", text: "Xin chào shop" },
        { role: "assistant", text: "Chào bạn, mình có thể giúp gì cho bạn?" },
      ];

      const res = await runCustomerSupportTools({
        message: "thêm vào giỏ",
        customerId: null,
        guestOrderAccessToken: null,
        scrapedProduct: null,
        history,
      });

      expect(res.productCards).toEqual([]);
      expect(res.guardedReply).toContain("chưa tìm thấy sản phẩm");
      expect(res.guardedReply).not.toContain("Đã thêm vào giỏ");
    });
  });
});
