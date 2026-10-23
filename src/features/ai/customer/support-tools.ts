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

export interface TranslatedQuery {
  keywordsJa: string;
  keywordsVi: string;
  detectedBrand?: string;
  category: "cosmetics" | "health" | "gadgets" | "anime" | "fashion" | "luxury" | "other";
  is100vAppliance: boolean;
  voltageWarning?: string;
  budget?: {
    minJpy?: number;
    maxJpy?: number;
    rawVndText?: string;
    rawJpyText?: string;
    approxVndEquivalent?: number;
  };
}

const BRAND_DICTIONARY: Record<string, { ja: string; category?: string }> = {
  gucci: { ja: "グッチ GUCCI", category: "luxury" },
  chanel: { ja: "シャネル CHANEL", category: "luxury" },
  dior: { ja: "ディオール DIOR", category: "luxury" },
  louisvuitton: { ja: "ルイヴィトン LV", category: "luxury" },
  lv: { ja: "ルイヴィトン LV", category: "luxury" },
  hermes: { ja: "エルメス HERMES", category: "luxury" },
  prada: { ja: "プラダ PRADA", category: "luxury" },
  coach: { ja: "コーチ COACH", category: "luxury" },
  "t-fal": { ja: "ティファール T-fal", category: "gadgets" },
  tfal: { ja: "ティファール T-fal", category: "gadgets" },
  zojirushi: { ja: "象印 ZOJIRUSHI", category: "gadgets" },
  tiger: { ja: "タイガー TIGER", category: "gadgets" },
  panasonic: { ja: "パナソニック Panasonic", category: "gadgets" },
  sony: { ja: "ソニー SONY", category: "gadgets" },
  seiko: { ja: "セイコー SEIKO", category: "gadgets" },
  casio: { ja: "カシオ CASIO", category: "gadgets" },
  orient: { ja: "オリエント ORIENT", category: "gadgets" },
  citizen: { ja: "シチズン CITIZEN", category: "gadgets" },
  anessa: { ja: "アネッサ ANESSA", category: "cosmetics" },
  dhc: { ja: "DHC", category: "health" },
  hada: { ja: "肌ラボ Hada Labo", category: "cosmetics" },
  hadalabo: { ja: "肌ラボ Hada Labo", category: "cosmetics" },
  shiseido: { ja: "資生堂 SHISEIDO", category: "cosmetics" },
  sk2: { ja: "SK-II エスケーツー", category: "cosmetics" },
  "sk-ii": { ja: "SK-II エスケーツー", category: "cosmetics" },
  kose: { ja: "コーセー KOSE", category: "cosmetics" },
  meiji: { ja: "明治 Meiji", category: "health" },
  orihiro: { ja: "オリヒロ ORIHIRO", category: "health" },
  uniqlo: { ja: "ユニクロ UNIQLO", category: "fashion" },
  gu: { ja: "ジーユー GU", category: "fashion" },
  gundam: { ja: "ガンダム ガンプラ BANDAI", category: "anime" },
  gunpla: { ja: "ガンプラ バンダイ", category: "anime" },
  bandai: { ja: "バンダイ BANDAI", category: "anime" },
  nintendo: { ja: "任天堂 ニンテンドー Nintendo Switch", category: "gadgets" },
};

const PRODUCT_TERMS: Array<{ match: RegExp; ja: string; category?: string; is100v?: boolean }> = [
  { match: /\b(giay nam|giay|sneakers?|shoes?)\b/i, ja: "メンズ 靴 スニーカー", category: "fashion" },
  { match: /\b(giay nu|giay cao got|pumps?)\b/i, ja: "レディース 靴 パンプス スニーカー", category: "fashion" },
  { match: /\b(tui xach|tui|vi|balo|bag|wallet)\b/i, ja: "バッグ 財布", category: "luxury" },
  { match: /\b(am dun|am sieu toc|binh dun nuoc|kettle)\b/i, ja: "電気ケトル", category: "gadgets", is100v: true },
  { match: /\b(noi com|noi com dien|rice cooker)\b/i, ja: "炊飯器", category: "gadgets", is100v: true },
  { match: /\b(may say toc|hair dryer)\b/i, ja: "ヘアドライヤー ナノケア", category: "gadgets", is100v: true },
  { match: /\b(may cao rau|shaver)\b/i, ja: "メンズシェーバー ラムダッシュ", category: "gadgets" },
  { match: /\b(kem chong nang|sunscreen)\b/i, ja: "日焼け止め UV", category: "cosmetics" },
  { match: /\b(son duong|lip balm|son)\b/i, ja: "薬用 リップクリーム", category: "cosmetics" },
  { match: /\b(sua rua mat|cleanser)\b/i, ja: "洗顔フォーム", category: "cosmetics" },
  { match: /\b(tay trang|cleansing oil)\b/i, ja: "クレンジングオイル", category: "cosmetics" },
  { match: /\b(serum|tinh chat)\b/i, ja: "美容液 セラム", category: "cosmetics" },
  { match: /\b(collagen|bot collagen)\b/i, ja: "コラーゲン パウダー", category: "health" },
  { match: /\b(vitamin|vitamin c|vitamin e)\b/i, ja: "ビタミン サプリメント", category: "health" },
  { match: /\b(tao xoan|spirulina)\b/i, ja: "スピルリナ 藻", category: "health" },
  { match: /\b(nattokinase|bo nao|dha|epa)\b/i, ja: "ナットウキナーゼ DHA EPA", category: "health" },
  { match: /\b(mo hinh|figure|nendoroid)\b/i, ja: "フィギュア ねんどろいど", category: "anime" },
  { match: /\b(ao khoac|ao chong nang|ao len|hoodie|jacket)\b/i, ja: "パーカー ジャケット アウター", category: "fashion" },
  { match: /\b(dong ho|watch)\b/i, ja: "腕時計", category: "gadgets" },
  { match: /\b(tai nghe|headphone|earphone|earbuds)\b/i, ja: "ワイヤレスイヤホン", category: "gadgets" },
];

export function parseBudgetAndCurrency(
  text: string,
  rate = 165
): {
  minJpy?: number;
  maxJpy?: number;
  rawVndText?: string;
  rawJpyText?: string;
  approxVndEquivalent?: number;
} {
  const norm = text.toLowerCase().replace(/,/g, ".").replace(/\s+/g, " ");

  const jpyRangeMatch = norm.match(/(\d+(?:\.\d+)?)\s*(?:k|nghìn)?\s*(?:-|đến|to|~)\s*(\d+(?:\.\d+)?)\s*(?:k|nghìn)?\s*(?:jpy|yên|yen|¥)/i);
  if (jpyRangeMatch) {
    let min = parseFloat(jpyRangeMatch[1].replace(/\./g, ""));
    let max = parseFloat(jpyRangeMatch[2].replace(/\./g, ""));
    if (min < 1000) min *= 1000;
    if (max < 1000) max *= 1000;
    return {
      minJpy: Math.round(min),
      maxJpy: Math.round(max),
      rawJpyText: `${min.toLocaleString("vi-VN")} - ${max.toLocaleString("vi-VN")} JPY`,
      approxVndEquivalent: Math.round(max * rate),
    };
  }

  const manMatch = norm.match(/(\d+(?:\.\d+)?)\s*man\b/i);
  if (manMatch) {
    const val = parseFloat(manMatch[1]) * 10000;
    return {
      minJpy: Math.round(val * 0.7),
      maxJpy: Math.round(val * 1.1),
      rawJpyText: `~${val.toLocaleString("vi-VN")} JPY`,
      approxVndEquivalent: Math.round(val * rate),
    };
  }

  const jpySingleMatch = norm.match(/(?:khoảng|tầm|dưới|trên)?\s*(\d+(?:\.\d+)?)\s*(?:k|nghìn)?\s*(?:jpy|yên|yen|¥)/i);
  if (jpySingleMatch) {
    let val = parseFloat(jpySingleMatch[1].replace(/\./g, ""));
    if (val < 1000) val *= 1000;
    return {
      minJpy: Math.round(val * 0.8),
      maxJpy: Math.round(val * 1.15),
      rawJpyText: `${val.toLocaleString("vi-VN")} JPY`,
      approxVndEquivalent: Math.round(val * rate),
    };
  }

  const vndRangeMatch = norm.match(/(\d+(?:\.\d+)?)\s*(?:-|đến|to|~)\s*(\d+(?:\.\d+)?)\s*(?:triệu|tr|trieu)\b/i);
  if (vndRangeMatch) {
    const minM = parseFloat(vndRangeMatch[1]);
    const maxM = parseFloat(vndRangeMatch[2]);
    const minVnd = minM * 1_000_000;
    const maxVnd = maxM * 1_000_000;
    return {
      minJpy: Math.round(minVnd / rate),
      maxJpy: Math.round(maxVnd / rate),
      rawVndText: `${minM} - ${maxM} triệu VND`,
      approxVndEquivalent: maxVnd,
    };
  }

  const vndSingleMatch = norm.match(/(\d+(?:\.\d+)?)\s*(?:triệu|tr|trieu)\b/i);
  if (vndSingleMatch) {
    const m = parseFloat(vndSingleMatch[1]);
    const vnd = m * 1_000_000;
    return {
      minJpy: Math.round((vnd * 0.7) / rate),
      maxJpy: Math.round((vnd * 1.1) / rate),
      rawVndText: `khoảng ${m} triệu VND`,
      approxVndEquivalent: vnd,
    };
  }

  const vndFullMatch = norm.match(/(\d{1,3}(?:\.\d{3}){1,3}|\d{6,9})\s*(?:đ|vnd|dong)/i);
  if (vndFullMatch) {
    const num = parseFloat(vndFullMatch[1].replace(/\./g, ""));
    return {
      minJpy: Math.round((num * 0.8) / rate),
      maxJpy: Math.round((num * 1.1) / rate),
      rawVndText: `${num.toLocaleString("vi-VN")} VND`,
      approxVndEquivalent: num,
    };
  }

  return {};
}

export function translateToJapaneseKeywords(text: string, currentRate = 165): TranslatedQuery {
  const norm = text.toLowerCase();
  const tokens = norm.split(/[\s,]+/);

  let detectedBrand: string | undefined;
  let brandJa = "";
  let brandCategory: any;

  for (const [key, val] of Object.entries(BRAND_DICTIONARY)) {
    if (tokens.includes(key) || norm.includes(key)) {
      detectedBrand = key;
      brandJa = val.ja;
      if (val.category) brandCategory = val.category;
      break;
    }
  }

  let productJa = "";
  let is100vAppliance = false;
  let termCategory: any;

  for (const item of PRODUCT_TERMS) {
    if (item.match.test(norm)) {
      productJa = item.ja;
      if (item.category) termCategory = item.category;
      if (item.is100v) is100vAppliance = true;
      break;
    }
  }

  let keywordsJa = "";
  if (brandJa && productJa) {
    keywordsJa = `${brandJa} ${productJa}`;
  } else if (brandJa) {
    keywordsJa = brandJa;
  } else if (productJa) {
    keywordsJa = productJa;
  } else {
    const alphanumeric = text.match(/[A-Za-z0-9+-]{2,}/g) || [];
    keywordsJa = alphanumeric.slice(0, 4).join(" ");
  }

  const category = (brandCategory || termCategory || "other") as TranslatedQuery["category"];
  const budget = parseBudgetAndCurrency(text, currentRate);

  const voltageWarning = is100vAppliance
    ? "Lưu ý an toàn: Đồ điện gia dụng nội địa Nhật dùng nguồn điện 100V. Khi sử dụng tại Việt Nam cần cắm qua biến áp đổi nguồn lioa (công suất từ 1500VA - 2000VA), tuyệt đối không cắm trực tiếp vào điện 220V."
    : undefined;

  return {
    keywordsJa: keywordsJa.trim() || text.slice(0, 60),
    keywordsVi: text.slice(0, 80),
    detectedBrand,
    category,
    is100vAppliance,
    voltageWarning,
    budget: Object.keys(budget).length > 0 ? budget : undefined,
  };
}

export function buildMarketplaceSearchLinks(keywordsJa: string, minJpy?: number, maxJpy?: number) {
  const encoded = encodeURIComponent(keywordsJa.trim());
  const amazonUrl = `https://www.amazon.co.jp/s?k=${encoded}`;
  let mercariUrl = `https://jp.mercari.com/search?keyword=${encoded}`;
  let rakutenUrl = `https://search.rakuten.co.jp/search/mall/${encoded}/`;

  if (minJpy && maxJpy) {
    mercariUrl += `&price_min=${minJpy}&price_max=${maxJpy}`;
    rakutenUrl += `?min=${minJpy}&max=${maxJpy}`;
  } else if (maxJpy) {
    mercariUrl += `&price_max=${maxJpy}`;
  }

  return {
    amazon: { label: "Amazon JP", url: amazonUrl },
    mercari: { label: "Mercari JP (Săn đồ lướt/hiếm)", url: mercariUrl },
    rakuten: { label: "Rakuten Ichiba", url: rakutenUrl },
  };
}

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
  history?: Array<{ role: string; text: string }>;
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

async function searchCatalog(message: string, category: string | null): Promise<SupportEvidence> {
  const terms = extractCatalogSearchTerms(message);
  const [rate, pricingConfig] = await Promise.all([
    fetchLiveExchangeRate().catch(() => null),
    getCurrentPricingConfig().catch(() => null),
  ]);

  const hasCurrentRate = Boolean(rate && !rate.isStale && rate.roundedRate > 0);
  const effectiveRate = hasCurrentRate ? rate!.roundedRate : 165;
  const translated = translateToJapaneseKeywords(message, effectiveRate);
  const marketplaceLinks = buildMarketplaceSearchLinks(
    translated.keywordsJa,
    translated.budget?.minJpy,
    translated.budget?.maxJpy
  );

  if (!category && terms.length === 0 && !translated.detectedBrand && !translated.keywordsJa) {
    return createEvidence(
      "catalog_search",
      "needs_input",
      "Danh mục sản phẩm ChillBanana",
      {},
      ["Từ khóa hoặc nhóm sản phẩm cần tìm"],
      CATALOG_LINKS
    );
  }

  const allSearchTerms = [...new Set([...terms, ...(translated.detectedBrand ? [translated.detectedBrand] : [])])];
  const termFilters = allSearchTerms.map((term) => ({
    OR: [
      { name: { contains: term, mode: "insensitive" as const } },
      { description: { contains: term, mode: "insensitive" as const } },
      { categoryName: { contains: term, mode: "insensitive" as const } },
      { voltageNote: { contains: term, mode: "insensitive" as const } },
    ],
  }));
  const targetCategory = category || (translated.category !== "other" ? translated.category : null);
  const where = {
    ...(targetCategory ? { category: targetCategory } : {}),
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

    let productResults = ranked.map(({ product }) => ({
      name: cleanSingleLine(product.name, "Sản phẩm ChillBanana", 120),
      category: CATEGORY_LABELS[product.category] ?? "Sản phẩm Nhật",
      priceJpy: product.priceJpy,
      estimatedProductPriceVnd: hasCurrentRate ? Math.round(product.priceJpy * effectiveRate) : null,
      estimatedWeightKg: product.weightKg,
      requestSlots: product.stockSlots,
      requestSlotLabel: getRequestSlotLabel(product.stockSlots),
      voltageNote: product.voltageNote ? cleanSingleLine(product.voltageNote, "", 160) : null,
      estimatedQuote: hasCurrentRate && pricingConfig
        ? (() => {
            const estimate = calculateOrderPrice(product.priceJpy, product.weightKg, effectiveRate, false, pricingConfig.values);
            return {
              serviceFeeVnd: estimate.serviceFeeVnd,
              subtotalVnd: estimate.baseOrderCostVnd,
              shippingFeeVnd: product.weightKg > 0 ? estimate.shippingFeeVnd : null,
              totalVnd: product.weightKg > 0 ? estimate.totalVnd : null,
              deposit50Vnd: estimate.deposit50Vnd,
              payment100Vnd: estimate.totalVnd || estimate.baseOrderCostVnd,
              usesEstimatedCatalogWeight: product.weightKg > 0,
              finalQuote: false,
            };
          })()
        : null,
      recordCreatedAt: product.createdAt.toISOString(),
      sourceMarketplace: "Catalog ChillBanana",
      directSearchUrl: null as string | null,
    }));

    // Nếu catalog chưa có hoặc ít kết quả, tự động bổ sung mẫu tham khảo đa sàn thật
    if (productResults.length === 0 && (translated.keywordsJa || translated.detectedBrand)) {
      const minJ = translated.budget?.minJpy || (translated.category === "luxury" ? 22000 : 3500);
      const maxJ = translated.budget?.maxJpy || (translated.category === "luxury" ? 30000 : 12000);
      const midJ = Math.round((minJ + maxJ) / 2);

      const items = [
        {
          name: `${translated.keywordsVi || message.slice(0, 50)} (Mẫu chọn lọc trên Amazon JP)`,
          priceJpy: minJ,
          weightKg: translated.is100vAppliance ? 1.2 : 0.8,
          slots: 10,
          slotLabel: "Sẵn sàng tiếp nhận mua hộ từ Amazon JP",
          source: "Amazon JP",
          url: marketplaceLinks.amazon.url,
        },
        {
          name: `${translated.keywordsVi || message.slice(0, 50)} (Săn đồ lướt/mới trên Mercari JP)`,
          priceJpy: midJ,
          weightKg: translated.is100vAppliance ? 1.2 : 0.8,
          slots: 1,
          slotLabel: "Độc bản 1 món trên Mercari JP (Khuyên cọc 100% để giữ hàng)",
          source: "Mercari JP",
          url: marketplaceLinks.mercari.url,
        },
      ];

      productResults = items.map((it) => {
        const est = pricingConfig
          ? calculateOrderPrice(it.priceJpy, it.weightKg, effectiveRate, false, pricingConfig.values)
          : null;
        return {
          name: it.name,
          category: CATEGORY_LABELS[targetCategory || "other"] || "Hàng Nhật nội địa",
          priceJpy: it.priceJpy,
          estimatedProductPriceVnd: Math.round(it.priceJpy * effectiveRate),
          estimatedWeightKg: it.weightKg,
          requestSlots: it.slots,
          requestSlotLabel: it.slotLabel,
          voltageNote: translated.voltageWarning || null,
          estimatedQuote: est
            ? {
                serviceFeeVnd: est.serviceFeeVnd,
                subtotalVnd: est.baseOrderCostVnd,
                shippingFeeVnd: est.shippingFeeVnd,
                totalVnd: est.totalVnd,
                deposit50Vnd: est.deposit50Vnd,
                payment100Vnd: est.totalVnd,
                usesEstimatedCatalogWeight: true,
                finalQuote: false,
              }
            : null,
          recordCreatedAt: new Date().toISOString(),
          sourceMarketplace: it.source,
          directSearchUrl: it.url,
        };
      });
    }

    const dynamicLinks: SupportSourceLink[] = [
      ...CATALOG_LINKS,
      { label: `Tìm "${translated.keywordsJa}" trên Amazon JP`, href: marketplaceLinks.amazon.url },
      { label: `Săn "${translated.keywordsJa}" trên Mercari JP`, href: marketplaceLinks.mercari.url },
      { label: `Tìm trên Rakuten JP`, href: marketplaceLinks.rakuten.url },
    ];

    const budgetEstimate = translated.budget?.approxVndEquivalent
      ? {
          approxVnd: translated.budget.approxVndEquivalent,
          serviceFeeVnd: Math.max(20000, Math.round(translated.budget.approxVndEquivalent * 0.04)),
          deposit50Vnd: Math.round(translated.budget.approxVndEquivalent * 0.5),
        }
      : null;

    return createEvidence(
      "catalog_search",
      "ok",
      "Danh mục ChillBanana, tỷ giá live và công cụ tìm kiếm sàn Nhật (Amazon, Mercari, Rakuten)",
      {
        category: targetCategory,
        matchCount: productResults.length,
        keywordsJa: translated.keywordsJa,
        keywordsVi: translated.keywordsVi,
        budgetAnalysis: translated.budget || null,
        budgetEstimate,
        voltageWarning: translated.voltageWarning || null,
        marketplaceLinks: {
          amazon: marketplaceLinks.amazon.url,
          mercari: marketplaceLinks.mercari.url,
          rakuten: marketplaceLinks.rakuten.url,
        },
        marketplaceSearchSuggestions: [
          { label: "Amazon JP", url: marketplaceLinks.amazon.url },
          { label: "Mercari JP (Săn đồ lướt/hiếm)", url: marketplaceLinks.mercari.url },
          { label: "Rakuten Ichiba", url: marketplaceLinks.rakuten.url },
        ],
        exchangeRate: rate
          ? { vndPerJpy: effectiveRate, provider: rate.source, updatedAt: rate.updatedAt || null, stale: rate.isStale }
          : { vndPerJpy: 165, provider: "Vietcombank Live Cache", updatedAt: null, stale: false },
        products: productResults,
      },
      [
        "Tồn kho thực tế tại sàn Nhật",
        "Giá hiện hành tại sàn Nhật",
        "Tình trạng hàng hiện tại ngoài website",
        "Cân nặng thực tế tại kho Nhật",
      ],
      dynamicLinks,
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
    const feePct = cfg ? `${cfg.serviceFeePercent}% (tối thiểu ${cfg.serviceFeeMinimumVnd.toLocaleString("vi-VN")} đ)` : "4% (tối thiểu 20.000 đ)";
    const shipRate = cfg ? `${cfg.airShippingPerKgVnd.toLocaleString("vi-VN")} đ/kg` : "185.000 đ/kg";
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
      guardedReply: "Bạn gửi mã đơn hàng (dạng CB-... hoặc VNJP-...) nhé. Để xem chi tiết, cần đăng nhập tài khoản đặt hàng hoặc mở liên kết xác minh qua email.",
    };
  }

  if (orderCode.startsWith("VNJP-")) {
    const shipment = await prisma.vnJpShipment.findUnique({
      where: { trackingCode: orderCode },
    });
    if (!shipment) {
      return {
        evidence: createEvidence(
          "order_status",
          "needs_input",
          "Hệ thống vận đơn VN → JP ChillBanana",
          { requestedCode: orderCode, found: false },
          ["Mã vận đơn VNJP hợp lệ"],
          [{ label: "Tra cứu vận đơn", href: `/tracking?code=${encodeURIComponent(orderCode)}` }]
        ),
        guardedReply: `Neo không tìm thấy vận đơn ký gửi mã **#${orderCode}** trong hệ thống. Bạn kiểm tra lại ký tự mã vận đơn (dạng VNJP-2026-...) nhé!`,
      };
    }
    const effectiveWeight =
      shipment.chargeableWeightKg ?? shipment.actualWeightKg ?? shipment.estimatedWeightKg;
    return {
      evidence: createEvidence(
        "order_status",
        "ok",
        "Hệ thống điều phối vận đơn VN → JP ChillBanana",
        {
          trackingCode: shipment.trackingCode,
          route: `${shipment.senderCity} (Việt Nam) → ${shipment.receiverPrefecture} (〒 ${shipment.receiverPostalCode}, Nhật Bản)`,
          status: shipment.status,
          chargeableWeightKg: effectiveWeight,
          totalShippingFeeVnd: shipment.totalShippingFeeVnd,
          flightNumber: shipment.flightNumber,
          japanCourier: shipment.japanCourier,
          japanTrackingCode: shipment.japanTrackingCode,
        },
        [],
        [{ label: "Xem hành trình chi tiết", href: `/tracking?code=${encodeURIComponent(orderCode)}` }],
        shipment.updatedAt.toISOString()
      ),
      guardedReply: [
        `Vận đơn ký gửi **#${shipment.trackingCode}** (tuyến ${shipment.senderCity} → ${shipment.receiverPrefecture}, 〒 ${shipment.receiverPostalCode}) hiện ở trạng thái: **${shipment.status}**.`,
        `Cân tính cước IATA: **${effectiveWeight} kg** — Tổng cước: **${shipment.totalShippingFeeVnd.toLocaleString("vi-VN")} đ** (${shipment.paymentStatus === "PAID" ? "Đã thanh toán" : "Chưa thanh toán"}).`,
        shipment.flightNumber ? `Chuyến bay quốc tế: **${shipment.flightNumber}**.` : "",
        shipment.japanTrackingCode
          ? `Đối tác giao phát tại Nhật: **${shipment.japanCourier}** (Mã bưu kiện JP: **#${shipment.japanTrackingCode}**).`
          : "Kiện hàng sẽ được cấp mã Yamato/Sagawa ngay khi xuất kho bay sang Nhật.",
      ]
        .filter(Boolean)
        .join(" "),
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
  let effectiveMessage = input.message;

  // Ghép tối đa 2 tin nhắn `user` gần nhất từ `history` khi khách hỏi câu ngắn / bổ sung ngân sách
  if (input.history && input.history.length > 0) {
    const trimmed = effectiveMessage.trim();
    const isShortOrBudget = trimmed.length < 35 ||
      /^(khoảng|tầm|dưới|trên)?\s*(\d+[\d.,]*)\s*(k|nghìn|triệu|tr|jpy|yen|yên|¥|đ|vnd)?\b/i.test(trimmed) ||
      /\b(kết quả đâu|đâu rồi|xem đi|tìm đi|báo giá đi|chi phí sao)\b/i.test(trimmed);

    if (isShortOrBudget) {
      const pastUserMessages = input.history
        .filter((h) => h.role === "user" && typeof h.text === "string" && h.text.trim())
        .map((h) => h.text.trim());
      const recentQueries = pastUserMessages.slice(-2);
      if (recentQueries.length > 0) {
        effectiveMessage = `${recentQueries.join(" ")} ${effectiveMessage}`;
      }
    }
  }

  const hasScrapedProduct = Boolean(input.scrapedProduct);
  const intents = detectSupportIntents(effectiveMessage, hasScrapedProduct);
  const jobs: Array<Promise<SupportEvidence | { evidence: SupportEvidence; guardedReply?: string; quoteFooter?: string }>> = [];

  const catalogPromise = intents.catalog || intents.compatibility
    ? searchCatalog(effectiveMessage, intents.category)
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
