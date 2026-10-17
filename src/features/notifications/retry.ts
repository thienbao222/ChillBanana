import { prisma } from "@/lib/prisma";

export type RetryEmailsSummary = { requeuedStuck: number; attempted: number; sent: number; failed: number; errors: number };

/**
 * Thử gửi lại các email FAILED đã đến hạn (nextRetryAt <= now) và chưa hết số lần thử.
 * Log kẹt ở PENDING quá lâu (hàm bị cắt giữa chừng) được đưa về FAILED để được thử lại.
 * `retry` trả true khi email thật sự đã gửi; lỗi của một email không làm dừng các email còn lại.
 */
export async function retryDueEmails(options: {
  retry: (logId: string) => Promise<boolean>;
  now?: Date;
  limit?: number;
  stuckAfterMs?: number;
}): Promise<RetryEmailsSummary> {
  const now = options.now ?? new Date();
  const limit = Math.max(1, Math.min(options.limit ?? 20, 100));
  const stuckBefore = new Date(now.getTime() - (options.stuckAfterMs ?? 15 * 60_000));

  const requeued = await prisma.emailLog.updateMany({
    where: { status: "PENDING", updatedAt: { lt: stuckBefore } },
    data: { status: "FAILED", nextRetryAt: now, lastErrorCode: "STUCK_PENDING" },
  });

  const due = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "EmailLog"
    WHERE "status" = 'FAILED'
      AND "attemptCount" < "maxAttempts"
      AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= ${now})
    ORDER BY "nextRetryAt" ASC NULLS FIRST
    LIMIT ${limit}`;

  const summary: RetryEmailsSummary = { requeuedStuck: requeued.count, attempted: 0, sent: 0, failed: 0, errors: 0 };
  for (const { id } of due) {
    summary.attempted += 1;
    try {
      if (await options.retry(id)) summary.sent += 1;
      else summary.failed += 1;
    } catch (error) {
      summary.errors += 1;
      console.error("[EmailRetry] Lỗi khi thử lại email:", error);
    }
  }
  return summary;
}
