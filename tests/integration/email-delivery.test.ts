import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverLoggedEmail } from "@/features/notifications/email-delivery";
import { prisma } from "../helpers/db";

const saved = {
  mode: process.env.EMAIL_MODE,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
};

afterEach(() => {
  if (saved.mode === undefined) delete process.env.EMAIL_MODE;
  else process.env.EMAIL_MODE = saved.mode;
  if (saved.user === undefined) delete process.env.SMTP_USER;
  else process.env.SMTP_USER = saved.user;
  if (saved.pass === undefined) delete process.env.SMTP_PASS;
  else process.env.SMTP_PASS = saved.pass;
});

const input = {
  emailType: "test-order-update",
  to: "customer@example.test",
  subject: "Email test",
  html: "<p>test</p>",
};

describe("logged email delivery", () => {
  it("records mock delivery without sending or storing recipient/body", async () => {
    process.env.EMAIL_MODE = "mock";
    process.env.SMTP_USER = "configured-but-not-opted-in@example.test";
    process.env.SMTP_PASS = "configured-secret";
    const sendMail = vi.fn();
    expect(await deliverLoggedEmail(input, { sendMail })).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
    const log = await prisma.emailLog.findFirstOrThrow({ where: { emailType: input.emailType } });
    expect(log).toMatchObject({ status: "SIMULATED", providerMode: "mock", attemptCount: 0 });
    expect(log.payload).toBeNull();
    expect(JSON.stringify(log)).not.toContain(input.to);
    expect(JSON.stringify(log)).not.toContain(input.html);
  });

  it("logs transient SMTP attempts and prevents duplicate manual retries", async () => {
    process.env.EMAIL_MODE = "smtp";
    process.env.SMTP_USER = "smtp-test@example.test";
    process.env.SMTP_PASS = "test-only-password";
    let calls = 0;
    const transport = {
      sendMail: vi.fn(async () => {
        calls += 1;
        if (calls === 1) throw Object.assign(new Error("temporary"), { code: "ETIMEDOUT" });
        return { accepted: [input.to] };
      }),
    };
    expect(await deliverLoggedEmail(input, transport)).toBe(true);
    const log = await prisma.emailLog.findFirstOrThrow({ where: { emailType: input.emailType } });
    expect(log).toMatchObject({ status: "SENT", providerMode: "smtp", attemptCount: 2, lastErrorCode: null });
    expect(transport.sendMail).toHaveBeenCalledTimes(2);

    const retryLog = await prisma.emailLog.create({
      data: { emailType: "retry-test", providerMode: "smtp", status: "FAILED", attemptCount: 0, maxAttempts: 9, nextRetryAt: new Date(Date.now() - 1000) },
    });
    const duplicateTransport = { sendMail: vi.fn(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); return { accepted: [input.to] }; }) };
    const retryInput = { ...input, emailType: "retry-test", logId: retryLog.id };
    const results = await Promise.all([
      deliverLoggedEmail(retryInput, duplicateTransport),
      deliverLoggedEmail(retryInput, duplicateTransport),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(duplicateTransport.sendMail).toHaveBeenCalledTimes(1);
  });
});
