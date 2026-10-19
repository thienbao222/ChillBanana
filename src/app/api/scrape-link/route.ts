import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { scrapeKeyPool } from "@/lib/api-key-manager";
import { GEMINI_MODELS } from "@/lib/gemini-models";
import { checkAndRecordHit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const SCRAPE_LINK_LIMIT = { max: 10, windowMs: 10 * 60_000, blockMs: 10 * 60_000 };

// Domain allowlist — chỉ cho phép sàn thương mại điện tử Nhật Bản
const ALLOWED_DOMAINS = [
  "amazon.co.jp",
  "amazon.com",
  "mercari.com",
  "jp.mercari.com",
  "rakuten.co.jp",
  "yahoo.co.jp",
  "auctions.yahoo.co.jp",
  "uniqlo.com",
  "suruga-ya.jp",
  "biccamera.com",
  "yodobashi.com",
  "r.jina.ai", // Jina AI reader proxy
];

// Cấu trúc dữ liệu chuẩn Agent trích xuất (thay thế regex rời rạc cũ)
interface ExtractedProduct {
  title: string;
  titleJp: string | null;        // Tên gốc tiếng Nhật
  priceJpy: number;
  priceDetected: boolean;
  variants: {                    // Biến thể màu/size
    label: string;
    priceJpy: number | null;
  }[];
  sellerRating: number | null;   // Rating shop (Mercari/Yahoo)
  soldCount: number | null;      // Số lượng đã bán
  stockStatus: "available" | "sold_out" | "limited" | "unknown";
  imageUrl: string;
  category: string;
  voltageWarning: boolean;       // Cảnh báo điện 100V
  riskFlags: string[];           // ["new_seller", "limited_stock", ...]
  storeName: string;
  url: string;
}

/**
 * Dùng Gemini để trích xuất thông tin sản phẩm có cấu trúc từ nội dung Jina AI.
 * Thay thế hệ thống regex cứng cũ — chịu được thay đổi layout của các sàn Nhật.
 */
async function extractWithGemini(
  jinaText: string,
  storeName: string,
  productUrl: string
): Promise<Partial<ExtractedProduct> | null> {
  const apiKey = scrapeKeyPool.getNextKey();
  if (!apiKey) {
    console.warn("[ScrapeLink] Không có Gemini key khả dụng, dùng fallback.");
    return null;
  }

  const prompt = `Bạn là agent trích xuất dữ liệu sản phẩm từ trang thương mại điện tử Nhật Bản.
Phân tích nội dung dưới đây từ trang "${storeName}" và trả về JSON theo schema chính xác.

QUY TẮC NGHIÊM NGẶT:
- priceJpy: chỉ lấy giá JPY thực sự hiển thị trên trang (ký hiệu ¥ hoặc 円). Nếu không thấy → 0.
- voltageWarning: true CHỈ KHI thấy "100V", "AC100V", "100V専用" trên trang.
- sellerRating: chỉ điền nếu thấy số đánh giá rõ ràng (Mercari/Yahoo). Không đoán.
- variants: chỉ điền nếu trang có màu/size rõ ràng (色, サイズ, カラー).
- riskFlags: ["new_seller"] nếu seller < 10 đánh giá, ["limited_stock"] nếu thấy "残り", ["sold_out"] nếu hết hàng.
- KHÔNG tự đoán, KHÔNG điền thông tin không có trên trang.
- Trả về JSON thuần túy, không markdown, không giải thích.

NỘI DUNG TRANG (tối đa 3000 ký tự đầu):
${jinaText.slice(0, 3000)}

JSON Schema cần trả về:
{
  "title": "string (tên sản phẩm tiếng Anh hoặc romaji nếu tiếng Nhật)",
  "titleJp": "string | null (tên gốc tiếng Nhật nếu có)",
  "priceJpy": number,
  "variants": [{"label": "string", "priceJpy": number | null}],
  "sellerRating": number | null,
  "soldCount": number | null,
  "stockStatus": "available" | "sold_out" | "limited" | "unknown",
  "voltageWarning": boolean,
  "riskFlags": string[],
  "imageUrl": "string (URL ảnh sản phẩm đầu tiên, để trống nếu không tìm thấy)"
}`;

  try {
    let response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODELS.lightweight}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 1024,
            thinkingConfig: { thinkingLevel: "minimal" },
          },
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      // Tự động gọi lại ngay với model gemini-2.5-flash và generationConfig không có thinkingConfig
      const fallbackResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 1024,
              temperature: 0.2,
            },
          }),
          signal: AbortSignal.timeout(15000),
        }
      );

      if (fallbackResponse.ok) {
        response = fallbackResponse;
      } else {
        scrapeKeyPool.markError(apiKey, response.status);
        return null;
      }
    }

    const data = await response.json();
    const rawText: string =
      data?.candidates?.[0]?.content?.parts
        ?.filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
        ?.pop()?.text ?? "";

    if (!rawText) return null;

    // Bóc tách JSON từ output Gemini (đề phòng model vẫn wrap markdown)
    const cleaned = rawText.replace(/```(?:json)?\n?|\n?```/g, "").trim();

    // Tìm JSON object đầu tiên trong output (phòng khi Gemini thêm text xung quanh)
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      console.warn("[ScrapeLink] Gemini output không chứa JSON hợp lệ:", cleaned.slice(0, 100));
      return null;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
    } catch (parseErr) {
      console.warn("[ScrapeLink] JSON.parse thất bại:", parseErr);
      return null;
    }

    return {
      title:
        typeof parsed.title === "string" && parsed.title.trim()
          ? parsed.title.trim().slice(0, 200)
          : undefined,
      titleJp:
        typeof parsed.titleJp === "string" ? parsed.titleJp.trim().slice(0, 200) : null,
      priceJpy:
        typeof parsed.priceJpy === "number" && parsed.priceJpy > 50
          ? Math.round(parsed.priceJpy)
          : 0,
      variants: Array.isArray(parsed.variants)
        ? parsed.variants
            .slice(0, 10)
            .filter(
              (v: unknown): v is { label: string; priceJpy: number | null } =>
                typeof (v as { label: unknown }).label === "string"
            )
            .map((v: { label: string; priceJpy: number | null }) => ({
              label: String(v.label).slice(0, 80),
              priceJpy:
                typeof v.priceJpy === "number" && v.priceJpy > 0
                  ? Math.round(v.priceJpy)
                  : null,
            }))
        : [],
      sellerRating:
        typeof parsed.sellerRating === "number" &&
        parsed.sellerRating >= 0 &&
        parsed.sellerRating <= 5
          ? Number(parsed.sellerRating.toFixed(1))
          : null,
      soldCount:
        typeof parsed.soldCount === "number" && parsed.soldCount >= 0
          ? Math.round(parsed.soldCount)
          : null,
      stockStatus: (["available", "sold_out", "limited", "unknown"] as const).includes(
        String(parsed.stockStatus) as "available" | "sold_out" | "limited" | "unknown"
      )
        ? (parsed.stockStatus as "available" | "sold_out" | "limited" | "unknown")
        : "unknown",
      voltageWarning: parsed.voltageWarning === true,
      riskFlags: Array.isArray(parsed.riskFlags)
        ? parsed.riskFlags
            .filter((f: unknown): f is string => typeof f === "string")
            .slice(0, 5)
        : [],
      imageUrl:
        typeof parsed.imageUrl === "string" && parsed.imageUrl.startsWith("http")
          ? parsed.imageUrl
          : "",
    };
  } catch (err) {
    console.warn("[ScrapeLink] Gemini extraction error:", err);
    return null;
  }
}

/**
 * Fallback: Nhận diện danh mục từ tiêu đề sản phẩm (giữ nguyên logic cũ).
 */
function detectCategory(title: string): string {
  const t = title.toLowerCase();
  if (
    t.includes("gundam") || t.includes("figure") || t.includes("anime") ||
    t.includes("manga") || t.includes("bandai") || t.includes("nendoroid") ||
    t.includes("gunpla") || t.includes("pokemon") || t.includes("フィギュア") ||
    t.includes("アニメ") || t.includes("マンガ") || t.includes("ぬいぐるみ") ||
    t.includes("card") || t.includes("カード") || t.includes("トレカ")
  ) return "anime";

  if (
    t.includes("panasonic") || t.includes("zojirushi") || t.includes("tiger") ||
    t.includes("sony") || t.includes("nồi cơm") || t.includes("tai nghe") ||
    t.includes("家電") || t.includes("炊飯器") || t.includes("イヤホン") ||
    t.includes("シェーバー") || t.includes("ドライヤー") || t.includes("gaming")
  ) return "gadgets";

  if (
    t.includes("dhc") || t.includes("anessa") || t.includes("hada labo") ||
    t.includes("shiseido") || t.includes("skincare") || t.includes("化粧品") ||
    t.includes("スキンケア") || t.includes("コスメ") || t.includes("日焼け止め") ||
    t.includes("美容液") || t.includes("クレンジング")
  ) return "cosmetics";

  if (
    t.includes("collagen") || t.includes("vitamin") || t.includes("orihiro") ||
    t.includes("サプリメント") || t.includes("健康食品") || t.includes("青汁") ||
    t.includes("spirulina")
  ) return "health";

  return "other";
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const ipHash = createHash("sha256").update(ip).digest("hex");
    const rateLimitKey = `scrape-link:${ipHash}`;
    let retryAfter: number;
    try {
      retryAfter = await checkAndRecordHit(rateLimitKey, SCRAPE_LINK_LIMIT);
    } catch (error) {
      console.error("[ScrapeLink] Không kiểm tra được giới hạn tần suất:", error);
      return NextResponse.json({ error: "Dịch vụ tạm thời không khả dụng." }, { status: 503 });
    }
    if (retryAfter > 0) {
      return NextResponse.json(
        { error: "Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau.", retryAfterSeconds: retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
    const { url } = await req.json();

    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp đường dẫn URL hợp lệ." },
        { status: 400 }
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: "URL không hợp lệ." }, { status: 400 });
    }

    // SSRF protection — block internal addresses
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.endsWith(".internal") ||
      hostname === "0.0.0.0"
    ) {
      return NextResponse.json({ error: "URL không hợp lệ." }, { status: 400 });
    }

    const isAllowed = ALLOWED_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith("." + domain)
    );
    if (!isAllowed) {
      return NextResponse.json(
        {
          error:
            "Chỉ hỗ trợ link từ các sàn Nhật Bản: Amazon JP, Mercari, Rakuten, Yahoo JP, Uniqlo, Surugaya, Bic Camera, Yodobashi.",
        },
        { status: 400 }
      );
    }

    // Xác định tên sàn
    const urlLower = url.toLowerCase();
    let storeName = "Website Nhật Bản";
    if (urlLower.includes("amazon.co.jp") || urlLower.includes("amazon.com"))
      storeName = "Amazon JP";
    else if (urlLower.includes("mercari.com") || urlLower.includes("jp.mercari.com"))
      storeName = "Mercari JP";
    else if (urlLower.includes("rakuten.co.jp")) storeName = "Rakuten JP";
    else if (urlLower.includes("yahoo.co.jp")) storeName = "Yahoo JP";
    else if (urlLower.includes("uniqlo.com")) storeName = "Uniqlo JP";
    else if (urlLower.includes("suruga-ya.jp")) storeName = "Surugaya JP";
    else if (urlLower.includes("biccamera.com")) storeName = "Bic Camera JP";
    else if (urlLower.includes("yodobashi.com")) storeName = "Yodobashi JP";

    // ── Bước 1: Lấy nội dung qua Jina AI Reader ──────────────────────────────
    let jinaText = "";
    let jinaImageUrl = "";

    try {
      const jinaResponse = await fetch(`https://r.jina.ai/${url}`, {
        headers: {
          Accept: "text/plain",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
        next: { revalidate: 1800 },
        signal: AbortSignal.timeout(12000),
      });

      if (jinaResponse.ok) {
        jinaText = await jinaResponse.text();

        // Trích xuất ảnh từ Jina output (giữ lại làm fallback)
        const imageMatch =
          jinaText.match(
            /!\[.*?\]\((https?:\/\/.*?\.(?:png|jpg|jpeg|webp).*?)\)/i
          ) ||
          jinaText.match(/Image:\s*(https?:\/\/.*?\.(?:png|jpg|jpeg|webp).*?)/i);
        if (imageMatch?.[1]) jinaImageUrl = imageMatch[1];
      }
    } catch (jinaErr) {
      console.warn("[ScrapeLink] Jina fetch error:", jinaErr);
    }

    // ── Bước 2: Gemini Agent trích xuất có cấu trúc ──────────────────────────
    let geminiResult: Partial<ExtractedProduct> | null = null;
    if (jinaText) {
      geminiResult = await extractWithGemini(jinaText, storeName, url);
    }

    // ── Bước 3: Fallback bằng HTML trực tiếp nếu Jina/Gemini không đủ ────────
    let htmlTitle = "";
    let htmlImageUrl = "";
    let htmlPriceJpy = 0;

    const needsHtmlFallback =
      !geminiResult ||
      !geminiResult.title ||
      !geminiResult.priceJpy;

    if (needsHtmlFallback) {
      try {
        const directRes = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "ja,en-US;q=0.9,en;q=0.8,vi;q=0.7",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          },
          signal: AbortSignal.timeout(8000),
        });

        if (directRes.ok) {
          const html = await directRes.text();

          // Title
          const ogTitle = html.match(
            /<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i
          );
          const tagTitle = html.match(/<title>(.*?)<\/title>/i);
          const rawT =
            (ogTitle && ogTitle[1]) || (tagTitle && tagTitle[1]) || "";
          if (rawT) {
            htmlTitle = rawT
              .replace(/\s*by\s*メルカリ/i, "")
              .replace(/\s*\|\s*Amazon/i, "")
              .trim();
          }

          // Image
          const ogImage = html.match(
            /<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i
          );
          if (ogImage?.[1]) htmlImageUrl = ogImage[1].trim();

          // Price — meta tag
          const metaPrice =
            html.match(
              /<meta\s+name=["']product:price:amount["']\s+content=["']([0-9.]+)["']/i
            ) ||
            html.match(
              /<meta\s+property=["']product:price:amount["']\s+content=["']([0-9.]+)["']/i
            );
          if (metaPrice?.[1]) {
            const p = parseInt(metaPrice[1], 10);
            if (p > 50) htmlPriceJpy = p;
          }

          // Price — JSON-LD
          if (!htmlPriceJpy) {
            const ldRegex =
              /<script type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi;
            let ldMatch;
            while ((ldMatch = ldRegex.exec(html)) !== null) {
              try {
                const parsed = JSON.parse(ldMatch[1]);
                const offers =
                  parsed.offers ||
                  parsed["@graph"]?.find(
                    (g: { offers?: unknown }) => g.offers
                  )?.offers;
                if (offers) {
                  const targetPrice = Array.isArray(offers)
                    ? offers[0]?.price
                    : offers?.price;
                  if (targetPrice) {
                    const p = parseInt(targetPrice, 10);
                    if (p > 50) {
                      htmlPriceJpy = p;
                      break;
                    }
                  }
                }
              } catch {
                // skip invalid JSON-LD
              }
            }
          }

          // Price — Amazon-specific
          if (!htmlPriceJpy) {
            const amazonWhole = html.match(
              /class=["']a-price-whole["']>([0-9,]+)/i
            );
            const offscreen = html.match(
              /class=["']a-offscreen["']>[¥￥$]?([0-9,.]+)/i
            );
            if (amazonWhole?.[1]) {
              htmlPriceJpy = parseInt(amazonWhole[1].replace(/,/g, ""), 10);
            } else if (offscreen?.[1]) {
              const val = parseFloat(offscreen[1].replace(/,/g, ""));
              const isUsd =
                offscreen[0].includes("$") ||
                (urlLower.includes("amazon.com") &&
                  !urlLower.includes("amazon.co.jp"));
              htmlPriceJpy = isUsd ? Math.round(val * 155) : Math.round(val);
            }
          }
        }
      } catch (directErr) {
        console.warn("[ScrapeLink] Direct fetch error:", directErr);
      }
    }

    // ── Bước 4: Hợp nhất kết quả ─────────────────────────────────────────────
    const finalTitle =
      geminiResult?.title ||
      htmlTitle ||
      `[${storeName}] Sản phẩm nội địa Nhật Bản`;

    const finalPriceJpy = geminiResult?.priceJpy || htmlPriceJpy || 0;

    const finalImageUrl =
      (geminiResult?.imageUrl && geminiResult.imageUrl.startsWith("http")
        ? geminiResult.imageUrl
        : null) ||
      jinaImageUrl ||
      htmlImageUrl ||
      "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80";

    // Cảnh báo điện áp: Gemini phát hiện OR title có "100V"
    const voltageWarning =
      geminiResult?.voltageWarning === true ||
      /\b100V\b|AC100/i.test(finalTitle);

    // Tự động thêm risk flag voltage nếu chưa có
    const riskFlags = [...(geminiResult?.riskFlags ?? [])];
    if (voltageWarning && !riskFlags.includes("voltage_100v")) {
      riskFlags.push("voltage_100v");
    }
    if (
      geminiResult?.sellerRating !== undefined &&
      geminiResult.sellerRating !== null &&
      geminiResult.sellerRating < 4.0
    ) {
      if (!riskFlags.includes("low_seller_rating")) riskFlags.push("low_seller_rating");
    }

    const result: ExtractedProduct = {
      storeName,
      url,
      title: finalTitle,
      titleJp: geminiResult?.titleJp ?? null,
      priceJpy: finalPriceJpy,
      priceDetected: finalPriceJpy > 0,
      variants: geminiResult?.variants ?? [],
      sellerRating: geminiResult?.sellerRating ?? null,
      soldCount: geminiResult?.soldCount ?? null,
      stockStatus: geminiResult?.stockStatus ?? "unknown",
      imageUrl: finalImageUrl,
      category: detectCategory(finalTitle),
      voltageWarning,
      riskFlags,
    };

    return NextResponse.json({
      success: true,
      priceDetected: result.priceDetected,
      data: result,
    });
  } catch (error) {
    console.error("[ScrapeLink] Lỗi xử lý URL:", error);
    return NextResponse.json({ error: "Lỗi xử lý đường dẫn." }, { status: 500 });
  }
}
