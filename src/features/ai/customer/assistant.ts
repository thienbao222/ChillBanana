import { AIPersonality } from "@/types";
import { chatKeyPool } from "@/lib/api-key-manager";
import { GEMINI_MODELS } from "@/lib/gemini-models";
import { CUSTOMER_SUPPORT_TOOL_REGISTRY, extractCatalogSearchTerms, type SupportEvidence } from "./support-policy";

// shortcut: cooldown is per serverless runtime; use shared storage if cross-instance coordination becomes necessary.
let neoPrimaryUnavailable = false;
let neoPrimaryCooldownUntil = 0;

export const CHAT_TIMEOUT_MS = Number(process.env.CHAT_TIMEOUT_MS) > 0
  ? Number(process.env.CHAT_TIMEOUT_MS)
  : 25_000;

const SENSITIVE_KEYWORDS = [
  "chính trị", "chinh tri", "bầu cử", "biểu tình", "bạo động",
  "khiêu dâm", "sex", "đồi trụy", "người lớn 18+", "phim sex", "gái gọi",
  "vũ khí", "súng", "đạn", "thuốc nổ", "bom", "ma túy", "chất cấm", "cần sa",
  "xúc phạm", "chửi bới", "xuyên tạc", "lừa đảo làm giàu", "cờ bạc", "cá độ",
];

export function isSensitiveTopic(text: string): boolean {
  const lower = text.toLowerCase();
  return SENSITIVE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export function detectCustomerLanguage(text: string): "vi" | "en" | "ja" {
  if (!text || typeof text !== "string") return "vi";

  // 1. Japanese: có chứa Hiragana, Katakana
  const HIRAGANA_KATAKANA = /[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF]/;
  if (HIRAGANA_KATAKANA.test(text)) {
    return "ja";
  }

  // 2. Vietnamese: có dấu tiếng Việt
  const VI_DIACRITICS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  if (VI_DIACRITICS.test(text)) {
    return "vi";
  }

  // 3. Phân biệt tiếng Anh và tiếng Việt không dấu
  const enMatches = text.match(/\b(the|is|are|do|does|did|how|what|when|where|which|who|why|can|could|would|should|have|has|having|in|on|at|to|for|with|about|stock|price|much|available|shipping|cleanser|sunscreen|product|products|order|help|please|hello|hi|good|thank|thanks|buy|cart|you|me|we|i|my|your|this|that|these|those)\b/gi) || [];
  const viMatches = text.match(/\b(toi|ban|minh|chao|cho|hoi|gia|bao\s+nhieu|co\s+khong|con\s+hang|san\s+pham|mua|ho|gio\s+hang|don\s+hang|phi|cuoc|tien|giay|quan|noi|kem|sua|rua|mat|tay|trang|anh|chi|em|shop|nhe|nha|da|vay|khong|dung|duoc|chua)\b/gi) || [];

  if (enMatches.length > viMatches.length && enMatches.length >= 1) {
    return "en";
  }

  if (viMatches.length > 0) {
    return "vi";
  }

  return "vi";
}

function pruneEvidenceForPrompt(evidence: SupportEvidence[] = []): unknown[] {
  return evidence.map((ev) => {
    const prunedKnown: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(ev.known || {})) {
      if (k === "products" && Array.isArray(v)) {
        prunedKnown.products = v.slice(0, 3).map((p: any) => ({
          name: p.name,
          priceJpy: p.priceJpy,
          estimatedProductPriceVnd: p.estimatedProductPriceVnd,
          estimatedWeightKg: p.estimatedWeightKg,
          voltageNote: p.voltageNote,
          inStock: p.inStock,
        }));
      } else if (k !== "raw" && k !== "debug") {
        prunedKnown[k] = v;
      }
    }
    return {
      toolId: ev.toolId,
      status: ev.status,
      known: prunedKnown,
      unknown: ev.unknown && ev.unknown.length ? ev.unknown : undefined,
    };
  });
}

export function formatSessionPreferencesContext(
  detectedKeywords?: string | null,
  topic?: string | null
): string | null {
  if (!detectedKeywords && (!topic || topic === "Tư vấn chung")) return null;

  const items = (detectedKeywords || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  let budget: string | null = null;
  let brand: string | null = null;
  let category: string | null = null;

  for (const item of items) {
    if (/^ngân sách:\s*/i.test(item)) {
      budget = item.replace(/^ngân sách:\s*/i, "").trim();
    } else if (/\b(?:\d+[\d.,]*\s*(?:triệu|tr|k|nghìn|đ|vnd|yên|jpy|yen))\b/i.test(item)) {
      budget = item;
    } else if (/^thương hiệu:\s*/i.test(item)) {
      brand = item.replace(/^thương hiệu:\s*/i, "").trim();
    } else if (/\b(anessa|hada labo|hadalabo|dhc|sony|panasonic|uniqlo|zojirushi|gundam|bandai|tiger|citizen|casio|seiko|shiseido|sk-ii|gucci)\b/i.test(item)) {
      brand = item;
    } else if (/^nhóm hàng:\s*/i.test(item)) {
      category = item.replace(/^nhóm hàng:\s*/i, "").trim();
    } else if (/\b(mỹ phẩm|thực phẩm chức năng|gia dụng|đồ điện|mô hình|anime|thời trang|đồng hồ|gadgets|fashion|cosmetics|health)\b/i.test(item)) {
      category = item;
    }
  }

  if (!category && topic && topic !== "Tư vấn chung" && topic !== "Tra cứu đơn hàng") {
    category = topic;
  }

  const parts: string[] = [];
  if (budget) parts.push(`ngân sách: ${budget}`);
  if (brand) parts.push(`thương hiệu: ${brand}`);
  if (category) parts.push(`nhóm hàng: ${category}`);

  if (parts.length === 0) {
    if (items.length > 0) {
      return `Sở thích khách đã nêu: ${items.slice(0, 3).join(", ")}`;
    }
    return null;
  }

  return `Sở thích khách đã nêu: ${parts.join(", ")}`;
}

export function buildSystemInstruction(
  evidence: SupportEvidence[] = [],
  customerLang: "vi" | "en" | "ja" = "vi",
  sessionPreferences?: string | null
): string {
  const evidencePayload = JSON.stringify(pruneEvidenceForPrompt(evidence));
  const langRule =
    customerLang === "ja"
      ? "BẮT BUỘC PHẢN HỒI BẰNG TIẾNG NHẬT (日本語で回答してください). Duy trì phong cách Omotenashi lịch thiệp, chu đáo."
      : customerLang === "en"
      ? "MANDATORY LANGUAGE: RESPOND IN ENGLISH. Answer the customer in clear, natural, professional English matching the selected persona."
      : "BẮT BUỘC PHẢN HỒI BẰNG TIẾNG VIỆT.";

  return `
Bạn là Trợ lý Mua sắm AI của ChillBanana (Chill果) — nền tảng mua hộ và vận chuyển hàng nội địa Nhật Bản chuyên nghiệp (Tokyo/Narita ⇄ Việt Nam hỏa tốc).

NGÔN NGỮ PHẢN HỒI:
- ${langRule}
${sessionPreferences ? `\nSỞ THÍCH KHÁCH ĐÃ NÊU TRONG PHIÊN:\n- ${sessionPreferences}\nHãy ưu tiên ghi nhớ và tư vấn các sản phẩm phù hợp với ngân sách, thương hiệu hoặc nhóm hàng này.\n` : ""}
HÌNH TƯỢNG VÀ VĂN PHONG:
- Trả lời ngắn gọn, súc tích trong khoảng 3 đến 6 dòng. Đi thẳng vào trọng tâm, không lan man, không viết dài dòng.
- Chỉ dựa trên dữ liệu bằng chứng công cụ máy chủ cung cấp bên dưới. Tuyệt đối không tự bịa đặt thông tin.
- TUYỆT ĐỐI KHÔNG sử dụng văn phong viễn tưởng, không dùng các từ ngữ vũ trụ sáo rỗng (như: tọa độ, quỹ đạo, hố đen chi phí, hạ cánh...). Dùng ngôn từ đời thường, văn minh, ấm áp và thực tế.
- Hai phong cách:
  + "omotenashi": Lễ phép, chu đáo, xưng "ChillBanana" hoặc "Mình", gọi khách là "Quý khách" (hoặc văn phong hiếu khách, tôn trọng trong tiếng Anh/Nhật).
  + "chill": Gần gũi, tự nhiên, súc tích, xưng "Neo" hoặc "Mình", gọi khách là "Bạn" (hoặc văn phong thân thiện, súc tích trong tiếng Anh/Nhật).

QUY TẮC CỐT LÕI VỀ BẰNG CHỨNG VÀ BÁO GIÁ:
1. Độ dài và căn cứ: Trả lời ngắn gọn 3-6 dòng, CHỈ DỰA TRÊN BẰNG CHỨNG CÔNG CỤ. Tuyệt đối KHÔNG được tự nêu giá tiền, tỷ giá, hay cân nặng sản phẩm nếu không có trong dữ liệu bằng chứng đính kèm.
2. Khi Catalog KHÔNG có sản phẩm khớp:
   - CHỈ được nói ChillBanana chưa có mẫu này trong catalog khi bằng chứng catalog_search có searched=true VÀ resultCount=0. inCatalog=false hoặc matchCount=0 riêng lẻ không đủ căn cứ.
   - Nếu chưa có bằng chứng catalog hoặc searched không phải true, tuyệt đối không kết luận là không có; nếu khách hỏi về sản phẩm, hỏi lại đúng 1 câu làm rõ (model, màu sắc hoặc tình trạng mới/cũ).
   - Khi đã tìm thành công nhưng không có sản phẩm, hỏi lại đúng 1 câu về model, màu sắc hoặc tình trạng mới/cũ và đề nghị khách dán link sản phẩm từ sàn Nhật để hệ thống bóc tách, tính báo giá.
3. Không lặp lại nguyên văn câu của khách:
   - TUYỆT ĐỐI KHÔNG lặp lại nguyên văn câu chat hay câu hỏi của khách làm tiêu đề hoặc nhãn liên kết (ví dụ: không viết [Tìm "tôi cần mua đồ rẻ rẻ" trên Amazon]). Chỉ dùng tên sản phẩm hoặc từ khóa tiếng Nhật chuẩn ngắn gọn (như [Tìm trên Amazon JP], [Săn trên Mercari JP]).
4. Khi Catalog CÓ sản phẩm khớp:
   - Nêu ngắn gọn 1-3 sản phẩm từ catalog thật (Tên, Giá ¥ và Giá VND ước tính có trong bằng chứng).
   - Nếu là đồ điện gia dụng nội địa Nhật, nhắc ngắn gọn lưu ý dùng điện 100V.
   - Hướng dẫn khách bấm nút "Thêm vào giỏ" ngay trên thẻ sản phẩm bên dưới nếu muốn đặt mua. Không bao giờ khẳng định bản thân "đã thêm vào giỏ".
7. Phạm vi an toàn:
   - Phân tích hình ảnh chỉ nêu dấu hiệu nhìn thấy. Không tuyên bố đã reverse-image-search, không khẳng định đúng model, giá hiện tại, hàng thật/giả hay còn hàng nếu công cụ không xác nhận.
   - Không đưa ra khẳng định y tế, pháp lý hay tài chính ngoài nghiệp vụ mua hộ; từ chối lịch sự các chủ đề nhạy cảm không liên quan.
8. Khi so sánh sản phẩm (có dữ liệu product_comparison hoặc khách yêu cầu so sánh):
   - Nêu rõ 4 yếu tố: Giá tiền (¥ và VND ước tính), Cân nặng, Điện áp (lưu ý điện 100V nếu có đồ gia dụng), và Tình trạng tồn kho.
   - Trả lời khách quan, súc tích, dựa đúng số liệu từ bằng chứng.
9. Khi khách hỏi gợi ý theo ngân sách (ví dụ: tầm 2 triệu nên mua gì):
   - CHỈ gợi ý các sản phẩm có trong bằng chứng catalog_search, TUYỆT ĐỐI KHÔNG bịa sản phẩm ngoài catalog.
   - Trình bày gợi ý phân loại rõ ràng theo từng nhóm hàng (mỹ phẩm, đồ gia dụng, mô hình, thời trang...), nêu rõ Giá ¥ và Giá VND ước tính phải nhỏ hơn hoặc bằng ngân sách khách hỏi.

KẾT QUẢ CÔNG CỤ TỪ MÁY CHỦ (JSON):
Các công cụ đã được máy chủ chạy đồng bộ: ${CUSTOMER_SUPPORT_TOOL_REGISTRY.map((tool) => `${tool.id} (${tool.access})`).join(", ")}.
${evidencePayload}
`;
}

export function ensureCatalogFactsInReply(
  reply: string,
  evidence: SupportEvidence[],
  isOmo: boolean
): string {
  const catalog = evidence.find((item) => item.toolId === "catalog_search");
  if (!catalog || catalog.known.searched !== true) return reply;

  const lang = detectCustomerLanguage(reply);

  const products = Array.isArray(catalog.known.products) ? catalog.known.products as Array<{ name?: unknown }> : [];
  const names = products.slice(0, 3).flatMap((product) =>
    typeof product?.name === "string" && product.name.trim() ? [product.name.trim()] : []
  );
  if (names.length) {
    const lowerReply = reply.toLocaleLowerCase();
    const missingNames = names.filter((name) => !lowerReply.includes(name.toLocaleLowerCase()));
    if (missingNames.length) {
      if (lang === "en") return `${reply}\n\n📦 Available in catalog: ${missingNames.join("; ")}.`;
      if (lang === "ja") return `${reply}\n\n📦 カタログ掲載商品: ${missingNames.join("; ")}。`;
      return `${reply}\n\n📦 Trong catalog có: ${missingNames.join("; ")}.`;
    }
    return reply;
  }

  if (catalog.known.resultCount !== 0) return reply;
  const saysNotFound = /(?:chưa có|không có|không tìm thấy|not available|not found|don't have|out of stock|在庫|ございません).{0,80}(?:catalog|mẫu|sản phẩm|item|product|カタログ)|(?:catalog|mẫu|sản phẩm|item|product|カタログ).{0,80}(?:chưa có|không có|không tìm thấy|not available|not found|don't have|out of stock|在庫|ございません)/i.test(reply);
  const asksForLink = /(?:link|đường dẫn|dán link|url|リンク)/i.test(reply);
  const asksForDetails = /\?/.test(reply) && /\b(model|màu|phiên bản|tình trạng|mẫu cụ thể|color|version|condition|モデル|色)\b/i.test(reply);
  if (saysNotFound && asksForLink && asksForDetails) return reply;

  if (lang === "en") {
    return `${reply}\n\nChillBanana does not currently have this matching item in our catalog. What specific model or color are you looking for? Feel free to paste a Japanese product link for us to check.`;
  }
  if (lang === "ja") {
    return `${reply}\n\nChillBananaのカタログには現在一致する商品がございません。ご希望のモデルやカラーはございますか？日本のECサイトのURLを貼り付けていただければ確認いたします。`;
  }
  return `${reply}\n\nChillBanana chưa có mẫu khớp trong catalog. ${isOmo ? "Quý khách" : "Bạn"} muốn tìm model hoặc màu sắc nào? Có thể dán link sản phẩm từ sàn Nhật để Neo kiểm tra tiếp.`;
}

export function buildOfflineEvidenceReply(
  userQuery: string,
  evidence: SupportEvidence[] = [],
  isOmo: boolean,
  customerLang?: "vi" | "en" | "ja"
): string {
  const lang = customerLang || detectCustomerLanguage(userQuery);
  const catalogEv = evidence.find((e) => e.toolId === "catalog_search");
  const compareEv = evidence.find((e) => e.toolId === "product_comparison");
  const shippingEv = evidence.find((e) => e.toolId === "shipping_policy");
  const compatEv = evidence.find((e) => e.toolId === "product_compatibility");
  const quoteEv = evidence.find((e) => e.toolId === "quote_estimate");
  const orderEv = evidence.find((e) => e.toolId === "order_status");
  const catalogProducts = catalogEv?.status === "ok" ? (catalogEv.known.products as any[]) || [] : [];
  const catalogNotFound = catalogEv?.known.searched === true && catalogEv.known.resultCount === 0;

  const lines: string[] = [];

  if (lang === "en") {
    lines.push(
      isOmo
        ? "ChillBanana Customer Support: Here is the direct lookup information from our system:"
        : "Neo here! Here is the latest lookup information from ChillBanana 🍌:"
    );
  } else if (lang === "ja") {
    lines.push(
      isOmo
        ? "ChillBananaカスタマーサポートより、システム照会結果をご案内いたします："
        : "Neoです！ChillBananaの最新照会情報をお届けします🍌："
    );
  } else {
    lines.push(
      isOmo
        ? "Dạ, Neo xin phép gửi Quý khách thông tin tra cứu trực tiếp từ hệ thống ChillBanana:"
        : "Neo gửi bạn thông tin tra cứu trực tiếp từ hệ thống ChillBanana nhé 🍌:"
    );
  }

  // 0. Product Comparison
  if (compareEv && compareEv.status === "ok" && compareEv.known.compared) {
    const pA = compareEv.known.productA as any;
    const pB = compareEv.known.productB as any;
    if (pA && pB) {
      if (lang === "en") {
        lines.push(`\n⚖️ **Comparison between ${pA.name} and ${pB.name}:**`);
        lines.push(`• **Price**: ${pA.name} ~${Number(pA.priceJpy).toLocaleString("ja-JP")} ¥ (${pA.priceVnd ? `~${Number(pA.priceVnd).toLocaleString("vi-VN")} VND` : "updating"}) vs ${pB.name} ~${Number(pB.priceJpy).toLocaleString("ja-JP")} ¥ (${pB.priceVnd ? `~${Number(pB.priceVnd).toLocaleString("vi-VN")} VND` : "updating"}).`);
        lines.push(`• **Weight**: ${pA.weightKg ? `${pA.weightKg} kg` : "~0.5 kg"} vs ${pB.weightKg ? `${pB.weightKg} kg` : "~0.5 kg"}.`);
        lines.push(`• **Voltage**: ${pA.voltage} vs ${pB.voltage}.`);
        lines.push(`• **Stock**: ${pA.inStock ? `In stock (${pA.stockSlots} slots)` : "Out of slots"} vs ${pB.inStock ? `In stock (${pB.stockSlots} slots)` : "Out of slots"}.`);
      } else if (lang === "ja") {
        lines.push(`\n⚖️ **${pA.name} と ${pB.name} の仕様比較：**`);
        lines.push(`• **価格**: ${pA.name} 約 ${Number(pA.priceJpy).toLocaleString("ja-JP")} 円 (${pA.priceVnd ? `約 ${Number(pA.priceVnd).toLocaleString("vi-VN")} VND` : "更新中"}) vs ${pB.name} 約 ${Number(pB.priceJpy).toLocaleString("ja-JP")} 円 (${pB.priceVnd ? `約 ${Number(pB.priceVnd).toLocaleString("vi-VN")} VND` : "更新中"})。`);
        lines.push(`• **重量**: ${pA.weightKg ? `${pA.weightKg} kg` : "約 0.5 kg"} vs ${pB.weightKg ? `${pB.weightKg} kg` : "約 0.5 kg"}。`);
        lines.push(`• **電圧**: ${pA.voltage} vs ${pB.voltage}。`);
        lines.push(`• **在庫**: ${pA.inStock ? `受付中 (${pA.stockSlots}枠)` : "受付終了"} vs ${pB.inStock ? `受付中 (${pB.stockSlots}枠)` : "受付終了"}。`);
      } else {
        lines.push(`\n⚖️ **So sánh thông số giữa ${pA.name} và ${pB.name}:**`);
        lines.push(`• **Giá**: ${pA.name} khoảng ${Number(pA.priceJpy).toLocaleString("ja-JP")} ¥ (${pA.priceVnd ? `${Number(pA.priceVnd).toLocaleString("vi-VN")} đ` : "đang cập nhật"}) vs ${pB.name} khoảng ${Number(pB.priceJpy).toLocaleString("ja-JP")} ¥ (${pB.priceVnd ? `${Number(pB.priceVnd).toLocaleString("vi-VN")} đ` : "đang cập nhật"}).`);
        lines.push(`• **Cân nặng**: ${pA.weightKg ? `${pA.weightKg} kg` : "khoảng 0.5 kg"} vs ${pB.weightKg ? `${pB.weightKg} kg` : "khoảng 0.5 kg"}.`);
        lines.push(`• **Điện áp**: ${pA.voltage} vs ${pB.voltage}.`);
        lines.push(`• **Tồn kho**: ${pA.inStock ? `Sẵn sàng đặt mua (${pA.stockSlots} suất)` : "Tạm hết suất"} vs ${pB.inStock ? `Sẵn sàng đặt mua (${pB.stockSlots} suất)` : "Tạm hết suất"}.`);
      }
    }
  }

  // 1. Budget-based recommendations
  if (catalogEv && catalogEv.status === "ok" && catalogEv.known.isBudgetFilter === true) {
    const budgetVnd = Number(catalogEv.known.budgetVnd || 0);
    const budgetStr = budgetVnd > 0 ? `${budgetVnd.toLocaleString("vi-VN")} đ` : "ngân sách yêu cầu";
    const grouped = (catalogEv.known.groupedByCategory as any[]) || [];

    if (lang === "en") {
      lines.push(`\n📦 **Recommended Japanese products within budget (~${budgetStr}):**`);
    } else if (lang === "ja") {
      lines.push(`\n📦 **ご予算（約 ${budgetStr}）内でのおすすめ商品：**`);
    } else {
      lines.push(`\n📦 **Gợi ý sản phẩm trong tầm ngân sách (${budgetStr}):**`);
    }

    if (grouped.length > 0) {
      for (const grp of grouped) {
        lines.push(`\n🏷️ **${grp.categoryName}:**`);
        for (const p of grp.topProducts || []) {
          const priceVnd = p.estimatedProductPriceVnd
            ? `${Number(p.estimatedProductPriceVnd).toLocaleString("vi-VN")} đ`
            : "đang cập nhật";
          lines.push(`• **${p.name}**: ~${Number(p.priceJpy).toLocaleString("vi-VN")} JPY (~${priceVnd})`);
        }
      }
      lines.push("\nQuý khách bấm nút 'Thêm vào giỏ' trên thẻ sản phẩm bên dưới để đặt mua nhé.");
    } else if (catalogProducts.length > 0) {
      for (const p of catalogProducts.slice(0, 3)) {
        const priceVnd = p.estimatedProductPriceVnd
          ? `${Number(p.estimatedProductPriceVnd).toLocaleString("vi-VN")} đ`
          : "đang cập nhật";
        lines.push(`• **${p.name}**: ~${Number(p.priceJpy).toLocaleString("vi-VN")} JPY (~${priceVnd})`);
      }
    } else {
      lines.push(`\nChillBanana chưa có sản phẩm nào trong catalog dưới ${budgetStr}. Quý khách có thể gửi link sản phẩm từ sàn Nhật để được hỗ trợ mua hộ nhé.`);
    }
  } else if (catalogEv && catalogEv.status === "ok" && catalogProducts.length > 0) {
    if (lang === "en") {
      lines.push("\n📦 **Matching products from Japanese stores:**");
      for (const p of catalogProducts.slice(0, 3)) {
        const priceVnd = p.estimatedProductPriceVnd
          ? `${Number(p.estimatedProductPriceVnd).toLocaleString("vi-VN")} VND`
          : "updating";
        const weight = p.estimatedWeightKg ? ` (${p.estimatedWeightKg} kg)` : "";
        const note = p.voltageNote ? ` — ⚡ *${p.voltageNote}*` : "";
        lines.push(`• **${p.name}**: ~${Number(p.priceJpy).toLocaleString("en-US")} JPY (~${priceVnd})${weight}${note}`);
      }
      lines.push("\nPlease click the 'Thêm vào giỏ' button on the product card below to order.");
    } else if (lang === "ja") {
      lines.push("\n📦 **おすすめ商品（日本国内ストア）：**");
      for (const p of catalogProducts.slice(0, 3)) {
        const priceVnd = p.estimatedProductPriceVnd
          ? `${Number(p.estimatedProductPriceVnd).toLocaleString("vi-VN")} VND`
          : "更新中";
        const weight = p.estimatedWeightKg ? ` (${p.estimatedWeightKg} kg)` : "";
        const note = p.voltageNote ? ` — ⚡ *${p.voltageNote}*` : "";
        lines.push(`• **${p.name}**: ~${Number(p.priceJpy).toLocaleString("ja-JP")} 円 (~${priceVnd})${weight}${note}`);
      }
      lines.push("\nご注文の場合は、下のカードの「Thêm vào giỏ」ボタンを押してください。");
    } else {
      lines.push("\n📦 **Gợi ý sản phẩm phù hợp từ các sàn Nhật:**");
      for (const p of catalogProducts.slice(0, 3)) {
        const priceVnd = p.estimatedProductPriceVnd
          ? `${Number(p.estimatedProductPriceVnd).toLocaleString("vi-VN")} đ`
          : "Đang cập nhật";
        const weight = p.estimatedWeightKg ? ` (${p.estimatedWeightKg} kg)` : "";
        const note = p.voltageNote ? ` — ⚡ *${p.voltageNote}*` : "";
        const link = p.directSearchUrl ? ` · [Xem trên ${p.sourceMarketplace || "Sàn Nhật"}](${p.directSearchUrl})` : "";
        lines.push(`• **${p.name}**: ~${Number(p.priceJpy).toLocaleString("vi-VN")} JPY (~${priceVnd})${weight}${note}${link}`);
      }
      if (catalogEv.known.marketplaceLinks) {
        const ml = catalogEv.known.marketplaceLinks as Record<string, string>;
        lines.push("\n🔗 **Đường dẫn tra cứu trực tiếp trên sàn Nhật:**");
        if (ml.amazon) lines.push(`• [Tìm trên Amazon JP](${ml.amazon})`);
        if (ml.mercari) lines.push(`• [Tìm trên Mercari JP](${ml.mercari})`);
        if (ml.rakuten) lines.push(`• [Tìm trên Rakuten JP](${ml.rakuten})`);
      }
    }
  } else if (catalogNotFound) {
    if (lang === "en") {
      lines.push("\n📦 ChillBanana does not currently have this item in our catalog. Please paste a product link from Japanese stores to get an instant quote.");
    } else if (lang === "ja") {
      lines.push("\n📦 該当する商品は現在カタログにございません。日本のECサイトの商品リンクをお知らせいただければ、お見積もりを作成いたします。");
    } else {
      lines.push("\n📦 ChillBanana chưa có sản phẩm này trong catalog. Quý khách dán link sản phẩm từ sàn Nhật để được báo giá, hoặc dùng các đường dẫn tìm kiếm bên dưới.");
      if (catalogEv?.known.marketplaceLinks) {
        const ml = catalogEv.known.marketplaceLinks as Record<string, string>;
        lines.push("\n🔗 **Đường dẫn tìm kiếm trên sàn Nhật:**");
        if (ml.amazon) lines.push(`• [Tìm trên Amazon JP](${ml.amazon})`);
        if (ml.mercari) lines.push(`• [Tìm trên Mercari JP](${ml.mercari})`);
        if (ml.rakuten) lines.push(`• [Tìm trên Rakuten JP](${ml.rakuten})`);
      }
    }
  } else if (extractCatalogSearchTerms(userQuery).length > 0) {
    if (lang === "en") {
      lines.push(isOmo
        ? "\n📦 ChillBanana does not have catalog lookup results for this item yet. Which brand or model are you looking for?"
        : "\n📦 Neo does not have catalog lookup results for this item yet. Which brand or model are you looking for?"
      );
    } else if (lang === "ja") {
      lines.push(isOmo
        ? "\n📦 該当商品のカタログ照会結果がございません。ご希望のブランドやモデルはございますか？"
        : "\n📦 該当商品のカタログ照会結果がまだありません。探しているブランドやモデルはありますか？"
      );
    } else {
      lines.push(isOmo
        ? "\n📦 Neo chưa có kết quả tra cứu catalog cho sản phẩm này. Quý khách muốn tìm thương hiệu hoặc model cụ thể nào ạ?"
        : "\n📦 Neo chưa có kết quả tra cứu catalog cho sản phẩm này. Bạn muốn tìm thương hiệu hoặc model cụ thể nào?"
      );
    }
  }

  // 2. Compatibility (Voltage 100V)
  if (compatEv && (compatEv.status === "ok" || compatEv.status === "needs_input")) {
    const compats = ((compatEv.known.matchedProducts || compatEv.known.products) as any[]) || [];
    const withVoltage = compats.filter((c: any) => c.voltageNote);
    if (withVoltage.length > 0 && (!catalogEv || !((catalogEv.known.products as any[])?.length))) {
      lines.push("\n⚡ **Lưu ý tương thích điện áp Nhật Bản (100V):**");
      for (const c of withVoltage.slice(0, 2)) {
        lines.push(`• **${c.name}**: ${c.voltageNote}`);
      }
    }
    if (compatEv.known.generalSafety) {
      lines.push(`\n⚡ **Khuyến cáo an toàn điện áp:** ${compatEv.known.generalSafety}`);
    }
  }

  // 3. Quote Estimate
  if (quoteEv && quoteEv.status === "ok" && quoteEv.known.priceJpy) {
    const q = quoteEv.known as any;
    lines.push("\n💴 **Tạm tính mua hộ theo liên kết:**");
    lines.push(`• Giá hàng: ${Number(q.priceJpy).toLocaleString("vi-VN")} JPY (Tỷ giá: ${q.exchangeRateVndPerJpy} đ/JPY)`);
    if (q.productPriceVnd) lines.push(`• Tiền hàng quy đổi: ~${Number(q.productPriceVnd).toLocaleString("vi-VN")} đ`);
    if (q.serviceFeeVnd) lines.push(`• Phí dịch vụ mua hộ: ~${Number(q.serviceFeeVnd).toLocaleString("vi-VN")} đ`);
    if (q.depositEstimateVnd) lines.push(`• Tiền đặt cọc tối thiểu (50%): ~${Number(q.depositEstimateVnd).toLocaleString("vi-VN")} đ`);
  }

  // 4. Shipping Policy
  if (shippingEv && shippingEv.status === "ok") {
    const sp = shippingEv.known as any;
    lines.push("\n✈️ **Chính sách cước bay & phí dịch vụ:**");
    if (sp.airShippingRateVndPerKg) {
      lines.push(`• Cước bay quốc tế: ${Number(sp.airShippingRateVndPerKg).toLocaleString("vi-VN")} đ/kg`);
    }
    if (sp.serviceFeePercent) {
      lines.push(`• Phí dịch vụ mua hộ: ${sp.serviceFeePercent}% (tối thiểu ${Number(sp.serviceFeeMinimumVnd || 20000).toLocaleString("vi-VN")} đ)`);
    }
    if (sp.groupBuyDiscountPercent) {
      lines.push(`• Ưu đãi Gộp đơn: Giảm ${sp.groupBuyDiscountPercent}% cước bay cho kiện hàng nhẹ (≤ 0.5kg)`);
    }
  }

  // 5. Order Status
  if (orderEv && orderEv.status === "ok") {
    const ord = orderEv.known as any;
    lines.push(`\n📋 **Trạng thái đơn hàng #${ord.orderCode}:** ${ord.status} (${ord.productName})`);
  }

  if (lines.length <= 1) {
    return isOmo
      ? "Dạ, hiện tại kết nối AI đang tạm gián đoạn. Quý khách có thể sử dụng công cụ tính giá tự động trên trang chủ hoặc gửi link sản phẩm Nhật để ChillBanana hỗ trợ ạ."
      : "Hiện tại kết nối AI đang tạm gián đoạn. Bạn có thể sử dụng công cụ tính giá tự động trên trang chủ hoặc gửi link sản phẩm Nhật để ChillBanana hỗ trợ nhé. 🍌";
  }

  if (isOmo) {
    lines.push("\nQuý khách cần tư vấn thêm chi tiết món nào cứ nhắn cho Neo nhé ạ!");
  } else {
    lines.push("\nBạn cần hỏi chi tiết thêm sản phẩm nào cứ nhắn cho Neo nha!");
  }

  return lines.join("\n");
}

export async function askGeminiAgentDetailed(
  userQuery: string,
  personality: AIPersonality,
  conversationHistory: { role: string; text: string }[] = [],
  evidence: SupportEvidence[] = [],
  sessionPreferences?: string | null
): Promise<{ text: string; mode: "gemini" | "offline"; model?: string }> {
  const isOmo = personality === "omotenashi";
  const customerLang = detectCustomerLanguage(userQuery);

  if (isSensitiveTopic(userQuery)) {
    return {
      text: isOmo
        ? (customerLang === "en" ? "ChillBanana Customer Support: We cannot assist with this topic." : "Dạ, Neo xin phép từ chối chủ đề này. Neo có thể hỗ trợ tìm sản phẩm Nhật, ước tính chi phí, chính sách vận chuyển và tra cứu đơn đã xác minh ạ.")
        : (customerLang === "en" ? "Neo cannot assist with this topic. I can help find Japanese items, estimate prices, or explain shipping policies. 🍌" : "Neo xin phép không hỗ trợ nội dung này nha. Mình có thể giúp tìm hàng Nhật, ước tính giá, giải thích vận chuyển hoặc hướng dẫn tra cứu đơn đã xác minh nhé. 🍌"),
      mode: "offline",
    };
  }

  const personalityPrompt = isOmo
    ? "Phong cách Omotenashi: Lễ phép, chu đáo, ân cần, xưng ChillBanana hoặc Mình và gọi Quý khách. Giải thích rõ ràng chi phí, tỷ giá live, quyền lợi cọc 50% hoặc thanh toán 100%, và lưu ý hàng Nhật."
    : "Phong cách Chill: Thân thiện, tự nhiên, súc tích, xưng Neo hoặc Mình và gọi Bạn. Báo giá nhanh, mách deal hời, không rườm rà.";
  const systemInstruction = buildSystemInstruction(evidence, customerLang, sessionPreferences);
  const contents = conversationHistory.slice(-8).map((message) => ({
    role: message.role === "user" ? "user" : "model",
    parts: [{ text: message.text }],
  }));
  const langPrompt =
    customerLang === "en"
      ? "[Customer is asking in English. Please reply in English.]\n"
      : customerLang === "ja"
      ? "[お客様は日本語で質問されています。日本語で回答してください。]\n"
      : "";
  const prefPrompt = sessionPreferences ? `[${sessionPreferences}]\n` : "";
  contents.push({
    role: "user",
    parts: [{ text: `${prefPrompt}${langPrompt}[${personalityPrompt}]\n\nCâu hỏi hiện tại của khách:\n${userQuery}` }],
  });

  let lastAttemptedModel: string | undefined;
  const activeKey = chatKeyPool.getNextKey();
  if (activeKey) {
    const candidateModels = neoPrimaryUnavailable || Date.now() < neoPrimaryCooldownUntil
      ? [GEMINI_MODELS.neoFallback, GEMINI_MODELS.neoFallback2]
      : [GEMINI_MODELS.neo, GEMINI_MODELS.neoFallback, GEMINI_MODELS.neoFallback2];
    const models = Array.from(new Set(candidateModels));

    for (const model of models) {
      lastAttemptedModel = model;
      try {
        let response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: systemInstruction }] },
              contents,
              generationConfig: {
                maxOutputTokens: 700,
                temperature: 0.4,
                thinkingConfig: { thinkingLevel: "low" },
              },
            }),
            signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
          }
        );

        // HTTP 500/503: lỗi tạm thời của model, KHÔNG cooldown khóa. Thử lại cùng model 1 lần sau 600-1200ms (có jitter), nếu vẫn lỗi thì chuyển model kế tiếp.
        if (response.status === 500 || response.status === 503) {
          const errStatus = response.status;
          console.warn(`[Assistant] Model ${model} lỗi HTTP ${errStatus}. Đang thử lại cùng model sau 600-1200ms...`);
          const isTestEnv = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
          const jitterMs = isTestEnv ? 10 : 600 + Math.floor(Math.random() * 600);
          await new Promise((r) => setTimeout(r, jitterMs));
          try {
            const retryRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  system_instruction: { parts: [{ text: systemInstruction }] },
                  contents,
                  generationConfig: {
                    maxOutputTokens: 700,
                    temperature: 0.4,
                    thinkingConfig: { thinkingLevel: "low" },
                  },
                }),
                signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
              }
            );
            if (retryRes.ok) {
              response = retryRes;
            } else {
              console.warn(`[Assistant] Model ${model} retry lỗi HTTP ${retryRes.status}`);
              chatKeyPool.markError(activeKey, retryRes.status, model);
              continue;
            }
          } catch (retryErr: any) {
            const isRetryTimeout = retryErr?.name === "AbortError" || retryErr?.name === "TimeoutError" || /timeout|abort/i.test(retryErr?.message || "");
            if (isRetryTimeout) {
              console.warn(`[Assistant] Model ${model} timeout`);
            } else {
              console.warn(`[Assistant] Model ${model} retry error: ${retryErr?.message || String(retryErr)}`);
            }
            continue;
          }
        }

        if (response.status === 400) {
          const err400 = await response.text().catch(() => "");
          console.warn(`[Assistant] Model ${model} lỗi HTTP 400: ${err400.slice(0, 200)}`);
          const retryRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: systemInstruction }] },
                contents,
                generationConfig: {
                  maxOutputTokens: 700,
                  temperature: 0.4,
                },
              }),
              signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
            }
          );
          if (retryRes.ok) {
            response = retryRes;
          } else {
            const retryErrText = await retryRes.text().catch(() => "");
            console.warn(`[Assistant] Model ${model} retry lỗi HTTP ${retryRes.status}: ${retryErrText.slice(0, 200)}`);
            response = retryRes;
          }
        }

        if (response.ok) {
          const data = await response.json();
          const parts = data?.candidates?.[0]?.content?.parts || [];
          const textPart = parts.filter((part: { text?: string; thought?: boolean }) => part.text && !part.thought).pop();
          if (typeof textPart?.text === "string" && textPart.text.trim()) {
            const rawText = textPart.text;
            // Nếu LLM cố tình in thông báo công cụ ảo hoặc chờ trạm quan sát, dùng ngay dữ liệu thực tế
            if (
              rawText.includes("**Công cụ đang chạy:**") ||
              rawText.toLowerCase().includes("trạm quan sát") ||
              rawText.toLowerCase().includes("đang chờ dữ liệu")
            ) {
              return {
                text: buildOfflineEvidenceReply(userQuery, evidence, isOmo, customerLang),
                mode: "offline",
              };
            }
            const sanitized = textPart.text
              .replace(/\*\*Công cụ đang chạy:\*\*.*?(?:\n|$)/gi, "")
              .replace(/\[(?:Công cụ đang chạy|Tool running):.*?\](?:\n|$)/gi, "")
              .trim();
            if (sanitized) return { text: sanitized, mode: "gemini", model };
          }
          continue;
        }

        const errText = await response.text().catch(() => "");
        console.warn(`[Assistant] Model ${model} lỗi HTTP ${response.status}: ${errText.slice(0, 200)}`);

        if (response.status === 429) {
          const retryAfter = response.headers.get("retry-after");
          const retryAfterSec = retryAfter ? parseInt(retryAfter, 10) : undefined;
          chatKeyPool.markError(activeKey, 429, model, retryAfterSec);
        } else {
          chatKeyPool.markError(activeKey, response.status, model);
        }

        if (model === GEMINI_MODELS.neo && (response.status === 403 || response.status === 404)) {
          neoPrimaryUnavailable = true;
          continue;
        }

        continue;
      } catch (err: any) {
        const isTimeout = err?.name === "AbortError" || err?.name === "TimeoutError" || /timeout|abort/i.test(err?.message || "");
        if (isTimeout) {
          console.warn(`[Assistant] Model ${model} timeout`);
          continue;
        }
        console.warn(`[Assistant] Model ${model} error:`, err?.message || String(err));
        chatKeyPool.markError(activeKey, 503, model);
        continue;
      }
    }
  }

  return {
    text: buildOfflineEvidenceReply(userQuery, evidence, isOmo, customerLang),
    mode: "offline",
    model: lastAttemptedModel,
  };
}

export async function askGeminiAgent(
  userQuery: string,
  personality: AIPersonality,
  conversationHistory: { role: string; text: string }[] = [],
  evidence: SupportEvidence[] = []
): Promise<string> {
  const result = await askGeminiAgentDetailed(userQuery, personality, conversationHistory, evidence);
  return result.text;
}
