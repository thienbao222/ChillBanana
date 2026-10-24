import { AIPersonality } from "@/types";
import { chatKeyPool } from "@/lib/api-key-manager";
import { GEMINI_MODELS } from "@/lib/gemini-models";
import { CUSTOMER_SUPPORT_TOOL_REGISTRY, type SupportEvidence } from "./support-policy";

// shortcut: cooldown is per serverless runtime; use shared storage if cross-instance coordination becomes necessary.
let neoPrimaryUnavailable = false;
let neoPrimaryCooldownUntil = 0;

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

export function buildSystemInstruction(evidence: SupportEvidence[] = []): string {
  const evidencePayload = JSON.stringify(evidence);
  return `
Bạn là Trợ lý Mua sắm AI của ChillBanana (Chill果) — nền tảng mua hộ và vận chuyển hàng nội địa Nhật Bản chuyên nghiệp (Tokyo/Narita ⇄ Việt Nam hỏa tốc).

HÌNH TƯỢNG VÀ TÍNH CÁCH:
- Bạn là chuyên gia tư vấn mua sắm hàng Nhật am hiểu tường tận các sàn thương mại điện tử Nhật Bản (Amazon JP, Mercari JP, Rakuten, Yahoo Auctions, Uniqlo JP, Surugaya, Bic Camera...).
- Luôn giữ thái độ nhiệt tình, trung thực, đặt lợi ích và an toàn ngân sách của khách hàng lên hàng đầu.
- TUYỆT ĐỐI KHÔNG sử dụng văn phong viễn tưởng, khoa học viễn tưởng hay các từ ngữ vũ trụ sáo rỗng (như: tọa độ, quỹ đạo, vì sao, trạm quan sát, hố đen chi phí, hạ cánh...). Hãy dùng ngôn từ đời thường, văn minh, ấm áp và thực tế.

HAI PHONG CÁCH PHỤC VỤ (THEO CHẾ ĐỘ TRÊN GIAO DIỆN):
1. Chế độ "omotenashi" (Chuẩn mực hiếu khách Nhật Bản):
   - Xưng hô: "ChillBanana" hoặc "Mình", gọi khách là "Quý khách" (hoặc "Bạn").
   - Văn phong: Lễ phép, lịch sự, ân cần, giải thích cặn kẽ mọi khoản chi phí (tiền hàng, tỷ giá live, phí mua hộ, cước bay, chính sách đặt cọc 50% hoặc thanh toán 100%).
   - Cẩn trọng hướng dẫn về tình trạng hàng mới (Amazon/Rakuten) vs hàng 2nd hand độc bản (Mercari/Yahoo), và cảnh báo an toàn điện áp 100V cho đồ gia dụng.
2. Chế độ "chill" (Thân thiện Việt Nam):
   - Xưng hô: "Neo" hoặc "Mình", gọi khách là "Bạn".
   - Văn phong: Gần gũi, trẻ trung, tự nhiên, đi thẳng vào trọng tâm, báo giá nhanh và mách deal tốt, rõ ràng từng con số.

QUY TẮC BẮT BUỘC VỀ CÔNG CỤ VÀ DỮ LIỆU:
- TUYỆT ĐỐI KHÔNG BAO GIỜ tự in đoạn text "**Công cụ đang chạy:** ..." hoặc tự bịa ra thông báo đang chờ hệ thống quét dữ liệu.
- Mọi công cụ máy chủ (tìm kiếm danh mục, tính giá, kiểm tra chính sách, tra cứu đơn, tương thích điện 100V) ĐÃ ĐƯỢC CHẠY ĐỒNG BỘ TRƯỚC KHI GỬI CHO BẠN. Kết quả nằm toàn bộ trong khối dữ liệu đính kèm bên dưới.
- Khi khách hỏi tìm sản phẩm (ví dụ: giày nam Gucci, ấm đun nước T-fal, nồi cơm điện, kem chống nắng...):
  + Hãy trình bày ngay các sản phẩm phù hợp dựa trên kết quả công cụ bên dưới, bao gồm: Tên sản phẩm, Từ khóa tiếng Nhật chuẩn (keywords_ja), Giá JPY, Giá quy đổi VND ước tính, và Link sàn tương ứng (Amazon JP, Mercari JP, Rakuten).
  + Nếu là đồ điện gia dụng nội địa Nhật Bản, BẮT BUỘC nhắc nhở về điện áp 100V và yêu cầu sử dụng biến áp đổi nguồn thích hợp (1500VA - 2000VA).
  + Giải thích rõ chính sách đặt cọc linh hoạt: Khách có thể chọn Đặt cọc 50% để mua hàng ngay (phần còn lại thanh toán khi hàng về VN), hoặc Thanh toán 100% để được ưu tiên chốt đơn tức thì.
- Bạn chỉ tư vấn và giải thích; không tự tạo đơn ghi đè dữ liệu nếu chưa có thao tác từ khách.
- Phân tích hình ảnh chỉ nêu dấu hiệu nhìn thấy. Không tuyên bố đã reverse-image-search, không khẳng định đúng model, giá hiện tại, hàng thật/giả hay còn hàng nếu công cụ không xác nhận.
- Không đưa ra khẳng định y tế, pháp lý hay tài chính ngoài nghiệp vụ mua hộ; từ chối lịch sự các chủ đề nhạy cảm không liên quan.

KẾT QUẢ CÔNG CỤ TỪ MÁY CHỦ (JSON):
Các công cụ đã được máy chủ chạy đồng bộ: ${CUSTOMER_SUPPORT_TOOL_REGISTRY.map((tool) => `${tool.id} (${tool.access})`).join(", ")}.
${evidencePayload}
`;
}

export function buildOfflineEvidenceReply(
  userQuery: string,
  evidence: SupportEvidence[] = [],
  isOmo: boolean
): string {
  const catalogEv = evidence.find((e) => e.toolId === "catalog_search");
  const shippingEv = evidence.find((e) => e.toolId === "shipping_policy");
  const compatEv = evidence.find((e) => e.toolId === "product_compatibility");
  const quoteEv = evidence.find((e) => e.toolId === "quote_estimate");
  const orderEv = evidence.find((e) => e.toolId === "order_status");

  const lines: string[] = [];

  if (isOmo) {
    lines.push("Dạ, Neo xin phép gửi Quý khách thông tin tra cứu trực tiếp từ hệ thống ChillBanana:");
  } else {
    lines.push("Neo gửi bạn thông tin tra cứu trực tiếp từ hệ thống ChillBanana nhé 🍌:");
  }

  // 1. Catalog Search
  if (catalogEv && catalogEv.status === "ok") {
    const products = (catalogEv.known.products as any[]) || [];
    if (products.length > 0) {
      lines.push("\n📦 **Gợi ý sản phẩm phù hợp từ các sàn Nhật:**");
      for (const p of products.slice(0, 3)) {
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
    } else {
      lines.push("\n📦 ChillBanana chưa có sản phẩm này trong catalog. Quý khách dán link sản phẩm từ sàn Nhật để được báo giá, hoặc dùng các đường dẫn tìm kiếm bên dưới.");
      if (catalogEv.known.marketplaceLinks) {
        const ml = catalogEv.known.marketplaceLinks as Record<string, string>;
        lines.push("\n🔗 **Đường dẫn tìm kiếm trên sàn Nhật:**");
        if (ml.amazon) lines.push(`• [Tìm trên Amazon JP](${ml.amazon})`);
        if (ml.mercari) lines.push(`• [Tìm trên Mercari JP](${ml.mercari})`);
        if (ml.rakuten) lines.push(`• [Tìm trên Rakuten JP](${ml.rakuten})`);
      }
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
  evidence: SupportEvidence[] = []
): Promise<{ text: string; mode: "gemini" | "offline" }> {
  const isOmo = personality === "omotenashi";

  if (isSensitiveTopic(userQuery)) {
    return {
      text: isOmo
        ? "Dạ, Neo xin phép từ chối chủ đề này. Neo có thể hỗ trợ tìm sản phẩm Nhật, ước tính chi phí, chính sách vận chuyển và tra cứu đơn đã xác minh ạ."
        : "Neo xin phép không hỗ trợ nội dung này nha. Mình có thể giúp tìm hàng Nhật, ước tính giá, giải thích vận chuyển hoặc hướng dẫn tra cứu đơn đã xác minh nhé. 🍌",
      mode: "offline",
    };
  }

  const personalityPrompt = isOmo
    ? "Phong cách Omotenashi: Lễ phép, chu đáo, ân cần, xưng ChillBanana hoặc Mình và gọi Quý khách. Giải thích rõ ràng chi phí, tỷ giá live, quyền lợi cọc 50% hoặc thanh toán 100%, và lưu ý hàng Nhật."
    : "Phong cách Chill: Thân thiện, tự nhiên, súc tích, xưng Neo hoặc Mình và gọi Bạn. Báo giá nhanh, mách deal hời, không rườm rà.";
  const systemInstruction = buildSystemInstruction(evidence);
  const contents = conversationHistory.slice(-8).map((message) => ({
    role: message.role === "user" ? "user" : "model",
    parts: [{ text: message.text }],
  }));
  contents.push({
    role: "user",
    parts: [{ text: `[${personalityPrompt}]\n\nCâu hỏi hiện tại của khách:\n${userQuery}` }],
  });

  let attemptCount = 0;
  const maxAttempts = 2;
  while (attemptCount < maxAttempts) {
    attemptCount++;
    const activeKey = chatKeyPool.getNextKey();
    if (!activeKey) break;

    const candidateModels = neoPrimaryUnavailable || Date.now() < neoPrimaryCooldownUntil
      ? [GEMINI_MODELS.neoFallback, GEMINI_MODELS.lightweight]
      : [GEMINI_MODELS.neo, GEMINI_MODELS.neoFallback, GEMINI_MODELS.lightweight];
    const models = Array.from(new Set(candidateModels));

    for (const model of models) {
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
                maxOutputTokens: 2200,
                temperature: 0.4,
                thinkingConfig: { thinkingLevel: "low" },
              },
            }),
            signal: AbortSignal.timeout(12_000),
          }
        );

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
                  maxOutputTokens: 2200,
                  temperature: 0.4,
                },
              }),
              signal: AbortSignal.timeout(12_000),
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
                text: buildOfflineEvidenceReply(userQuery, evidence, isOmo),
                mode: "offline",
              };
            }
            const sanitized = textPart.text
              .replace(/\*\*Công cụ đang chạy:\*\*.*?(?:\n|$)/gi, "")
              .replace(/\[(?:Công cụ đang chạy|Tool running):.*?\](?:\n|$)/gi, "")
              .trim();
            if (sanitized) return { text: sanitized, mode: "gemini" };
          }
          continue;
        }

        const errText = await response.text().catch(() => "");
        console.warn(`[Assistant] Model ${model} lỗi HTTP ${response.status}: ${errText.slice(0, 200)}`);

        chatKeyPool.markError(activeKey, response.status, model);

        if (model === GEMINI_MODELS.neo && [403, 404, 429, 500, 503].includes(response.status)) {
          if (response.status === 403 || response.status === 404) neoPrimaryUnavailable = true;
          else neoPrimaryCooldownUntil = Date.now() + 60_000;
          continue;
        }

        continue;
      } catch (err: any) {
        console.warn(`[Assistant] Model ${model} error:`, err?.message || String(err));
        chatKeyPool.markError(activeKey, 503, model);
        if (model === GEMINI_MODELS.neo) {
          neoPrimaryCooldownUntil = Date.now() + 60_000;
        }
        continue;
      }
    }
  }

  return {
    text: buildOfflineEvidenceReply(userQuery, evidence, isOmo),
    mode: "offline",
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
