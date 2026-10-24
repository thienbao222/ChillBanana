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

export function buildSystemInstruction(evidence: SupportEvidence[] = []): string {
  const evidencePayload = JSON.stringify(evidence);
  return `
Bạn là Trợ lý Mua sắm AI của ChillBanana (Chill果) — nền tảng mua hộ và vận chuyển hàng nội địa Nhật Bản chuyên nghiệp (Tokyo/Narita ⇄ Việt Nam hỏa tốc).

HÌNH TƯỢNG VÀ VĂN PHONG:
- Trả lời ngắn gọn, súc tích trong khoảng 3 đến 6 dòng. Đi thẳng vào trọng tâm, không lan man, không viết dài dòng.
- Chỉ dựa trên dữ liệu bằng chứng công cụ máy chủ cung cấp bên dưới. Tuyệt đối không tự bịa đặt thông tin.
- TUYỆT ĐỐI KHÔNG sử dụng văn phong viễn tưởng, không dùng các từ ngữ vũ trụ sáo rỗng (như: tọa độ, quỹ đạo, hố đen chi phí, hạ cánh...). Dùng ngôn từ đời thường, văn minh, ấm áp và thực tế.
- Hai phong cách:
  + "omotenashi": Lễ phép, chu đáo, xưng "ChillBanana" hoặc "Mình", gọi khách là "Quý khách".
  + "chill": Gần gũi, tự nhiên, súc tích, xưng "Neo" hoặc "Mình", gọi khách là "Bạn".

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
5. Phạm vi an toàn:
   - Phân tích hình ảnh chỉ nêu dấu hiệu nhìn thấy. Không tuyên bố đã reverse-image-search, không khẳng định đúng model, giá hiện tại, hàng thật/giả hay còn hàng nếu công cụ không xác nhận.
   - Không đưa ra khẳng định y tế, pháp lý hay tài chính ngoài nghiệp vụ mua hộ; từ chối lịch sự các chủ đề nhạy cảm không liên quan.

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

  const products = Array.isArray(catalog.known.products) ? catalog.known.products as Array<{ name?: unknown }> : [];
  const names = products.slice(0, 3).flatMap((product) =>
    typeof product?.name === "string" && product.name.trim() ? [product.name.trim()] : []
  );
  if (names.length) {
    const lowerReply = reply.toLocaleLowerCase();
    const missingNames = names.filter((name) => !lowerReply.includes(name.toLocaleLowerCase()));
    return missingNames.length ? `${reply}\n\n📦 Trong catalog có: ${missingNames.join("; ")}.` : reply;
  }

  if (catalog.known.resultCount !== 0) return reply;
  const saysNotFound = /(?:chưa có|không có|không tìm thấy).{0,80}(?:catalog|mẫu|sản phẩm)|(?:catalog|mẫu|sản phẩm).{0,80}(?:chưa có|không có|không tìm thấy)/i.test(reply);
  const asksForLink = /(?:link|đường dẫn|dán link)/i.test(reply);
  const asksForDetails = /\?/.test(reply) && /\b(model|màu|phiên bản|tình trạng|mẫu cụ thể)\b/i.test(reply);
  if (saysNotFound && asksForLink && asksForDetails) return reply;
  return `${reply}\n\nChillBanana chưa có mẫu khớp trong catalog. ${isOmo ? "Quý khách" : "Bạn"} muốn tìm model hoặc màu sắc nào? Có thể dán link sản phẩm từ sàn Nhật để Neo kiểm tra tiếp.`;
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
  const catalogProducts = catalogEv?.status === "ok" ? (catalogEv.known.products as any[]) || [] : [];
  const catalogNotFound = catalogEv?.known.searched === true && catalogEv.known.resultCount === 0;

  const lines: string[] = [];

  if (isOmo) {
    lines.push("Dạ, Neo xin phép gửi Quý khách thông tin tra cứu trực tiếp từ hệ thống ChillBanana:");
  } else {
    lines.push("Neo gửi bạn thông tin tra cứu trực tiếp từ hệ thống ChillBanana nhé 🍌:");
  }

  // 1. Catalog Search
  if (catalogEv && catalogEv.status === "ok" && catalogProducts.length > 0) {
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
  } else if (catalogNotFound) {
    lines.push("\n📦 ChillBanana chưa có sản phẩm này trong catalog. Quý khách dán link sản phẩm từ sàn Nhật để được báo giá, hoặc dùng các đường dẫn tìm kiếm bên dưới.");
    if (catalogEv?.known.marketplaceLinks) {
      const ml = catalogEv.known.marketplaceLinks as Record<string, string>;
      lines.push("\n🔗 **Đường dẫn tìm kiếm trên sàn Nhật:**");
      if (ml.amazon) lines.push(`• [Tìm trên Amazon JP](${ml.amazon})`);
      if (ml.mercari) lines.push(`• [Tìm trên Mercari JP](${ml.mercari})`);
      if (ml.rakuten) lines.push(`• [Tìm trên Rakuten JP](${ml.rakuten})`);
    }
  } else if (extractCatalogSearchTerms(userQuery).length > 0) {
    lines.push(isOmo
      ? "\n📦 Neo chưa có kết quả tra cứu catalog cho sản phẩm này. Quý khách muốn tìm thương hiệu hoặc model cụ thể nào ạ?"
      : "\n📦 Neo chưa có kết quả tra cứu catalog cho sản phẩm này. Bạn muốn tìm thương hiệu hoặc model cụ thể nào?"
    );
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
      ? [GEMINI_MODELS.neoFallback, GEMINI_MODELS.neoFallback2]
      : [GEMINI_MODELS.neo, GEMINI_MODELS.neoFallback, GEMINI_MODELS.neoFallback2];
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
            signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
          }
        );

        // HTTP 500/503: lỗi tạm thời của model, KHÔNG cooldown khóa. Thử lại cùng model 1 lần sau 600-1200ms (có jitter), nếu vẫn lỗi thì chuyển model kế tiếp.
        if (response.status === 500 || response.status === 503) {
          const errStatus = response.status;
          console.warn(`[Assistant] Model ${model} lỗi HTTP ${errStatus}. Đang thử lại cùng model sau 600-1200ms...`);
          const jitterMs = 600 + Math.floor(Math.random() * 600);
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
                    maxOutputTokens: 2200,
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
                  maxOutputTokens: 2200,
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
