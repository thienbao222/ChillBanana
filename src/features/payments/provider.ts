export type PaymentMode = "mock" | "sandbox" | "blocked-live" | "misconfigured";

export function isVnpaySandboxUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "sandbox.vnpayment.vn" && url.pathname.startsWith("/paymentv2/");
  } catch {
    return false;
  }
}

/** Live checkout is intentionally unavailable until the project is approved for real commerce. */
export function resolvePaymentMode(env: NodeJS.ProcessEnv = process.env): PaymentMode {
  const configured = env.PAYMENT_MODE?.trim().toLowerCase();
  if (configured === "live") return "blocked-live";
  if (configured === "mock") return "mock";
  if (configured === "sandbox") return isVnpaySandboxUrl(env.VNPAY_URL) ? "sandbox" : "misconfigured";
  if (configured) return "misconfigured";
  // Never infer an external gateway from leftover credentials or URLs.
  return "mock";
}

import crypto from "node:crypto";

export function getMockPaymentSecret(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.PAYMENT_MOCK_SECRET || env.CUSTOMER_SESSION_SECRET || "";
  const isTestEnv = env.NODE_ENV === "test" || env.VITEST === "true" || env.APP_ENV === "test";
  if (isTestEnv) return raw;
  if (raw.length >= 32) return raw;
  return crypto
    .createHash("sha256")
    .update(raw || "chillbanana-default-mock-payment-secret-2026-tdmu")
    .digest("hex");
}
