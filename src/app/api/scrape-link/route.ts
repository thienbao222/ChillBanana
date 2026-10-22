import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { scrapeKeyPool } from "@/lib/api-key-manager";
import { GEMINI_MODELS } from "@/lib/gemini-models";
import { checkAndRecordHit, getClientIp } from "@/lib/rate-limit";
import { isPrivateHost } from "@/lib/ssrf";
import {
  classifyProductCategory,
  getCategoryCustomsInfo,
  VALID_JP_VN_CATEGORIES,
  JpVnProductCategory,
} from "@/features/pricing/customs-categories";

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
  "shopping.yahoo.co.jp",
  "uniqlo.com",
  "suruga-ya.jp",
  "biccamera.com",
  "yodobashi.com",
];

function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (isPrivateHost(h)) return false;
  return ALLOWED_DOMAINS.some((d) => h === d || h.endsWith("." + d));
}

export interface ExtractedProduct {
  title: string;
  titleJp: string | null;
  priceJpy: number;
  priceDetected: boolean;
  variants: { label: string; priceJpy: number | null }[];
  sellerRating: number | null;
  soldCount: number | null;
  stockStatus: "available" | "sold_out" | "limited" | "unknown";
  imageUrl: string;
  category: string;
  categoryLabel: string;
  categoryBreadcrumb: string | null;
  customsSurchargePercent: number;
  customsRuleNote: string;
  voltageWarning: boolean;
  riskFlags: string[];
  storeName: string;
  url: string;
}

interface HtmlExtractedMeta {
  title: string;
  priceJpy: number;
  imageUrl: string;
  breadcrumbs: string;
  rawSnippet: string;
}

/**
 * Tải HTML trực tiếp với cơ chế kiểm tra từng bước Redirect (tối đa 4 bước)
 * để hỗ trợ Amazon JP, Rakuten, Yahoo Auctions, Uniqlo mà vẫn chống SSRF tuyệt đối.
 */
async function safeFetchHtmlWithRedirects(initialUrl: string, maxRedirects = 4): Promise<string> {
  let currentUrl = initialUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const parsed = new URL(currentUrl);
    if (parsed.protocol !== "https:" || parsed.port !== "" || !isAllowedHost(parsed.hostname)) {
      throw new Error("REDIRECT_TO_DISALLOWED_HOST");
    }

    const res = await fetch(currentUrl, {
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) break;
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!res.ok) return "";

    if (res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let html = "";
      let bytes = 0;
      while (bytes < 1500 * 1024) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        html += decoder.decode(value, { stream: true });
      }
      await reader.cancel().catch(() => {});
      return html;
    }
    return await res.text();
  }
  return "";
}

function cleanHtmlText(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&gt;/gi, ">")
    .replace(/&lt;/gi, "<")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Bộ bóc tách chuyên biệt đa sàn từ HTML (Amazon JP, Rakuten, Yahoo Auctions/Shopping, Surugaya, Uniqlo, Bic Camera, Yodobashi, Mercari)
 * Trích xuất chính xác: Title, Price JPY, Image, và đặc biệt là Mục loại sản phẩm (Breadcrumb Category Path).
 */
function extractStructuredMetaFromHtml(html: string, urlLower: string): HtmlExtractedMeta {
  let title = "";
  let priceJpy = 0;
  let imageUrl = "";
  const breadcrumbParts: string[] = [];

  if (!html) {
    return { title, priceJpy, imageUrl, breadcrumbs: "", rawSnippet: "" };
  }

  // 1. Bóc tách Title từ og:title / twitter:title / <title>
  const ogTitle =
    html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:title["']/i);
  const tagTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = cleanHtmlText(ogTitle?.[1] || tagTitle?.[1] || "");
  if (rawTitle && !/captcha|robot check|access denied/i.test(rawTitle)) {
    title = rawTitle
      .replace(/\s*(?:by\s*メルカリ|-\s*メルカリ|\|\s*Amazon\.co\.jp.*|-\s*楽天市場.*|-\s*Yahoo!オークション.*|-\s*ヤフオク!.*|\|\s*ユニクロ.*|\|\s*駿河屋.*)$/i, "")
      .replace(/^【楽天市場】/i, "")
      .trim();
  }

  // 2. Bóc tách Image từ og:image / lander image Amazon
  const ogImg =
    html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i) ||
    html.match(/"hiRes"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/i) ||
    html.match(/id=["']landingImage["'][^>]+src=["'](https:\/\/[^"']+)["']/i);
  if (ogImg?.[1]) {
    imageUrl = ogImg[1].trim();
  }

  // 3. Quét toàn bộ thẻ JSON-LD (<script type="application/ld+json">) để lấy cả Product Price & BreadcrumbList!
  const ldRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let ldMatch;
  while ((ldMatch = ldRegex.exec(html)) !== null) {
    try {
      const rawJson = ldMatch[1].trim();
      const parsed = JSON.parse(rawJson);
      const nodes = Array.isArray(parsed)
        ? parsed
        : parsed["@graph"] && Array.isArray(parsed["@graph"])
        ? parsed["@graph"]
        : [parsed];

      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;

        // Lấy BreadcrumbList từ JSON-LD (Chuẩn trên Rakuten, Yahoo, BicCamera, Yodobashi, Uniqlo)
        if (
          node["@type"] === "BreadcrumbList" &&
          Array.isArray(node.itemListElement)
        ) {
          const names = node.itemListElement
            .map((el: any) => el?.item?.name || el?.name || "")
            .map((s: string) => cleanHtmlText(String(s)))
            .filter((s: string) => s && !/^(ホーム|top|トップ|home|楽天市場|amazon|yahoo)$/i.test(s));
          if (names.length > 0) {
            breadcrumbParts.push(names.join(" > "));
          }
        }

        // Lấy Product từ JSON-LD
        if (node["@type"] === "Product" || node.offers) {
          if (!title && typeof node.name === "string") {
            title = cleanHtmlText(node.name);
          }
          if (!imageUrl) {
            const ldImg = Array.isArray(node.image) ? node.image[0] : node.image?.url || node.image;
            if (typeof ldImg === "string" && ldImg.startsWith("https://")) {
              imageUrl = ldImg;
            }
          }
          if (typeof node.category === "string" && node.category.trim()) {
            breadcrumbParts.push(cleanHtmlText(node.category));
          }
          const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
          const rawP = offers?.price ?? offers?.lowPrice ?? offers?.highPrice;
          if (rawP !== undefined && !priceJpy) {
            const p = Math.round(Number(String(rawP).replace(/[,¥￥円\s]/g, "")));
            if (Number.isFinite(p) && p > 50 && p < 10_000_000) {
              priceJpy = p;
            }
          }
        }
      }
    } catch {
      // Bỏ qua khối JSON-LD lỗi cú pháp
    }
  }

  // 4. Bóc tách __NEXT_DATA__ (Cực kỳ hiệu quả cho Yahoo! Auctions, Yahoo! Shopping, Uniqlo, Mercari)
  const nextDataMatch = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch?.[1]) {
    try {
      const nextJson = nextDataMatch[1];
      // Tìm giá trong __NEXT_DATA__ (Yahoo Auctions: "price":1234, "taxinPrice":1234, "bidOrBuy":1234)
      if (!priceJpy) {
        const yPrice =
          nextJson.match(/"(?:taxinPrice|currentPrice|price|priceValue)"\s*:\s*([0-9]{2,8})/i) ||
          nextJson.match(/"bidOrBuy"\s*:\s*([0-9]{2,8})/i);
        if (yPrice?.[1]) {
          const p = parseInt(yPrice[1], 10);
          if (p > 50 && p < 10_000_000) priceJpy = p;
        }
      }
      // Tìm đường dẫn danh mục trong __NEXT_DATA__
      const catMatches = Array.from(
        nextJson.matchAll(/"(?:categoryName|genreName|departmentName)"\s*:\s*"([^"]{2,60})"/gi)
      ).map((m) => m[1]);
      if (catMatches.length > 0) {
        breadcrumbParts.push(Array.from(new Set(catMatches)).slice(0, 5).join(" > "));
      }
    } catch {}
  }

  // 5. Bộ bóc tách chuyên biệt theo từng sàn Nhật nếu JSON-LD chưa có đủ Giá hoặc Breadcrumb
  // --- A. AMAZON.CO.JP ---
  if (urlLower.includes("amazon.")) {
    const amzBreadMatch = html.match(
      /id=["']wayfinding-breadcrumbs_feature_div["'][\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i
    );
    if (amzBreadMatch?.[1]) {
      const crumbs = Array.from(amzBreadMatch[1].matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi))
        .map((m) => cleanHtmlText(m[1]))
        .filter(Boolean);
      if (crumbs.length > 0) breadcrumbParts.push(crumbs.join(" > "));
    }
    if (!priceJpy) {
      const amzPrice =
        html.match(/"priceAmount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i) ||
        html.match(/class=["'][^"']*apexPriceToPay[^"']*["'][\s\S]*?class=["']a-offscreen["']>[¥￥]?([0-9,]+)/i) ||
        html.match(/id=["']corePriceDisplay_desktop_feature_div["'][\s\S]*?class=["']a-price-whole["']>([0-9,]+)/i) ||
        html.match(/class=["']a-price-whole["']>([0-9,]+)/i);
      if (amzPrice?.[1]) {
        const p = Math.round(Number(amzPrice[1].replace(/,/g, "")));
        if (p > 50 && p < 10_000_000) priceJpy = p;
      }
    }
  }

  // --- B. RAKUTEN.CO.JP ---
  if (urlLower.includes("rakuten.co.jp")) {
    const rakutenCrumbs = Array.from(
      html.matchAll(/class=["'][^"']*sdtext[^"']*["'][^>]*>([\s\S]*?)<\/td>/gi)
    )
      .map((m) => cleanHtmlText(m[1]))
      .filter(Boolean);
    if (rakutenCrumbs.length > 0) breadcrumbParts.push(rakutenCrumbs.join(" > "));

    if (!priceJpy) {
      const rakPrice =
        html.match(/"taxIncludedPrice"\s*:\s*([0-9]{2,8})/i) ||
        html.match(/itemprop=["']price["']\s+content=["']([0-9,]+)["']/i) ||
        html.match(/property=["']apprakuten:price["']\s+content=["']([0-9,]+)["']/i) ||
        html.match(/class=["'][^"']*price2[^"']*["'][^>]*>\s*([0-9,]+)\s*円/i) ||
        html.match(/([0-9]{1,3}(?:,[0-9]{3})+)\s*円\s*(?:\(税込\)|税込)/i);
      if (rakPrice?.[1]) {
        const p = parseInt(rakPrice[1].replace(/,/g, ""), 10);
        if (p > 50 && p < 10_000_000) priceJpy = p;
      }
    }
  }

  // --- C. YAHOO! AUCTIONS & YAHOO! SHOPPING ---
  if (urlLower.includes("yahoo.co.jp")) {
    const yBread = html.match(/class=["'][^"']*Breadcrumb[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|nav|ol|ul)>/i);
    if (yBread?.[1]) {
      breadcrumbParts.push(cleanHtmlText(yBread[1]));
    }
    if (!priceJpy) {
      const yPrice =
        html.match(/(?:現在|即決|価格|税込)\s*[:：]?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,8})\s*円/i) ||
        html.match(/class=["'][^"']*Price__value[^"']*["'][^>]*>\s*([0-9,]+)/i);
      if (yPrice?.[1]) {
        const p = parseInt(yPrice[1].replace(/,/g, ""), 10);
        if (p > 50 && p < 10_000_000) priceJpy = p;
      }
    }
  }

  // --- D. SURUGAYA, BIC CAMERA, YODOBASHI, UNIQLO ---
  if (!breadcrumbParts.length) {
    const genericBread = html.match(
      /(?:id|class)=["'][^"']*(?:breadcrumb|pankuzu|topicpath)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|nav|ol|ul)>/i
    );
    if (genericBread?.[1]) {
      breadcrumbParts.push(cleanHtmlText(genericBread[1]));
    }
  }
  if (!priceJpy) {
    const metaPrice =
      html.match(/<meta\s+(?:name|property)=["']product:price:amount["']\s+content=["']([0-9.]+)["']/i) ||
      html.match(/(?:税込価格|販売価格|価格)\s*[:：]?\s*[¥￥]?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,7})\s*(?:円|\(税込\))/i) ||
      html.match(/[¥￥]\s*([0-9]{1,3}(?:,[0-9]{3})+)/i);
    if (metaPrice?.[1]) {
      const p = Math.round(Number(metaPrice[1].replace(/,/g, "")));
      if (p > 50 && p < 10_000_000) priceJpy = p;
    }
  }

  const breadcrumbs = Array.from(new Set(breadcrumbParts.filter(Boolean)))
    .join(" | ")
    .slice(0, 350);

  return {
    title,
    priceJpy,
    imageUrl,
    breadcrumbs,
    rawSnippet: `${title} | Danh mục gốc: ${breadcrumbs} | Giá phát hiện: ${priceJpy} JPY`,
  };
}

/**
 * Lọc nội dung Jina AI thông minh: bỏ qua phần Header menu rác ở đầu trang Rakuten/Amazon/Yahoo,
 * ưu tiên giữ lại các dòng chứa Breadcrumb (>, カテゴリ, ジャンル), Giá (¥, 円, 税込) và Thông tin sản phẩm.
 */
function buildFocusedScrapeContext(jinaText: string, htmlMeta: HtmlExtractedMeta): string {
  const lines = jinaText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  const priorityLines: string[] = [];
  for (const line of lines) {
    if (
      /[¥￥円]|税込|価格|カテゴリ|ジャンル|パンくず|ブランド|サイズ|仕様|商品説明|商品の説明|>|＞/i.test(line) &&
      line.length < 300
    ) {
      priorityLines.push(line);
      if (priorityLines.length >= 60) break;
    }
  }

  const headerContext = [
    htmlMeta.title ? `TIÊU ĐỀ HTML: ${htmlMeta.title}` : "",
    htmlMeta.breadcrumbs ? `MỤC LOẠI SẢN PHẨM (BREADCRUMB TRANG GỐC): ${htmlMeta.breadcrumbs}` : "",
    htmlMeta.priceJpy > 0 ? `GIÁ JPY TRONG HTML/JSON-LD: ${htmlMeta.priceJpy} JPY` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const bodyContext =
    priorityLines.length > 8
      ? `${priorityLines.join("\n")}\n---\n${jinaText.slice(0, 4500)}`
      : jinaText.slice(0, 6500);

  return `${headerContext}\n\n${bodyContext}`.slice(0, 8000);
}

/**
 * Dùng Gemini để trích xuất thông tin sản phẩm có cấu trúc từ nội dung Jina AI.
 */
async function extractWithGemini(
  contextText: string,
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
- priceJpy: chỉ lấy giá JPY thực sự hiển thị trên trang (ký hiệu ¥ hoặc 円 hoặc 税込). Nếu không thấy hoặc đã bán hết → 0.
- categoryBreadcrumb: chuỗi cây danh mục / loại sản phẩm (ví dụ: 家電 > キッチン家電 > 炊飯器 hoặc ファッション > メンズ > トップス hoặc từ khóa Breadcrumb trên trang).
- category: phân loại sản phẩm vào đúng 1 trong 8 danh mục sau:
  "cosmetics" (mỹ phẩm, skincare, nước hoa),
  "health" (thực phẩm chức năng, vitamin, collagen, thuốc),
  "gadgets" (gia dụng, điện tử, máy tính, tai nghe, 100V),
  "anime" (anime, manga, figure, gunpla, thẻ bài, hobby),
  "fashion" (quần áo, giày dép, túi xách, phụ kiện vải, Uniqlo),
  "food" (thực phẩm khô, bánh kẹo, trà, matcha, gia vị, đồ bếp thường),
  "luxury" (đồng hồ, máy chơi game PS5/Switch, máy ảnh, hàng hiệu xa xỉ),
  "other" (mặt hàng khác).
- voltageWarning: true CHỈ KHI thấy "100V", "AC100V", "100V専用" trên trang.
- sellerRating: chỉ điền nếu thấy số đánh giá rõ ràng (Mercari/Yahoo). Không đoán.
- variants: chỉ điền nếu trang có màu/size rõ ràng (色, サイズ, カラー).
- riskFlags: ["new_seller"] nếu seller < 10 đánh giá, ["limited_stock"] nếu thấy "残り", ["sold_out"] nếu hết hàng.
- KHÔNG tự đoán, KHÔNG điền thông tin không có trên trang.
- Trả về JSON thuần túy, không markdown, không giải thích.

NỘI DUNG TRANG:
${contextText}

JSON SCHEMA:
{
  "title": "string (tên sản phẩm rõ ràng, dễ hiểu)",
  "titleJp": "string | null (tên gốc tiếng Nhật nếu có)",
  "priceJpy": number,
  "categoryBreadcrumb": "string | null (chuỗi mục loại sản phẩm đọc được từ trang)",
  "category": "cosmetics" | "health" | "gadgets" | "anime" | "fashion" | "food" | "luxury" | "other",
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
            temperature: 0.2,
          },
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      // Tự động gọi lại ngay với model gemini-2.5-flash
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
        if ([401, 403, 429, 500, 503].includes(response.status)) {
          scrapeKeyPool.markError(apiKey, response.status);
        }
        return null;
      }
    }

    const data = await response.json();
    const rawText: string =
      data?.candidates?.[0]?.content?.parts
        ?.filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
        ?.pop()?.text ?? "";

    if (!rawText) return null;

    // Bóc tách JSON từ output Gemini
    const cleaned = rawText.replace(/```(?:json)?\n?|\n?```/g, "").trim();

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

    const categoryVal = typeof parsed.category === "string" ? parsed.category.toLowerCase().trim() : "";
    const validatedCategory = (VALID_JP_VN_CATEGORIES as string[]).includes(categoryVal)
      ? (categoryVal as JpVnProductCategory)
      : undefined;

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
      category: validatedCategory,
      categoryBreadcrumb:
        typeof parsed.categoryBreadcrumb === "string" && parsed.categoryBreadcrumb.trim()
          ? parsed.categoryBreadcrumb.trim().slice(0, 250)
          : null,
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
        typeof parsed.imageUrl === "string" && parsed.imageUrl.startsWith("https://")
          ? (() => {
              try {
                const u = new URL(parsed.imageUrl);
                return u.protocol === "https:" && !isPrivateHost(u.hostname) ? parsed.imageUrl : "";
              } catch {
                return "";
              }
            })()
          : "",
    };
  } catch (err) {
    console.warn("[ScrapeLink] Gemini extraction error:", err);
    return null;
  }
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
        { error: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.", retryAfterSeconds: retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
    const { url } = await req.json();

    if (!url || typeof url !== "string" || !url.startsWith("https://")) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp đường dẫn URL bảo mật hợp lệ (HTTPS)." },
        { status: 400 }
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: "URL không hợp lệ." }, { status: 400 });
    }

    // BẢO MẬT (P1-07): Bắt buộc protocol === 'https:' và port === '' (chặn port nội bộ / bypass proxy)
    if (parsedUrl.protocol !== "https:" || parsedUrl.port !== "") {
      return NextResponse.json({ error: "Chỉ chấp nhận URL HTTPS tiêu chuẩn không có cổng tùy chỉnh." }, { status: 400 });
    }

    // SSRF protection — block internal, link-local, cloud metadata & private IPv4/IPv6 addresses
    const hostname = parsedUrl.hostname.toLowerCase();
    if (isPrivateHost(hostname)) {
      return NextResponse.json({ error: "URL không hợp lệ." }, { status: 400 });
    }

    const isAllowed = ALLOWED_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith("." + domain)
    );
    if (!isAllowed) {
      return NextResponse.json(
        {
          error:
            "Nền tảng này hiện chưa được hỗ trợ mua hộ. Chỉ hỗ trợ link từ các sàn Nhật Bản: Amazon JP, Mercari, Rakuten, Yahoo JP, Uniqlo, Surugaya, Bic Camera, Yodobashi.",
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

    // ── Bước 1: Lấy HTML trực tiếp từ web sàn Nhật (Hỗ trợ theo dõi tối đa 4 bước redirect) ──
    let directHtml = "";
    try {
      directHtml = await safeFetchHtmlWithRedirects(url, 4);
    } catch (fetchErr) {
      console.warn("[ScrapeLink] Direct fetch html error:", fetchErr);
    }

    // Bóc tách metadata có cấu trúc từ HTML gốc (Breadcrumbs, Price, Image, Title)
    const htmlMeta = extractStructuredMetaFromHtml(directHtml, urlLower);

    // ── Bước 2: Lấy nội dung qua Jina AI Reader ──────────────────────────────
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

        // Lấy ảnh từ Jina reader header nếu có
        const imageMatch =
          jinaText.match(/!\[.*?\]\((https:\/\/.*?)\)/i) ||
          jinaText.match(/Image\s*:\s*(https:\/\/\S+)/i);
        if (imageMatch?.[1]) {
          const rawImg = imageMatch[1];
          try {
            const u = new URL(rawImg);
            if (u.protocol === "https:" && !isPrivateHost(u.hostname)) {
              jinaImageUrl = rawImg;
            }
          } catch {
            // bỏ qua URL ảnh lỗi
          }
        }
      }
    } catch (jinaErr) {
      console.warn("[ScrapeLink] Jina AI reader error:", jinaErr);
    }

    // ── Bước 3: Gọi Gemini Agent với nội dung tập trung (đã lọc rác menu) ──────
    let geminiResult: Partial<ExtractedProduct> | null = null;
    const focusedContext = buildFocusedScrapeContext(jinaText || directHtml, htmlMeta);

    if (focusedContext.length > 50) {
      geminiResult = await extractWithGemini(focusedContext, storeName, url);
    }

    // ── Bước 4: Hợp nhất kết quả ─────────────────────────────────────────────
    const finalTitle =
      geminiResult?.title ||
      htmlMeta.title ||
      `[${storeName}] Sản phẩm nội địa Nhật Bản`;

    const finalPriceJpy = geminiResult?.priceJpy || htmlMeta.priceJpy || 0;

    const finalImageUrl =
      (geminiResult?.imageUrl && geminiResult.imageUrl.startsWith("http")
        ? geminiResult.imageUrl
        : null) ||
      htmlMeta.imageUrl ||
      jinaImageUrl ||
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

    // Phân loại danh mục chính xác dựa trên Breadcrumb cào từ trang gốc + Gemini + Từ khóa đa tầng
    const combinedBreadcrumb =
      geminiResult?.categoryBreadcrumb || htmlMeta.breadcrumbs || null;

    const classification = classifyProductCategory({
      breadcrumbText: combinedBreadcrumb,
      title: finalTitle,
      titleJp: geminiResult?.titleJp ?? htmlMeta.title,
      storeName,
      geminiCategory: geminiResult?.category ?? null,
    });

    const customsInfo = getCategoryCustomsInfo(classification.category);

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
      category: classification.category,
      categoryLabel: customsInfo.label,
      categoryBreadcrumb: combinedBreadcrumb || classification.matchedFrom,
      customsSurchargePercent: customsInfo.surchargePercent,
      customsRuleNote: customsInfo.customsRuleNote,
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
