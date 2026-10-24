import { describe, expect, it, vi, afterEach } from "vitest";
import { isSingleItemStore, CartItem } from "@/context/CartContext";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
    },
  },
}));

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
    roundedRate: 172,
    previousRate: 171,
    changePercent: 0.2,
    updatedAt: "2026-10-24T00:00:00Z",
    source: "Vietcombank Live",
    isFallback: false,
    isStale: false,
  })),
}));

vi.mock("@/lib/api-key-manager", () => ({
  chatKeyPool: {
    getNextKey: vi.fn(() => null),
    markError: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { runCustomerSupportTools } from "@/features/ai/customer/support-tools";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CartContext & Add-To-Cart Persistence", () => {
  it("xác định đúng cửa hàng đơn bản (Mercari/Yahoo Auction) vs thông thường", () => {
    expect(isSingleItemStore("Mercari JP")).toBe(true);
    expect(isSingleItemStore("Mercari Japan")).toBe(true);
    expect(isSingleItemStore("Yahoo Auction JP")).toBe(true);
    expect(isSingleItemStore("Orihiro JP Direct")).toBe(false);
    expect(isSingleItemStore("Amazon JP")).toBe(false);
    expect(isSingleItemStore("Catalog ChillBanana")).toBe(false);
  });

  it("runCustomerSupportTools trả productCards có đầy đủ stockSlots và weightKg cho sản phẩm Catalog", async () => {
    const mockProducts = [
      {
        id: "prod-hea-02",
        name: "Viên Uống Bổ Não Orihiro Ginkgo Biloba 120 viên",
        slug: "vien-uong-bo-nao-orihiro-ginkgo-biloba",
        category: "health",
        categoryName: "Thực Phẩm Chức Năng",
        priceJpy: 1850,
        priceVnd: 318200,
        weightKg: 0.2,
        stockSlots: 12,
        description: "Chiết xuất lá bạch quả Ginkgo giúp tăng cường trí nhớ",
        voltageNote: null,
        imageUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843",
        originalStore: "Orihiro JP Direct",
        createdAt: new Date(),
      },
    ];

    vi.mocked(prisma.product.findMany).mockResolvedValueOnce(mockProducts as any);

    const result = await runCustomerSupportTools({
      message: "thêm Viên Uống Bổ Não Orihiro Ginkgo Biloba vào giỏ hàng giúp tôi",
      customerId: null,
      guestOrderAccessToken: null,
      scrapedProduct: null,
    });

    expect(result.productCards).toBeDefined();
    expect(result.productCards?.length).toBe(1);
    const card = result.productCards![0];
    expect(card.id).toBe("prod-hea-02");
    expect(card.name).toBe("Viên Uống Bổ Não Orihiro Ginkgo Biloba 120 viên");
    expect(card.priceJpy).toBe(1850);
    expect(card.inStock).toBe(true);
    expect(card.stockSlots).toBe(12);
    expect(card.weightKg).toBe(0.2);
    expect(card.originalStore).toBe("Orihiro JP Direct");
  });

  it("giỏ hàng xử lý an toàn dữ liệu từ localStorage, không bị xóa sạch khi có thuộc tính lỏng lẻo", () => {
    // Giả lập dữ liệu thô trong localStorage
    const rawStored = [
      {
        id: "prod-hea-02",
        name: "Viên Uống Bổ Não Orihiro Ginkgo Biloba 120 viên",
        quantity: 1,
        priceJpy: 1850,
        priceVnd: 318200,
        weightKg: 0.2,
        imageUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843",
        originalStore: "Orihiro JP Direct",
        stockSlots: 12,
      },
      {
        // Item với số dạng string hoặc thiếu priceVnd
        id: "prod-anime-01",
        name: "Mô hình Luffy Gear 5",
        quantity: 2,
        priceJpy: "4500",
        priceVnd: null,
        weightKg: "0.8",
        imageUrl: "https://example.com/luffy.jpg",
      },
    ];

    // Parser chuẩn hóa trong CartContext
    const parsed = rawStored;
    const sanitized = parsed
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map((item) => {
        const id = typeof item.id === "string" && item.id.trim() ? item.id : `item-${Date.now()}`;
        const name = typeof item.name === "string" && item.name.trim() ? item.name : "Sản phẩm mua hộ";
        const quantity = Number.isSafeInteger(item.quantity) && (item.quantity as number) > 0 ? (item.quantity as number) : 1;
        const priceJpy = Math.max(0, Math.round(Number(item.priceJpy) || 0));
        const priceVnd = Math.max(0, Math.round(Number(item.priceVnd) || 0));
        const weightKg = Number.isFinite(Number(item.weightKg)) && Number(item.weightKg) >= 0 ? Number(item.weightKg) : 0.5;
        const imageUrl = typeof item.imageUrl === "string" && item.imageUrl ? item.imageUrl : "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80";
        const originalStore = typeof item.originalStore === "string" ? item.originalStore : "Catalog ChillBanana";
        const stockSlots = typeof item.stockSlots === "number" ? item.stockSlots : undefined;

        return {
          id,
          name,
          quantity,
          priceJpy,
          priceVnd,
          weightKg,
          imageUrl,
          originalStore,
          stockSlots,
        } as CartItem;
      })
      .filter((item) => item.quantity > 0 && item.priceJpy >= 0);

    expect(sanitized.length).toBe(2);
    expect(sanitized[0].name).toBe("Viên Uống Bổ Não Orihiro Ginkgo Biloba 120 viên");
    expect(sanitized[0].quantity).toBe(1);
    expect(sanitized[0].priceJpy).toBe(1850);
    expect(sanitized[0].weightKg).toBe(0.2);

    expect(sanitized[1].name).toBe("Mô hình Luffy Gear 5");
    expect(sanitized[1].quantity).toBe(2);
    expect(sanitized[1].priceJpy).toBe(4500); // Đã cast thành số an toàn
    expect(sanitized[1].weightKg).toBe(0.8);
    expect(sanitized[1].priceVnd).toBe(0);
  });
});
