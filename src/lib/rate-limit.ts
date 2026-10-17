import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  clientIpFromHeaders,
  registerHit,
  retryAfterSeconds,
  type RateLimitConfig,
  type RateLimitState,
} from "@/lib/rate-limit-core";

// Bộ đếm lưu trong PostgreSQL (bảng RateLimit) nên có hiệu lực xuyên các serverless instance
// và không mất khi cold start, khác với Map trong bộ nhớ.
//
// Chính sách lỗi: nếu database gặp sự cố, các hàm ở đây KHÔNG chặn người dùng (fail-open)
// và chỉ ghi log lỗi. Đăng nhập vốn cũng cần database nên không tạo thêm lỗ hổng đáng kể.

export function getClientIp(req: NextRequest | Request): string {
  return clientIpFromHeaders((name) => req.headers.get(name));
}

function toState(row: { count: number; windowStart: Date; blockedUntil: Date | null }): RateLimitState {
  return {
    count: row.count,
    windowStart: row.windowStart.getTime(),
    blockedUntil: row.blockedUntil ? row.blockedUntil.getTime() : null,
  };
}

/** Số giây còn bị khóa của một khóa giới hạn (0 nếu không bị khóa). */
export async function getBlockedSeconds(key: string): Promise<number> {
  try {
    const row = await prisma.rateLimit.findUnique({ where: { key } });
    return row ? retryAfterSeconds(toState(row), Date.now()) : 0;
  } catch (error) {
    console.error("[RateLimit] Không đọc được bộ đếm:", error);
    return 0;
  }
}

/** Lấy số giây chờ lớn nhất trong nhiều khóa. */
export async function getMaxBlockedSeconds(keys: string[]): Promise<number> {
  const waits = await Promise.all(keys.map((key) => getBlockedSeconds(key)));
  return Math.max(0, ...waits);
}

/** Đếm lượt và trả số giây chặn; lỗi DB được ném ra để route tốn chi phí có thể fail closed. */
export async function checkAndRecordHit(key: string, config: RateLimitConfig): Promise<number> {
  return prisma.$transaction(async (tx) => {
    // Serialize parallel calls from the same key across serverless instances.
    // Project the void lock result to a scalar Prisma can decode.
    await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))) AS advisory_lock`;
    const now = Date.now();
    const existing = await tx.rateLimit.findUnique({ where: { key } });
    const state = existing ? toState(existing) : null;
    const retryAfter = retryAfterSeconds(state, now);
    if (retryAfter > 0) return retryAfter;

    const next = registerHit(state, now, config);
    const data = {
      count: next.count,
      windowStart: new Date(next.windowStart),
      blockedUntil: next.blockedUntil === null ? null : new Date(next.blockedUntil),
    };
    await tx.rateLimit.upsert({ where: { key }, create: { key, ...data }, update: data });

    // Dọn dần các bộ đếm đã cũ (khoảng 1% số lần ghi) để bảng không phình ra.
    if (Math.random() < 0.01) {
      await tx.rateLimit.deleteMany({ where: { updatedAt: { lt: new Date(now - 24 * 60 * 60 * 1000) } } });
    }
    return 0;
  });
}

/** Ghi nhận một lần thử/thất bại theo chính sách fail-open dùng chung. */
export async function recordHit(key: string, config: RateLimitConfig): Promise<void> {
  try {
    await checkAndRecordHit(key, config);
  } catch (error) {
    console.error("[RateLimit] Không ghi được bộ đếm:", error);
  }
}

export async function recordHits(keys: string[], config: RateLimitConfig): Promise<void> {
  await Promise.all(keys.map((key) => recordHit(key, config)));
}

/** Xóa bộ đếm (ví dụ sau khi đăng nhập thành công). */
export async function resetKey(key: string): Promise<void> {
  try {
    await prisma.rateLimit.deleteMany({ where: { key } });
  } catch (error) {
    console.error("[RateLimit] Không xóa được bộ đếm:", error);
  }
}
