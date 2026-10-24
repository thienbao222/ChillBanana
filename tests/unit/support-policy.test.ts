import { afterEach, describe, expect, it, vi } from "vitest";

const { routeSupportIntentMock } = vi.hoisted(() => ({
  routeSupportIntentMock: vi.fn<(...args: any[]) => Promise<any>>(async () => null),
}));

vi.mock("@/features/ai/customer/intent-router", () => ({ routeSupportIntent: routeSupportIntentMock }));

import {
  canReadOrder,
  detectSupportIntents,
  extractCatalogSearchTerms,
  getOrderStatusLabel,
  getRequestSlotLabel,
  isSupportedMarketplaceUrl,
  isValidOrderCode,
  isValidQuotePrice,
  normalizeSupportText,
  SEARCH_STOP_WORDS,
} from "@/features/ai/customer/support-policy";
import {
  searchCatalog,
  runCustomerSupportTools,
  resolveEffectiveSupportMessage,
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
      serviceFeePercent: 8,
      serviceFeeMinimumVnd: 20000,
      airShippingPerKgVnd: 185000,
      groupBuyShippingDiscountPercent: 25,
      groupBuyMaxWeightKg: 0.5,
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

vi.mock("@/lib/api-key-manager", () => ({
  chatKeyPool: {
    getNextKey: vi.fn(() => null),
    markError: vi.fn(),
  },
}));

describe("support-policy unit tests", () => {
  describe("normalizeSupportText", () => {
    it("bỏ dấu tiếng Việt, chuyển đ/Đ thành d/D và chuyển chữ thường", () => {
      expect(normalizeSupportText("Nồi cơm điện Zojirushi")).toBe("noi com dien zojirushi");
      expect(normalizeSupportText("ĐỒNG HỒ ĐEO TAY")).toBe("dong ho deo tay");
      expect(normalizeSupportText("Đã kiểm tra")).toBe("da kiem tra");
    });
  });

  describe("isSupportedMarketplaceUrl", () => {
    it("chấp nhận các sàn thương mại điện tử Nhật Bản hợp lệ qua HTTPS", () => {
      expect(isSupportedMarketplaceUrl("https://jp.mercari.com/item/m12345678")).toBe(true);
      expect(isSupportedMarketplaceUrl("https://www.amazon.co.jp/dp/B08N5WRWNW")).toBe(true);
      expect(isSupportedMarketplaceUrl("https://item.rakuten.co.jp/shop/item123/")).toBe(true);
      expect(isSupportedMarketplaceUrl("https://page.auctions.yahoo.co.jp/jp/auction/1234")).toBe(true);
      expect(isSupportedMarketplaceUrl("https://www.suruga-ya.jp/product/detail/123")).toBe(true);
      expect(isSupportedMarketplaceUrl("https://www.biccamera.com/bc/item/123/")).toBe(true);
      expect(isSupportedMarketplaceUrl("https://www.yodobashi.com/product/123/")).toBe(true);
      expect(isSupportedMarketplaceUrl("https://www.uniqlo.com/jp/ja/products/E123")).toBe(true);
    });

    it("từ chối URL không phải HTTPS", () => {
      expect(isSupportedMarketplaceUrl("http://jp.mercari.com/item/m123")).toBe(false);
      expect(isSupportedMarketplaceUrl("javascript:alert(1)")).toBe(false);
      expect(isSupportedMarketplaceUrl("ftp://jp.mercari.com")).toBe(false);
    });

    it("từ chối URL có chứa thông tin đăng nhập trong liên kết", () => {
      expect(isSupportedMarketplaceUrl("https://admin:password@jp.mercari.com/item/123")).toBe(false);
    });

    it("từ chối các sàn ngoài phạm vi hoặc tên miền giả mạo", () => {
      expect(isSupportedMarketplaceUrl("https://shopee.vn/product/123")).toBe(false);
      expect(isSupportedMarketplaceUrl("https://fake-mercari.com/item/123")).toBe(false);
      expect(isSupportedMarketplaceUrl("https://phishing.rakuten.co.jp.attacker.com")).toBe(false);
      expect(isSupportedMarketplaceUrl("https://google.com")).toBe(false);
    });

    it("từ chối input không hợp lệ hoặc quá dài (>2048 ký tự)", () => {
      expect(isSupportedMarketplaceUrl(null)).toBe(false);
      expect(isSupportedMarketplaceUrl(undefined)).toBe(false);
      expect(isSupportedMarketplaceUrl(12345)).toBe(false);
      expect(isSupportedMarketplaceUrl("https://jp.mercari.com/" + "a".repeat(2050))).toBe(false);
    });
  });

  describe("isValidOrderCode", () => {
    it("chấp nhận mã đơn ChillBanana hợp lệ", () => {
      expect(isValidOrderCode("CB-2026-ABCD-123456")).toBe(true);
      expect(isValidOrderCode("cb-2026-xyz9-1234")).toBe(true);
    });

    it("từ chối mã đơn sai định dạng", () => {
      expect(isValidOrderCode("CB-123")).toBe(false);
      expect(isValidOrderCode("ORDER-2026-ABC-123")).toBe(false);
      expect(isValidOrderCode("CB-2026-")).toBe(false);
      expect(isValidOrderCode("")).toBe(false);
    });
  });

  describe("isValidQuotePrice", () => {
    it("chấp nhận số tiền JPY hợp lệ (>0 và <= 1.000.000.000)", () => {
      expect(isValidQuotePrice(1000)).toBe(true);
      expect(isValidQuotePrice(50000)).toBe(true);
      expect(isValidQuotePrice(1_000_000_000)).toBe(true);
    });

    it("từ chối số tiền không hợp lệ, số âm, số lẻ hoặc tràn số", () => {
      expect(isValidQuotePrice(0)).toBe(false);
      expect(isValidQuotePrice(-100)).toBe(false);
      expect(isValidQuotePrice(150.5)).toBe(false);
      expect(isValidQuotePrice(NaN)).toBe(false);
      expect(isValidQuotePrice(Infinity)).toBe(false);
      expect(isValidQuotePrice("1000")).toBe(false);
      expect(isValidQuotePrice(1_000_000_001)).toBe(false);
    });
  });

  describe("canReadOrder (Quyền truy cập thông tin đơn)", () => {
    it("cho phép đọc nếu đúng ID khách hàng sở hữu đơn", () => {
      expect(canReadOrder("user_1", "user_1", false)).toBe(true);
    });

    it("cho phép đọc nếu có guest access token hợp lệ", () => {
      expect(canReadOrder(null, "user_1", true)).toBe(true);
      expect(canReadOrder("user_different", "user_1", true)).toBe(true);
    });

    it("từ chối nếu sai ID khách hàng và không có token khách vãng lai", () => {
      expect(canReadOrder("user_attacker", "user_victim", false)).toBe(false);
      expect(canReadOrder(null, "user_1", false)).toBe(false);
      expect(canReadOrder(null, null, false)).toBe(false);
    });
  });

  describe("detectSupportIntents", () => {
    it("nhận diện intent kiểm tra điện áp tương thích 100V", () => {
      const intent = detectSupportIntents("Nồi cơm điện Nhật 100V có cắm được điện 220V ở nhà không?");
      expect(intent.compatibility).toBe(true);
    });

    it("nhận diện intent tính giá mua hộ", () => {
      const intent = detectSupportIntents("Tính giá về Việt Nam cho món này bao nhiêu tiền?");
      expect(intent.quote).toBe(true);
    });

    it("nhận diện intent kiểm tra tiến độ đơn hàng và trích xuất mã đơn", () => {
      const intent = detectSupportIntents("Tra cứu đơn hàng CB-2026-TEST-987654 đang ở đâu rồi?");
      expect(intent.orderStatus).toBe(true);
      expect(intent.orderCode).toBe("CB-2026-TEST-987654");
    });

    it("nhận diện intent về cước phí vận chuyển và gom đơn", () => {
      const intent = detectSupportIntents("Cước bay Narita về Sài Gòn tính thế nào? Gom đơn được giảm không?");
      expect(intent.shipping).toBe(true);
    });
  });

  it("vẫn tìm catalog khi router không có API key và regex không nhận ra câu hỏi sản phẩm", async () => {
    const hadaProduct = {
      id: "hada-labo-cleanser",
      name: "Sữa Rửa Mặt Hada Labo Gokujyun",
      category: "cosmetics",
      categoryName: "Mỹ phẩm & Chăm sóc da",
      priceJpy: 900,
      weightKg: 0.2,
      stockSlots: 2,
      description: "Sữa rửa mặt làm sạch da Hada Labo",
      voltageNote: null,
      imageUrl: "/hada-labo.jpg",
      originalStore: "Amazon JP",
      createdAt: new Date("2026-01-01"),
    };
    vi.spyOn(prisma.product, "findMany").mockResolvedValue([hadaProduct as any]);

    for (const message of ["sữa rửa mặt hada còn hàng sẵn không", "sua rua mat hada con hang khong"]) {
      const result = await runCustomerSupportTools({
        message,
        customerId: null,
        guestOrderAccessToken: null,
        scrapedProduct: null,
      });

      expect(result.evidence.find((item) => item.toolId === "catalog_search")?.known.products).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "hada-labo-cleanser" })])
      );
    }
    expect(prisma.product.findMany).toHaveBeenCalledTimes(2);
  });

  it("dùng searchTerms do router nhận diện để tìm catalog dù intent được phân loại là quote", async () => {
    vi.restoreAllMocks();
    routeSupportIntentMock.mockResolvedValueOnce({
      intents: { catalog: false, quote: true, orderStatus: false, shipping: false, compatibility: false, addToCart: false },
      searchTerms: ["Patagonia"],
      keywordsJa: [],
      category: "gadgets",
      referencesPreviousProduct: true,
    });
    const product = {
      id: "patagonia-bottle", name: "Bình giữ nhiệt Patagonia", category: "gadgets",
      categoryName: "Gia dụng & Thiết bị", priceJpy: 2800, weightKg: 0.3, stockSlots: 2,
      description: "Bình giữ nhiệt", voltageNote: null, imageUrl: null,
      originalStore: "Amazon JP", createdAt: new Date("2026-01-01"),
    };
    vi.spyOn(prisma.product, "findMany").mockResolvedValue([product as any]);

    const result = await runCustomerSupportTools({
      message: "còn hàng không",
      customerId: null,
      guestOrderAccessToken: null,
      scrapedProduct: null,
    });

    expect(result.evidence.find((item) => item.toolId === "catalog_search")?.known.products)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: "patagonia-bottle" })]));
  });

  it("không cho router biến câu hỏi sản phẩm không dấu thành tra cứu đơn hàng", async () => {
    vi.restoreAllMocks();
    routeSupportIntentMock.mockResolvedValueOnce({
      intents: { catalog: false, quote: false, orderStatus: true, shipping: false, compatibility: false, addToCart: false },
      searchTerms: ["Hada Labo"],
      keywordsJa: [],
      category: "cosmetics",
      referencesPreviousProduct: false,
    });
    const product = {
      id: "hada-labo-cleanser", name: "Sữa Rửa Mặt Hada Labo Gokujyun", category: "cosmetics",
      categoryName: "Mỹ phẩm & Chăm sóc da", priceJpy: 900, weightKg: 0.2, stockSlots: 2,
      description: "Sữa rửa mặt Hada Labo", voltageNote: null, imageUrl: null,
      originalStore: "Amazon JP", createdAt: new Date("2026-01-01"),
    };
    vi.spyOn(prisma.product, "findMany").mockResolvedValue([product as any]);

    const result = await runCustomerSupportTools({
      message: "sua rua mat hada con hang khong",
      customerId: null,
      guestOrderAccessToken: null,
      scrapedProduct: null,
    });

    expect(result.evidence.some((item) => item.toolId === "order_status")).toBe(false);
    expect(result.evidence.find((item) => item.toolId === "catalog_search")?.known.products)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: "hada-labo-cleanser" })]));
  });

  it("shows catalog evidence instead of the link-required quote guard when a product already matches", async () => {
    vi.restoreAllMocks();
    const product = {
      id: "hada-labo-cleanser", name: "Sữa Rửa Mặt Hada Labo Gokujyun Hyaluronic", category: "cosmetics",
      categoryName: "Mỹ phẩm & Chăm sóc da", priceJpy: 900, weightKg: 0.2, stockSlots: 2,
      description: "Sữa rửa mặt Hada Labo", voltageNote: null, imageUrl: null,
      originalStore: "Amazon JP", createdAt: new Date("2026-01-01"),
    };
    vi.spyOn(prisma.product, "findMany").mockResolvedValue([product as any]);

    const result = await runCustomerSupportTools({
      message: "sữa rửa mặt hada giá bao nhiêu",
      customerId: null,
      guestOrderAccessToken: null,
      scrapedProduct: null,
    });

    expect(result.evidence.find((item) => item.toolId === "catalog_search")?.known.products)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: "hada-labo-cleanser" })]));
    expect(result.guardedReply).toBeUndefined();
  });

  it("names the matched catalog product in the add-to-cart confirmation", async () => {
    vi.restoreAllMocks();
    const product = {
      id: "luffy-gear-5", name: "One Piece Luffy Gear 5 Figure", category: "anime",
      categoryName: "Anime & Mô hình", priceJpy: 3850, weightKg: 0.4, stockSlots: 2,
      description: "Mô hình Luffy Gear 5", voltageNote: null, imageUrl: null,
      originalStore: "Amazon JP", createdAt: new Date("2026-01-01"),
    };
    vi.spyOn(prisma.product, "findMany").mockResolvedValue([product as any]);

    const result = await runCustomerSupportTools({
      message: "tự thêm mô hình luffy gear 5 vào giỏ hàng giúp tôi",
      customerId: null,
      guestOrderAccessToken: null,
      scrapedProduct: null,
    });

    expect(result.guardedReply).toContain("Luffy Gear 5");
    expect(result.guardedReply).toContain("Thêm vào giỏ");
  });

  it("does not replace a follow-up catalog answer with a generic quote prompt", async () => {
    vi.restoreAllMocks();
    const product = {
      id: "gunpla-rx-78", name: "Bandai Gunpla RX-78-2 Figure", category: "anime",
      categoryName: "Anime & Mô hình", priceJpy: 3850, weightKg: 0.4, stockSlots: 2,
      description: "Mô hình RX-78", voltageNote: null, imageUrl: null,
      originalStore: "Amazon JP", createdAt: new Date("2026-01-01"),
    };
    vi.spyOn(prisma.product, "findMany").mockResolvedValue([product as any]);

    const result = await runCustomerSupportTools({
      message: "giá bao nhiêu vậy",
      history: [{ role: "user", text: "gunpla rx-78 còn hàng không" }],
      customerId: null,
      guestOrderAccessToken: null,
      scrapedProduct: null,
    });

    expect(result.evidence.find((item) => item.toolId === "catalog_search")?.known.products)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: "gunpla-rx-78" })]));
    expect(result.guardedReply).toBeUndefined();
  });

  it("không chạy catalog cho câu chào hỏi hoặc cảm ơn thuần túy", async () => {
    vi.restoreAllMocks();
    const findMany = vi.spyOn(prisma.product, "findMany");

    const result = await runCustomerSupportTools({
      message: "Dạ Neo ơi, cảm ơn bạn nhiều",
      customerId: null,
      guestOrderAccessToken: null,
      scrapedProduct: null,
    });

    expect(findMany).not.toHaveBeenCalled();
    expect(result.evidence).toEqual([]);
  });

  it("activates every registered support tool from a representative customer message", async () => {
    vi.restoreAllMocks();
    vi.spyOn(prisma.product, "findMany").mockResolvedValue([]);
    const cases = [
      ["catalog_search", "Tìm sữa rửa mặt Hada"],
      ["quote_estimate", "Tính giá về Việt Nam cho món này bao nhiêu tiền?"],
      ["order_status", "Tình trạng đơn CB-2026-ABCD-123456"],
      ["shipping_policy", "Cước bay Narita về Sài Gòn tính thế nào? Gom đơn được giảm không?"],
      ["product_compatibility", "Nồi cơm điện Nhật 100V có cắm được điện 220V ở nhà không?"],
    ] as const;

    for (const [toolId, message] of cases) {
      const result = await runCustomerSupportTools({
        message,
        customerId: null,
        guestOrderAccessToken: null,
        scrapedProduct: null,
      });
      expect(result.evidence.some((item) => item.toolId === toolId), `${message} should activate ${toolId}`).toBe(true);
    }
  });

  it("matches accent-free queries against the small catalog and keeps product-type terms", async () => {
    const products = [
      {
        id: "hada-labo-cleanser", name: "Sữa Rửa Mặt Hada Labo Gokujyun", category: "cosmetics",
        categoryName: "Mỹ phẩm & Chăm sóc da", priceJpy: 900, weightKg: 0.2, stockSlots: 2,
        description: "Sữa rửa mặt làm sạch da Hada Labo", voltageNote: null, imageUrl: null,
        originalStore: "Amazon JP", createdAt: new Date("2026-01-01"),
      },
      {
        id: "zojirushi-bottle", name: "Bình giữ nhiệt Zojirushi SM-SF48", category: "gadgets",
        categoryName: "Gia dụng & Thiết bị", priceJpy: 2800, weightKg: 0.3, stockSlots: 2,
        description: "Bình giữ nhiệt inox Zojirushi", voltageNote: null, imageUrl: null,
        originalStore: "Amazon JP", createdAt: new Date("2026-01-02"),
      },
    ];
    vi.spyOn(prisma.product, "findMany").mockResolvedValue(products as any);

    for (const [query, productId] of [
      ["sua rua mat hada con hang khong", "hada-labo-cleanser"],
      ["bình giữ nhiệt zojirushi có sẵn không", "zojirushi-bottle"],
    ]) {
      const evidence = await searchCatalog(query, null);
      expect(evidence.known.products).toEqual(expect.arrayContaining([expect.objectContaining({ id: productId })]));
    }

    expect(extractCatalogSearchTerms("kem chống nắng")).toContain("kem");
    expect(extractCatalogSearchTerms("máy cạo râu")).toContain("máy");
    expect(extractCatalogSearchTerms("kem")).toEqual([]);
    expect(extractCatalogSearchTerms("may")).toEqual([]);
    expect(extractCatalogSearchTerms("do")).toEqual([]);
  });

  describe("Nhãn hiển thị trạng thái và suất mua", () => {
    it("trả về nhãn tiếng Việt chuẩn cho từng trạng thái đơn", () => {
      expect(getOrderStatusLabel("PENDING_DEPOSIT")).toBe("Chờ đặt cọc");
      expect(getOrderStatusLabel("PURCHASING_JP")).toBe("Đang mua tại Nhật Bản");
      expect(getOrderStatusLabel("WAREHOUSE_JP")).toBe("Đã vào kho Nhật Bản");
      expect(getOrderStatusLabel("IN_TRANSIT_AIR")).toBe("Đang vận chuyển quốc tế");
      expect(getOrderStatusLabel("WAREHOUSE_VN")).toBe("Đã về kho Việt Nam");
      expect(getOrderStatusLabel("LOCAL_DELIVERY")).toBe("Đang giao hàng nội địa");
      expect(getOrderStatusLabel("COMPLETED")).toBe("Đã giao hàng thành công");
      expect(getOrderStatusLabel("CANCELLED")).toBe("Đã hủy");
      expect(getOrderStatusLabel("UNKNOWN")).toBe("Đang được kiểm tra");
    });

    it("trả về nhãn suất tiếp nhận yêu cầu mua hộ", () => {
      expect(getRequestSlotLabel(5)).toBe("Còn 5 suất tiếp nhận yêu cầu mua hộ");
      expect(getRequestSlotLabel(0)).toBe("Hiện chưa có suất tiếp nhận yêu cầu mua hộ");
    });
  });

  describe("BƯỚC 7: Kiểm thử chính sách AI & công cụ hỗ trợ khách hàng", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    describe('(a) "tranh errormusk có kèm khung không? thêm sản phẩm đó vào giỏ hàng" không trả Gunpla/máy cạo râu', () => {
      it("trích xuất từ khóa loại bỏ sạch stop words và nhận diện đúng intent add_to_cart", () => {
        const query = "tranh errormusk có kèm khung không? thêm sản phẩm đó vào giỏ hàng";
        const terms = extractCatalogSearchTerms(query);
        expect(terms).toContain("tranh");
        expect(terms).toContain("errormusk");
        expect(terms).toContain("khung");
        expect(terms).not.toContain("co");
        expect(terms).not.toContain("kem");
        expect(terms).not.toContain("khong");
        expect(terms).not.toContain("them");
        expect(terms).not.toContain("san");
        expect(terms).not.toContain("pham");
        expect(terms).not.toContain("do");
        expect(terms).not.toContain("vao");
        expect(terms).not.toContain("gio");
        expect(terms).not.toContain("hang");

        const intents = detectSupportIntents(query);
        expect(intents.addToCart).toBe(true);
      });

      it("không trả về Gunpla hoặc máy cạo râu khi tìm kiếm tranh errormusk", async () => {
        const catalogData = [
          {
            id: "prod-gunpla",
            name: "Mô hình Bandai Gunpla RG 1/144 Wing Zero",
            category: "anime",
            categoryName: "Anime & Mô hình",
            priceJpy: 4500,
            weightKg: 0.5,
            stockSlots: 2,
            description: "Mô hình Bandai Gundam chính hãng",
            voltageNote: null,
            imageUrl: "/gunpla.jpg",
            originalStore: "Amazon JP",
            createdAt: new Date("2026-01-01"),
          },
          {
            id: "prod-shaver",
            name: "Máy cạo râu Panasonic Lamdash 5 lưỡi",
            category: "gadgets",
            categoryName: "Gia dụng & Thiết bị",
            priceJpy: 18000,
            weightKg: 0.4,
            stockSlots: 3,
            description: "Máy cạo râu nội địa Nhật",
            voltageNote: "100V-240V",
            imageUrl: "/shaver.jpg",
            originalStore: "Bic Camera",
            createdAt: new Date("2026-01-01"),
          },
        ];

        vi.spyOn(prisma.product, "findMany").mockResolvedValueOnce(catalogData as any);

        const evidence = await searchCatalog(
          "tranh errormusk có kèm khung không? thêm sản phẩm đó vào giỏ hàng",
          null
        );
        const products = (evidence.known.products as any[]) || [];

        expect(products.some((p) => /gunpla|gundam/i.test(p.name))).toBe(false);
        expect(products.some((p) => /cạo râu|shaver|panasonic/i.test(p.name))).toBe(false);
        expect(products).toHaveLength(0);
        expect(evidence.known.inCatalog).toBe(false);
      });
    });

    describe('(b) "thực phẩm chức năng thì sao" gửi sau một tin khác KHÔNG bị gộp', () => {
      it("giữ nguyên câu hỏi nối tiếp độc lập có từ 2 từ khóa trở lên, không gộp lịch sử trước đó", () => {
        const history = [
          { role: "user", text: "Tìm máy cạo râu Panasonic giúp mình" },
          { role: "assistant", text: "Dạ đây là các mẫu máy cạo râu Panasonic..." },
        ];

        const terms = extractCatalogSearchTerms("thực phẩm chức năng thì sao");
        expect(terms.length).toBeGreaterThanOrEqual(2);

        const resolved = resolveEffectiveSupportMessage("thực phẩm chức năng thì sao", history);
        expect(resolved).toBe("thực phẩm chức năng thì sao");
        expect(resolved).not.toContain("Panasonic");
        expect(resolved).not.toContain("cạo râu");
      });
    });

    describe("(c) catalog rỗng thì không có sản phẩm kèm giá bịa", () => {
      it("trả về inCatalog = false, danh sách sản phẩm rỗng và không bịa giá", async () => {
        vi.spyOn(prisma.product, "findMany").mockResolvedValueOnce([]);

        const evidence = await searchCatalog("sản phẩm hoàn toàn không tồn tại xyz999", null);
        expect(evidence.known.inCatalog).toBe(false);
        expect(evidence.known.matchCount).toBe(0);
        expect(evidence.known.products).toEqual([]);
        expect(evidence.unknown).toContain("Sản phẩm không có trong catalog ChillBanana");
      });
    });

    describe("(d) stop words tiếng Việt bị loại khỏi từ khóa", () => {
      it("loại bỏ toàn bộ các stop words tiếng Việt phổ thông khỏi từ khóa tìm kiếm", () => {
        const stopWordsList = [
          "có", "không", "kèm", "thêm", "sản phẩm", "đó", "này", "vào",
          "giỏ", "hàng", "của", "tôi", "mình", "cho", "thì", "sao",
          "nào", "gì", "muốn", "cần", "xem", "giúp", "với", "và",
          "hay", "hoặc", "bao nhiêu",
        ];

        for (const phrase of stopWordsList) {
          const terms = extractCatalogSearchTerms(phrase);
          expect(terms, `Stop word '${phrase}' không được phép tạo search term`).toEqual([]);
        }

        const allTogether =
          "có không kèm thêm sản phẩm đó này vào giỏ hàng của tôi mình cho thì sao nào gì muốn cần xem giúp với và hay hoặc bao nhiêu";
        expect(extractCatalogSearchTerms(allTogether)).toEqual([]);
      });

      it("giữ lại đúng từ khóa sản phẩm thực tế và lọc bỏ sạch các stop words đi kèm", () => {
        const query = "Tôi muốn xem thêm sản phẩm tai nghe Sony này vào giỏ hàng giúp mình với thì giá bao nhiêu";
        const terms = extractCatalogSearchTerms(query);
        expect(terms).toContain("tai");
        expect(terms).toContain("nghe");
        expect(terms).toContain("Sony");

        const normalizedTerms = terms.map((t) => normalizeSupportText(t));
        const forbidden = [
          "toi", "muon", "xem", "them", "san", "pham", "nay", "vao",
          "gio", "hang", "giup", "minh", "voi", "thi", "gia", "bao", "nhieu",
        ];
        for (const stop of forbidden) {
          expect(normalizedTerms).not.toContain(stop);
        }
      });

      it("giữ các từ loại hàng khi nằm trong cụm sản phẩm", () => {
        expect(extractCatalogSearchTerms("kem chống nắng")).toContain("kem");
        expect(extractCatalogSearchTerms("máy cạo râu")).toContain("máy");
      });
    });
  });
});
