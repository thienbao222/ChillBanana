// Module dịch từ khóa sang tiếng Nhật (keywords_ja) & Chuẩn hóa ngân sách VND ⇄ JPY
// Phục vụ AI Agent tìm kiếm đa sàn (Amazon JP, Mercari JP, Rakuten) đồng bộ.

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

  // 1. Kiểm tra dải giá JPY: "20.000-30.000 JPY", "20000 - 30000 yên", "20k - 30k jpy"
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

  // 1b. Đơn giá JPY: "30.000 JPY", "20000 yên", "3 man" (30.000 yên)
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

  // 2. Kiểm tra dải giá VND: "3 - 5 triệu", "3tr - 5tr", "3 đến 5 triệu đồng"
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

  // 2b. Đơn giá VND: "khoảng 5 triệu", "tầm 5tr", "5.000.000đ", "dưới 3 triệu"
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

  // 2c. Số tiền đầy đủ: "5.000.000 vnđ", "5000000 đ"
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

  // Ghép chuỗi từ khóa tiếng Nhật
  let keywordsJa = "";
  if (brandJa && productJa) {
    keywordsJa = `${brandJa} ${productJa}`;
  } else if (brandJa) {
    keywordsJa = brandJa;
  } else if (productJa) {
    keywordsJa = productJa;
  } else {
    // Giữ lại các danh từ riêng, model ký tự la-tinh
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
  let amazonUrl = `https://www.amazon.co.jp/s?k=${encoded}`;
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
