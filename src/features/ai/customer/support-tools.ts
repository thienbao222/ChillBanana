import { prisma } from "@/lib/prisma";
import { calculateOrderPrice } from "@/features/pricing/calculator";
import { getCurrentPricingConfig } from "@/features/pricing/config";
import { fetchLiveExchangeRate } from "@/features/pricing/exchange-rate";
import {
  hasGuestOrderAccessForEmail,
  verifyGuestOrderAccessToken,
} from "@/lib/auth-session";
import {
  canReadOrder,
  detectSupportIntents,
  extractCatalogSearchTerms,
  getOrderStatusLabel,
  getRequestSlotLabel,
  isSupportedMarketplaceUrl,
  isValidQuotePrice,
  type SupportEvidence,
  type SupportSourceLink,
} from "./support-policy";

const CATALOG_LINKS: SupportSourceLink[] = [
  { label: "Danh mục sản phẩm ChillBanana", href: "/" },
];

const CATEGORY_LABELS: Record<string, string> = {
  cosmetics: "Mỹ phẩm",
  health: "Thực phẩm chức năng",
  gadgets: "Gia dụng và điện tử",
  anime: "Anime và mô hình",
};

export interface ScrapedProductInput {
  title?: unknown;
  priceJpy?: unknown;
  url?: unknown;
}

export interface CustomerSupportToolInput {
  message: string;
  customerId: string | null;
  guestOrderAccessToken: string | null;
  scrapedProduct: ScrapedProductInput | null;
}

export interface CustomerSupportToolRun {
  evidence: SupportEvidence[];
  sources: Array<{ label: string; href: string; checkedAt: string }>;
  guardedReply?: string;
  quoteFooter?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cleanSingleLine(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\[\]()*_`!#>|]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, maxLength);
  return cleaned || fallback;
}

function buildSourceList(evidence: SupportEvidence[]) {
  return evidence
    .filter((item) => item.status !== "unavailable")
    .flatMap((item) => item.links.map((link) => ({
      label: link.label,
      href: link.href,
      checkedAt: item.source.observedAt,
    })))
    .filter((source, index, all) => all.findIndex((candidate) => candidate.href === source.href && candidate.label === source.label) === index);
}

function createEvidence(
  toolId: SupportEvidence["toolId"],
  status: SupportEvidence["status"],
  sourceLabel: string,
  known: Record<string, unknown>,
  unknown: string[],
  links: SupportSourceLink[] = [],
  dataUpdatedAt?: string | null
): SupportEvidence {
  return {
    toolId,
    status,
    source: { label: sourceLabel, observedAt: nowIso(), ...(dataUpdatedAt ? { dataUpdatedAt } : {}) },
    known,
    unknown,
    links,
  };
}

function normalizeForMatching(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();
}

async function searchCatalog(message: string, category: string | null, includePriceEstimate = true): Promise<SupportEvidence> {
  const terms = extractCatalogSearchTerms(message);
  if (!category && terms.length === 0) {
    return createEvidence(
      "catalog_search",
      "needs_input",
      "Danh mục sản phẩm ChillBanana",
      {},
      ["Từ khóa hoặc nhóm sản phẩm cần tìm"],
      CATALOG_LINKS
    );
  }

  const termFilters = terms.map((term) => ({
    OR: [
      { name: { contains: term, mode: "insensitive" as const } },
      { description: { contains: term, mode: "insensitive" as const } },
      { categoryName: { contains: term, mode: "insensitive" as const } },
      { voltageNote: { contains: term, mode: "insensitive" as const } },
    ],
  }));
  const where = {
    ...(category ? { category } : {}),
    ...(termFilters.length ? { OR: termFilters } : {}),
  };

  try {
    const rows = await prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        name: true,
        category: true,
        categoryName: true,
        priceJpy: true,
        weightKg: true,
        stockSlots: true,
        description: true,
        voltageNote: true,
        createdAt: true,
      },
    });

    const ranked = rows
      .map((product) => {
        const text = normalizeForMatching(`${product.name} ${product.description} ${product.categoryName} ${product.voltageNote ?? ""}`);
        const score = terms.reduce((sum, term) => sum + (text.includes(normalizeForMatching(term)) ? 1 : 0), 0);
        return { product, score };
      })
      .filter(({ score }) => terms.length === 0 || score > 0)
      .sort((a, b) => b.score - a.score || b.product.createdAt.getTime() - a.product.createdAt.getTime())
      .slice(0, 5);

    const rate = includePriceEstimate && ranked.length > 0 ? await fetchLiveExchangeRate() : null;
    const pricingConfig = rate && !rate.isStale ? await getCurrentPricingConfig() : null;
    const hasCurrentRate = Boolean(rate && !rate.isStale && rate.roundedRate > 0);

    return createEvidence(
      "catalog_search",
      "ok",
      "Danh mục ChillBanana và nguồn tỷ giá hiện hành nếu khả dụng",
      {
        category,
        matchCount: ranked.length,
        exchangeRate: rate
          ? { vndPerJpy: hasCurrentRate ? rate.roundedRate : null, provider: rate.source, updatedAt: rate.updatedAt || null, stale: rate.isStale }
          : null,
        products: ranked.map(({ product }) => ({
          name: cleanSingleLine(product.name, "Sản phẩm ChillBanana", 120),
          category: CATEGORY_LABELS[product.category] ?? "Sản phẩm Nhật",
          priceJpy: product.priceJpy,
          estimatedProductPriceVnd: hasCurrentRate ? Math.round(product.priceJpy * rate!.roundedRate) : null,
          estimatedWeightKg: product.weightKg,
          requestSlots: product.stockSlots,
          requestSlotLabel: getRequestSlotLabel(product.stockSlots),
          voltageNote: product.voltageNote ? cleanSingleLine(product.voltageNote, "", 160) : null,
          estimatedQuote: hasCurrentRate
            ? (() => {
                const estimate = calculateOrderPrice(product.priceJpy, product.weightKg, rate!.roundedRate, false, pricingConfig!.values);
                return {
                  serviceFeeVnd: estimate.serviceFeeVnd,
                  subtotalVnd: estimate.baseOrderCostVnd,
                  shippingFeeVnd: product.weightKg > 0 ? estimate.shippingFeeVnd : null,
                  totalVnd: product.weightKg > 0 ? estimate.totalVnd : null,
                  deposit50Vnd: estimate.deposit50Vnd,
                  usesEstimatedCatalogWeight: product.weightKg > 0,
                  finalQuote: false,
                };
              })()
            : null,
          recordCreatedAt: product.createdAt.toISOString(),
        })),
      },
      [
        "Tồn kho thực tế tại sàn Nhật",
        "Giá hiện hành tại sàn Nhật",
        "Tình trạng hàng hiện tại ngoài website",
        "Cân nặng thực tế tại kho Nhật",
      ],
      CATALOG_LINKS,
      rate?.updatedAt || null
    );
  } catch (error) {
    console.warn("[CustomerSupportTools] Catalog search unavailable:", error);
    return createEvidence(
      "catalog_search",
      "unavailable",
      "Danh mục sản phẩm ChillBanana",
      {},
      ["Kết quả tìm kiếm danh mục hiện tại"],
      CATALOG_LINKS
    );
  }
}

function createQuoteEvidence(scrapedProduct: ScrapedProductInput | null): {
  evidence: SupportEvidence;
  guardedReply?: string;
  quoteFooter?: string;
} {
  const rawPrice = scrapedProduct?.priceJpy;
  const url = scrapedProduct?.url;

  if (!scrapedProduct || !isValidQuotePrice(rawPrice) || !isSupportedMarketplaceUrl(url)) {
    const evidence = createEvidence(
      "quote_estimate",
      "needs_input",
      "Công cụ báo giá phía máy chủ",
      {},
      ["Liên kết sàn được hỗ trợ và giá JPY đọc được từ trang", "Cân nặng thực tế"],
      [{ label: "Mở công cụ tính giá", href: "/#quote" }]
    );
    return {
      evidence,
    };
  }

  return {
    evidence: createEvidence("quote_estimate", "needs_input", "Công cụ giá ChillBanana và nguồn tỷ giá", {}, ["Đang lấy tỷ giá hiện hành"], [{ label: "Công cụ tính giá", href: "/" }]),
  };
}

async function executeQuote(scrapedProduct: ScrapedProductInput | null): Promise<{
  evidence: SupportEvidence;
  guardedReply?: string;
  quoteFooter?: string;
}> {
  const rawPrice = scrapedProduct?.priceJpy;
  const url = scrapedProduct?.url;
  if (!scrapedProduct || !isValidQuotePrice(rawPrice) || !isSupportedMarketplaceUrl(url)) {
    const [rate, pricingConfig] = await Promise.all([
      fetchLiveExchangeRate().catch(() => null),
      getCurrentPricingConfig().catch(() => null),
    ]);
    const cfg = pricingConfig?.values;
    const rateText = rate && !rate.isStale && rate.roundedRate > 0 ? `1 JPY = ${rate.roundedRate.toLocaleString("vi-VN")} đ` : "theo tỷ giá thực tế";
    const feePct = cfg ? `${cfg.serviceFeePercent}% (tối thiểu ${cfg.serviceFeeMinimumVnd.toLocaleString("vi-VN")} đ)` : "5%";
    const shipRate = cfg ? `${cfg.airShippingPerKgVnd.toLocaleString("vi-VN")} đ/kg` : "220.000 đ/kg";
    const discountPct = cfg ? `${cfg.groupBuyShippingDiscountPercent}% (cho kiện ≤ ${cfg.groupBuyMaxWeightKg}kg)` : "25%";
    return {
      evidence: createEvidence(
        "quote_estimate",
        "needs_input",
        "Biểu phí mua hộ chuẩn của ChillBanana",
        {
          formula: "Tổng về tay = Tiền hàng (JPY × Tỷ giá) + Phí mua hộ & bảo hiểm + Cước bay quốc tế theo cân thực tế",
          exchangeRate: rateText,
          serviceFee: feePct,
          airShippingRate: shipRate,
          groupBuyDiscount: discountPct,
          depositPolicy: "Chỉ cần đặt cọc trước 50% (tiền hàng + phí mua hộ), cước bay cân thực tế khi hàng về kho.",
        },
        ["Link sản phẩm hoặc giá Yên cụ thể của món hàng khách đang muốn tính"],
        [{ label: "Công cụ tính giá tự động", href: "/#quote" }]
      ),
      guardedReply:
        `Công thức tính giá mua hộ tại Chill果 (Chill Banana): Tổng về tay = Tiền hàng (JPY × Tỷ giá ${rateText}) + Phí dịch vụ mua hộ ${feePct} + Cước bay quốc tế ${shipRate} (ưu đãi giảm ${discountPct} khi chọn Gộp đơn tiết kiệm), chỉ cần đặt cọc trước 50%. Để nhận báo giá chi tiết cho từng món, bạn vui lòng gửi liên kết sản phẩm từ các sàn Nhật hỗ trợ (Amazon JP, Mercari, Rakuten, Yahoo, Uniqlo...) kèm giá JPY nhé.`,
    };
  }

  const priceJpy = Number(scrapedProduct?.priceJpy);
  const title = cleanSingleLine(scrapedProduct?.title, "Sản phẩm từ liên kết", 160);
  const productUrl = scrapedProduct?.url as string;
  const quoteFormLink: SupportSourceLink = {
    label: "Mở form yêu cầu mua hộ",
    href: `/?url=${encodeURIComponent(productUrl)}`,
  };
  try {
    const rate = await fetchLiveExchangeRate();
    if (rate.isStale || !Number.isSafeInteger(rate.roundedRate) || rate.roundedRate <= 0) {
      const evidence = createEvidence(
        "quote_estimate",
        "unavailable",
        "Nguồn tỷ giá JPY/VND",
        { stale: true, lastKnownAt: rate.updatedAt || null, provider: rate.source },
        ["Tỷ giá hiện hành", "Tạm tính quy đổi hiện hành", "Cước vận chuyển do thiếu cân nặng"],
        [quoteFormLink]
      );
      return {
        evidence,
        guardedReply: "Neo chưa thể đưa ra ước tính quy đổi vì nguồn tỷ giá đang cũ hoặc chưa khả dụng. Mình không dùng tỷ giá dự phòng để báo giá; bạn thử lại sau nhé.",
      };
    }

    const pricingConfig = await getCurrentPricingConfig();
    const quote = calculateOrderPrice(priceJpy, 0, rate.roundedRate, false, pricingConfig.values);
    const checkedAt = nowIso();
    const evidence = createEvidence(
      "quote_estimate",
      "ok",
      `Máy chủ ChillBanana; tỷ giá từ ${rate.source}`,
      {
        sourceType: "Giá đọc từ liên kết do khách gửi; chưa được nhân viên xác nhận",
        priceJpy,
        exchangeRateVndPerJpy: rate.roundedRate,
        exchangeRateUpdatedAt: rate.updatedAt,
        productPriceVnd: quote.productPriceVnd,
        serviceFeeVnd: quote.serviceFeeVnd,
        subtotalVnd: quote.baseOrderCostVnd,
        depositEstimateVnd: quote.deposit50Vnd,
        shippingFeeVnd: null,
        totalVnd: null,
        finalQuote: false,
        rateIsStale: false,
        quoteCheckedAt: checkedAt,
        marketplaceUrlValidated: true,
      },
      ["Cân nặng thực tế", "Cước vận chuyển", "Tổng tiền cuối cùng", "Tình trạng hàng tại sàn"],
      [quoteFormLink],
      rate.updatedAt || null
    );
    const number = (value: number) => value.toLocaleString("vi-VN");
    const quoteFooter = [
      "",
      "> **ƯỚC TÍNH TỪ HỆ THỐNG — CHƯA PHẢI BÁO GIÁ CHỐT**",
      `> 🛒 **Sản phẩm:** ${title}`,
      `> 💴 **Giá trang sản phẩm:** ${number(priceJpy)} JPY (chưa được nhân viên xác nhận)`,
      `> 🔄 **Tỷ giá dùng để ước tính:** 1 JPY = ${number(rate.roundedRate)} VND (${rate.source})`,
      `> 🧾 **Tiền hàng + phí dịch vụ:** ${number(quote.baseOrderCostVnd)} đ`,
      `> ✈️ **Cước vận chuyển:** ${number(pricingConfig.values.airShippingPerKgVnd)} đ/kg; chưa cộng vì chưa có cân nặng thực tế. Đơn gộp đủ điều kiện (tối đa ${pricingConfig.values.groupBuyMaxWeightKg} kg) được giảm ${pricingConfig.values.groupBuyShippingDiscountPercent}% cước.`,
      `> 💰 **Tiền cọc tham khảo 50%:** ${number(quote.deposit50Vnd)} đ (không gồm cước bay)`,
      "> Tổng cuối cùng và tình trạng hàng cần nhân viên kiểm tra trước khi xác nhận.",
    ].join("\n");

    return {
      evidence,
      quoteFooter,
      guardedReply: "Mình đã tính ước tính theo thông tin giá bạn gửi. Kết quả tham khảo ở dưới; cước và tổng cuối cần cân hàng, nhân viên xác nhận nhé.",
    };
  } catch (error) {
    console.warn("[CustomerSupportTools] Quote estimate unavailable:", error);
    return {
      evidence: createEvidence(
        "quote_estimate",
        "unavailable",
        "Công cụ giá ChillBanana",
        {},
        ["Tỷ giá và kết quả ước tính"],
        [quoteFormLink]
      ),
      guardedReply: "Neo chưa lấy được tỷ giá để tính ước tính lúc này. Bạn thử lại sau nhé; giá cuối vẫn cần nhân viên xác nhận.",
    };
  }
}

async function lookupOrderStatus(
  orderCode: string | null,
  customerId: string | null,
  guestOrderAccessToken: string | null
): Promise<{ evidence: SupportEvidence; guardedReply?: string }> {
  const genericAccessReply = "Để bảo vệ thông tin đơn hàng, Neo chưa thể hiển thị chi tiết ở đây. Bạn đăng nhập đúng tài khoản hoặc mở liên kết xác minh đơn được gửi qua email; nếu cần, gửi mã đơn để nhân viên hướng dẫn.";
  if (!orderCode) {
    return {
      evidence: createEvidence(
        "order_status",
        "needs_input",
        "Hệ thống theo dõi đơn ChillBanana",
        {},
        ["Mã đơn hàng"],
        [{ label: "Trang theo dõi đơn hàng", href: "/tracking" }]
      ),
      guardedReply: "Bạn gửi mã đơn hàng (dạng CB-...) nhé. Để xem chi tiết, cần đăng nhập tài khoản đặt hàng hoặc mở liên kết xác minh qua email.",
    };
  }

  const guestAccess = guestOrderAccessToken
    ? verifyGuestOrderAccessToken(guestOrderAccessToken)
    : null;
  if (!customerId && guestAccess?.orderCode !== orderCode) {
    return {
      evidence: createEvidence(
        "order_status",
        "restricted",
        "Hệ thống theo dõi đơn ChillBanana",
        {},
        ["Không thể xác nhận đơn hàng khi chưa xác minh quyền truy cập"],
        [{ label: "Trang theo dõi đơn hàng", href: "/tracking" }]
      ),
      guardedReply: genericAccessReply,
    };
  }

  try {
    const order = await prisma.order.findUnique({
      where: { orderCode },
      select: {
        orderCode: true,
        productName: true,
        status: true,
        customerId: true,
        customerEmail: true,
        updatedAt: true,
        trackingLogs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { title: true, createdAt: true },
        },
      },
    });

    const hasValidGuestAccess = Boolean(
      order && hasGuestOrderAccessForEmail(guestOrderAccessToken, order.orderCode, order.customerEmail)
    );
    if (!order || !canReadOrder(customerId, order.customerId, hasValidGuestAccess)) {
      return {
        evidence: createEvidence(
          "order_status",
          "restricted",
          "Hệ thống theo dõi đơn ChillBanana",
          {},
          ["Không thể xác nhận đơn hàng khi chưa xác minh quyền truy cập"],
          [{ label: "Trang theo dõi đơn hàng", href: "/tracking" }]
        ),
        guardedReply: genericAccessReply,
      };
    }

    const latestLog = order.trackingLogs[0];
    return {
      evidence: createEvidence(
        "order_status",
        "ok",
        "Hệ thống đơn hàng ChillBanana",
        {
          orderCode: order.orderCode,
          productName: cleanSingleLine(order.productName, "Sản phẩm trong đơn", 120),
          status: getOrderStatusLabel(order.status),
          latestPublicTrackingUpdate: latestLog
            ? {
                title: cleanSingleLine(latestLog.title, "Cập nhật trạng thái đơn", 100),
                updatedAt: latestLog.createdAt.toISOString(),
              }
            : null,
        },
        ["Thời gian giao hàng dự kiến nếu đơn chưa có lịch được xác nhận", "Thông tin không được lưu trong trạng thái hoặc nhật ký công khai"],
        [{ label: "Theo dõi đơn hàng", href: "/tracking" }],
        order.updatedAt.toISOString()
      ),
      guardedReply: [
        `Đơn ${order.orderCode} hiện ở trạng thái: **${getOrderStatusLabel(order.status)}**.`,
        `Sản phẩm: ${cleanSingleLine(order.productName, "Sản phẩm trong đơn", 120)}.`,
        latestLog
          ? `Cập nhật theo dõi mới nhất: ${cleanSingleLine(latestLog.title, "Cập nhật trạng thái đơn", 100)}.`
          : "Chưa có cập nhật vận chuyển công khai mới.",
        "Bạn có thể mở trang theo dõi để xem chi tiết.",
      ].join(" "),
    };
  } catch (error) {
    console.warn("[CustomerSupportTools] Order lookup unavailable:", error);
    return {
      evidence: createEvidence(
        "order_status",
        "unavailable",
        "Hệ thống đơn hàng ChillBanana",
        {},
        ["Trạng thái đơn hàng hiện tại"],
        [{ label: "Trang theo dõi đơn hàng", href: "/tracking" }]
      ),
      guardedReply: "Neo chưa truy cập được trạng thái đơn hàng lúc này. Mình chưa thể xác nhận thông tin; bạn thử lại sau hoặc mở trang theo dõi đơn hàng nhé.",
    };
  }
}

async function getShippingPolicyEvidence(): Promise<SupportEvidence> {
  const pricingConfig = await getCurrentPricingConfig();
  return createEvidence(
    "shipping_policy",
    "ok",
    "Quy tắc giá và vận chuyển đang cấu hình trên website",
    {
      airShippingRateVndPerKg: pricingConfig.values.airShippingPerKgVnd,
      serviceFeePercent: pricingConfig.values.serviceFeePercent,
      serviceFeeMinimumVnd: pricingConfig.values.serviceFeeMinimumVnd,
      groupBuyDiscountPercent: pricingConfig.values.groupBuyShippingDiscountPercent,
      groupBuyDiscountCondition: `Đơn được bật gộp đơn và cân nặng không quá ${pricingConfig.values.groupBuyMaxWeightKg} kg`,
      minimumBaseOrderVnd: pricingConfig.values.minimumBaseOrderVnd,
      deliveryEta: null,
      shippingSchedule: null,
    },
    ["Thời gian giao dự kiến cho một đơn cụ thể", "Lịch bay cụ thể", "Cước cuối cùng trước khi cân hàng"],
    [{ label: "Theo dõi vận chuyển", href: "/tracking" }]
  );
}

function getCompatibilityEvidence(catalog: SupportEvidence): SupportEvidence {
  if (catalog.status === "unavailable") {
    return createEvidence(
      "product_compatibility",
      "unavailable",
      "Ghi chú tương thích trong danh mục sản phẩm ChillBanana",
      {},
      ["Ghi chú điện áp theo mẫu sản phẩm"],
      CATALOG_LINKS
    );
  }

  const products = Array.isArray(catalog.known.products)
    ? catalog.known.products as Array<{ name: string; voltageNote: string | null }>
    : [];
  const matched = products
    .filter((product) => typeof product.voltageNote === "string" && product.voltageNote.trim())
    .map((product) => ({ name: product.name, voltageNote: product.voltageNote }));
  return createEvidence(
    "product_compatibility",
    matched.length ? "ok" : "needs_input",
    "Ghi chú do quản trị viên lưu trên danh mục ChillBanana",
    {
      matchedProducts: matched,
      generalSafety: "Nếu nhãn ghi chỉ dùng 100V, không cắm trực tiếp vào nguồn 220V. Cần kiểm tra đúng model và tài liệu để chọn thiết bị chuyển đổi; không thể xác định công suất biến áp khi chưa có thông số.",
      transformerSizing: null,
    },
    ["Điện áp dải vào của đúng model", "Công suất cần thiết để chọn biến áp", "Xác nhận thiết bị có hỗ trợ 100–240V hay không"],
    CATALOG_LINKS
  );
}

export async function runCustomerSupportTools(input: CustomerSupportToolInput): Promise<CustomerSupportToolRun> {
  const hasScrapedProduct = Boolean(input.scrapedProduct);
  const intents = detectSupportIntents(input.message, hasScrapedProduct);
  const jobs: Array<Promise<SupportEvidence | { evidence: SupportEvidence; guardedReply?: string; quoteFooter?: string }>> = [];

  const catalogPromise = intents.catalog || intents.compatibility
    ? searchCatalog(input.message, intents.category, intents.catalog)
    : null;
  if (intents.catalog && catalogPromise) jobs.push(catalogPromise);
  if (intents.quote) jobs.push(executeQuote(input.scrapedProduct));
  if (intents.orderStatus) jobs.push(lookupOrderStatus(intents.orderCode, input.customerId, input.guestOrderAccessToken));
  if (intents.shipping) jobs.push(getShippingPolicyEvidence());
  if (intents.compatibility && catalogPromise) {
    jobs.push(catalogPromise.then(getCompatibilityEvidence));
  }

  const results = await Promise.all(jobs);
  const evidence: SupportEvidence[] = [];
  let orderReply: string | undefined;
  let quoteReply: string | undefined;
  let quoteFooter: string | undefined;
  for (const result of results) {
    if ("evidence" in result) {
      evidence.push(result.evidence);
      if (result.guardedReply && result.evidence.toolId === "order_status") orderReply = result.guardedReply;
      if (result.guardedReply && result.evidence.toolId === "quote_estimate") quoteReply = result.guardedReply;
      if (result.quoteFooter) quoteFooter = result.quoteFooter;
    } else {
      evidence.push(result);
    }
  }

  // Never let model-generated prose reinterpret private order details or quote arithmetic.
  // A combined request can be split by the customer into separate messages afterward.
  const guardedReply = orderReply ?? quoteReply;

  return { evidence, sources: buildSourceList(evidence), guardedReply, quoteFooter };
}
