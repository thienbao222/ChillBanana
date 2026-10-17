// Logic giới hạn tần suất thuần túy (không phụ thuộc database) để dễ kiểm thử.
// Lớp lưu trữ bằng Prisma nằm ở src/lib/rate-limit.ts.

export type RateLimitState = {
  count: number;
  windowStart: number; // epoch ms
  blockedUntil: number | null; // epoch ms
};

export type RateLimitConfig = {
  max: number; // số lần tối đa trong một cửa sổ trước khi bị khóa
  windowMs: number;
  blockMs: number; // thời gian khóa khi vượt ngưỡng
};

/** Số giây còn lại bị khóa, hoặc 0 nếu không bị khóa. */
export function retryAfterSeconds(state: RateLimitState | null, now: number): number {
  if (!state || state.blockedUntil === null || state.blockedUntil <= now) return 0;
  return Math.ceil((state.blockedUntil - now) / 1000);
}

/** Ghi nhận một lần vi phạm/thử và trả về trạng thái mới. */
export function registerHit(state: RateLimitState | null, now: number, config: RateLimitConfig): RateLimitState {
  if (state === null || now - state.windowStart >= config.windowMs) {
    // Hết cửa sổ cũ (kể cả khi khóa đã hết hạn): bắt đầu đếm lại.
    if (state !== null && state.blockedUntil !== null && state.blockedUntil > now) return state;
    return { count: 1, windowStart: now, blockedUntil: 1 >= config.max ? now + config.blockMs : null };
  }
  if (state.blockedUntil !== null && state.blockedUntil > now) return state; // đang bị khóa: không đếm thêm
  const count = state.count + 1;
  return { count, windowStart: state.windowStart, blockedUntil: count >= config.max ? now + config.blockMs : null };
}

/** Lấy IP client từ header (Vercel đặt x-forwarded-for; phần tử đầu là client). */
export function clientIpFromHeaders(get: (name: string) => string | null): string {
  const forwarded = get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = get("x-real-ip");
  return real ? real.trim().slice(0, 64) : "unknown";
}

// Ngưỡng dùng chung cho các luồng xác thực.
export const LOGIN_FAILURES_PER_ACCOUNT: RateLimitConfig = { max: 5, windowMs: 15 * 60_000, blockMs: 15 * 60_000 };
export const LOGIN_FAILURES_PER_IP: RateLimitConfig = { max: 20, windowMs: 15 * 60_000, blockMs: 15 * 60_000 };
export const REGISTER_PER_IP: RateLimitConfig = { max: 10, windowMs: 60 * 60_000, blockMs: 60 * 60_000 };
