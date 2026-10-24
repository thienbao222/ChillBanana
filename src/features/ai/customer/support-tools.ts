import { prisma } from "@/lib/prisma";
import { calculateOrderPrice, DEFAULT_EXCHANGE_RATE } from "@/features/pricing/calculator";
import { getCurrentPricingConfig } from "@/features/pricing/config";
import { fetchLiveExchangeRate } from "@/features/pricing/exchange-rate";
import { chatKeyPool } from "@/lib/api-key-manager";
import { GEMINI_MODELS } from "@/lib/gemini-models";
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
  normalizeSupportText,
  SEARCH_STOP_WORDS,
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
  rate = DEFAULT_EXCHANGE_RATE
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

export function isValidJapaneseSearchKeyword(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;

  // Chứa ký tự tiếng Nhật (Kanji, Hiragana, Katakana)
  const hasJapaneseChar = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(trimmed);
  if (hasJapaneseChar) return true;

  // Nếu chứa ký tự có dấu tiếng Việt (à, á, ả, ã, ạ, ê, ơ, ư, ô, đ...) -> KHÔNG phải từ khóa Nhật hợp lệ
  const hasVietnameseAccents = /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(trimmed);
  if (hasVietnameseAccents) return false;

  // Nếu là chữ La-tinh không dấu nhưng chỉ gồm các từ giao tiếp / từ tiếng Việt cắt dấu -> KHÔNG hợp lệ
  const commonVietnameseStopwords = new Set([
    "tim", "kiem", "giup", "toi", "muon", "mua", "ban", "cho", "hoi", "gia", "bao", "nhieu", "co", "khong", "nao", "tot", "re", "hang", "san", "pham", "do", "cai", "chiec", "quan", "ao", "giay", "dep", "tui", "xach", "dong", "ho", "may", "noi", "com", "dien", "shop", "ad", "admin", "em", "anh", "chi", "o", "dau", "nao", "the", "vay", "a", "oi", "nhe", "nha", "chao", "xin", "cam", "on"
  ]);
  const words = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length > 0 && words.every((w) => commonVietnameseStopwords.has(w))) {
    return false;
  }

  // Nếu là tên thương hiệu quốc tế hoặc model number hợp lệ (chữ La-tinh không dấu từ 3 ký tự)
  const isRecognizedBrandOrModel = Boolean(
    Object.keys(BRAND_DICTIONARY).some((brand) => trimmed.toLowerCase().includes(brand)) ||
    (/^[A-Za-z0-9\s._+-]+$/.test(trimmed) && trimmed.length >= 3 && /[A-Z0-9]/.test(trimmed))
  );

  return isRecognizedBrandOrModel;
}

export async function extractKeywordsWithGemini(
  text: string
): Promise<{ keywordsJa: string; keywordsVi: string; category?: string; brand?: string } | null> {
  const activeKey = chatKeyPool.getNextKey();
  if (!activeKey) return null;

  try {
    const prompt = `Bạn là trợ lý AI chuyên trích xuất và dịch từ khóa tìm kiếm sản phẩm sang tiếng Nhật chuẩn để tìm kiếm trên các sàn thương mại điện tử Nhật Bản (Amazon JP, Rakuten, Mercari).
Nếu người dùng tìm kiếm sản phẩm hoặc hỏi mua một món đồ, hãy dịch tên sản phẩm và thương hiệu sang tiếng Nhật (Kanji/Katakana/Romaji) thông dụng nhất mà người Nhật dùng để tìm kiếm trên sàn TMĐT.
Nếu câu hỏi của người dùng KHÔNG phải là tìm kiếm/hỏi mua sản phẩm (ví dụ: chào hỏi, hỏi chính sách, hỏi địa chỉ, cảm ơn...), keywordsJa PHẢI là chuỗi rỗng "".
Trả về đúng định dạng JSON:
{
  "keywordsJa": "từ khóa tiếng Nhật chuẩn hoặc rỗng nếu không phải tìm sản phẩm",
  "keywordsVi": "tên sản phẩm tiếng Việt tóm tắt",
  "category": "cosmetics" | "health" | "gadgets" | "anime" | "fashion" | "luxury" | "other",
  "brand": "tên thương hiệu nếu có"
}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODELS.lightweight}:generateContent?key=${activeKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: prompt }] },
          contents: [{ role: "user", parts: [{ text: text.slice(0, 300) }] }],
          generationConfig: {
            maxOutputTokens: 256,
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(6000),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`[GeminiExtractKeywords] Model ${GEMINI_MODELS.lightweight} lỗi HTTP ${res.status}: ${errText.slice(0, 200)}`);
      chatKeyPool.markError(activeKey, res.status, GEMINI_MODELS.lightweight);
      return null;
    }

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const textPart = parts.filter((part: { text?: string; thought?: boolean }) => part.text && !part.thought).pop();
    const rawJson = textPart?.text;
    if (!rawJson) return null;

    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== "object") return null;

    return {
      keywordsJa: typeof parsed.keywordsJa === "string" ? parsed.keywordsJa.trim() : "",
      keywordsVi: typeof parsed.keywordsVi === "string" ? parsed.keywordsVi.trim() : "",
      category: typeof parsed.category === "string" ? parsed.category : undefined,
      brand: typeof parsed.brand === "string" ? parsed.brand : undefined,
    };
  } catch (error: any) {
    console.warn(`[GeminiExtractKeywords] Error:`, error?.message || String(error));
    chatKeyPool.markError(activeKey, 503, GEMINI_MODELS.lightweight);
    return null;
  }
}

export function translateToJapaneseKeywordsFromDictionary(text: string, currentRate = DEFAULT_EXCHANGE_RATE): TranslatedQuery & { matched: boolean } {
  const norm = normalizeSupportText(text);
  const rawLower = text.toLowerCase();
  const tokens = norm.split(/[\s,]+/);

  let detectedBrand: string | undefined;
  let brandJa = "";
  let brandCategory: any;

  for (const [key, val] of Object.entries(BRAND_DICTIONARY)) {
    if (tokens.includes(key) || norm.includes(key) || rawLower.includes(key)) {
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
    if (item.match.test(norm) || item.match.test(rawLower)) {
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
  }

  const matched = Boolean(keywordsJa);
  if (!isValidJapaneseSearchKeyword(keywordsJa)) {
    keywordsJa = "";
  }

  const category = (brandCategory || termCategory || "other") as TranslatedQuery["category"];
  const budget = parseBudgetAndCurrency(text, currentRate);

  const voltageWarning = is100vAppliance
    ? "Lưu ý an toàn: Đồ điện gia dụng nội địa Nhật dùng nguồn điện 100V. Khi sử dụng tại Việt Nam cần cắm qua biến áp đổi nguồn lioa (công suất từ 1500VA - 2000VA), tuyệt đối không cắm trực tiếp vào điện 220V."
    : undefined;

  return {
    keywordsJa,
    keywordsVi: text.slice(0, 80),
    detectedBrand,
    category,
    is100vAppliance,
    voltageWarning,
    budget: Object.keys(budget).length > 0 ? budget : undefined,
    matched,
  };
}

export const translateToJapaneseKeywordsSync = translateToJapaneseKeywordsFromDictionary;

export async function translateToJapaneseKeywords(text: string, currentRate = DEFAULT_EXCHANGE_RATE): Promise<TranslatedQuery> {
  const dictionaryResult = translateToJapaneseKeywordsFromDictionary(text, currentRate);

  // Chỉ gọi khi từ điển BRAND_DICTIONARY/PRODUCT_TERMS không khớp
  if (dictionaryResult.matched) {
    return dictionaryResult;
  }

  // Gọi Gemini trích xuất từ khóa tiếng Nhật
  const geminiResult = await extractKeywordsWithGemini(text).catch(() => null);

  if (geminiResult && geminiResult.keywordsJa && isValidJapaneseSearchKeyword(geminiResult.keywordsJa)) {
    const budget = parseBudgetAndCurrency(text, currentRate);
    const validCategory = (["cosmetics", "health", "gadgets", "anime", "fashion", "luxury", "other"].includes(geminiResult.category || "")
      ? geminiResult.category
      : "other") as TranslatedQuery["category"];

    return {
      keywordsJa: geminiResult.keywordsJa,
      keywordsVi: geminiResult.keywordsVi || text.slice(0, 80),
      detectedBrand: geminiResult.brand || undefined,
      category: validCategory,
      is100vAppliance: false,
      voltageWarning: undefined,
      budget: Object.keys(budget).length > 0 ? budget : undefined,
    };
  }

  // Nếu Gemini lỗi hoặc không trả keywordsJa hợp lệ thì dùng kết quả từ điển (không link, không regex)
  return dictionaryResult;
}

export function buildMarketplaceSearchLinks(keywordsJa: string, minJpy?: number, maxJpy?: number) {
  if (!keywordsJa || !keywordsJa.trim() || !isValidJapaneseSearchKeyword(keywordsJa)) {
    return null;
  }
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

export interface ProductCardData {
  id: string;
  name: string;
  imageUrl: string;
  priceJpy: number;
  priceVnd: number | null;
  inStock: boolean;
  stockSlots?: number;
  weightKg?: number;
  originalStore?: string;
  category?: string;
}

export interface CustomerSupportToolInput {
  message: string;
  customerId: string | null;
  guestOrderAccessToken: string | null;
  scrapedProduct: ScrapedProductInput | null;
  history?: Array<{ role: string; text: string; productCards?: ProductCardData[] }>;
}

export interface CustomerSupportToolRun {
  evidence: SupportEvidence[];
  sources: Array<{ label: string; href: string; checkedAt: string }>;
  guardedReply?: string;
  quoteFooter?: string;
  productCards?: ProductCardData[];
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

export function tokenizeNormalizedWords(text: string): string[] {
  if (!text) return [];
  return normalizeSupportText(text)
    .split(/[\s,./\\_!@#$%^&*()+=~`{}[\]|:;"'<>?]+/u)
    .filter(Boolean);
}

export function matchesWholePhraseOrWord(
  haystackNorm: string,
  haystackWords: Set<string>,
  term: string
): boolean {
  const normTerm = normalizeSupportText(term).trim();
  if (!normTerm) return false;

  // Nếu term là 1 từ đơn không có dấu cách
  if (!normTerm.includes(" ")) {
    if (haystackWords.has(normTerm)) return true;
    const escaped = normTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
    return regex.test(haystackNorm);
  }

  // Nếu term là cụm nhiều từ
  const escaped = normTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
  return regex.test(haystackNorm);
}

export async function searchCatalog(message: string, category: string | null): Promise<SupportEvidence> {
  const terms = extractCatalogSearchTerms(message);
  const [rate, pricingConfig] = await Promise.all([
    fetchLiveExchangeRate().catch(() => null),
    getCurrentPricingConfig().catch(() => null),
  ]);

  const hasCurrentRate = Boolean(rate && !rate.isStale && rate.roundedRate > 0);
  const effectiveRate = hasCurrentRate ? rate!.roundedRate : DEFAULT_EXCHANGE_RATE;
  const translated = await translateToJapaneseKeywords(message, effectiveRate);
  const marketplaceLinks = translated.keywordsJa
    ? buildMarketplaceSearchLinks(
        translated.keywordsJa,
        translated.budget?.minJpy,
        translated.budget?.maxJpy
      )
    : null;

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
      take: 60,
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
        imageUrl: true,
        originalStore: true,
        createdAt: true,
      },
    });

    const msgNorm = normalizeSupportText(message);
    const msgWords = new Set(tokenizeNormalizedWords(message));
    const detectedBrandNorm = translated.detectedBrand ? normalizeSupportText(translated.detectedBrand) : null;

    const initialRanked = rows
      .map((product) => {
        const nameNorm = normalizeSupportText(product.name);
        const nameWords = new Set(tokenizeNormalizedWords(product.name));
        const fullTextNorm = normalizeSupportText(
          `${product.name} ${product.description} ${product.categoryName} ${product.voltageNote ?? ""}`
        );
        const fullTextWords = new Set(tokenizeNormalizedWords(fullTextNorm));

        let nameMatchedCount = 0;
        let otherMatchedCount = 0;

        for (const term of terms) {
          if (matchesWholePhraseOrWord(nameNorm, nameWords, term)) {
            nameMatchedCount++;
          } else if (matchesWholePhraseOrWord(fullTextNorm, fullTextWords, term)) {
            otherMatchedCount++;
          }
        }

        const matchedTermsCount = nameMatchedCount + otherMatchedCount;

        // Khớp trọn tên thương hiệu (nếu phát hiện được thương hiệu và sản phẩm khớp đúng thương hiệu đó)
        const isFullBrandMatch = Boolean(
          detectedBrandNorm &&
          matchesWholePhraseOrWord(fullTextNorm, fullTextWords, detectedBrandNorm)
        );

        // Khớp trọn tên sản phẩm (nếu câu hỏi của khách chứa toàn bộ tên sản phẩm hoặc mọi từ khóa chính của tên sản phẩm)
        const isFullProductNameMatch = Boolean(
          (nameNorm.length >= 4 && msgNorm.includes(nameNorm)) ||
          (() => {
            const significantNameWords = Array.from(nameWords).filter((w) => !SEARCH_STOP_WORDS.has(w));
            if (significantNameWords.length === 0) return false;
            return significantNameWords.every((w) => msgWords.has(w));
          })()
        );

        // Điểm xếp hạng:
        // - Khớp trong tên sản phẩm có trọng số cao hơn (2 điểm mỗi từ)
        // - Khớp trong mô tả / thuộc tính (1 điểm)
        // - Khớp trọn thương hiệu (+3 điểm)
        // - Khớp trọn tên sản phẩm (+5 điểm)
        const score =
          nameMatchedCount * 2 +
          otherMatchedCount +
          (isFullBrandMatch ? 3 : 0) +
          (isFullProductNameMatch ? 5 : 0);

        return {
          product,
          score,
          matchedTermsCount,
          isFullBrandMatch,
          isFullProductNameMatch,
        };
      })
      .filter(({ matchedTermsCount, isFullBrandMatch, isFullProductNameMatch }) => {
        // Nếu không có từ khóa tìm kiếm (tìm theo danh mục), giữ lại các sản phẩm cùng danh mục
        if (terms.length === 0) {
          return true;
        }
        // Nếu chỉ có 1 từ khóa: sản phẩm phải khớp ít nhất từ khóa đó hoặc khớp trọn thương hiệu/sản phẩm
        if (terms.length === 1) {
          return matchedTermsCount >= 1 || isFullBrandMatch || isFullProductNameMatch;
        }
        // Nếu có từ 2 từ khóa trở lên: sản phẩm phải khớp ít nhất 2 từ
        // (hoặc khớp trọn tên thương hiệu/sản phẩm). Không hiển thị sản phẩm chỉ khớp 1 từ chung chung.
        return matchedTermsCount >= 2 || isFullBrandMatch || isFullProductNameMatch;
      })
      .sort((a, b) => b.score - a.score || b.product.createdAt.getTime() - a.product.createdAt.getTime());

    const maxScore = initialRanked.length > 0 ? initialRanked[0].score : 0;
    const maxMatched = initialRanked.length > 0 ? Math.max(...initialRanked.map((r) => r.matchedTermsCount)) : 0;

    const ranked = initialRanked
      .filter(({ score, matchedTermsCount, isFullBrandMatch, isFullProductNameMatch }) => {
        if (isFullProductNameMatch || isFullBrandMatch) return true;
        if (terms.length >= 3) {
          // Khi query có từ 3 từ khóa trở lên: loại bỏ các sản phẩm chỉ khớp từ generic
          // khi đã có sản phẩm khớp nhiều từ khóa hơn
          if (matchedTermsCount < Math.ceil(terms.length * 0.5)) return false;
          if (matchedTermsCount < maxMatched - 1) return false;
          if (score < maxScore * 0.6) return false;
        }
        return true;
      })
      .slice(0, 5);

    let productResults = ranked.map(({ product }) => ({
      id: product.id,
      name: cleanSingleLine(product.name, "Sản phẩm ChillBanana", 120),
      category: CATEGORY_LABELS[product.category] ?? "Sản phẩm Nhật",
      priceJpy: product.priceJpy,
      estimatedProductPriceVnd: hasCurrentRate ? Math.round(product.priceJpy * effectiveRate) : null,
      estimatedWeightKg: product.weightKg,
      requestSlots: product.stockSlots,
      inStock: product.stockSlots > 0,
      imageUrl: product.imageUrl,
      originalStore: product.originalStore,
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

    const dynamicLinks: SupportSourceLink[] = [
      ...CATALOG_LINKS,
      ...(marketplaceLinks
        ? [
            { label: `Tìm "${translated.keywordsJa}" trên Amazon JP`, href: marketplaceLinks.amazon.url },
            { label: `Săn "${translated.keywordsJa}" trên Mercari JP`, href: marketplaceLinks.mercari.url },
            { label: `Tìm trên Rakuten JP`, href: marketplaceLinks.rakuten.url },
          ]
        : []),
    ];

    const budgetEstimate = translated.budget?.approxVndEquivalent
      ? {
          approxVnd: translated.budget.approxVndEquivalent,
          serviceFeeVnd: Math.max(20000, Math.round(translated.budget.approxVndEquivalent * 0.04)),
          deposit50Vnd: Math.round(translated.budget.approxVndEquivalent * 0.5),
        }
      : null;

    const hasCatalogMatches = productResults.length > 0;

    return createEvidence(
      "catalog_search",
      "ok",
      hasCatalogMatches
        ? "Danh mục ChillBanana, tỷ giá live và công cụ tìm kiếm sàn Nhật (Amazon, Mercari, Rakuten)"
        : "Không có trong catalog ChillBanana (cung cấp công cụ tìm kiếm sàn Nhật)",
      {
        category: targetCategory,
        matchCount: productResults.length,
        inCatalog: hasCatalogMatches,
        catalogStatus: hasCatalogMatches ? "found" : "not_found",
        keywordsJa: translated.keywordsJa,
        keywordsVi: translated.keywordsVi,
        budgetAnalysis: translated.budget || null,
        budgetEstimate,
        voltageWarning: translated.voltageWarning || null,
        marketplaceLinks: marketplaceLinks
          ? {
              amazon: marketplaceLinks.amazon.url,
              mercari: marketplaceLinks.mercari.url,
              rakuten: marketplaceLinks.rakuten.url,
            }
          : null,
        marketplaceSearchSuggestions: marketplaceLinks
          ? [
              { label: "Amazon JP", url: marketplaceLinks.amazon.url },
              { label: "Mercari JP (Săn đồ lướt/hiếm)", url: marketplaceLinks.mercari.url },
              { label: "Rakuten Ichiba", url: marketplaceLinks.rakuten.url },
            ]
          : [],
        exchangeRate: rate
          ? { vndPerJpy: effectiveRate, provider: rate.source, updatedAt: rate.updatedAt || null, stale: rate.isStale }
          : { vndPerJpy: DEFAULT_EXCHANGE_RATE, provider: "Vietcombank Live Cache", updatedAt: null, stale: false },
        products: productResults,
      },
      [
        ...(hasCatalogMatches ? [] : ["Sản phẩm không có trong catalog ChillBanana"]),
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

export function isCommandOrConversationalMessage(text: string): boolean {
  if (!text) return true;
  const norm = normalizeSupportText(text).trim();
  if (!norm) return true;

  // Lệnh thêm vào giỏ / đặt hàng
  const isCartCommand =
    /\b(them|cho|bo|dat)\s+(vao\s+)?(gio|gio\s+hang|cart)\b/i.test(norm) ||
    /\b(add\s+to\s+cart|mua\s+ngay|order\s+luon|chot\s+don|tao\s+don)\b/i.test(norm);
  if (isCartCommand) return true;

  const terms = extractCatalogSearchTerms(text);

  // Cảm ơn (bỏ qua nếu câu chỉ gồm từ cảm ơn)
  const isThanks = /\b(cam\s+on|thank|thanks|tks|ty)\b/i.test(norm);
  if (isThanks) {
    const nonThanksTerms = terms.filter((t) => !/^(thank|thanks|tks|ty|cam|on)$/i.test(normalizeSupportText(t)));
    if (nonThanksTerms.length === 0) return true;
  }

  // Chào hỏi (bỏ qua nếu câu chỉ gồm từ chào hỏi)
  const isGreeting = /\b(chao|xin\s+chao|hello|hi|alo|hey|shop\s+oi|ad\s+oi|admin\s+oi)\b/i.test(norm);
  if (isGreeting) {
    const nonGreetingTerms = terms.filter((t) => !/^(chao|xin|hello|hi|alo|hey|shop|ad|admin)$/i.test(normalizeSupportText(t)));
    if (nonGreetingTerms.length === 0) return true;
  }

  // Nếu toàn bộ từ là stop words hoặc chỉ có lời cảm ơn / chào hỏi
  if (terms.length === 0 && (isThanks || /\b(chao|hello|hi|shop|ad)\b/i.test(norm))) {
    return true;
  }

  return false;
}

export function isFollowupQuery(message: string, currentTerms: string[]): boolean {
  const trimmed = message.trim();
  const norm = normalizeSupportText(trimmed);

  // Bỏ qua tin mang tính lệnh hoặc chào hỏi
  if (isCommandOrConversationalMessage(message)) {
    return false;
  }

  // Hỏi bổ sung ngân sách / khoảng giá
  const isBudgetFollowup =
    /^(khoảng|tầm|dưới|trên)?\s*(\d+[\d.,]*)\s*(k|nghìn|triệu|tr|jpy|yen|yên|¥|đ|vnd|man)?\b/i.test(trimmed);

  if (isBudgetFollowup) {
    return true;
  }

  // Nếu tin nhắn hiện tại tự nó đã có từ 2 từ khóa trở lên -> KHÔNG gộp
  if (currentTerms.length >= 2) {
    return false;
  }

  // Cụm hỏi tiếp / kết quả
  const isContinuationPhrase =
    /\b(kết quả đâu|đâu rồi|xem đi|tìm đi|báo giá đi|chi phí sao|giá sao|thế nào|sao rồi|hết chưa|còn không|loại nào khác|loại khác|mẫu khác|bản khác|màu khác|size khác)\b/i.test(trimmed);

  // Bắt đầu bằng từ nối tiếp câu
  const isConnector =
    /^(thế còn|còn|vậy|vậy thì|thế thì|thế|nếu|xem thêm|tìm thêm|cho xem|thêm|bản|mẫu|loại)\b/i.test(trimmed);

  // Câu hỏi về giá, phí, mua tiếp
  const isFollowupQuestion =
    /\b(gia bao nhieu|bao nhieu tien|bao nhieu|nhieu tien|tinh gia|bao gia|phi ship|cuoc|mua duoc khong|co khong|ship duoc khong)\b/i.test(norm);

  return isBudgetFollowup || isContinuationPhrase || isConnector || isFollowupQuestion || (trimmed.length < 35 && currentTerms.length <= 1);
}

export function resolveEffectiveSupportMessage(
  message: string,
  history?: Array<{ role: string; text: string }>
): string {
  let effectiveMessage = message;

  if (history && history.length > 0) {
    const currentTerms = extractCatalogSearchTerms(effectiveMessage);

    // Chỉ gộp tin trước khi tin hiện tại là câu hỏi nối tiếp và tự nó có ít hơn 2 từ khóa có nghĩa sau khi bỏ stop words.
    // Nếu tin hiện tại đã có từ 2 từ khóa trở lên (ví dụ "thực phẩm chức năng thì sao") thì KHÔNG gộp.
    if (isFollowupQuery(effectiveMessage, currentTerms)) {
      const pastUserMessages = history
        .filter((h) => h.role === "user" && typeof h.text === "string" && h.text.trim())
        .map((h) => h.text.trim());

      // Chỉ lấy 1 tin user gần nhất, và bỏ qua tin mang tính lệnh (thêm vào giỏ, cảm ơn, chào hỏi) khi gộp.
      let candidateMessage: string | null = null;
      for (let i = pastUserMessages.length - 1; i >= 0; i--) {
        const pastText = pastUserMessages[i];
        if (!isCommandOrConversationalMessage(pastText)) {
          candidateMessage = pastText;
          break;
        }
      }

      if (candidateMessage) {
        effectiveMessage = `${candidateMessage} ${effectiveMessage}`;
      }
    }
  }

  return effectiveMessage;
}

export async function runCustomerSupportTools(input: CustomerSupportToolInput): Promise<CustomerSupportToolRun> {
  const effectiveMessage = resolveEffectiveSupportMessage(input.message, input.history);

  const hasScrapedProduct = Boolean(input.scrapedProduct);
  const intents = detectSupportIntents(effectiveMessage, hasScrapedProduct);

  let productCards: ProductCardData[] = [];
  let cartReply: string | undefined;
  let addToCartCatalogEvidence: SupportEvidence | null = null;

  if (intents.addToCart) {
    const currentTerms = extractCatalogSearchTerms(input.message);

    if (currentTerms.length > 0) {
      // 1. Khách có tên sản phẩm trong tin nhắn hiện tại -> tìm trong catalog theo các từ khóa đó
      addToCartCatalogEvidence = await searchCatalog(input.message, intents.category);
      const matchedProducts = (addToCartCatalogEvidence.known.products as any[]) || [];

      if (matchedProducts.length === 1) {
        // 3. Đúng 1 sản phẩm khớp chắc chắn -> trả productCards chỉ với sản phẩm đó
        const p = matchedProducts[0];
        productCards = [
          {
            id: p.id,
            name: p.name,
            imageUrl: p.imageUrl || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80",
            priceJpy: p.priceJpy,
            priceVnd: p.estimatedProductPriceVnd ?? null,
            inStock: Boolean(p.inStock ?? (p.requestSlots > 0)),
            stockSlots: typeof p.requestSlots === "number" ? p.requestSlots : (typeof p.stockSlots === "number" ? p.stockSlots : 5),
            weightKg: p.estimatedWeightKg,
            originalStore: p.originalStore,
            category: p.category,
          },
        ];
        cartReply = "Quý khách bấm nút Thêm vào giỏ bên dưới để thêm sản phẩm vào giỏ hàng nhé.";
      } else if (matchedProducts.length >= 2) {
        // 4. Có 2-3 sản phẩm khớp -> trả tối đa 3 thẻ và hỏi "Quý khách muốn thêm món nào?". KHÔNG chọn thay khách
        productCards = matchedProducts.slice(0, 3).map((p: any) => ({
          id: p.id,
          name: p.name,
          imageUrl: p.imageUrl || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80",
          priceJpy: p.priceJpy,
          priceVnd: p.estimatedProductPriceVnd ?? null,
          inStock: Boolean(p.inStock ?? (p.requestSlots > 0)),
          stockSlots: typeof p.requestSlots === "number" ? p.requestSlots : (typeof p.stockSlots === "number" ? p.stockSlots : 5),
          weightKg: p.estimatedWeightKg,
          originalStore: p.originalStore,
          category: p.category,
        }));
        cartReply = "ChillBanana tìm thấy một số sản phẩm phù hợp. Quý khách muốn thêm món nào vào giỏ hàng ạ?";
      } else {
        // 5. Không khớp sản phẩm nào -> nói chưa tìm thấy trong catalog, không lấy sản phẩm cũ trong lịch sử để thay thế.
        // Tuyệt đối không bao giờ trả thẻ của một sản phẩm khác với sản phẩm khách vừa gọi tên.
        productCards = [];
        cartReply = "ChillBanana chưa tìm thấy sản phẩm này trong catalog. Quý khách có thể gửi link sản phẩm từ sàn Nhật để được hỗ trợ mua hộ nhé.";
      }
    } else {
      // 2. Tin nhắn dùng từ chỉ định (đó, này, nó...) hoặc không có tên sản phẩm -> dùng sản phẩm Catalog gần nhất trong lịch sử
      let recentProduct: ProductCardData | null = null;

      if (input.history && input.history.length > 0) {
        for (let i = input.history.length - 1; i >= 0; i--) {
          const item = input.history[i];
          if (item.productCards && Array.isArray(item.productCards) && item.productCards.length > 0) {
            recentProduct = item.productCards[0];
            break;
          }
        }

        // Nếu trong history không có sẵn productCards, tìm theo nội dung text trong lịch sử
        if (!recentProduct) {
          const pastTexts = input.history
            .map((h) => (typeof h.text === "string" ? h.text : ""))
            .filter(Boolean);

          if (pastTexts.length > 0) {
            try {
              const allProducts = await prisma.product.findMany({
                take: 50,
                orderBy: { createdAt: "desc" },
                select: {
                  id: true,
                  name: true,
                  imageUrl: true,
                  priceJpy: true,
                  priceVnd: true,
                  weightKg: true,
                  originalStore: true,
                  category: true,
                  stockSlots: true,
                },
              });

              for (let i = pastTexts.length - 1; i >= 0; i--) {
                const textNorm = normalizeSupportText(pastTexts[i]);
                const matched = allProducts.find((p) => {
                  const pNameNorm = normalizeSupportText(p.name);
                  return textNorm.includes(pNameNorm) || (pNameNorm.length >= 6 && textNorm.includes(pNameNorm.slice(0, 20)));
                });
                if (matched) {
                  const liveRateData = await fetchLiveExchangeRate().catch(() => null);
                  const hasLiveRate = Boolean(liveRateData && !liveRateData.isStale && liveRateData.roundedRate > 0);
                  recentProduct = {
                    id: matched.id,
                    name: matched.name,
                    imageUrl: matched.imageUrl || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80",
                    priceJpy: matched.priceJpy,
                    priceVnd: hasLiveRate ? Math.round(matched.priceJpy * liveRateData!.roundedRate) : null,
                    inStock: matched.stockSlots > 0,
                    stockSlots: matched.stockSlots,
                    weightKg: matched.weightKg,
                    originalStore: matched.originalStore,
                    category: matched.category,
                  };
                  break;
                }
              }
            } catch {
              // Bỏ qua lỗi DB
            }
          }
        }
      }

      if (recentProduct) {
        productCards = [recentProduct];
        cartReply = "Quý khách bấm nút Thêm vào giỏ bên dưới để thêm sản phẩm vào giỏ hàng nhé.";
      } else {
        productCards = [];
        cartReply = "ChillBanana chưa tìm thấy sản phẩm nào trong cuộc trò chuyện để thêm vào giỏ. Quý khách vui lòng chọn hoặc tìm kiếm sản phẩm trước nhé.";
      }
    }
  }

  const jobs: Array<Promise<SupportEvidence | { evidence: SupportEvidence; guardedReply?: string; quoteFooter?: string }>> = [];

  const catalogPromise =
    (intents.catalog || intents.compatibility) && !intents.addToCart
      ? searchCatalog(effectiveMessage, intents.category)
      : null;
  if (intents.catalog && !intents.addToCart && catalogPromise) jobs.push(catalogPromise);
  if (intents.quote) jobs.push(executeQuote(input.scrapedProduct));
  if (intents.orderStatus) jobs.push(lookupOrderStatus(intents.orderCode, input.customerId, input.guestOrderAccessToken));
  if (intents.shipping) jobs.push(getShippingPolicyEvidence());
  if (intents.compatibility && catalogPromise) {
    jobs.push(catalogPromise.then(getCompatibilityEvidence));
  }

  const results = await Promise.all(jobs);
  const evidence: SupportEvidence[] = [];
  if (addToCartCatalogEvidence) {
    evidence.push(addToCartCatalogEvidence);
  }
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

  // Nếu chưa có productCards từ add_to_cart, lấy danh sách sản phẩm Catalog từ catalog_search
  if (!intents.addToCart && productCards.length === 0) {
    const catalogEvidence = evidence.find((e) => e.toolId === "catalog_search");
    const rawProducts = catalogEvidence?.known?.products;
    if (Array.isArray(rawProducts) && rawProducts.length > 0) {
      productCards = rawProducts
        .filter((p: any) => p && typeof p.id === "string" && typeof p.name === "string")
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          imageUrl: p.imageUrl || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80",
          priceJpy: p.priceJpy,
          priceVnd: typeof p.estimatedProductPriceVnd === "number" ? p.estimatedProductPriceVnd : null,
          inStock: Boolean(p.inStock ?? (p.requestSlots > 0)),
          stockSlots: typeof p.requestSlots === "number" ? p.requestSlots : (typeof p.stockSlots === "number" ? p.stockSlots : 5),
          weightKg: p.estimatedWeightKg,
          originalStore: p.originalStore,
          category: p.category,
        }));
    }
  }

  // Never let model-generated prose reinterpret private order details or quote arithmetic.
  // A combined request can be split by the customer into separate messages afterward.
  const guardedReply = cartReply ?? orderReply ?? quoteReply;

  return { evidence, sources: buildSourceList(evidence), guardedReply, quoteFooter, productCards };
}
