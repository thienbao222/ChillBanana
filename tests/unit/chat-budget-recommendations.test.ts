import { afterEach, describe, expect, it, vi } from "vitest";
import {
  searchCatalogByBudget,
  runCustomerSupportTools,
  parseBudgetAndCurrency,
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

describe("Gợi ý theo ngân sách (Budget-based recommendations)", () => {
  const mockCatalogProducts = [
    {
      id: "prod-anessa",
      name: "Kem chống nắng Anessa Perfect UV Sunscreen",
      category: "cosmetics",
      categoryName: "Mỹ phẩm",
      priceJpy: 3000,
      priceVnd: 514000,
      weightKg: 0.1,
      stockSlots: 10,
      description: "Chống nắng cao cấp",
      voltageNote: null,
      imageUrl: "https://example.com/anessa.jpg",
      originalStore: "Amazon JP",
      createdAt: new Date(),
    },
    {
      id: "prod-dhc",
      name: "Dầu tẩy trang DHC Deep Cleansing Oil",
      category: "cosmetics",
      categoryName: "Mỹ phẩm",
      priceJpy: 2500,
      priceVnd: 428000,
      weightKg: 0.25,
      stockSlots: 8,
      description: "Tẩy trang dầu olive",
      voltageNote: null,
      imageUrl: "https://example.com/dhc.jpg",
      originalStore: "Mercari JP",
      createdAt: new Date(),
    },
    {
      id: "prod-gundam",
      name: "Mô hình Gundam RG 1/144 RX-78-2",
      category: "anime",
      categoryName: "Mô hình Anime",
      priceJpy: 4500,
      priceVnd: 771000,
      weightKg: 0.5,
      stockSlots: 4,
      description: "Gundam chính hãng Bandai",
      voltageNote: null,
      imageUrl: "https://example.com/gundam.jpg",
      originalStore: "Amazon JP",
      createdAt: new Date(),
    },
    {
      id: "prod-zojirushi-expensive",
      name: "Nồi cơm điện cao tần Zojirushi cao cấp",
      category: "gadgets",
      categoryName: "Đồ gia dụng",
      priceJpy: 45000,
      priceVnd: 7712000, // Vượt quá ngân sách 2 triệu
      weightKg: 5.5,
      stockSlots: 2,
      description: "Nồi cơm áp suất cao tần",
      voltageNote: "100V",
      imageUrl: "https://example.com/zojirushi.jpg",
      originalStore: "Amazon JP",
      createdAt: new Date(),
    },
  ];

  it("parseBudgetAndCurrency phân tích chuẩn 'tầm 2 triệu', '500k', '2tr5'", () => {
    expect(parseBudgetAndCurrency("tầm 2 triệu nên mua gì").approxVndEquivalent).toBe(2000000);
    expect(parseBudgetAndCurrency("500k có món gì hay").approxVndEquivalent).toBe(500000);
    expect(parseBudgetAndCurrency("ngân sách 2tr5 mua quà").approxVndEquivalent).toBe(2500000);
  });

  it("searchCatalogByBudget lọc sản phẩm có giá VND ước tính <= ngân sách và xếp theo nhóm", async () => {
    vi.spyOn(prisma.product, "findMany").mockResolvedValue(mockCatalogProducts as any);

    const evidence = await searchCatalogByBudget(2000000);

    expect(evidence.status).toBe("ok");
    expect(evidence.known.searched).toBe(true);
    expect(evidence.known.isBudgetFilter).toBe(true);
    expect(evidence.known.budgetVnd).toBe(2000000);

    const prods = evidence.known.products as any[];
    expect(prods.length).toBeGreaterThan(0);

    // Mọi sản phẩm được gợi ý đều phải <= 2 triệu
    for (const p of prods) {
      expect(p.estimatedProductPriceVnd).toBeLessThanOrEqual(2000000);
      expect(p.id).not.toBe("prod-zojirushi-expensive");
    }

    // Đã phân nhóm theo ngành hàng
    const grouped = evidence.known.groupedByCategory as any[];
    expect(grouped.length).toBeGreaterThan(0);
    const catKeys = grouped.map((g) => g.categoryKey);
    expect(catKeys).toContain("cosmetics");
    expect(catKeys).toContain("anime");
    expect(catKeys).not.toContain("gadgets"); // Đồ gia dụng > 2tr bị lọc bỏ hoàn toàn
  });

  it("runCustomerSupportTools tự động nhận diện câu 'tầm 2 triệu nên mua gì' và trả sản phẩm thật", async () => {
    vi.spyOn(prisma.product, "findMany").mockResolvedValue(mockCatalogProducts as any);

    const res = await runCustomerSupportTools({
      message: "tầm 2 triệu nên mua gì",
      customerId: null,
      guestOrderAccessToken: null,
      scrapedProduct: null,
    });

    const catalogEv = res.evidence.find((e) => e.toolId === "catalog_search");
    expect(catalogEv).toBeDefined();
    expect(catalogEv?.known.isBudgetFilter).toBe(true);
    expect(catalogEv?.known.budgetVnd).toBe(2000000);

    // Product cards chỉ chứa sản phẩm có giá <= 2 triệu
    expect(res.productCards).toBeDefined();
    expect(res.productCards!.length).toBeGreaterThan(0);
    for (const card of res.productCards!) {
      expect(card.priceVnd).toBeLessThanOrEqual(2000000);
      expect(card.id).not.toBe("prod-zojirushi-expensive");
    }

    // buildOfflineEvidenceReply hiển thị gợi ý theo nhóm hàng
    const reply = buildOfflineEvidenceReply("tầm 2 triệu nên mua gì", res.evidence, true);
    expect(reply).toContain("Gợi ý sản phẩm trong tầm ngân sách");
    expect(reply).toContain("2.000.000 đ");
    expect(reply).toContain("Kem chống nắng Anessa");
    expect(reply).toContain("Mô hình Gundam");
    expect(reply).not.toContain("Nồi cơm điện cao tần Zojirushi cao cấp");
  });

  it("không bịa đặt sản phẩm khi ngân sách quá thấp so với catalog", async () => {
    vi.spyOn(prisma.product, "findMany").mockResolvedValue(mockCatalogProducts as any);

    const evidence = await searchCatalogByBudget(50000); // 50 nghìn VND - catalog không có món nào rẻ vậy
    expect(evidence.known.resultCount).toBe(0);
    const prods = evidence.known.products as any[];
    expect(prods.length).toBe(0);
  });
});
