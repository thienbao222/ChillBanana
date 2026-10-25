/**
 * LRU In-Memory Response Cache cho Neo Chat & Hỗ trợ khách hàng.
 * Tiết kiệm quota Gemini cho các câu hỏi thông tin chung (chính sách, tỷ giá, câu hỏi mẫu).
 * TUYỆT ĐỐI KHÔNG cache câu hỏi có chứa mã đơn hàng hoặc thông tin cá nhân.
 */

export interface CachedChatEntry {
  text: string;
  mode: "gemini" | "offline";
  model?: string;
  createdAt: number;
}

const MAX_CACHE_SIZE = 200;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 phút

// Map lưu trữ theo thứ tự truy cập (LRU)
const chatCache = new Map<string, CachedChatEntry>();

/**
 * Chuẩn hóa câu hỏi: lowercase, bỏ dấu câu và khoảng trắng thừa.
 */
export function normalizeQuery(query: string): string {
  if (!query || typeof query !== "string") return "";
  return query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // bỏ dấu tiếng Việt để gộp câu tương đương
    .replace(/[.,?!:;'"()[\]{}~`@#$%^&*_\-+=<>/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Kiểm tra câu hỏi có an toàn và phù hợp để cache không.
 * TUYỆT ĐỐI KHÔNG cache nếu có mã đơn (CB-..., VNJP-...), SĐT, email hoặc dữ liệu cá nhân.
 */
export function isCacheableQuery(query: string): boolean {
  if (!query || typeof query !== "string") return false;
  const trimmed = query.trim();
  if (trimmed.length < 3 || trimmed.length > 300) return false;

  // Kiểm tra mã đơn hàng
  const hasOrderCode =
    /CB-\d{4}-[A-Z0-9]+/i.test(trimmed) ||
    /\bCB-[A-Z0-9-]{4,}\b/i.test(trimmed) ||
    /\bVNJP-[A-Z0-9-]{4,}\b/i.test(trimmed);
  if (hasOrderCode) return false;

  // Kiểm tra thông tin nhạy cảm: email, số điện thoại
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(trimmed);
  if (hasEmail) return false;

  const hasPhone = /(?:0|\+84)[3|5|7|8|9]\d{8}\b/.test(trimmed);
  if (hasPhone) return false;

  return true;
}

export function buildCacheKey(query: string, persona: string, lang: string): string {
  const normQ = normalizeQuery(query);
  return `${normQ}|${persona.toLowerCase()}|${lang.toLowerCase()}`;
}

export function getChatCache(
  query: string,
  persona = "omotenashi",
  lang = "vi"
): CachedChatEntry | null {
  if (!isCacheableQuery(query)) return null;

  const key = buildCacheKey(query, persona, lang);
  const entry = chatCache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.createdAt > CACHE_TTL_MS) {
    chatCache.delete(key);
    return null;
  }

  // Cập nhật vị trí LRU (xóa và set lại để chuyển xuống cuối map)
  chatCache.delete(key);
  chatCache.set(key, entry);

  return entry;
}

export function setChatCache(
  query: string,
  persona = "omotenashi",
  lang = "vi",
  result: { text: string; mode: "gemini" | "offline"; model?: string }
): void {
  if (!isCacheableQuery(query)) return;
  if (!result || !result.text || typeof result.text !== "string") return;

  const key = buildCacheKey(query, persona, lang);

  // LRU Eviction: nếu đầy 200 items, xóa phần tử cũ nhất (đầu map)
  if (chatCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = chatCache.keys().next().value;
    if (oldestKey) {
      chatCache.delete(oldestKey);
    }
  }

  chatCache.set(key, {
    text: result.text,
    mode: result.mode,
    model: result.model,
    createdAt: Date.now(),
  });
}

export function clearChatCache(): void {
  chatCache.clear();
}

export function getChatCacheSize(): number {
  return chatCache.size;
}
