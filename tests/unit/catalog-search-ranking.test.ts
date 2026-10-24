import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractCatalogSearchTerms,
  SEARCH_STOP_WORDS,
} from "@/features/ai/customer/support-policy";
import {
  matchesWholePhraseOrWord,
  tokenizeNormalizedWords,
  searchCatalog,
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

describe("BƯỚC 3: Lọc từ khóa và xếp hạng sản phẩm", () => {
  describe("Mở rộng SEARCH_STOP_WORDS và extractCatalogSearchTerms", () => {
    it("chứa đầy đủ các từ tiếng Việt phổ thông theo yêu cầu", () => {
      const requiredWords = [
        "co", "khong", "kem", "them", "san", "pham", "do", "nay", "vao",
        "gio", "hang", "cua", "toi", "minh", "cho", "thi", "sao", "nao",
        "gi", "muon", "can", "xem", "giup", "voi", "va", "hay", "hoac",
        "bao", "nhieu",
      ];
      for (const word of requiredWords) {
        expect(SEARCH_STOP_WORDS.has(word), `Thiếu stop word: ${word}`).toBe(true);
      }
    });

    it("lọc sạch câu giao tiếp / giỏ hàng thành mảng rỗng", () => {
      expect(extractCatalogSearchTerms("Có sản phẩm này trong giỏ hàng của tôi không")).toEqual([]);
      expect(extractCatalogSearchTerms("Có kèm thêm vào giỏ hàng không shop")).toEqual([]);
      expect(extractCatalogSearchTerms("Bên mình có sản phẩm nào cho tôi xem với")).toEqual([]);
      expect(extractCatalogSearchTerms("Cho mình hỏi cái này giá bao nhiêu ạ")).toEqual([]);
    });

    it("trích xuất chính xác các từ khóa thực tế khi người dùng tìm sản phẩm", () => {
      const terms = extractCatalogSearchTerms("Bạn tìm giúp mình tai nghe Sony WH-1000XM5 với");
      expect(terms).toContain("tai");
      expect(terms).toContain("nghe");
      expect(terms).toContain("Sony");
      expect(terms).toContain("WH-1000XM5");
      expect(terms).not.toContain("ban");
      expect(terms).not.toContain("tim");
      expect(terms).not.toContain("giup");
      expect(terms).not.toContain("minh");
      expect(terms).not.toContain("voi");
    });
  });

  describe("Khớp theo từ nguyên vẹn (matchesWholePhraseOrWord)", () => {
    it("khớp đúng từ nguyên vẹn có hoặc không có dấu", () => {
      const textNorm = "ao khoac gio uniqlo nam sieu nhe";
      const words = new Set(tokenizeNormalizedWords(textNorm));

      expect(matchesWholePhraseOrWord(textNorm, words, "áo")).toBe(true);
      expect(matchesWholePhraseOrWord(textNorm, words, "khoác")).toBe(true);
      expect(matchesWholePhraseOrWord(textNorm, words, "nam")).toBe(true);
      expect(matchesWholePhraseOrWord(textNorm, words, "uniqlo")).toBe(true);
    });

    it("KHÔNG khớp substring nếu không phải từ nguyên vẹn (tránh bug 'ao' trong 'chào')", () => {
      const textNorm = "xin chao quy khach den voi cua hang";
      const words = new Set(tokenizeNormalizedWords(textNorm));

      // 'ao' là chuỗi con của 'chao', nhưng KHÔNG phải từ nguyên vẹn
      expect(matchesWholePhraseOrWord(textNorm, words, "áo")).toBe(false);
      expect(matchesWholePhraseOrWord(textNorm, words, "ao")).toBe(false);

      // 'hang' trong 'thang 10' không được khớp nếu từ là 'thang'
      const textNorm2 = "thang muoi nam nay co khuyen mai";
      const words2 = new Set(tokenizeNormalizedWords(textNorm2));
      expect(matchesWholePhraseOrWord(textNorm2, words2, "hang")).toBe(false);
    });

    it("hỗ trợ thương hiệu và model có dấu gạch ngang", () => {
      const textNorm = "noi chien khong dau t-fal 4.2l";
      const words = new Set(tokenizeNormalizedWords(textNorm));
      expect(matchesWholePhraseOrWord(textNorm, words, "t-fal")).toBe(true);
      expect(matchesWholePhraseOrWord(textNorm, words, "tfal")).toBe(false);
    });
  });

  describe("searchCatalog: Xếp hạng và quy tắc lọc khi có từ 2 từ khóa trở lên", () => {
    it("khi có từ 2 từ khóa trở lên, loại bỏ sản phẩm không liên quan chỉ khớp 1 từ chung chung", async () => {
      // Giả lập danh mục có 2 sản phẩm:
      // 1) "Giày thể thao nam Bitis Hunter" (khớp 'giay', 'the', 'thao', 'nam')
      // 2) "Ví cầm tay nam da bò Gucci" (chỉ khớp 1 từ 'nam')
      const products = [
        {
          id: "prod-1",
          name: "Giày thể thao nam Bitis Hunter",
          category: "fashion",
          categoryName: "Thời trang & Phụ kiện",
          priceJpy: 5000,
          weightKg: 0.8,
          stockSlots: 5,
          description: "Giày thể thao chạy bộ êm chân",
          voltageNote: null,
          createdAt: new Date("2026-01-02"),
        },
        {
          id: "prod-2",
          name: "Ví cầm tay nam da bò Gucci",
          category: "luxury",
          categoryName: "Đồ hiệu & Thời trang",
          priceJpy: 25000,
          weightKg: 0.3,
          stockSlots: 2,
          description: "Ví da cao cấp chính hãng",
          voltageNote: null,
          createdAt: new Date("2026-01-01"),
        },
      ];

      vi.spyOn(prisma.product, "findMany").mockResolvedValueOnce(products as any);

      // Query: "giày thể thao nam" (terms = ['giay', 'thao', 'nam']) -> 3 từ khóa (>= 2)
      const evidence = await searchCatalog("giày thể thao nam", null);
      const results = (evidence.known.products as any[]) || [];

      // Phải giữ lại "Giày thể thao nam Bitis Hunter" (khớp >= 2 từ)
      expect(results.some((p) => p.name.includes("Giày thể thao nam"))).toBe(true);

      // Tuyệt đối KHÔNG hiển thị "Ví cầm tay nam da bò Gucci" vì chỉ khớp 1 từ 'nam' chung chung
      expect(results.some((p) => p.name.includes("Ví cầm tay nam"))).toBe(false);
    });

    it("giữ lại sản phẩm khi khớp trọn tên thương hiệu dù từ khóa khác không khớp", async () => {
      const products = [
        {
          id: "prod-3",
          name: "Kem chống nắng Anessa Perfect UV Milk",
          category: "cosmetics",
          categoryName: "Mỹ phẩm",
          priceJpy: 2680,
          weightKg: 0.2,
          stockSlots: 4,
          description: "Chống nắng kiềm dầu",
          voltageNote: null,
          createdAt: new Date("2026-01-03"),
        },
      ];

      vi.spyOn(prisma.product, "findMany").mockResolvedValueOnce(products as any);

      // Query có thương hiệu "Anessa"
      const evidence = await searchCatalog("hàng Anessa mới về hôm nay", null);
      const results = (evidence.known.products as any[]) || [];

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain("Anessa");
    });
  });
});
