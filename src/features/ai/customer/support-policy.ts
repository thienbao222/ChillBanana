export type CustomerSupportToolId =
  | "catalog_search"
  | "quote_estimate"
  | "order_status"
  | "shipping_policy"
  | "product_compatibility";

export type SupportToolStatus = "ok" | "needs_input" | "restricted" | "unavailable";

export interface SupportSourceLink {
  label: string;
  href: string;
}

export interface SupportEvidence {
  toolId: CustomerSupportToolId;
  status: SupportToolStatus;
  source: {
    label: string;
    observedAt: string;
    dataUpdatedAt?: string | null;
  };
  known: Record<string, unknown>;
  unknown: string[];
  links: SupportSourceLink[];
}

export interface SupportIntents {
  catalog: boolean;
  quote: boolean;
  orderStatus: boolean;
  shipping: boolean;
  compatibility: boolean;
  category: "cosmetics" | "health" | "gadgets" | "anime" | null;
  orderCode: string | null;
}

const CATEGORY_PATTERNS: Array<[SupportIntents["category"], RegExp]> = [
  ["cosmetics", /\b(my pham|kem chong nang|duong da|skincare|serum|son duong|tay trang)\b/],
  ["health", /\b(thuc pham chuc nang|vitamin|collagen|tao xoan|nattokinase|bo nao)\b/],
  ["gadgets", /\b(do dien|dien tu|gia dung|noi com|may cao|100v|bien ap|tai nghe)\b/],
  ["anime", /\b(gundam|gunpla|figure|anime|manga|mo hinh|bandai)\b/],
];

export const SEARCH_STOP_WORDS = new Set([
  // Đại từ, xưng hô
  "anh", "chi", "em", "bac", "ban", "toi", "minh", "ben", "shop", "ad", "admin",
  // Trợ từ, hư từ, liên từ tiếng Việt phổ biến
  "co", "khong", "kem", "them", "do", "nay", "kia", "vao", "ra", "gio", "hang",
  "cua", "cho", "thi", "sao", "nao", "gi", "muon", "can", "xem", "giup", "voi", "va",
  "hay", "hoac", "bao", "nhieu", "la", "nhu", "nhat", "tu", "van", "xin", "y", "de",
  "dang", "mot", "cac", "nhung", "tren", "duoi", "trong", "ngoai", "the", "vay",
  "a", "oi", "nhe", "nha", "chao", "hoi", "cam", "on", "duoc", "bi", "lai", "di",
  "den", "toi", "ve", "theo", "chiec", "cai",
  // Thuật ngữ mua bán chung chung / website
  "website", "chillbanana", "san", "pham", "mua", "ban", "loai", "tim", "kiem",
  "gia", "tam", "trieu", "dong", "nhan", "loi", "neo", "nhatban", "noidia",
  "tot", "re", "dep", "chuan",
  // Từ khóa danh mục chung cũ đã có
  "biet", "my", "thuc", "chuc", "nang", "do", "dien", "gia", "dung", "noi", "com", "choi", "may",
]);

const SUPPORTED_MARKETPLACE_DOMAINS = [
  "amazon.co.jp", "amazon.com", "mercari.com", "rakuten.co.jp", "yahoo.co.jp",
  "uniqlo.com", "suruga-ya.jp", "biccamera.com", "yodobashi.com",
];

export function normalizeSupportText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function extractCatalogSearchTerms(message: string): string[] {
  const rawTokens = message.match(/[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)*/gu)?.filter((t) => t.length >= 2) ?? [];
  const tokens = rawTokens.filter((token) => !SEARCH_STOP_WORDS.has(normalizeSupportText(token)));
  return [...new Set(tokens.map((token) => token.slice(0, 60)))].slice(0, 6);
}

const ORDER_CODE_PATTERN = /\b((?:CB|VNJP)-\d{4}-[A-Z0-9-]{4,16})\b/i;

export function extractOrderCode(message: string): string | null {
  const match = message.match(ORDER_CODE_PATTERN);
  return match ? match[1].toUpperCase() : null;
}

export function detectSupportIntents(message: string, hasScrapedProduct = false): SupportIntents {
  const normalized = normalizeSupportText(message);
  const category = CATEGORY_PATTERNS.find(([, pattern]) => pattern.test(normalized))?.[0] ?? null;
  const orderCode = extractOrderCode(message);
  const orderStatus = Boolean(orderCode) || /\b(don hang|ma don|theo doi don|tinh trang don)\b/.test(normalized);
  const quote = hasScrapedProduct || /\b(tinh gia|bao gia|uoc tinh|tong chi phi|gia ve viet nam|tinh bill|gia bao nhieu|bao nhieu tien)\b/.test(normalized);
  const shipping = /\b(van chuyen|cuoc|phi ship|shipping|gop don|group buy|thoi gian giao|bao lau nhan|phi mua ho|phi dich vu|bieu phi|cach tinh phi|cach tinh gia|cong thuc tinh|dat coc)\b/.test(normalized);
  const compatibility = /\b(tuong thich|dien ap|100v|220v|bien ap|cong suat|dung o viet nam|cam truc tiep|am dun|noi com|may say)\b/.test(normalized);
  const catalog = Boolean(category) || /\b(tim|xem|goi y|tu van|san pham|mua hang|co ban|con ban|danh muc|dong may|giay|gucci|t-fal|tfal|am dun|noi com|dong ho|tui|vi|ao|khoac|sneaker|shoes|kettle|figure|gundam|jpy|yen|trieu)\b/.test(normalized);

  return { catalog, quote, orderStatus, shipping, compatibility, category, orderCode };
}

export function isValidOrderCode(value: string): boolean {
  return /^CB-\d{4}-[A-Z0-9]+-\d{4,6}$/i.test(value) || /^VNJP-\d{4}-[A-Z0-9-]{4,16}$/i.test(value);
}

export function isSupportedMarketplaceUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && SUPPORTED_MARKETPLACE_DOMAINS.some(
      (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

export function isValidQuotePrice(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 1_000_000_000;
}

export function canReadOrder(
  currentCustomerId: string | null,
  orderCustomerId: string | null,
  hasValidGuestAccess: boolean
): boolean {
  return Boolean(
    (currentCustomerId && orderCustomerId && currentCustomerId === orderCustomerId) ||
    hasValidGuestAccess
  );
}

export function getOrderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING_DEPOSIT: "Chờ đặt cọc",
    PURCHASING_JP: "Đang mua tại Nhật Bản",
    WAREHOUSE_JP: "Đã vào kho Nhật Bản",
    IN_TRANSIT_AIR: "Đang vận chuyển quốc tế",
    WAREHOUSE_VN: "Đã về kho Việt Nam",
    LOCAL_DELIVERY: "Đang giao hàng nội địa",
    COMPLETED: "Đã giao hàng thành công",
    CANCELLED: "Đã hủy",
  };
  return labels[status] ?? "Đang được kiểm tra";
}

export function getRequestSlotLabel(stockSlots: number): string {
  return stockSlots > 0
    ? `Còn ${stockSlots} suất tiếp nhận yêu cầu mua hộ`
    : "Hiện chưa có suất tiếp nhận yêu cầu mua hộ";
}

export const CUSTOMER_SUPPORT_TOOL_REGISTRY = [
  { id: "catalog_search", access: "read-only", purpose: "Search the current website catalog" },
  { id: "quote_estimate", access: "read-only", purpose: "Calculate a clearly labeled estimate using server pricing rules" },
  { id: "order_status", access: "read-only", purpose: "Read one order status after server-side ownership verification" },
  { id: "shipping_policy", access: "read-only", purpose: "Explain the configured shipping rate and group-buy rule" },
  { id: "product_compatibility", access: "read-only", purpose: "Read catalog voltage notes and ask for missing device details" },
] as const;
