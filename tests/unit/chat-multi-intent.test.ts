import { afterEach, describe, expect, it, vi } from "vitest";
import { detectSupportIntents } from "@/features/ai/customer/support-policy";
import {
  extractComparisonQueries,
  runCustomerSupportTools,
  type ProductCardData,
} from "@/features/ai/customer/support-tools";
import { buildOfflineEvidenceReply } from "@/features/ai/customer/assistant";
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
    rate: 171.38,
    roundedRate: 171.38,
    previousRate: 171.38,
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

describe("Multi-intent in single prompt (Nhiều ý định trong một câu)", () => {
  describe("Ý định kết hợp: Giá X và thêm vào giỏ", () => {
    it("nhận diện đồng thời cả intent quote, catalog và addToCart", () => {
      const intents = detectSupportIntents("giá mô hình luffy gear 5 và thêm vào giỏ");
      expect(intents.quote).toBe(true);
      expect(intents.catalog).toBe(true);
      expect(intents.addToCart).toBe(true);
    });

    it("không bỏ qua tìm catalog khi có addToCart; trả thẻ sản phẩm kèm giá đầy đủ", async () => {
      const mockProduct = {
        id: "prod-luffy-gear5",
        name: "Mô hình One Piece Luffy Gear 5",
        imageUrl: "https://example.com/luffy.jpg",
        priceJpy: 12000,
        priceVnd: 2056000,
        weightKg: 0.8,
        originalStore: "Amazon JP",
        category: "anime",
        stockSlots: 5,
        description: "Mô hình Luffy Gear 5 trạng thái thức tỉnh",
        voltageNote: null,
        categoryName: "Mô hình Anime",
        createdAt: new Date(),
      };

      vi.spyOn(prisma.product, "findMany").mockResolvedValue([mockProduct as any]);

      const res = await runCustomerSupportTools({
        message: "giá mô hình luffy gear 5 và thêm vào giỏ",
        customerId: null,
        guestOrderAccessToken: null,
        scrapedProduct: null,
      });

      // Product card phải có và chứa giá VND lẫn JPY
      expect(res.productCards).toBeDefined();
      expect(res.productCards!.length).toBe(1);
      expect(res.productCards![0].id).toBe("prod-luffy-gear5");
      expect(res.productCards![0].priceJpy).toBe(12000);
      expect(res.productCards![0].priceVnd).toBeGreaterThan(0);

      // Phản hồi có chứa thông tin giá chứ không chỉ hướng dẫn thêm vào giỏ
      expect(res.guardedReply).toContain("12.000");
      expect(res.guardedReply).toContain("giá");
      expect(res.guardedReply).toContain("Quý khách bấm nút Thêm vào giỏ bên dưới");

      // Evidence phải chứa catalog_search
      const hasCatalogEvidence = res.evidence.some(
        (e) => e.toolId === "catalog_search" && e.status === "ok"
      );
      expect(hasCatalogEvidence).toBe(true);
    });
  });

  describe("Ý định so sánh 2 sản phẩm: So sánh A và B", () => {
    it("extractComparisonQueries tách đúng 2 vế sản phẩm từ câu hỏi", () => {
      const query1 = extractComparisonQueries("so sánh kem chống nắng anessa và dầu tẩy trang dhc");
      expect(query1).not.toBeNull();
      expect(query1?.queryA).toContain("anessa");
      expect(query1?.queryB).toContain("dhc");

      const query2 = extractComparisonQueries("so sánh nồi cơm điện zojirushi với máy cạo râu panasonic");
      expect(query2).not.toBeNull();
      expect(query2?.queryA).toContain("zojirushi");
      expect(query2?.queryB).toContain("panasonic");

      const query3 = extractComparisonQueries("nên mua kem chống nắng anessa hay dầu tẩy trang dhc");
      expect(query3).not.toBeNull();
      expect(query3?.queryA).toContain("anessa");
      expect(query3?.queryB).toContain("dhc");
    });

    it("trả về bằng chứng so sánh gồm giá, cân nặng, điện áp, tồn kho và thẻ 2 sản phẩm", async () => {
      const prodA = {
        id: "prod-anessa",
        name: "Kem chống nắng Anessa Perfect UV Sunscreen",
        imageUrl: "https://example.com/anessa.jpg",
        priceJpy: 3000,
        priceVnd: 514000,
        weightKg: 0.1,
        originalStore: "Amazon JP",
        category: "cosmetics",
        stockSlots: 10,
        description: "Kem chống nắng kiềm dầu",
        voltageNote: null,
        categoryName: "Mỹ phẩm",
        createdAt: new Date(),
      };

      const prodB = {
        id: "prod-dhc",
        name: "Dầu tẩy trang DHC Deep Cleansing Oil",
        imageUrl: "https://example.com/dhc.jpg",
        priceJpy: 2500,
        priceVnd: 428000,
        weightKg: 0.25,
        originalStore: "Mercari JP",
        category: "cosmetics",
        stockSlots: 8,
        description: "Dầu tẩy trang chiết xuất olive",
        voltageNote: null,
        categoryName: "Mỹ phẩm",
        createdAt: new Date(),
      };

      vi.spyOn(prisma.product, "findMany").mockResolvedValue([prodA as any, prodB as any]);

      const res = await runCustomerSupportTools({
        message: "so sánh kem chống nắng anessa và dầu tẩy trang dhc",
        customerId: null,
        guestOrderAccessToken: null,
        scrapedProduct: null,
      });

      // Product cards phải có cả 2 sản phẩm
      expect(res.productCards).toBeDefined();
      expect(res.productCards!.length).toBe(2);
      expect(res.productCards!.map((p) => p.name)).toEqual(
        expect.arrayContaining([prodA.name, prodB.name])
      );

      // Phải có bằng chứng product_comparison
      const comparisonEv = res.evidence.find((e) => e.toolId === "product_comparison");
      expect(comparisonEv).toBeDefined();
      expect(comparisonEv?.status).toBe("ok");
      expect(comparisonEv?.known.compared).toBe(true);

      const pA = comparisonEv?.known.productA as any;
      const pB = comparisonEv?.known.productB as any;
      expect(pA).toBeDefined();
      expect(pB).toBeDefined();
      expect(pA.priceJpy).toBe(3000);
      expect(pB.priceJpy).toBe(2500);
      expect(pA.weightKg).toBeDefined();
      expect(pB.weightKg).toBeDefined();
      expect(pA.voltage).toBeDefined();
      expect(pB.voltage).toBeDefined();
      expect(pA.stockSlots).toBeDefined();
      expect(pB.stockSlots).toBeDefined();

      // buildOfflineEvidenceReply xuất ra bảng so sánh 4 thông số
      const offlineReply = buildOfflineEvidenceReply(
        "so sánh kem chống nắng anessa và dầu tẩy trang dhc",
        res.evidence,
        true
      );
      expect(offlineReply).toContain("So sánh thông số");
      expect(offlineReply).toContain("Giá");
      expect(offlineReply).toContain("Cân nặng");
      expect(offlineReply).toContain("Điện áp");
      expect(offlineReply).toContain("Tồn kho");
    });
  });
});
