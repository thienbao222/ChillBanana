import { afterAll, beforeEach, vi } from "vitest";
import { assertSafeTestDatabase } from "../helpers/safety";

// ── 1. Môi trường test giả lập (không phải secret thật) ─────────────────────
process.env.APP_ENV = "test";
process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-000000000000";
process.env.CUSTOMER_SESSION_SECRET = "test-customer-session-secret-0000000000";
process.env.CRON_SECRET = "test-cron-secret-0123456789abcdef";
process.env.VNPAY_TMN_CODE = "TESTTMN1";
process.env.VNPAY_HASH_SECRET = "test-vnpay-hash-secret";
process.env.VNPAY_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
process.env.PAYMENT_MODE = "sandbox";
process.env.PAYMENT_MOCK_SECRET = "test-mock-payment-secret-000000000000000000000";
process.env.EMAIL_MODE = "mock";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;

// ── 2. Chốt an toàn: test sẽ TRUNCATE toàn bộ bảng ──────────────────────────
assertSafeTestDatabase();

// ── 3. Mock dịch vụ ngoài (áp dụng cho mọi file test) ───────────────────────
vi.mock("@/lib/mailer", () => ({
  sendGuestOrderAccessEmail: vi.fn().mockResolvedValue(true),
  sendCustomerEmailVerification: vi.fn().mockResolvedValue(true),
  sendOrderCreatedEmail: vi.fn().mockResolvedValue(true),
  sendPriceApprovedEmail: vi.fn().mockResolvedValue(true),
  sendPaymentSuccessEmail: vi.fn().mockResolvedValue(true),
  sendOrderStatusUpdateEmail: vi.fn().mockResolvedValue(true),
  sendZaloTrackingNotification: vi.fn().mockResolvedValue(true),
  retryEmailLog: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/features/pricing/exchange-rate", () => ({
  fetchLiveExchangeRate: vi.fn(),
}));

import { fetchLiveExchangeRate } from "@/features/pricing/exchange-rate";
import { freshRate } from "../helpers/rate";
import { resetDb, disconnectDb } from "../helpers/db";

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(fetchLiveExchangeRate).mockResolvedValue(freshRate(170));
  await resetDb();
});

afterAll(async () => {
  await disconnectDb();
});
