import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type EmailLogInput = {
  emailType: string;
  orderId?: string;
  payload?: Record<string, unknown>;
  to: string;
  subject: string;
  html: string;
  logId?: string;
};

type MailTransport = { sendMail(message: { from: string; to: string; subject: string; html: string }): Promise<unknown> };

function emailMode(): "mock" | "smtp" {
  const rawMode = (process.env.EMAIL_MODE || "").trim().toLowerCase();
  if (rawMode === "mock") return "mock";
  if (rawMode === "smtp") return "smtp";
  // Trong môi trường kiểm thử tự động (Vitest), giữ nguyên mặc định "mock" để bảo toàn 100% unit/integration tests
  const isTestEnv = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
  if (!isTestEnv && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return "smtp";
  }
  return "mock";
}

function errorCode(error: unknown): string {
  const candidate = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code || "SMTP_ERROR")
    : "SMTP_ERROR";
  return candidate.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "SMTP_ERROR";
}

function retryDelay(attempt: number): number {
  return Math.min(500 * 2 ** (attempt - 1), 2_000);
}

export async function deliverLoggedEmail(input: EmailLogInput, transport: MailTransport): Promise<boolean> {
  const mode = emailMode();
  let logId = input.logId;
  let attemptsSoFar = 0;
  let maxAttempts = 9;

  try {
    if (logId) {
      const log = await prisma.emailLog.findUnique({ where: { id: logId } });
      if (!log || log.status !== "FAILED" || (log.nextRetryAt && log.nextRetryAt > new Date())) return false;
      attemptsSoFar = log.attemptCount;
      maxAttempts = log.maxAttempts;
      if (attemptsSoFar >= maxAttempts) return false;
      const claimed = await prisma.emailLog.updateMany({
        where: {
          id: logId,
          status: "FAILED",
          attemptCount: attemptsSoFar,
          maxAttempts,
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
        },
        data: { status: "PENDING", providerMode: mode, lastErrorCode: null },
      });
      if (claimed.count !== 1) return false;
    } else {
      const log = await prisma.emailLog.create({
        data: {
          orderId: input.orderId,
          emailType: input.emailType,
          payload: input.payload as Prisma.InputJsonValue | undefined,
          providerMode: mode,
          status: mode === "mock" ? "SIMULATED" : "PENDING",
          maxAttempts,
        },
      });
      logId = log.id;
    }
  } catch (error) {
    // Email dispatch must not be claimed as successful when its durable log could not be written.
    console.error("[EmailLog] Could not create/update delivery record:", error);
    return false;
  }

  if (mode === "mock") {
    if (input.logId) {
      await prisma.emailLog.update({
        where: { id: input.logId },
        data: { status: "SIMULATED", providerMode: "mock", nextRetryAt: null, lastErrorCode: null, attemptCount: attemptsSoFar },
      });
    }
    console.info(`[Mailer Sim] ${input.emailType} recorded as simulated; no email was sent.`);
    return false;
  }
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    await prisma.emailLog.update({
      where: { id: logId },
      data: { status: "FAILED", lastErrorCode: "SMTP_NOT_CONFIGURED", nextRetryAt: new Date(Date.now() + 5 * 60_000) },
    });
    return false;
  }

  const remainingAttempts = Math.min(3, maxAttempts - attemptsSoFar);
  for (let attempt = 1; attempt <= remainingAttempts; attempt += 1) {
    const attemptCount = attemptsSoFar + attempt;
    try {
      const info = await transport.sendMail({
        from: process.env.SMTP_FROM || `"ChillBanana" <${process.env.SMTP_USER}>`,
        to: input.to,
        subject: input.subject,
        html: input.html,
      });
      const accepted = Array.isArray((info as { accepted?: unknown } | null)?.accepted)
        ? (info as { accepted: unknown[] }).accepted.length > 0
        : true;
      if (!accepted) throw Object.assign(new Error("SMTP rejected all recipients"), { code: "SMTP_NO_RECIPIENT_ACCEPTED" });
      await prisma.emailLog.update({
        where: { id: logId },
        data: { status: "SENT", attemptCount, lastAttemptAt: new Date(), lastErrorCode: null, nextRetryAt: null, sentAt: new Date() },
      });
      return true;
    } catch (error) {
      const code = errorCode(error);
      await prisma.emailLog.update({
        where: { id: logId },
        data: {
          status: attempt === remainingAttempts && attemptsSoFar + attempt >= maxAttempts ? "FAILED" : "PENDING",
          attemptCount,
          lastAttemptAt: new Date(),
          lastErrorCode: code,
          nextRetryAt: attempt === remainingAttempts ? new Date(Date.now() + 5 * 60_000) : null,
        },
      });
      if (attempt < remainingAttempts) await new Promise((resolve) => setTimeout(resolve, retryDelay(attempt)));
    }
  }

  if (attemptsSoFar + remainingAttempts < maxAttempts) {
    await prisma.emailLog.update({
      where: { id: logId },
      data: { status: "FAILED", nextRetryAt: new Date(Date.now() + 5 * 60_000) },
    });
  }
  return false;
}
