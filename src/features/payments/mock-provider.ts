import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getMockPaymentSecret } from "@/features/payments/provider";

type MockPaymentPayload = { attemptId: string; expiresAt: number };

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createMockPaymentAttemptToken(attemptId: string, expiresAt: Date): string {
  const secret = getMockPaymentSecret();
  if (secret.length < 32) throw new Error("PAYMENT_MOCK_SECRET hoặc CUSTOMER_SESSION_SECRET phải có ít nhất 32 ký tự.");
  const payload: MockPaymentPayload = { attemptId, expiresAt: expiresAt.getTime() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyMockPaymentAttemptToken(token: unknown, now = Date.now()): MockPaymentPayload | null {
  if (typeof token !== "string" || token.length > 512) return null;
  const [encoded, supplied, ...extra] = token.split(".");
  if (!encoded || !supplied || extra.length) return null;
  const secret = getMockPaymentSecret();
  if (secret.length < 32) return null;
  const expected = sign(encoded, secret);
  const suppliedBuffer = Buffer.from(supplied, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<MockPaymentPayload>;
    if (typeof payload.attemptId !== "string" || payload.attemptId.length > 40 || !Number.isSafeInteger(payload.expiresAt) || payload.expiresAt! <= now) return null;
    return payload as MockPaymentPayload;
  } catch {
    return null;
  }
}

export function createMockProviderReference(): string {
  return `MOCK-${randomUUID()}`;
}
