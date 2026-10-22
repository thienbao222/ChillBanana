// FILE: src/features/ai/vn-jp/maff-inspector.ts
// Động cơ AI Lai (Deterministic MAFF/IATA Rule-Engine + Gemini Structured JSON)
// Dùng chung cho cả Khách hàng (Neo MAFF Inspector) và Quản trị viên (Admin Customs & Flight Copilot).

import { VnJpCargoType } from "@/features/pricing/vn-jp-rates";

export type MaffRiskLevel = "SAFE" | "CONDITIONAL" | "PROHIBITED";

export interface InspectedCargoItem {
  rawText: string;
  status: MaffRiskLevel;
  reasonVi: string;
  englishCustomsName: string;
  japaneseCustomsName: string;
  hsCode: string;
}

export interface VnJpAiInspectionResult {
  overallRisk: MaffRiskLevel;
  canFly: boolean;
  suggestedCargoType: VnJpCargoType;
  cleanedCargoDetails: string;
  normalizedRomajiName: string;
  postalPrefectureMatch: {
    isValid: boolean;
    expectedRegionNote: string;
  };
  recommendedBox: {
    boxCode: string;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    volumetricWeightKg: number;
  };
  items: InspectedCargoItem[];
  neoKuudereComment: string;
  // Phần mở rộng chuyên biệt cho Admin Copilot (Tờ khai CN23 & Điều phối bay)
  adminCustomsDeclaration?: {
    invoiceSummaryEn: string;
    invoiceSummaryJp: string;
    declaredCategory: "GIFT" | "DOCUMENTS" | "COMMERCIAL_SAMPLE";
    recommendedFlight: string;
    recommendedCourier: string;
    routingReasonVi: string;
  };
}

interface RulePattern {
  keywords: RegExp;
  status: MaffRiskLevel;
  reasonVi: string;
  en: string;
  jp: string;
  hsCode: string;
  cargoType: VnJpCargoType;
}

const MAFF_IATA_RULES: RulePattern[] = [
  {
    keywords: /(khô bò|bò khô|khô gà|gà khô|chà bông|ruốc|xúc xích|lạp xưởng|giò chả|chả lụa|nem chua|thịt heo|thịt lợn|thịt bò|thịt gà|pate|bánh trung thu nhân trứng muối|trứng muối|tổ yến)/i,
    status: "PROHIBITED",
    reasonVi: "CẤM TUYỆT ĐỐI theo Luật Kiểm dịch Động vật MAFF Nhật Bản (các chế phẩm từ thịt gia súc, gia cầm, trứng chưa qua kiểm dịch chính ngạch bị tịch thu và phạt tới 3 triệu JPY).",
    en: "Prohibited Meat/Poultry Product (MAFF Restricted)",
    jp: "肉製品・畜産物（動物検疫対象・持込禁止）",
    hsCode: "1602.50",
    cargoType: "food",
  },
  {
    keywords: /(xoài tươi|sầu riêng|vải thiều|nhãn tươi|thanh long|bưởi|cam tươi|rau tươi|ớt tươi|cây cảnh|hạt giống|đất trồng|hoa tươi)/i,
    status: "PROHIBITED",
    reasonVi: "CẤM NHẬP CẢNH theo Luật Bảo vệ Thực vật MAFF Nhật Bản (trái cây tươi, rau củ tươi và hạt giống không có chứng thư Phytosanitary bị tiêu hủy tại sân bay).",
    en: "Fresh Fruit/Plant Material (MAFF Plant Quarantine Prohibited)",
    jp: "生鮮果実・植物類（植物検疫持込禁止）",
    hsCode: "0804.50",
    cargoType: "food",
  },
  {
    keywords: /(pin dự phòng|sạc dự phòng|bình xịt|nước hoa|cồn|rượu|rưỡu|chất lỏng dễ cháy|bật lửa|pháo)/i,
    status: "PROHIBITED",
    reasonVi: "CẤM BAY theo quy định An ninh Hàng không Quốc tế IATA (Hàng nguy hiểm Dangerous Goods - dễ cháy nổ trong khoang áp suất).",
    en: "IATA Dangerous Goods (Lithium Battery / Flammable Liquid)",
    jp: "航空危険物（モバイルバッテリー・引火性液体）",
    hsCode: "8507.60",
    cargoType: "other",
  },
  {
    keywords: /(cà phê|cafe|trà|chè|bánh đậu xanh|bánh pía|bánh tráng|bún khô|miến khô|phở khô|mì gói|hạt điều|hạt sen|mít sấy|chuối sấy|tôm khô|mực khô|cá khô|gia vị)/i,
    status: "CONDITIONAL",
    reasonVi: "Được phép bay sang Nhật nhưng BẮT BUỘC có nhãn mác thương mại, thành phần không chứa thịt/trứng và phải hút chân không kín.",
    en: "Vacuum-Sealed Dry Food / Roasted Coffee & Confectionery",
    jp: "乾燥食品・焙煎コーヒー・菓子類（真空パック済）",
    hsCode: "0901.21",
    cargoType: "food",
  },
  {
    keywords: /(hồ sơ|tài liệu|học bạ|bằng cấp|bằng tốt nghiệp|bằng lái|giấy tờ|giấy khai sinh|hợp đồng|chứng từ|sách|truyện)/i,
    status: "SAFE",
    reasonVi: "Hàng tài liệu/ấn phẩm an toàn 100%, được ưu tiên luồng thông quan nhanh EMS 48h.",
    en: "Printed Documents & Educational Certificates",
    jp: "書類・印刷物・証明書",
    hsCode: "4901.99",
    cargoType: "doc",
  },
  {
    keywords: /(áo|quần|váy|khăn|giày|dép|túi xách|mũ|nón|quà lưu niệm|đồ len|áo dài)/i,
    status: "SAFE",
    reasonVi: "Hàng may mặc & quà tặng cá nhân an toàn 100%, miễn kiểm dịch MAFF.",
    en: "Personal Apparel & Clothing Gift",
    jp: "個人用衣類・贈答品",
    hsCode: "6110.20",
    cargoType: "gift",
  },
];

// Ánh xạ 2 chữ số đầu của Mã bưu điện Nhật Bản (〒) sang vùng/tỉnh để kiểm tra chéo
const POSTAL_PREFIX_TO_PREFECTURE: Record<string, string[]> = {
  "10": ["Tokyo"], "11": ["Tokyo"], "12": ["Tokyo"], "13": ["Tokyo"], "14": ["Tokyo"],
  "15": ["Tokyo"], "16": ["Tokyo"], "17": ["Tokyo"], "18": ["Tokyo"], "19": ["Tokyo"],
  "20": ["Tokyo"],
  "21": ["Kanagawa"], "22": ["Kanagawa"], "23": ["Kanagawa"], "24": ["Kanagawa"], "25": ["Kanagawa"],
  "26": ["Chiba"], "27": ["Chiba"], "28": ["Chiba"], "29": ["Chiba"],
  "33": ["Saitama"], "34": ["Saitama"], "35": ["Saitama"], "36": ["Saitama"],
  "45": ["Aichi"], "46": ["Aichi"], "47": ["Aichi"], "48": ["Aichi"], "49": ["Aichi"],
  "53": ["Osaka"], "54": ["Osaka"], "55": ["Osaka"], "56": ["Osaka"], "57": ["Osaka"], "58": ["Osaka"], "59": ["Osaka"],
  "60": ["Kyoto"], "61": ["Kyoto"], "62": ["Kyoto"],
  "65": ["Hyogo"], "66": ["Hyogo"], "67": ["Hyogo"],
  "81": ["Fukuoka"], "82": ["Fukuoka"], "83": ["Fukuoka"],
};

const KANSAI_WEST_PREFECTURES = new Set([
  "Osaka", "Kyoto", "Hyogo", "Nara", "Wakayama", "Shiga", "Mie", "Aichi",
  "Hiroshima", "Okayama", "Yamaguchi", "Fukuoka", "Saga", "Nagasaki", "Kumamoto", "Oita", "Miyazaki", "Kagoshima",
]);

export function toUpperRomaji(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function recommendIataBox(estimatedWeightKg: number) {
  const w = Math.max(0.5, Number(estimatedWeightKg) || 1);
  if (w <= 2.5) {
    return { boxCode: "Thùng IATA Size S", lengthCm: 30, widthCm: 20, heightCm: 20, volumetricWeightKg: 2.4 };
  }
  if (w <= 6.0) {
    return { boxCode: "Thùng IATA Size M", lengthCm: 40, widthCm: 30, heightCm: 25, volumetricWeightKg: 6.0 };
  }
  if (w <= 12.0) {
    return { boxCode: "Thùng IATA Size L", lengthCm: 50, widthCm: 40, heightCm: 30, volumetricWeightKg: 12.0 };
  }
  return { boxCode: "Thùng IATA Cargo XL", lengthCm: 60, widthCm: 45, heightCm: 40, volumetricWeightKg: 21.6 };
}

export function inspectVnJpCargoDeterministic(params: {
  cargoDetails: string;
  estimatedWeightKg?: number;
  receiverName?: string;
  receiverPostalCode?: string;
  receiverPrefecture?: string;
  senderCity?: string;
  includeAdminCopilot?: boolean;
}): VnJpAiInspectionResult {
  const rawSegments = params.cargoDetails
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const items: InspectedCargoItem[] = [];
  const detectedCargoTypes = new Set<VnJpCargoType>();

  for (const seg of rawSegments.length > 0 ? rawSegments : [params.cargoDetails.trim()]) {
    if (!seg) continue;
    let matchedRule: RulePattern | null = null;
    for (const rule of MAFF_IATA_RULES) {
      if (rule.keywords.test(seg)) {
        matchedRule = rule;
        break;
      }
    }

    if (matchedRule) {
      detectedCargoTypes.add(matchedRule.cargoType);
      items.push({
        rawText: seg,
        status: matchedRule.status,
        reasonVi: matchedRule.reasonVi,
        englishCustomsName: matchedRule.en,
        japaneseCustomsName: matchedRule.jp,
        hsCode: matchedRule.hsCode,
      });
    } else {
      detectedCargoTypes.add("gift");
      items.push({
        rawText: seg,
        status: "SAFE",
        reasonVi: "Hàng cá nhân thông thường — đủ điều kiện xuất kho bay sau khi kiểm tra ngoại quan.",
        englishCustomsName: "Personal Effects / Gift Item",
        japaneseCustomsName: "個人用物品・贈答品",
        hsCode: "9804.00",
      });
    }
  }

  const hasProhibited = items.some((i) => i.status === "PROHIBITED");
  const hasConditional = items.some((i) => i.status === "CONDITIONAL");
  const overallRisk: MaffRiskLevel = hasProhibited
    ? "PROHIBITED"
    : hasConditional
    ? "CONDITIONAL"
    : "SAFE";

  const suggestedCargoType: VnJpCargoType = detectedCargoTypes.has("food")
    ? "food"
    : detectedCargoTypes.has("doc") && detectedCargoTypes.size === 1
    ? "doc"
    : detectedCargoTypes.has("gift")
    ? "gift"
    : "other";

  const cleanedCargoDetails = items
    .filter((i) => i.status !== "PROHIBITED")
    .map((i) => i.rawText)
    .join(", ");

  const normalizedRomajiName = toUpperRomaji(params.receiverName || "");

  // Kiểm tra chéo mã bưu điện 〒 và tỉnh/thành phố
  const cleanPostal = (params.receiverPostalCode || "").replace(/\D/g, "");
  const prefix2 = cleanPostal.slice(0, 2);
  const expectedPrefs = POSTAL_PREFIX_TO_PREFECTURE[prefix2];
  let isPostalMatch = true;
  let expectedRegionNote = "Mã bưu điện 〒 hợp lệ và khớp vùng phát sóng Sagawa/Yamato.";

  if (cleanPostal.length === 7 && expectedPrefs && params.receiverPrefecture) {
    if (!expectedPrefs.includes(params.receiverPrefecture)) {
      isPostalMatch = false;
      expectedRegionNote = `Lưu ý: Đầu mã 〒 ${cleanPostal.slice(0, 3)}-${cleanPostal.slice(3)} thường thuộc tỉnh ${expectedPrefs.join("/")} nhưng đang chọn ${params.receiverPrefecture}. Vui lòng kiểm tra lại để tránh trễ phát hàng!`;
    }
  }

  const recommendedBox = recommendIataBox(params.estimatedWeightKg || 1);

  const neoKuudereComment = hasProhibited
    ? "🛸 Cảnh báo quỹ đạo đỏ! Neo phát hiện mặt hàng vi phạm Luật Kiểm dịch MAFF/IATA trong kiện hàng. Bạn bấm nút 'Loại bỏ món cấm' bên dưới để kiện hàng không bị Hải quan sân bay Narita/Kansai giữ lại nhé!"
    : hasConditional
    ? "✨ Tín hiệu đường bay xanh – vàng! Kiện hàng thực phẩm khô của bạn được phép bay sang Nhật. Kho ChillBanana sẽ hỗ trợ hút chân không miễn phí và dán nhãn thành phần chuẩn MAFF trước khi đóng thùng nhé!"
    : "🌟 Quỹ đạo hoàn hảo 100%! Toàn bộ danh mục hàng hóa đều thuộc luồng xanh ưu tiên thông quan. Neo đã chuẩn hóa sẵn tên Romaji và gợi ý kích thước thùng IATA tối ưu cho bạn rồi đó!";

  const result: VnJpAiInspectionResult = {
    overallRisk,
    canFly: !hasProhibited,
    suggestedCargoType,
    cleanedCargoDetails,
    normalizedRomajiName,
    postalPrefectureMatch: {
      isValid: isPostalMatch,
      expectedRegionNote,
    },
    recommendedBox,
    items,
    neoKuudereComment,
  };

  if (params.includeAdminCopilot) {
    const safeOrCondItems = items.filter((i) => i.status !== "PROHIBITED");
    const targetItems = safeOrCondItems.length > 0 ? safeOrCondItems : items;
    const pref = params.receiverPrefecture || "Tokyo";
    const isWestJapan = KANSAI_WEST_PREFECTURES.has(pref);
    const isFromSouthVn = /hồ chí minh|tp\.?hcm|sài gòn|bình dương|đồng nai|cần thơ/i.test(
      params.senderCity || "Bình Dương"
    );

    const recommendedFlight = isWestJapan
      ? isFromSouthVn
        ? "VN320 (SGN ➔ KIX)"
        : "VN330 (HAN ➔ KIX)"
      : isFromSouthVn
      ? "VN300 (SGN ➔ NRT)"
      : "VN310 (HAN ➔ NRT)";

    const recommendedCourier =
      suggestedCargoType === "doc" ? "Japan Post (Yu-Pack / EMS)" : isWestJapan ? "Sagawa Express" : "Yamato Transport (Kuroneko)";

    result.adminCustomsDeclaration = {
      invoiceSummaryEn: `${targetItems.map((i) => `${i.englishCustomsName} [HS:${i.hsCode}]`).join("; ")} — Personal Gift, No Commercial Value`,
      invoiceSummaryJp: `${targetItems.map((i) => i.japaneseCustomsName).join("、")}（個人用贈答品・無償）`,
      declaredCategory:
        suggestedCargoType === "doc"
          ? "DOCUMENTS"
          : suggestedCargoType === "other"
          ? "COMMERCIAL_SAMPLE"
          : "GIFT",
      recommendedFlight,
      recommendedCourier,
      routingReasonVi: isWestJapan
        ? `Người nhận tại ${pref} (Khu vực Kansai/Miền Tây Nhật Bản) ➔ Ưu tiên hạ cánh sân bay Quốc tế Kansai (KIX) qua chuyến ${recommendedFlight} để rút ngắn 24h trung chuyển nội địa.`
        : `Người nhận tại ${pref} (Khu vực Kanto/Miền Đông Nhật Bản) ➔ Ưu tiên hạ cánh sân bay Quốc tế Narita (NRT) qua chuyến ${recommendedFlight} và bàn giao kho Yamato Tokyo.`,
    };
  }

  return result;
}
