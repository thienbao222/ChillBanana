import { describe, expect, it, vi } from "vitest";
import { GET as cron } from "@/app/api/cron/retry-emails/route";
import { retryDueEmails } from "@/features/notifications/retry";
import { retryEmailLog } from "@/lib/mailer";
import { prisma } from "../helpers/db";
import { get, json } from "../helpers/request";

const minutes = (n: number) => new Date(Date.now() + n * 60_000);

const log = (over: Record<string, unknown> = {}) =>
  prisma.emailLog.create({
    data: { emailType: "order-created", providerMode: "smtp", status: "FAILED", attemptCount: 3, maxAttempts: 9, nextRetryAt: minutes(-5), ...over },
  });

describe("retryDueEmails", () => {
  it("chỉ thử lại email FAILED đã đến hạn và chưa hết số lần thử", async () => {
    const due = await log({ nextRetryAt: minutes(-10) });
    const dueNoSchedule = await log({ nextRetryAt: null });
    const future = await log({ nextRetryAt: minutes(30) });
    const exhausted = await log({ attemptCount: 9, maxAttempts: 9 });
    const sent = await log({ status: "SENT", nextRetryAt: null });
    const simulated = await log({ status: "SIMULATED", providerMode: "mock", nextRetryAt: null });
    const freshPending = await log({ status: "PENDING", nextRetryAt: null });

    const retry = vi.fn().mockResolvedValue(true);
    const summary = await retryDueEmails({ retry });

    expect(retry.mock.calls.map((c) => c[0]).sort()).toEqual([due.id, dueNoSchedule.id].sort());
    expect(summary).toMatchObject({ attempted: 2, sent: 2, failed: 0, errors: 0, requeuedStuck: 0 });
    for (const skipped of [future, exhausted, sent, simulated, freshPending]) expect(retry).not.toHaveBeenCalledWith(skipped.id);
  });

  it("log kẹt PENDING quá lâu được đưa về FAILED rồi thử lại", async () => {
    const stuck = await log({ status: "PENDING", nextRetryAt: null });
    await prisma.$executeRaw`UPDATE "EmailLog" SET "updatedAt" = (${minutes(-60)} AT TIME ZONE 'UTC') WHERE "id" = ${stuck.id}`;

    const retry = vi.fn().mockResolvedValue(false);
    const summary = await retryDueEmails({ retry });
    expect(summary).toMatchObject({ requeuedStuck: 1, attempted: 1, sent: 0, failed: 1 });
    expect(retry).toHaveBeenCalledWith(stuck.id);
    expect((await prisma.emailLog.findUniqueOrThrow({ where: { id: stuck.id } })).lastErrorCode).toBe("STUCK_PENDING");
  });

  it("tôn trọng giới hạn mỗi lượt", async () => {
    for (let i = 0; i < 5; i++) await log({ nextRetryAt: minutes(-10 - i) });
    const retry = vi.fn().mockResolvedValue(true);
    const summary = await retryDueEmails({ retry, limit: 2 });
    expect(summary.attempted).toBe(2);
    expect(retry).toHaveBeenCalledTimes(2);
  });

  it("lỗi ở một email không làm dừng các email còn lại", async () => {
    const a = await log({ nextRetryAt: minutes(-20) });
    const b = await log({ nextRetryAt: minutes(-10) });
    const retry = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(true);
    const summary = await retryDueEmails({ retry });
    expect(summary).toMatchObject({ attempted: 2, errors: 1, sent: 1 });
    expect(retry).toHaveBeenNthCalledWith(1, a.id);
    expect(retry).toHaveBeenNthCalledWith(2, b.id);
  });

  it("không có gì cần thử lại thì không gọi retry", async () => {
    const retry = vi.fn();
    expect(await retryDueEmails({ retry })).toEqual({ requeuedStuck: 0, attempted: 0, sent: 0, failed: 0, errors: 0 });
    expect(retry).not.toHaveBeenCalled();
  });
});

describe("GET /api/cron/retry-emails", () => {
  it("cần CRON_SECRET: thiếu cấu hình 503, sai khóa 401", async () => {
    const saved = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    expect((await cron(get("/api/cron/retry-emails"))).status).toBe(503);
    process.env.CRON_SECRET = saved;
    expect((await cron(get("/api/cron/retry-emails"))).status).toBe(401);
    expect((await cron(get("/api/cron/retry-emails", { headers: { authorization: "Bearer sai" } }))).status).toBe(401);
    expect(retryEmailLog).not.toHaveBeenCalled();
  });

  it("đúng khóa: chạy thử lại và trả tổng kết", async () => {
    const due = await log();
    const res = await cron(get("/api/cron/retry-emails", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ success: true, attempted: 1, sent: 1 });
    expect(retryEmailLog).toHaveBeenCalledWith(due.id);
  });
});
