// FILE: src/features/pricing/customs-categories.ts
// Module trung tâm quản lý Danh mục hàng hóa mua hộ Nhật -> Việt,
// Biểu phí đối chiếu Phụ phí Hải quan (tính ở Đợt 2 sau khi qua hải quan)
// và Bộ phân loại đa tầng từ Mục loại sản phẩm (Breadcrumb / Category Path) + Tên sản phẩm.

export type JpVnProductCategory =
  | "cosmetics"
  | "health"
  | "gadgets"
  | "anime"
  | "fashion"
  | "food"
  | "luxury"
  | "other";

export interface CategoryCustomsInfo {
  id: JpVnProductCategory;
  label: string;
  shortLabel: string;
  surchargePercent: number;      // % phụ phí hải quan tham chiếu đối chiếu theo danh mục (thu Đợt 2 sau khi qua hải quan)
  perKgSurchargeVnd: number;     // Phụ phí kiểm dịch/thông quan theo kg tham chiếu (nếu có)
  suggestedWeight: number;       // Cân nặng gợi ý tham khảo (kg)
  customsRuleNote: string;       // Ghi chú quy tắc hải quan hiển thị trên bảng phí
  selectOptionLabel: string;     // Nhãn hiển thị trong ô <select>
}

export const JP_VN_CATEGORIES: Record<JpVnProductCategory, CategoryCustomsInfo> = {
  fashion: {
    id: "fashion",
    label: "Thời Trang, Quần Áo & Giày Dép",
    shortLabel: "Thời trang & Giày dép",
    surchargePercent: 0,
    perKgSurchargeVnd: 0,
    suggestedWeight: 0.4,
    customsRuleNote: "0% phụ phí danh mục (Tính sau khi qua hải quan)",
    selectOptionLabel: "👗 Thời Trang, Quần Áo, Giày Dép & Túi Vải (0% phụ phí danh mục)",
  },
  anime: {
    id: "anime",
    label: "Anime, Figure, Mô Hình & Thẻ Bài",
    shortLabel: "Anime & Figure",
    surchargePercent: 0,
    perKgSurchargeVnd: 0,
    suggestedWeight: 0.5,
    customsRuleNote: "0% phụ phí danh mục (Tính sau khi qua hải quan)",
    selectOptionLabel: "🎎 Anime, Manga, Figure, Gunpla & Thẻ Bài (0% phụ phí danh mục)",
  },
  food: {
    id: "food",
    label: "Thực Phẩm Khô, Bánh Kẹo & Trà Nhật",
    shortLabel: "Thực phẩm & Trà Nhật",
    surchargePercent: 0,
    perKgSurchargeVnd: 0,
    suggestedWeight: 0.5,
    customsRuleNote: "0% phụ phí danh mục (Tính sau khi qua hải quan)",
    selectOptionLabel: "🍵 Thực Phẩm Khô, Bánh Kẹo, Matcha & Đồ Gia Dụng Thường (0% phụ phí)",
  },
  cosmetics: {
    id: "cosmetics",
    label: "Mỹ Phẩm, Nước Hoa & Chăm Sóc Da",
    shortLabel: "Mỹ phẩm & Skincare",
    surchargePercent: 2,
    perKgSurchargeVnd: 20000,
    suggestedWeight: 0.3,
    customsRuleNote: "Phụ phí thông quan mỹ phẩm ~2% (Tính sau khi qua hải quan)",
    selectOptionLabel: "🌸 Mỹ Phẩm, Nước Hoa & Chăm Sóc Da (Phụ phí HQ ~2% sau thông quan)",
  },
  health: {
    id: "health",
    label: "Thực Phẩm Chức Năng & Sức Khỏe",
    shortLabel: "Thực phẩm chức năng",
    surchargePercent: 3,
    perKgSurchargeVnd: 30000,
    suggestedWeight: 0.4,
    customsRuleNote: "Phụ phí kiểm dịch TPCN ~3% (Tính sau khi qua hải quan)",
    selectOptionLabel: "🌿 Thực Phẩm Chức Năng, Vitamin & Collagen (Phụ phí HQ ~3% sau thông quan)",
  },
  gadgets: {
    id: "gadgets",
    label: "Gia Dụng, Điện Tử & Thiết Bị Số (100V)",
    shortLabel: "Gia dụng & Điện tử",
    surchargePercent: 5,
    perKgSurchargeVnd: 40000,
    suggestedWeight: 0.8,
    customsRuleNote: "Phụ phí hải quan điện tử ~5% (Tính sau khi qua hải quan)",
    selectOptionLabel: "⚡ Gia Dụng, Điện Tử Mini & Thiết Bị 100V (Phụ phí HQ ~5% sau thông quan)",
  },
  luxury: {
    id: "luxury",
    label: "Đồng Hồ, Máy Game & Hàng Giá Trị Cao",
    shortLabel: "Đồng hồ & Hàng hiệu",
    surchargePercent: 6,
    perKgSurchargeVnd: 50000,
    suggestedWeight: 0.6,
    customsRuleNote: "Phụ phí hải quan hàng giá trị cao ~6% (Tính sau khi qua hải quan)",
    selectOptionLabel: "⌚ Đồng Hồ, Máy Chơi Game, Máy Ảnh & Hàng Hiệu (Phụ phí HQ ~6% sau thông quan)",
  },
  other: {
    id: "other",
    label: "Danh Mục Khác (Đối chiếu thực tế)",
    shortLabel: "Danh mục khác",
    surchargePercent: 0,
    perKgSurchargeVnd: 0,
    suggestedWeight: 0.5,
    customsRuleNote: "Đối chiếu theo biểu phí thực tế khi qua hải quan",
    selectOptionLabel: "📦 Mặt Hàng Khác (Đối chiếu phụ phí thực tế sau khi qua hải quan)",
  },
};

export const VALID_JP_VN_CATEGORIES = Object.keys(JP_VN_CATEGORIES) as JpVnProductCategory[];

export function getCategoryCustomsInfo(category: string): CategoryCustomsInfo {
  return JP_VN_CATEGORIES[category as JpVnProductCategory] || JP_VN_CATEGORIES.other;
}

/**
 * Nhận diện chính xác Danh mục hàng hóa từ:
 * 1. Chuỗi Mục loại sản phẩm / Breadcrumb cào trực tiếp từ sàn Nhật (Ưu tiên số 1)
 * 2. Kết quả phân loại từ Gemini AI (Ưu tiên số 2)
 * 3. Tiêu đề tiếng Nhật + tiếng Anh/Việt & Tên sàn (Ưu tiên số 3)
 */
export function classifyProductCategory(params: {
  breadcrumbText?: string | null;
  title?: string | null;
  titleJp?: string | null;
  storeName?: string | null;
  geminiCategory?: string | null;
}): { category: JpVnProductCategory; matchedFrom: string } {
  const bread = (params.breadcrumbText || "").toLowerCase();
  const fullText = `${params.breadcrumbText || ""} ${params.titleJp || ""} ${params.title || ""}`.toLowerCase();
  const store = (params.storeName || "").toLowerCase();

  // 1. Nếu là sàn Uniqlo JP -> Mặc định chắc chắn là Thời trang (fashion) trừ khi có từ khóa khác
  if (store.includes("uniqlo")) {
    return { category: "fashion", matchedFrom: params.breadcrumbText || "Uniqlo JP (Thời trang)" };
  }

  // 2. Tập luật ưu tiên quét trên Breadcrumb (Mục loại sản phẩm của Amazon, Rakuten, Yahoo, Mercari, Surugaya, BicCamera)
  const rules: { category: JpVnProductCategory; pattern: RegExp }[] = [
    {
      category: "anime",
      pattern:
        /フィギュア|プラモデル|ガンプラ|おもちゃ|ホビー|トレカ|トレーディングカード|ポケモンカード|遊戯王|アニメ|コミック|キャラクターグッズ|ぬいぐるみ|同人|一番くじ|ねんどろいど|バンダイ|bandai|figure|gunpla|gundam|nendoroid|pokemon|one piece|naruto|dragon ball|hololive|굿즈/i,
    },
    {
      category: "cosmetics",
      pattern:
        /コスメ|美容|香水|スキンケア|化粧品|化粧水|乳液|美容液|日焼け止め|クレンジング|洗顔|メイク|リップ|口紅|ファンデーション|シャンプー|ヘアケア|ボディケア|shiseido|anessa|hada labo|dhc|sk-ii|canmake|cezanne|cosme|skincare|serum|sunscreen|cleansing|lotion/i,
    },
    {
      category: "health",
      pattern:
        /サプリメント|サプリ|健康食品|ダイエット・健康|医薬品|医薬部外品|ビタミン|コラーゲン|青汁|プロテイン|乳酸菌|グルコサミン|コンドロイチン|ナットウキナーゼ|orihiro|dear-natura|fancl|wakamoto|ebios|karang|collagen|vitamin|supplement|glucosamine|spirulina/i,
    },
    {
      category: "luxury",
      pattern:
        /腕時計|時計|ロレックス|セイコー|カシオ|g-shock|citizen|seiko|casio|orient|ブランドバッグ|ルイ・ヴィトン|エルメス|シャネル|グッチ|プラダ|ジュエリー|アクセサリー|テレビゲーム|nintendo switch|playstation|ps5|xbox|デジタル一眼|ミラーレス一眼|交換レンズ/i,
    },
    {
      category: "gadgets",
      pattern:
        /家電|生活家電|キッチン家電|美容家電|空調家電|スマホ|スマートフォン|タブレット|パソコン|pc周辺機器|オーディオ|イヤホン|ヘッドホン|スピーカー|炊飯器|電子レンジ|掃除機|ドライヤー|シェーバー|電動歯ブラシ|マッサージ機|加湿器|空気清浄機|panasonic|zojirushi|tiger|hitachi|toshiba|sharp|sony|audio-technica|dyson|braun|philips|100v|ac100v/i,
    },
    {
      category: "fashion",
      pattern:
        /ファッション|レディース|メンズ|キッズ・ベビー|トップス|ジャケット|アウター|コート|パンツ|デニム|スカート|ワンピース|シャツ|パーカー|ニット|セーター|スウェット|下着|靴|シューズ|スニーカー|ブーツ|サンダル|バッグ・小物|リュック|トートバッグ|財布|帽子|サングラス|uniqlo|gu |beams|united arrows|porter|onitsuka tiger|asics|mizuno|nike|adidas|new balance|áo|quần|giày|váy|túi xách/i,
    },
    {
      category: "food",
      pattern:
        /食品|スイーツ|お菓子|チョコレート|せんべい|ビスケット|クッキー|お茶|抹茶|緑茶|コーヒー|紅茶|飲料|お酒|調味料|ラーメン|うどん|そば|カレー|ふりかけ|海苔|乾物|キッチン用品|調理器具|食器|弁当箱|水筒|マグボトル|文房具|日用品|matcha|snack|ramen|chocolate/i,
    },
  ];

  // Quét ưu tiên trên riêng chuỗi Breadcrumb trước (để tránh tên sản phẩm gây nhiễu)
  if (bread.trim().length > 2) {
    for (const rule of rules) {
      if (rule.pattern.test(bread)) {
        return { category: rule.category, matchedFrom: `Mục loại sản phẩm: ${params.breadcrumbText}` };
      }
    }
  }

  // Nếu Gemini đã phân loại rõ ràng (khác "other")
  if (
    params.geminiCategory &&
    VALID_JP_VN_CATEGORIES.includes(params.geminiCategory as JpVnProductCategory) &&
    params.geminiCategory !== "other"
  ) {
    return {
      category: params.geminiCategory as JpVnProductCategory,
      matchedFrom: params.breadcrumbText
        ? `AI + Breadcrumb (${params.breadcrumbText})`
        : "AI phân tích nội dung trang",
    };
  }

  // Quét trên toàn bộ Breadcrumb + Tên tiếng Nhật + Tên sản phẩm
  for (const rule of rules) {
    if (rule.pattern.test(fullText)) {
      return {
        category: rule.category,
        matchedFrom: params.breadcrumbText || "Phân tích từ khóa tên sản phẩm",
      };
    }
  }

  // Suy luận theo đặc thù sàn nếu vẫn chưa khớp
  if (store.includes("surugaya")) {
    return { category: "anime", matchedFrom: "Sàn Surugaya JP (Anime & Hobby)" };
  }
  if (store.includes("bic camera") || store.includes("yodobashi")) {
    return { category: "gadgets", matchedFrom: `Sàn ${params.storeName} (Điện tử & Gia dụng)` };
  }

  return { category: "other", matchedFrom: "Chưa xác định rõ mục loại sản phẩm" };
}
