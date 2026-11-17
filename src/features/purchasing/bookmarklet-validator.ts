import { isPrivateHost } from "@/lib/ssrf";

export const ALLOWED_SHOPPING_DOMAINS = [
  "amazon.co.jp", "amazon.com", "amzn.asia", "amzn.to",
  "mercari.com", "jp.mercari.com",
  "rakuten.co.jp", "a.r10.to",
  "yahoo.co.jp", "auctions.yahoo.co.jp", "shopping.yahoo.co.jp",
  "page.auctions.yahoo.co.jp", "paypayfleamarket.yahoo.co.jp",
  "uniqlo.com", "suruga-ya.jp", "biccamera.com", "yodobashi.com"
];

export interface ValidatedBookmarkletItem {
  id: string;
  name: string;
  priceJpy: number;
  weightKg: number;
  originalUrl: string;
  imageUrl?: string;
  quoteSource: "EXTENSION";
}

export type BookmarkletValidationResult =
  | { isValid: true; data: ValidatedBookmarkletItem }
  | { isValid: false; error: string };

function stripHtml(input: string): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export function validateBookmarkletPayload(raw: any): BookmarkletValidationResult {
  if (!raw || typeof raw !== "object") {
    return { isValid: false, error: "Dữ liệu bookmarklet không hợp lệ." };
  }

  // 1. Kiểm tra URL sản phẩm
  const rawUrl = typeof raw.url === "string" ? raw.url.trim() : "";
  if (!rawUrl) {
    return { isValid: false, error: "Thiếu đường dẫn (link) sản phẩm." };
  }
  if (rawUrl.length > 1000) {
    return { isValid: false, error: "Đường dẫn sản phẩm vượt quá độ dài cho phép (1000 ký tự)." };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return { isValid: false, error: "Đường dẫn sản phẩm không đúng định dạng URL hợp lệ." };
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    return { isValid: false, error: "Chỉ hỗ trợ giao thức HTTP hoặc HTTPS." };
  }

  if (isPrivateHost(parsedUrl.hostname)) {
    return { isValid: false, error: "Đường dẫn sản phẩm vi phạm chính sách bảo mật mạng (Private IP/Host)." };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const isAllowedDomain = ALLOWED_SHOPPING_DOMAINS.some(
    (d) => hostname === d || hostname.endsWith("." + d)
  );

  if (!isAllowedDomain) {
    return {
      isValid: false,
      error: `Website (${hostname}) không nằm trong danh sách các sàn thương mại điện tử Nhật Bản được ChillBanana hỗ trợ.`,
    };
  }

  // 2. Làm sạch tên sản phẩm và chống XSS
  const rawName = typeof raw.name === "string" ? raw.name : "";
  const cleanedName = stripHtml(rawName).slice(0, 200);
  if (!cleanedName) {
    return { isValid: false, error: "Tên sản phẩm không hợp lệ hoặc bị rỗng." };
  }

  // 3. Kiểm tra giá Yên
  const numPrice = Number(raw.priceJpy || raw.price);
  if (!Number.isSafeInteger(numPrice) || numPrice < 100 || numPrice > 10_000_000) {
    return { isValid: false, error: "Giá sản phẩm phải là số nguyên dương hợp lệ từ 100 ¥ đến 10.000.000 ¥." };
  }

  // 4. Cân nặng ước tính (kg)
  let weightKg = Number(raw.weightKg);
  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 500) {
    weightKg = 0.5; // Mặc định 0.5kg
  }

  // 5. Ảnh sản phẩm
  let imageUrl: string | undefined;
  if (typeof raw.imageUrl === "string" && raw.imageUrl.trim()) {
    const rawImg = raw.imageUrl.trim();
    if (rawImg.startsWith("https://") || rawImg.startsWith("http://")) {
      imageUrl = rawImg.slice(0, 1000);
    }
  }

  return {
    isValid: true,
    data: {
      id: `calc-ext-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: cleanedName,
      priceJpy: numPrice,
      weightKg,
      originalUrl: rawUrl,
      imageUrl,
      quoteSource: "EXTENSION",
    },
  };
}

