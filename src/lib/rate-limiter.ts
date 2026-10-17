/**
 * rate-limiter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Rate Limiter in-memory đơn giản, không cần Redis.
 * Phù hợp cho pre-production / single-instance deployment trên Vercel.
 *
 * GIỚI HẠN: Vercel Serverless là stateless → mỗi cold start reset counter.
 * Điều này là chấp nhận được ở giai đoạn pre-production; production thật cần
 * Redis/Upstash để persist counter across instances.
 *
 * Cách dùng:
 *   const limiter = getRateLimiter("login", { maxRequests: 5, windowMs: 60_000 });
 *   const result = limiter.check(ip);
 *   if (!result.allowed) return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface WindowEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  /** Số request tối đa trong cửa sổ thời gian. */
  maxRequests: number;
  /** Khoảng thời gian cửa sổ (ms). Ví dụ: 60_000 = 1 phút. */
  windowMs: number;
}

interface CheckResult {
  /** true nếu request được phép đi qua. */
  allowed: boolean;
  /** Số request còn lại trong cửa sổ hiện tại. */
  remaining: number;
  /** Unix timestamp (ms) khi cửa sổ reset. */
  resetAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// RateLimiter class
// ─────────────────────────────────────────────────────────────────────────────

class RateLimiter {
  private store = new Map<string, WindowEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(options: RateLimiterOptions) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;

    // Tự dọn Map mỗi 10 phút để tránh memory leak
    if (typeof setInterval !== "undefined") {
      setInterval(() => this.cleanup(), 10 * 60 * 1000);
    }
  }

  /**
   * Kiểm tra và tính counter cho key (thường là IP address hoặc "ip:route").
   */
  check(key: string): CheckResult {
    const now = Date.now();
    let entry = this.store.get(key);

    // Nếu cửa sổ đã hết hạn, reset
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + this.windowMs };
    }

    entry.count += 1;
    this.store.set(key, entry);

    const allowed = entry.count <= this.maxRequests;
    return {
      allowed,
      remaining: Math.max(0, this.maxRequests - entry.count),
      resetAt: entry.resetAt,
    };
  }

  /** Xoá manual (ví dụ: sau khi đăng nhập thành công để reset penalty). */
  reset(key: string): void {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton instances — mỗi "route" có một limiter riêng
// ─────────────────────────────────────────────────────────────────────────────

// Ghi chú: Khai báo trên module scope để tận dụng Vercel module caching trong
// cùng một warm instance. Mỗi cold start sẽ reset, đây là trade-off chấp nhận được.

/** Cho `/api/auth/customer` POST — Login/Register: max 10 lần / 1 phút / IP */
const loginLimiter = new RateLimiter({ maxRequests: 10, windowMs: 60_000 });

/** Cho `/api/orders` POST — Đặt đơn: max 5 đơn / 2 phút / IP */
const orderCreateLimiter = new RateLimiter({ maxRequests: 5, windowMs: 2 * 60_000 });

/** Cho `/api/auth/customer/reset-password` — Quên mật khẩu: max 3 lần / 10 phút / IP */
const resetPasswordLimiter = new RateLimiter({ maxRequests: 3, windowMs: 10 * 60_000 });

// ─────────────────────────────────────────────────────────────────────────────
// Helper: lấy IP từ NextRequest
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest } from "next/server";

/**
 * Lấy IP thực của client, hỗ trợ Vercel proxy headers.
 * Nếu không tìm được IP, trả về "unknown" (vẫn bị limit nhưng chia sẻ counter).
 */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

export { loginLimiter, orderCreateLimiter, resetPasswordLimiter };
export type { RateLimiterOptions, CheckResult };
