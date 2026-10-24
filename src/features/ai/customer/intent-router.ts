import { chatKeyPool } from "@/lib/api-key-manager";
import { GEMINI_MODELS } from "@/lib/gemini-models";
import { normalizeSupportText, SEARCH_STOP_WORDS } from "./support-policy";

export interface RoutedSupportIntent {
  intents: {
    catalog: boolean;
    quote: boolean;
    orderStatus: boolean;
    shipping: boolean;
    compatibility: boolean;
    addToCart: boolean;
  };
  searchTerms: string[];
  keywordsJa: string[];
  category: "cosmetics" | "health" | "gadgets" | "anime" | null;
  referencesPreviousProduct: boolean;
}

const INTENT_KEYS = ["catalog", "quote", "orderStatus", "shipping", "compatibility", "addToCart"] as const;
const CATEGORIES = new Set(["cosmetics", "health", "gadgets", "anime"]);

function cleanTerms(value: unknown, japanese = false): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.slice(0, 12).flatMap((item) => {
    if (typeof item !== "string") return [];
    const text = item
      .replace(japanese ? /[^\p{L}\p{N}\sー々ヶ・-]/gu : /[^\p{L}\p{N}\s-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, japanese ? 80 : 60);
    if (!text) return [];
    if (japanese) return [text];
    const words = text.split(" ").filter((word) => !SEARCH_STOP_WORDS.has(normalizeSupportText(word)));
    return words.length ? [words.join(" ")] : [];
  }))].slice(0, 6);
}

function parseRoutedIntent(value: unknown): RoutedSupportIntent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const parsed = value as Record<string, unknown>;
  if (!parsed.intents || typeof parsed.intents !== "object" || Array.isArray(parsed.intents)) return null;
  const rawIntents = parsed.intents as Record<string, unknown>;

  return {
    intents: Object.fromEntries(INTENT_KEYS.map((key) => [key, rawIntents[key] === true])) as RoutedSupportIntent["intents"],
    searchTerms: cleanTerms(parsed.searchTerms),
    keywordsJa: cleanTerms(parsed.keywordsJa, true),
    category: typeof parsed.category === "string" && CATEGORIES.has(parsed.category)
      ? parsed.category as RoutedSupportIntent["category"]
      : null,
    referencesPreviousProduct: parsed.referencesPreviousProduct === true,
  };
}

export async function routeSupportIntent(
  message: string,
  history: Array<{ role: string; text: string }> = []
): Promise<RoutedSupportIntent | null> {
  const prompt = `Phân loại ý định hỗ trợ mua sắm ChillBanana. Chỉ trích xuất sản phẩm được nhắc hoặc xác định rõ từ lịch sử; không đoán tên sản phẩm.
Trả về đúng JSON: {"intents":{"catalog":boolean,"quote":boolean,"orderStatus":boolean,"shipping":boolean,"compatibility":boolean,"addToCart":boolean},"searchTerms":string[],"keywordsJa":string[],"category":"cosmetics"|"health"|"gadgets"|"anime"|null,"referencesPreviousProduct":boolean}.
searchTerms tối đa 6 tên thương hiệu, loại hàng hoặc sản phẩm bằng tiếng Việt/Anh, không chứa từ giao tiếp; keywordsJa là từ khóa tìm kiếm tiếng Nhật; category chỉ dùng khi phù hợp. Không có ý định thì trả các intent false và mảng rỗng.`;
  const contents = [
    ...history.slice(-6).map((item) => ({
      role: item.role === "user" ? "user" : "model",
      parts: [{ text: typeof item.text === "string" ? item.text.slice(0, 180) : "" }],
    })),
    { role: "user", parts: [{ text: message.slice(0, 500) }] },
  ];
  const deadline = Date.now() + 4_000;

  for (const model of [GEMINI_MODELS.lightweight, GEMINI_MODELS.neoFallback]) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const activeKey = chatKeyPool.getNextKey();
    if (!activeKey) return null;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: prompt }] },
            contents,
            generationConfig: {
              maxOutputTokens: 512,
              temperature: 0.1,
              responseMimeType: "application/json",
              thinkingConfig: { thinkingLevel: "low" },
            },
          }),
          signal: AbortSignal.timeout(remaining),
        }
      );

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.warn(`[SupportIntentRouter] Model ${model} HTTP ${response.status}: ${body.slice(0, 200)}`);
        chatKeyPool.markError(activeKey, response.status, model);
        continue;
      }

      const data = await response.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const textPart = parts.filter((part: { text?: string; thought?: boolean }) => part.text && !part.thought).pop();
      if (typeof textPart?.text === "string") {
        try {
          const routed = parseRoutedIntent(JSON.parse(textPart.text));
          if (routed) return routed;
        } catch {
          // Continue to the fallback model when the provider returns malformed JSON.
        }
      }
      console.warn(`[SupportIntentRouter] Model ${model} returned invalid intent JSON`);
    } catch (error) {
      console.warn(`[SupportIntentRouter] Model ${model} failed: ${error instanceof Error ? error.message : String(error)}`);
      chatKeyPool.markError(activeKey, 503, model);
    }
  }

  return null;
}
