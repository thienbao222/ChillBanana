import { afterEach, describe, expect, it, vi } from "vitest";

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

describe("BƯỚC D: Kiểm thử độ chính xác thêm vào giỏ và tính nhất quán tỷ giá", () => {
  const luffyProduct = {
    id: "prod-luffy-gear-5",
    name: "Mô hình ONE PIECE Monkey D. Luffy Gear 5 Wano",
    category: "anime",
    categoryName: "Anime & Mô hình",
    priceJpy: 8500,
    weightKg: 0.7,
    stockSlots: 3,
    description: "Mô hình Luffy trạng thái Thần Mặt Trời Gear 5 chính hãng Bandai",
    voltageNote: null,
    imageUrl: "https://example.com/luffy.jpg",
    originalStore: "Bandai Namco JP",
    createdAt: new Date("2026-01-02"),
  };

  const gunplaProduct = {
    id: "prod-gunpla-rg",
    name: "Mô hình Bandai Gunpla RG 1/144 Wing Zero",
    category: "anime",
    categoryName: "Anime & Mô hình",
    priceJpy: 4500,
    weightKg: 0.5,
    stockSlots: 2,
    description: "Mô hình Gundam Bandai chính hãng",
    voltageNote: null,
    imageUrl: "https://example.com/gunpla.jpg",
    originalStore: "Amazon JP",
    createdAt: new Date("2026-01-01"),
  };

  const shaverProduct = {
    id: "prod-shaver",
    name: "Máy cạo râu Panasonic Lamdash 5 lưỡi",
    category: "gadgets",
    categoryName: "Gia dụng & Thiết bị",
    priceJpy: 18000,
    weightKg: 0.4,
    stockSlots: 3,
    description: "Máy cạo râu nội địa Nhật",
    voltageNote: "100V-240V",
    imageUrl: "https://example.com/shaver.jpg",
    originalStore: "Bic Camera",
    createdAt: new Date("2026-01-01"),
  };

  it("(1) 'tự thêm Mô hình luffy gear 5 vào giỏ hàng giúp tôi' chỉ trả sản phẩm Luffy Gear 5", async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([luffyProduct, gunplaProduct, shaverProduct] as any);

    const res = await runCustomerSupportTools({
      message: "tự thêm Mô hình luffy gear 5 vào giỏ hàng giúp tôi",
      customerId: null,
      guestOrderAccessToken: null,
      scrapedProduct: null,
      history: [
        {
          role: "assistant",
          text: "Dạ đây là mô hình Gunpla RG 1/144.",
          productCards: [
            {
              id: gunplaProduct.id,
              name: gunplaProduct.name,
              imageUrl: gunplaProduct.imageUrl,
              priceJpy: gunplaProduct.priceJpy,
              priceVnd: 774000,
              inStock: true,
            },
          ],
        },
      ],
    });

    expect(res.productCards).toBeDefined();
    expect(res.productCards).toHaveLength(1);
    expect(res.productCards![0].id).toBe("prod-luffy-gear-5");
    expect(res.productCards![0].name).toContain("Luffy Gear 5");
    expect(res.productCards!.some((p) => p.name.includes("Gunpla"))).toBe(false);
    expect(res.productCards!.some((p) => p.name.includes("Panasonic"))).toBe(false);
  });

  it("(2) 'thêm sản phẩm đó vào giỏ' ngay sau khi chat hiện thẻ Gunpla thì trả Gunpla", async () => {
    const res = await runCustomerSupportTools({
      message: "thêm sản phẩm đó vào giỏ",
      customerId: null,
      guestOrderAccessToken: null,
      scrapedProduct: null,
      history: [
        { role: "user", text: "Tìm mô hình Gunpla RG 1/144" },
        {
          role: "assistant",
          text: "Dạ có Mô hình Bandai Gunpla RG 1/144.",
          productCards: [
            {
              id: gunplaProduct.id,
              name: gunplaProduct.name,
              imageUrl: gunplaProduct.imageUrl,
              priceJpy: gunplaProduct.priceJpy,
              priceVnd: 774000,
              inStock: true,
            },
          ],
        },
      ],
    });

    expect(res.productCards).toBeDefined();
    expect(res.productCards).toHaveLength(1);
    expect(res.productCards![0].id).toBe("prod-gunpla-rg");
    expect(res.productCards![0].name).toContain("Gunpla");
  });

  it("(3) 'thêm vào giỏ' khi chưa có sản phẩm nào trong lịch sử thì hỏi lại, không chọn bừa", async () => {
    const res = await runCustomerSupportTools({
      message: "thêm vào giỏ",
      customerId: null,
      guestOrderAccessToken: null,
      scrapedProduct: null,
      history: [],
    });

    expect(res.productCards).toEqual([]);
    expect(res.guardedReply).toContain("chưa tìm thấy sản phẩm");
    expect(res.guardedReply).not.toContain("Đã thêm vào giỏ");
  });

  it("(4) tên không có trong catalog thì không trả thẻ", async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([]);

    const res = await runCustomerSupportTools({
      message: "tự thêm Máy bay tiêm kích phản lực Boeing 777 vào giỏ hàng giúp tôi",
      customerId: null,
      guestOrderAccessToken: null,
      scrapedProduct: null,
      history: [
        {
          role: "assistant",
          text: "Dạ đây là mô hình Gunpla RG 1/144.",
          productCards: [
            {
              id: gunplaProduct.id,
              name: gunplaProduct.name,
              imageUrl: gunplaProduct.imageUrl,
              priceJpy: gunplaProduct.priceJpy,
              priceVnd: 774000,
              inStock: true,
            },
          ],
        },
      ],
    });

    expect(res.productCards).toEqual([]);
    expect(res.guardedReply).toContain("chưa tìm thấy sản phẩm này trong catalog");
    expect(res.guardedReply).not.toContain("Gunpla");
  });

  it("(5) giá VND trong thẻ bằng priceJpy nhân tỷ giá dùng chung", async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([luffyProduct] as any);

    const res = await runCustomerSupportTools({
      message: "tự thêm Mô hình luffy gear 5 vào giỏ hàng giúp tôi",
      customerId: null,
      guestOrderAccessToken: null,
      scrapedProduct: null,
    });

    expect(res.productCards).toBeDefined();
    expect(res.productCards).toHaveLength(1);
    const card = res.productCards![0];
    // priceJpy = 8500, roundedRate = 172 -> priceVnd = 8500 * 172 = 1,462,000
    expect(card.priceJpy).toBe(8500);
    expect(card.priceVnd).toBe(8500 * 172);
    expect(card.priceVnd).toBe(1462000);
  });
});
