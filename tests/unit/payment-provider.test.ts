import { afterEach, describe, expect, it } from "vitest";
import { resolvePaymentMode } from "@/features/payments/provider";
import { createMockPaymentAttemptToken, verifyMockPaymentAttemptToken } from "@/features/payments/mock-provider";

describe("payment provider mode safety", () => {
  it("defaults to local mock even if sandbox URL credentials are present", () => {
    expect(resolvePaymentMode({
      VNPAY_URL: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
      VNPAY_TMN_CODE: "configured",
      VNPAY_HASH_SECRET: "configured",
    } as NodeJS.ProcessEnv)).toBe("mock");
  });

  it("enables VNPAY only when sandbox is explicitly selected and URL is allowlisted", () => {
    expect(resolvePaymentMode({ PAYMENT_MODE: "sandbox", VNPAY_URL: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html" } as NodeJS.ProcessEnv)).toBe("sandbox");
    expect(resolvePaymentMode({ PAYMENT_MODE: "sandbox", VNPAY_URL: "https://vnpayment.vn/paymentv2/vpcpay.html" } as NodeJS.ProcessEnv)).toBe("misconfigured");
    expect(resolvePaymentMode({ PAYMENT_MODE: "sandbox", VNPAY_URL: "http://sandbox.vnpayment.vn/paymentv2/vpcpay.html" } as NodeJS.ProcessEnv)).toBe("misconfigured");
  });

  it("always blocks live mode", () => {
    expect(resolvePaymentMode({ PAYMENT_MODE: "live", VNPAY_URL: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html" } as NodeJS.ProcessEnv)).toBe("blocked-live");
  });
});

describe("mock payment attempt tokens", () => {
  const savedSecret = process.env.PAYMENT_MOCK_SECRET;
  afterEach(() => {
    if (savedSecret === undefined) delete process.env.PAYMENT_MOCK_SECRET;
    else process.env.PAYMENT_MOCK_SECRET = savedSecret;
  });

  it("signs an expiring attempt token and rejects tampering", () => {
    process.env.PAYMENT_MOCK_SECRET = "unit-test-mock-payment-secret-1234567890";
    const token = createMockPaymentAttemptToken("attempt-123", new Date(Date.now() + 60_000));
    expect(verifyMockPaymentAttemptToken(token)?.attemptId).toBe("attempt-123");
    expect(verifyMockPaymentAttemptToken(`${token}x`)).toBeNull();
  });

  it("rejects an expired token", () => {
    process.env.PAYMENT_MOCK_SECRET = "unit-test-mock-payment-secret-1234567890";
    const token = createMockPaymentAttemptToken("attempt-123", new Date(Date.now() + 1_000));
    expect(verifyMockPaymentAttemptToken(token, Date.now() + 2_000)).toBeNull();
  });
});
