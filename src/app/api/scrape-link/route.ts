// FILE: src/app/api/scrape-link/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { scrapeKeyPool, chatKeyPool, visionKeyPool } from "@/lib/api-key-manager";
import { GEMINI_MODELS, getFeatureModels } from "@/lib/gemini-models";
import { checkAndRecordHit, getClientIp } from "@/lib/rate-limit";
import { isPrivateHost } from "@/lib/ssrf";
import {
  classifyProductCategory,
  getCategoryCustomsInfo,
  VALID_JP_VN_CATEGORIES,
  JpVnProductCategory,
} from "@/features/pricing/customs-categories";
import { findSampleProductByUrl } from "@/features/pricing/japan-stores";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SCRAPE_LINK_LIMIT = { max: 10, windowMs: 10 * 60_000, blockMs: 10 * 60_000 };

// Domain allowlist — chỉ cho phép sàn thương mại điện tử Nhật Bản chính thống & domain rút gọn chính thức
const ALLOWED_DOMAINS = [
  "amazon.co.jp",
  "amazon.com",
  "amzn.asia",
  "amzn.to",
  "mercari.com",
  "jp.mercari.com",
  "rakuten.co.jp",
  "a.r10.to",
  "yahoo.co.jp",
  "auctions.yahoo.co.jp",
  "shopping.yahoo.co.jp",
  "page.auctions.yahoo.co.jp",
  "paypayfleamarket.yahoo.co.jp",
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
  highConfidencePrice: boolean;
  imageUrl: string;
  breadcrumbs: string;
  rawSnippet: string;
}

function getAvailableScrapeApiKey(model?: string): string | null {
  return (
    scrapeKeyPool?.getNextKey?.(model) ||
    chatKeyPool?.getNextKey?.(model) ||
    visionKeyPool?.getNextKey?.(model) ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    null
  );
}

/**
 * Tải HTML trực tiếp với cơ chế kiểm tra từng bước Redirect (tối đa 4 bước)
 * Chuẩn hóa URL Amazon JP, giả lập headers trình duyệt tại Nhật và giải mã EUC-JP / Shift_JIS.
 */
async function safeFetchHtmlWithRedirects(
  initialUrl: string,
  maxRedirects = 4
): Promise<{ html: string; finalUrl: string }> {
  let currentUrl = initialUrl;

  // Chuẩn hóa link Amazon JP nếu có ASIN để luôn trả về đúng trang chi tiết với tiền tệ JPY
  const asinMatch = initialUrl.match(/(?:\/dp\/|\/gp\/product\/|\/product\/)([A-Z0-9]{10})/i);
  if (
    asinMatch &&
    (initialUrl.includes("amazon.co.jp") || initialUrl.includes("amazon.com") || initialUrl.includes("amzn."))
  ) {
    currentUrl = `https://www.amazon.co.jp/dp/${asinMatch[1].toUpperCase()}?language=ja_JP&th=1&psc=1`;
  }

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const parsed = new URL(currentUrl);
    if (parsed.protocol !== "https:" || parsed.port !== "" || !isAllowedHost(parsed.hostname)) {
      throw new Error("REDIRECT_TO_DISALLOWED_HOST");
    }

    const res = await fetch(currentUrl, {
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept-Language": "ja-JP,ja;q=0.95,en-US;q=0.7,en;q=0.6",
        Cookie: "i18n-prefs=JPY; lc-acbjp=ja_JP",
        "Sec-CH-UA": '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="99"',
        "Sec-CH-UA-Mobile": "?0",
        "Sec-CH-UA-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(9000),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) break;
      const nextUrl = new URL(location, currentUrl).toString();
      const nextAsin = nextUrl.match(/(?:\/dp\/|\/gp\/product\/|\/product\/)([A-Z0-9]{10})/i);
      if (nextAsin && nextUrl.includes("amazon.co.jp")) {
        currentUrl = `https://www.amazon.co.jp/dp/${nextAsin[1].toUpperCase()}?language=ja_JP&th=1&psc=1`;
      } else {
        currentUrl = nextUrl;
      }
      continue;
    }

    if (!res.ok) return { html: "", finalUrl: currentUrl };

    const contentType = res.headers.get("content-type") || "";
    let encoding = "utf-8";
    if (/euc-jp/i.test(contentType)) {
      encoding = "euc-jp";
    } else if (/shift_jis|sjis|windows-31j/i.test(contentType)) {
      encoding = "shift_jis";
    }

    const arrayBuffer = await res.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer.slice(0, 2500 * 1024));

    if (encoding === "utf-8") {
      const asciiProbe = new TextDecoder("ascii").decode(bytes.slice(0, 4096));
      if (/charset=["']?(?:euc-jp)/i.test(asciiProbe)) {
        encoding = "euc-jp";
      } else if (/charset=["']?(?:shift_jis|sjis|windows-31j)/i.test(asciiProbe)) {
        encoding = "shift_jis";
      }
    }

    try {
      const decoder = new TextDecoder(encoding);
      return { html: decoder.decode(bytes), finalUrl: currentUrl };
    } catch {
      return { html: new TextDecoder("utf-8").decode(bytes), finalUrl: currentUrl };
    }
  }
  return { html: "", finalUrl: currentUrl };
}

/**
 * Gọi trực tiếp API nội bộ Uniqlo JP vì giao diện web của Uniqlo là Single Page App
 */
async function fetchUniqloProductApi(url: string): Promise<HtmlExtractedMeta | null> {
  const match = url.match(/\/products\/(E?[0-9]+(?:-[0-9]+)?)(?:\/([0-9]+))?/i);
  if (!match) return null;
  const productId = match[1];
  const priceGroup = match[2] || "00";
  const apiUrl = `https://www.uniqlo.com/jp/api/commerce/v5/ja/products/${productId}/price-groups/${priceGroup}/details?includeModel=true`;
  try {
    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "application/json",
        "Accept-Language": "ja-JP,ja;q=0.9",
        "x-fr-clientid": "uq.jp.web-spa",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.result;
    if (!result) return null;
    const title = result.name || "";
    const rawPrice =
      result.prices?.promo?.value ??
      result.prices?.base?.value ??
      result.prices?.promo?.origin?.value ??
      0;
    const priceJpy = Math.round(Number(rawPrice)) || 0;
    let imageUrl = "";
    if (result.images?.main) {
      const first = Object.values(result.images.main)[0] as { image?: string; url?: string } | undefined;
      if (first?.image) imageUrl = first.image;
      else if (first?.url) imageUrl = first.url;
    }
    if (!imageUrl && result.images?.sub && Array.isArray(result.images.sub) && result.images.sub[0]?.image) {
      imageUrl = result.images.sub[0].image;
    }
    const breadcrumbList: string[] = [];
    if (Array.isArray(result.breadcrumbs)) {
      for (const b of result.breadcrumbs) {
        if (b?.name) breadcrumbList.push(String(b.name));
      }
    } else if (result.breadcrumbs && typeof result.breadcrumbs === "object") {
      for (const val of Object.values(result.breadcrumbs)) {
        if (val && typeof val === "object" && "name" in val && typeof (val as any).name === "string") {
          breadcrumbList.push((val as any).name);
        }
      }
    }
    const breadcrumbs = breadcrumbList.join(" > ") || "ファッション > ユニクロ (Uniqlo JP)";
    return {
      title,
      priceJpy,
      highConfidencePrice: priceJpy > 0,
      imageUrl,
      breadcrumbs,
      rawSnippet: `${title} | Uniqlo JP | ${breadcrumbs} | Giá: ${priceJpy} JPY`,
    };
  } catch (err) {
    console.warn("[ScrapeLink] Uniqlo API fetch error:", err);
    return null;
  }
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
 * Trích xuất chính xác: Title, Price JPY, Image, và Mục loại sản phẩm (Breadcrumb Category Path).
 * Đặc biệt: Cô lập đúng khối thông tin sản phẩm chính để KHÔNG BAO GIỜ lấy nhầm giá của sản phẩm quảng cáo/liên quan.
 */
function extractStructuredMetaFromHtml(html: string, urlLower: string): HtmlExtractedMeta {
  let title = "";
  let priceJpy = 0;
  let highConfidencePrice = false;
  let imageUrl = "";
  const breadcrumbParts: string[] = [];

  if (!html) {
    return { title, priceJpy, highConfidencePrice, imageUrl, breadcrumbs: "", rawSnippet: "" };
  }

  // Kiểm tra nhanh nếu HTML là trang chặn Bot / Captcha / Error page của sàn
  const isBlockedPage =
    /api-services-support@amazon\.com|Robot Check|驗證|アクセスが集中|エラーが発生しました|403 Forbidden|Access Denied|Cloudflare/i.test(
      html.slice(0, 6000)
    ) && html.length < 25000;

  if (isBlockedPage) {
    return { title, priceJpy, highConfidencePrice, imageUrl, breadcrumbs: "", rawSnippet: "" };
  }

  // 1. Bóc tách Title từ #productTitle (Amazon) / og:title / twitter:title / <title>
  const amzProductTitle = html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i);
  const ogTitle =
    html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:title["']/i);
  const tagTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  const rawTitle = cleanHtmlText(amzProductTitle?.[1] || ogTitle?.[1] || tagTitle?.[1] || "");
  if (
    rawTitle &&
    !/captcha|robot check|access denied|just a moment|ページが見つかりません|エラー/i.test(rawTitle)
  ) {
    title = rawTitle
      .replace(
        /\s*(?:by\s*メルカリ|-\s*メルカリ|\|\s*Amazon\.co\.jp.*|-\s*楽天市場.*|-\s*Yahoo!オークション.*|-\s*ヤフオク!.*|\|\s*ユニクロ.*|\|\s*駿河屋.*|\|\s*ビックカメラ.*|\|\s*ヨドバシ\.com.*)$/i,
        ""
      )
      .replace(/^Amazon\.co\.jp[:：]\s*/i, "")
      .replace(/^【楽天市場】/i, "")
      .replace(/^ヨドバシ\.com\s*-\s*/i, "")
      .trim();
  }

  // 2. Bóc tách Image từ og:image / landingImage (Amazon)
  const ogImg =
    html.match(/"hiRes"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/i) ||
    html.match(/data-old-hires=["'](https:\/\/m\.media-amazon\.com\/images\/I\/[^"']+)["']/i) ||
    html.match(/id=["']landingImage["'][^>]+src=["'](https:\/\/[^"']+)["']/i) ||
    html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);
  if (ogImg?.[1]) {
    imageUrl = ogImg[1].trim();
  }

  // 3. Quét toàn bộ thẻ JSON-LD (<script type="application/ld+json">) để lấy Product Price & BreadcrumbList chính thức
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

        if (node["@type"] === "BreadcrumbList" && Array.isArray(node.itemListElement)) {
          const names = node.itemListElement
            .map((el: any) => el?.item?.name || el?.name || "")
            .map((s: string) => cleanHtmlText(String(s)))
            .filter((s: string) => s && !/^(ホーム|top|トップ|home|楽天市場|amazon|yahoo)$/i.test(s));
          if (names.length > 0) {
            breadcrumbParts.push(names.join(" > "));
          }
        }

        if (node["@type"] === "Product" || node.offers) {
          if (!title && typeof node.name === "string") {
            title = cleanHtmlText(node.name);
          }
          if (!imageUrl) {
            const ldImg = Array.isArray(node.image)
              ? typeof node.image[0] === "string"
                ? node.image[0]
                : node.image[0]?.url
              : node.image?.url || node.image;
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
            if (Number.isFinite(p) && p >= 100 && p < 10_000_000) {
              priceJpy = p;
              highConfidencePrice = true;
            }
          }
        }
      }
    } catch {
      // Bỏ qua khối JSON-LD lỗi cú pháp
    }
  }

  // 4. Bóc tách __NEXT_DATA__ (Chuẩn xác 100% cho Yahoo! Auctions, Yahoo! Shopping, PayPay Flea Market, Mercari)
  const nextDataMatch = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch?.[1]) {
    try {
      const nextJson = nextDataMatch[1];
      const parsed = JSON.parse(nextJson);
      const item =
        parsed?.props?.pageProps?.initialState?.item?.detail?.item ||
        parsed?.props?.pageProps?.item ||
        parsed?.props?.pageProps?.data?.item ||
        parsed?.props?.pageProps?.product;

      if (item) {
        if (!title && (item.title || item.name)) title = cleanHtmlText(item.title || item.name);
        if (!priceJpy) {
          const p = Number(
            item.taxinPrice ?? item.price ?? item.bidOrBuy ?? item.currentPrice ?? item.salePrice
          );
          if (Number.isFinite(p) && p >= 100 && p < 10_000_000) {
            priceJpy = Math.round(p);
            highConfidencePrice = true;
          }
        }
        if (!imageUrl && Array.isArray(item.image) && item.image[0]?.url) {
          imageUrl = item.image[0].url;
        } else if (!imageUrl && Array.isArray(item.images) && item.images[0]?.url) {
          imageUrl = item.images[0].url;
        } else if (!imageUrl && typeof item.imgUrl === "string") {
          imageUrl = item.imgUrl;
        }
        if (Array.isArray(item.categoryPath)) {
          const cat = item.categoryPath
            .map((c: any) => c.name)
            .filter(Boolean)
            .join(" > ");
          if (cat) breadcrumbParts.push(cat);
        } else if (item.category?.path && Array.isArray(item.category.path)) {
          const cat = item.category.path
            .map((c: any) => c.name)
            .filter(Boolean)
            .join(" > ");
          if (cat) breadcrumbParts.push(cat);
        }
      }

      if (!priceJpy) {
        const yPrice =
          nextJson.match(/"(?:taxinPrice|currentPrice|bidOrBuy|priceValue)"\s*:\s*([0-9]{3,8})/i) ||
          nextJson.match(/"price"\s*:\s*([0-9]{3,8})/i);
        if (yPrice?.[1]) {
          const p = parseInt(yPrice[1], 10);
          if (p >= 100 && p < 10_000_000) {
            priceJpy = p;
            highConfidencePrice = true;
          }
        }
      }
      const catMatches = Array.from(
        nextJson.matchAll(/"(?:categoryName|genreName|departmentName)"\s*:\s*"([^"]{2,60})"/gi)
      ).map((m) => m[1]);
      if (catMatches.length > 0) {
        breadcrumbParts.push(Array.from(new Set(catMatches)).slice(0, 5).join(" > "));
      }
    } catch {}
  }

  // 5. Bộ bóc tách chuyên biệt theo từng sàn Nhật (Chỉ quét vùng DOM chính của sản phẩm)
  // --- A. AMAZON.CO.JP ---
  if (urlLower.includes("amazon.") || urlLower.includes("amzn.")) {
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
      // QUAN TRỌNG: Cắt riêng vùng sản phẩm chính (#ppd / #centerCol / #apex_desktop) để KHÔNG lấy nhầm giá sản phẩm Sponsored
      const mainProductZone =
        html.match(
          /id=["'](?:corePriceDisplay_desktop_feature_div|corePrice_feature_div|apex_desktop|twister-plus-inline-twister)["'][\s\S]{1,12000}/i
        )?.[0] || html.slice(0, 180000);

      const amzPrice =
        html.match(/id=["']twister-plus-price-data-price["'][^>]+value=["']([0-9]+(?:\.[0-9]+)?)["']/i) ||
        html.match(/"priceAmount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i) ||
        mainProductZone.match(
          /class=["'][^"']*(?:priceToPay|apexPriceToPay)[^"']*["'][\s\S]{1,800}?class=["']a-offscreen["']>[¥￥]?([0-9,]+)/i
        ) ||
        mainProductZone.match(
          /class=["'][^"']*(?:priceToPay|apexPriceToPay)[^"']*["'][\s\S]{1,800}?class=["']a-price-whole["']>([0-9,]+)/i
        ) ||
        mainProductZone.match(/id=["']priceblock_(?:ourprice|dealprice|saleprice)["'][^>]*>[¥￥\s]*([0-9,]+)/i);

      if (amzPrice?.[1]) {
        const p = Math.round(Number(amzPrice[1].replace(/,/g, "")));
        if (p >= 100 && p < 10_000_000) {
          priceJpy = p;
          highConfidencePrice = true;
        }
      }
    }
  }

  // --- B. RAKUTEN.CO.JP ---
  if (urlLower.includes("rakuten.co.jp") || urlLower.includes("r10.to")) {
    const rakutenCrumbs = Array.from(
      html.matchAll(/class=["'][^"']*sdtext[^"']*["'][^>]*>([\s\S]*?)<\/td>/gi)
    )
      .map((m) => cleanHtmlText(m[1]))
      .filter(Boolean);
    if (rakutenCrumbs.length > 0) breadcrumbParts.push(rakutenCrumbs.join(" > "));

    if (!priceJpy) {
      // Chỉ lấy từ các thuộc tính dữ liệu chuẩn của Rakuten Item Page (không quét đại trà chữ 円 ở banner)
      const rakPrice =
        html.match(/property=["']apprakuten:price["']\s+content=["']([0-9,]+)["']/i) ||
        html.match(/content=["']([0-9,]+)["']\s+property=["']apprakuten:price["']/i) ||
        html.match(/itemprop=["']price["']\s+content=["']([0-9,]+)["']/i) ||
        html.match(/"taxIncludedPrice"\s*:\s*([0-9]{3,8})/i) ||
        html.match(/"minPrice"\s*:\s*([0-9]{3,8})/i) ||
        html.match(/class=["'][^"']*price2[^"']*["'][^>]*>\s*([0-9,]+)\s*円/i);
      if (rakPrice?.[1]) {
        const p = parseInt(rakPrice[1].replace(/,/g, ""), 10);
        if (p >= 100 && p < 10_000_000) {
          priceJpy = p;
          highConfidencePrice = true;
        }
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
        html.match(/class=["'][^"']*Price__value[^"']*["'][^>]*>\s*([0-9,]+)/i) ||
        html.match(/dd\s+class=["'][^"']*Price__value[^"']*["'][^>]*>([0-9,]+)/i) ||
        html.match(/(?:現在|即決)\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,8})\s*円/i);
      if (yPrice?.[1]) {
        const p = parseInt(yPrice[1].replace(/,/g, ""), 10);
        if (p >= 100 && p < 10_000_000) {
          priceJpy = p;
          highConfidencePrice = true;
        }
      }
    }
  }

  // --- D. BIC CAMERA ---
  if (urlLower.includes("biccamera.com")) {
    const bicBread = html.match(/class=["'][^"']*bcs_breadcrumb[^"']*["'][\s\S]*?<\/div>/i);
    if (bicBread?.[0]) {
      breadcrumbParts.push(cleanHtmlText(bicBread[0]));
    }
    if (!priceJpy) {
      const bicPrice =
        html.match(/itemprop=["']price["'][^>]*content=["']([0-9,]+)["']/i) ||
        html.match(/class=["'][^"']*bcs_price[^"']*["'][\s\S]{1,300}?<strong>\s*([0-9,]+)\s*<\/strong>/i) ||
        html.match(/class=["'][^"']*bcs_price[^"']*["'][^>]*>\s*([0-9,]+)\s*円/i);
      if (bicPrice?.[1]) {
        const p = parseInt(bicPrice[1].replace(/,/g, ""), 10);
        if (p >= 100 && p < 10_000_000) {
          priceJpy = p;
          highConfidencePrice = true;
        }
      }
    }
  }

  // --- E. YODOBASHI ---
  if (urlLower.includes("yodobashi.com")) {
    const yodoBread = html.match(/id=["']js_header_pankuzu["'][\s\S]*?<\/div>/i);
    if (yodoBread?.[0]) {
      breadcrumbParts.push(cleanHtmlText(yodoBread[0]));
    }
    if (!priceJpy) {
      const yodoPrice =
        html.match(/id=["']js_scl_finalPrice["'][^>]*>[¥￥]?\s*([0-9,]+)/i) ||
        html.match(/class=["'][^"']*(?:productPrice|salesPrice)[^"']*["'][^>]*>[¥￥]?\s*([0-9,]+)/i);
      if (yodoPrice?.[1]) {
        const p = parseInt(yodoPrice[1].replace(/,/g, ""), 10);
        if (p >= 100 && p < 10_000_000) {
          priceJpy = p;
          highConfidencePrice = true;
        }
      }
    }
  }

  // --- F. SURUGAYA ---
  if (urlLower.includes("suruga-ya.jp")) {
    const suruBread = html.match(/class=["'][^"']*breadcrumb[^"']*["'][\s\S]*?<\/(?:ol|ul|div)>/i);
    if (suruBread?.[0]) {
      breadcrumbParts.push(cleanHtmlText(suruBread[0]));
    }
    if (!priceJpy) {
      const suruPrice =
        html.match(/class=["'][^"']*(?:text-price-detail|price-buy)[^"']*["'][^>]*>[¥￥]?\s*([0-9,]+)\s*円?/i) ||
        html.match(/(?:税込価格|販売価格)\s*[:：]?\s*([0-9,]+)\s*円/i);
      if (suruPrice?.[1]) {
        const p = parseInt(suruPrice[1].replace(/,/g, ""), 10);
        if (p >= 100 && p < 10_000_000) {
          priceJpy = p;
          highConfidencePrice = true;
        }
      }
    }
  }

  // --- G. META PRICE FALLBACK ---
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
      html.match(/<meta\s+content=["']([0-9.]+)["']\s+(?:name|property)=["']product:price:amount["']/i);
    if (metaPrice?.[1]) {
      const p = Math.round(Number(metaPrice[1].replace(/,/g, "")));
      if (p >= 100 && p < 10_000_000) {
        priceJpy = p;
        highConfidencePrice = true;
      }
    }
  }

  const breadcrumbs = Array.from(new Set(breadcrumbParts.filter(Boolean)))
    .join(" | ")
    .slice(0, 350);

  return {
    title,
    priceJpy,
    highConfidencePrice,
    imageUrl,
    breadcrumbs,
    rawSnippet: `${title} | Danh mục gốc: ${breadcrumbs} | Giá phát hiện: ${priceJpy} JPY`,
  };
}

/**
 * Trích xuất nhanh Title, Price JPY, Image từ văn bản Markdown của Jina AI Reader
 * (Phục vụ khi Direct HTML bị sàn chặn 403/Captcha trên IP Vercel nhưng Jina Reader vượt qua được)
 */
function extractMetaFromJinaMarkdown(jinaText: string, urlLower: string): Partial<HtmlExtractedMeta> {
  if (!jinaText) return {};

  // Cắt bỏ phần sản phẩm gợi ý / liên quan ở cuối trang để không lấy nhầm giá của sản phẩm khác
  const relatedCutoff = jinaText.search(
    /\n(?:#+\s*)?(?:関連商品|おすすめ商品|この商品を見た人は|よく一緒に購入されている商品|スポンサー\s*プロダクト|こちらもおすすめ|同じカテゴリの商品|Customers who viewed)/i
  );
  const mainJina = relatedCutoff > 400 ? jinaText.slice(0, relatedCutoff) : jinaText.slice(0, 12000);

  let title = "";
  const titleHeader = mainJina.match(/^Title:\s*(.+)$/m);
  if (titleHeader?.[1]) {
    const raw = titleHeader[1].trim();
    if (!/captcha|robot check|access denied|just a moment|403 forbidden/i.test(raw)) {
      title = raw
        .replace(
          /\s*(?:by\s*メルカリ|-\s*メルカリ|\|\s*Amazon\.co\.jp.*|-\s*楽天市場.*|-\s*Yahoo!オークション.*|-\s*ヤフオク!.*|\|\s*ユニクロ.*|\|\s*駿河屋.*|\|\s*ビックカメラ.*|\|\s*ヨドバシ\.com.*)$/i,
          ""
        )
        .replace(/^Amazon\.co\.jp[:：]\s*/i, "")
        .replace(/^【楽天市場】/i, "")
        .replace(/^ヨドバシ\.com\s*-\s*/i, "")
        .trim();
    }
  }

  // Tìm giá Yên chính của sản phẩm trong mainJina (bỏ qua giá ship 送料 và coupon クーポン)
  let priceJpy = 0;
  const lines = mainJina.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 180) continue;
    // Bỏ qua các dòng nói về phí ship, điểm thưởng, giảm giá hoặc điều kiện freeship
    if (/送料|クーポン|ポイント|以上購入|送料無料ライン|OFF|割引|手数料|参考価格|定価/i.test(trimmed)) {
      continue;
    }

    const strongPriceMatch =
      trimmed.match(/(?:税込価格|販売価格|価格|現在|即決)\s*[:：]?\s*[¥￥]?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,7})\s*(?:円|\(税込\)|税込)?/i) ||
      trimmed.match(/^[¥￥]\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,7})\b/) ||
      trimmed.match(/\b([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,7})\s*円\s*(?:\(税込\)|税込)/i);

    if (strongPriceMatch?.[1]) {
      const p = parseInt(strongPriceMatch[1].replace(/,/g, ""), 10);
      if (p >= 150 && p < 10_000_000) {
        priceJpy = p;
        break;
      }
    }
  }

  return { title, priceJpy };
}

/**
 * Lọc nội dung Jina AI thông minh: bỏ qua phần Header menu rác và cắt bỏ phần Sản phẩm liên quan ở cuối trang.
 */
function buildFocusedScrapeContext(jinaText: string, htmlMeta: HtmlExtractedMeta): string {
  const relatedCutoff = jinaText.search(
    /\n(?:#+\s*)?(?:関連商品|おすすめ商品|この商品を見た人は|よく一緒に購入されている商品|スポンサー\s*プロダクト|こちらもおすすめ)/i
  );
  const cleanJina = relatedCutoff > 400 ? jinaText.slice(0, relatedCutoff) : jinaText;

  const lines = cleanJina
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  const priorityLines: string[] = [];
  for (const line of lines) {
    if (/送料|クーポン|ポイント還元|送料無料ライン/i.test(line)) continue;
    if (
      /[¥￥円]|税込|価格|カテゴリ|ジャンル|パンくず|ブランド|サイズ|仕様|商品説明|商品の説明|>|＞/i.test(line) &&
      line.length < 300
    ) {
      priorityLines.push(line);
      if (priorityLines.length >= 45) break;
    }
  }

  const headerContext = [
    htmlMeta.title ? `TIÊU ĐỀ SẢN PHẨM CHÍNH THỨC: ${htmlMeta.title}` : "",
    htmlMeta.breadcrumbs ? `MỤC LOẠI SẢN PHẨM (BREADCRUMB TRANG GỐC): ${htmlMeta.breadcrumbs}` : "",
    htmlMeta.priceJpy > 0 ? `GIÁ JPY CHÍNH THỨC TRONG HTML/JSON-LD: ${htmlMeta.priceJpy} JPY` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const bodyContext =
    priorityLines.length > 6
      ? `${priorityLines.join("\n")}\n---\n${cleanJina.slice(0, 4000)}`
      : cleanJina.slice(0, 6000);

  return `${headerContext}\n\n${bodyContext}`.slice(0, 7500);
}

/**
 * Dùng Gemini để trích xuất thông tin sản phẩm có cấu trúc từ nội dung đã lọc.
 */
async function extractWithGemini(
  contextText: string,
  storeName: string
): Promise<Partial<ExtractedProduct> | null> {
  const prompt = `Bạn là agent trích xuất dữ liệu sản phẩm chính xác từ sàn thương mại điện tử Nhật Bản (${storeName}).
Phân tích nội dung dưới đây và trả về đúng 1 JSON object theo schema.

QUY TẮC NGHIÊM NGẶT CHỐNG LẤY SAI DỮ LIỆU:
1. Nếu phần đầu có dòng "TIÊU ĐỀ SẢN PHẨM CHÍNH THỨC" và "GIÁ JPY CHÍNH THỨC TRONG HTML/JSON-LD", hãy ưu tiên tuyệt đối sản phẩm và mức giá đó!
2. TUYỆT ĐỐI KHÔNG lấy giá vận chuyển (送料), giá giảm coupon (クーポン), ngưỡng freeship (3,980円以上送料無料) hay giá của các sản phẩm quảng cáo/gợi ý bên dưới (関連商品 / おすすめ商品).
3. Dịch hoặc làm rõ "title" sang tiếng Việt tự nhiên kèm tên model/thương hiệu gốc dễ hiểu (ví dụ: "Nồi cơm điện cao tần Zojirushi NW-VH10 1.0L nội địa Nhật" hoặc "Mô hình Bandai RG 1/144 RX-78-2 Gundam Ver 2.0"), giữ tên tiếng Nhật gốc ở "titleJp".
4. Phân loại "category" vào đúng 1 trong 8 danh mục: "cosmetics", "health", "gadgets", "anime", "fashion", "food", "luxury", "other".

NỘI DUNG TRANG:
${contextText}

BẮT BUỘC chỉ trả về JSON hợp lệ (không bọc markdown):
{
  "title": "string",
  "titleJp": "string | null",
  "priceJpy": 0,
  "categoryBreadcrumb": "string | null",
  "category": "cosmetics" | "health" | "gadgets" | "anime" | "fashion" | "food" | "luxury" | "other",
  "variants": [{"label": "string", "priceJpy": null}],
  "sellerRating": null,
  "soldCount": null,
  "stockStatus": "available" | "sold_out" | "limited" | "unknown",
  "voltageWarning": false,
  "riskFlags": [],
  "imageUrl": ""
}`;

  const models = typeof getFeatureModels === "function"
    ? getFeatureModels("light")
    : Array.from(
        new Set([
          GEMINI_MODELS.lightweight,
          GEMINI_MODELS.neoFallback,
          GEMINI_MODELS.neo,
        ])
      );
  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 1536,
      temperature: 0.1,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "low" },
    },
  };
  const readResponseBody = async (response: Response) =>
    typeof response.text === "function"
      ? response.text().catch(() => "")
      : JSON.stringify(await response.json().catch(() => ({})));

  for (const modelName of models) {
    const apiKey = getAvailableScrapeApiKey(modelName);
    if (!apiKey) {
      console.warn(`[ScrapeLink] No available API key for model ${modelName}, skipping.`);
      continue;
    }

    for (let jsonAttempt = 0; jsonAttempt < 2; jsonAttempt++) {
      let responseStatus: number | null = null;
    try {
      let response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(12000),
        }
      );
      responseStatus = response.status;

      if (response.status === 429) {
        const errorBody = await readResponseBody(response);
        const retryAfter = response.headers.get("retry-after") ?? undefined;
        console.warn(`[ScrapeLink] Model ${modelName} HTTP 429: ${errorBody.slice(0, 200)}`);
        scrapeKeyPool.markModelError(apiKey, modelName, 429, errorBody, retryAfter);
        break;
      }

      if (response.status === 401 || response.status === 403) {
        const errorBody = await readResponseBody(response);
        console.warn(`[ScrapeLink] Model ${modelName} HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
        scrapeKeyPool.markError(apiKey, response.status, modelName);
        break;
      }

      if (response.status === 500 || response.status === 503) {
        const errorBody = await readResponseBody(response);
        console.warn(`[ScrapeLink] Model ${modelName} HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
        await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));
        try {
          const retryRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody),
              signal: AbortSignal.timeout(12000),
            }
          );
          responseStatus = retryRes.status;
          if (retryRes.ok) {
            response = retryRes;
          } else {
            break;
          }
        } catch {
          break;
        }
      }

      if (response.status === 400) {
        const errorBody = await readResponseBody(response);
        console.warn(`[ScrapeLink] Model ${modelName} HTTP 400: ${errorBody.slice(0, 200)}`);
        const retryRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(12000),
          }
        );
        responseStatus = retryRes.status;
        if (retryRes.ok) {
          response = retryRes;
        } else {
          const retryBody = await readResponseBody(retryRes);
          console.warn(`[ScrapeLink] Model ${modelName} retry HTTP ${retryRes.status}: ${retryBody.slice(0, 200)}`);
          break;
        }
      }

      if (!response.ok) {
        const errorBody = await readResponseBody(response);
        console.warn(`[ScrapeLink] Model ${modelName} HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
        break;
      }

      const responseBody = await readResponseBody(response);
      let data: any;
      try {
        data = JSON.parse(responseBody);
      } catch {
        console.warn(`[ScrapeLink] Model ${modelName} HTTP ${response.status}: ${responseBody.slice(0, 200)}`);
        if (jsonAttempt === 0) continue;
        break;
      }
      const rawText: string =
        data?.candidates?.[0]?.content?.parts
          ?.filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
          ?.pop()?.text ?? "";

      if (!rawText) {
        console.warn(`[ScrapeLink] Model ${modelName} HTTP ${response.status}: empty model JSON`);
        if (jsonAttempt === 0) continue;
        break;
      }

      const cleaned = rawText.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
      const jsonStart = cleaned.indexOf("{");
      const jsonEnd = cleaned.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1) {
        console.warn(`[ScrapeLink] Model ${modelName} HTTP ${response.status}, malformed JSON: ${rawText.slice(0, 200)}`);
        if (jsonAttempt === 0) continue;
        break;
      }

      let parsed: Record<string, unknown>;
      try {
        const value = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected JSON object");
        parsed = value as Record<string, unknown>;
      } catch {
        console.warn(`[ScrapeLink] Model ${modelName} HTTP ${response.status}, malformed JSON: ${rawText.slice(0, 200)}`);
        if (jsonAttempt === 0) continue;
        break;
      }
      const categoryVal = typeof parsed.category === "string" ? parsed.category.toLowerCase().trim() : "";
      const validatedCategory = (VALID_JP_VN_CATEGORIES as string[]).includes(categoryVal)
        ? (categoryVal as JpVnProductCategory)
        : undefined;

      scrapeKeyPool.markModelSuccess(apiKey, modelName);
      return {
        title:
          typeof parsed.title === "string" && parsed.title.trim()
            ? parsed.title.trim().slice(0, 200)
            : undefined,
        titleJp: typeof parsed.titleJp === "string" ? parsed.titleJp.trim().slice(0, 200) : null,
        priceJpy:
          typeof parsed.priceJpy === "number" && parsed.priceJpy >= 100
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
                  Boolean(v && typeof (v as { label?: unknown }).label === "string")
              )
              .map((v) => ({
                label: String(v.label).slice(0, 80),
                priceJpy:
                  typeof v.priceJpy === "number" && v.priceJpy > 0 ? Math.round(v.priceJpy) : null,
              }))
          : [],
        sellerRating:
          typeof parsed.sellerRating === "number" && parsed.sellerRating >= 0 && parsed.sellerRating <= 5
            ? Number(parsed.sellerRating.toFixed(1))
            : null,
        soldCount:
          typeof parsed.soldCount === "number" && parsed.soldCount >= 0
            ? Math.round(parsed.soldCount)
            : null,
        stockStatus: (["available", "sold_out", "limited", "unknown"] as const).includes(
          String(parsed.stockStatus) as any
        )
          ? (parsed.stockStatus as "available" | "sold_out" | "limited" | "unknown")
          : "unknown",
        voltageWarning: parsed.voltageWarning === true,
        riskFlags: Array.isArray(parsed.riskFlags)
          ? parsed.riskFlags.filter((f: unknown): f is string => typeof f === "string").slice(0, 5)
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
        const isTimeout = err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
        console.warn(`[ScrapeLink] Model ${modelName} ${isTimeout ? "timeout" : `HTTP ${responseStatus ?? "n/a"}`}: ${err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200)}`);
        break;
      }
    }
  }

  return null;
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

    if (parsedUrl.protocol !== "https:" || parsedUrl.port !== "") {
      return NextResponse.json(
        { error: "Chỉ chấp nhận URL HTTPS tiêu chuẩn không có cổng tùy chỉnh." },
        { status: 400 }
      );
    }

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

    const urlLower = url.toLowerCase();
    let storeName = "Website Nhật Bản";
    if (urlLower.includes("amazon.co.jp") || urlLower.includes("amazon.com") || urlLower.includes("amzn."))
      storeName = "Amazon JP";
    else if (urlLower.includes("mercari.com") || urlLower.includes("jp.mercari.com"))
      storeName = "Mercari JP";
    else if (urlLower.includes("rakuten.co.jp") || urlLower.includes("r10.to"))
      storeName = "Rakuten JP";
    else if (urlLower.includes("yahoo.co.jp") || urlLower.includes("paypayfleamarket.yahoo.co.jp"))
      storeName = "Yahoo JP";
    else if (urlLower.includes("uniqlo.com"))
      storeName = "Uniqlo JP";
    else if (urlLower.includes("suruga-ya.jp"))
      storeName = "Surugaya JP";
    else if (urlLower.includes("biccamera.com"))
      storeName = "Bic Camera JP";
    else if (urlLower.includes("yodobashi.com"))
      storeName = "Yodobashi JP";

    // ── Bước 1: Chạy song song Direct HTML Fetch & Jina AI Reader để vừa nhanh vừa chống chặn Bot ──
    let directHtml = "";
    let effectiveUrl = url;

    const directFetchPromise = safeFetchHtmlWithRedirects(url, 4)
      .then((res) => {
        directHtml = res.html;
        if (res.finalUrl) effectiveUrl = res.finalUrl;
      })
      .catch((fetchErr) => {
        console.warn("[ScrapeLink] Direct fetch html error:", fetchErr);
      });

    let jinaText = "";
    let jinaImageUrl = "";

    const jinaFetchPromise = (async () => {
      try {
        const jinaHeaders: Record<string, string> = {
          Accept: "text/plain",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "X-Locale": "ja-JP",
          "X-Set-Cookie": "i18n-prefs=JPY; lc-acbjp=ja_JP",
        };
        if (process.env.JINA_API_KEY) {
          jinaHeaders["Authorization"] = `Bearer ${process.env.JINA_API_KEY}`;
        }

        const jinaResponse = await fetch(`https://r.jina.ai/${url}`, {
          headers: jinaHeaders,
          signal: AbortSignal.timeout(11000),
        });

        if (jinaResponse.ok) {
          jinaText = await jinaResponse.text();
          const imageMatch =
            jinaText.match(/!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/i) ||
            jinaText.match(/Image\s*:\s*(https:\/\/\S+)/i);
          if (imageMatch?.[1]) {
            const rawImg = imageMatch[1];
            try {
              const u = new URL(rawImg);
              if (
                u.protocol === "https:" &&
                !isPrivateHost(u.hostname) &&
                !/logo|icon|sprite|banner|badge/i.test(rawImg)
              ) {
                jinaImageUrl = rawImg;
              }
            } catch {}
          }
        }
      } catch (jinaErr) {
        console.warn("[ScrapeLink] Jina AI reader error:", jinaErr);
      }
    })();

    await Promise.allSettled([directFetchPromise, jinaFetchPromise]);

    // Bóc tách metadata có cấu trúc từ HTML gốc
    const htmlMeta = extractStructuredMetaFromHtml(directHtml, effectiveUrl.toLowerCase());

    // Bổ trợ từ Jina Markdown nếu Direct HTML bị chặn Bot (trống title hoặc trống price)
    if (jinaText && (!htmlMeta.title || !htmlMeta.priceJpy)) {
      const jinaMeta = extractMetaFromJinaMarkdown(jinaText, effectiveUrl.toLowerCase());
      if (!htmlMeta.title && jinaMeta.title) htmlMeta.title = jinaMeta.title;
      if (!htmlMeta.priceJpy && jinaMeta.priceJpy && jinaMeta.priceJpy > 0) {
        htmlMeta.priceJpy = jinaMeta.priceJpy;
      }
    }

    // Bổ trợ chuyên biệt cho Uniqlo JP qua API v5
    if (urlLower.includes("uniqlo.com")) {
      const uniqloMeta = await fetchUniqloProductApi(effectiveUrl);
      if (uniqloMeta) {
        if (uniqloMeta.title) htmlMeta.title = uniqloMeta.title;
        if (uniqloMeta.priceJpy > 0) {
          htmlMeta.priceJpy = uniqloMeta.priceJpy;
          htmlMeta.highConfidencePrice = true;
        }
        if (uniqloMeta.imageUrl) htmlMeta.imageUrl = uniqloMeta.imageUrl;
        if (uniqloMeta.breadcrumbs) htmlMeta.breadcrumbs = uniqloMeta.breadcrumbs;
      }
    }

    // ── Bước 2: Gọi Gemini Agent với nội dung tập trung đã lọc bỏ sản phẩm liên quan ──
    let geminiResult: Partial<ExtractedProduct> | null = null;
    const focusedContext = buildFocusedScrapeContext(jinaText || directHtml, htmlMeta);

    if (focusedContext.length > 40) {
      geminiResult = await extractWithGemini(focusedContext, storeName);
    }

    // ── Bước 3: Hợp nhất kết quả thông minh (Khóa giá JSON-LD/DOM chuẩn để tránh AI lấy nhầm giá gợi ý) ──
    let finalTitle =
      geminiResult?.title ||
      htmlMeta.title ||
      `[${storeName}] Sản phẩm nội địa Nhật Bản`;

    // QUAN TRỌNG: Nếu HTML/JSON-LD/NEXT_DATA của trang gốc đã bóc được giá độ tin cậy cao (highConfidencePrice),
    // ưu tiên giữ giá đó thay vì để Gemini vô tình đọc nhầm giá sản phẩm quảng cáo trong văn bản Jina!
    let finalPriceJpy = htmlMeta.highConfidencePrice && htmlMeta.priceJpy > 0
      ? htmlMeta.priceJpy
      : geminiResult?.priceJpy || htmlMeta.priceJpy || 0;

    let finalImageUrl =
      htmlMeta.imageUrl ||
      (geminiResult?.imageUrl && geminiResult.imageUrl.startsWith("http")
        ? geminiResult.imageUrl
        : null) ||
      jinaImageUrl ||
      "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80";

    let combinedBreadcrumb =
      htmlMeta.breadcrumbs || geminiResult?.categoryBreadcrumb || null;

    // Fallback thông minh cho các link mẫu của 8 sàn hỗ trợ
    const sampleProduct = findSampleProductByUrl(effectiveUrl) || findSampleProductByUrl(url);
    if (sampleProduct) {
      if (!finalPriceJpy || finalPriceJpy <= 0) {
        finalPriceJpy = sampleProduct.samplePriceJpy;
      }
      if (!finalTitle || finalTitle.includes("Sản phẩm nội địa Nhật Bản")) {
        finalTitle = sampleProduct.sampleProductTitle;
      }
      if (!finalImageUrl || finalImageUrl.includes("unsplash")) {
        finalImageUrl = sampleProduct.sampleImageUrl;
      }
      if (!combinedBreadcrumb) {
        combinedBreadcrumb = sampleProduct.categoryBreadcrumb;
      }
    }

    const voltageWarning =
      geminiResult?.voltageWarning === true ||
      /\b100V\b|AC100/i.test(finalTitle) ||
      sampleProduct?.is100v === true;

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

    const classification = classifyProductCategory({
      breadcrumbText: combinedBreadcrumb,
      title: finalTitle,
      titleJp: geminiResult?.titleJp ?? htmlMeta.title ?? sampleProduct?.sampleProductTitleJp,
      storeName,
      geminiCategory: (geminiResult?.category as JpVnProductCategory) ?? sampleProduct?.category ?? null,
    });

    const customsInfo = getCategoryCustomsInfo(classification.category);

    const result: ExtractedProduct = {
      storeName,
      url,
      title: finalTitle,
      titleJp: geminiResult?.titleJp ?? (htmlMeta.title || sampleProduct?.sampleProductTitleJp || null),
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
    console.error("[ScrapeLink] HTTP n/a:", error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200));
    return NextResponse.json({ error: "Không thể đọc thông tin sản phẩm từ trang này. Hãy kiểm tra link sàn Nhật rồi thử lại." }, { status: 500 });
  }
}
