import { defineConfig } from "@playwright/test";
// E2E chạy trên bản build production thật (`next start`) với PostgreSQL cục bộ/CI.
// Dữ liệu và secret ở đây chỉ dành cho test, không phải secret thật.
import { E2E_PORT as PORT } from "./tests/helpers/http";

Object.assign(process.env, {
  APP_ENV: "test",
  TEST_FIXED_JPY_VND_RATE: "170",
  ADMIN_SESSION_SECRET: "e2e-admin-session-secret-0000000000000",
  CUSTOMER_SESSION_SECRET: "e2e-customer-session-secret-00000000000",
  CRON_SECRET: "e2e-cron-secret-0123456789abcdef",
  VNPAY_TMN_CODE: "E2ETMN01",
  VNPAY_HASH_SECRET: "e2e-vnpay-hash-secret",
  VNPAY_URL: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  PAYMENT_MODE: "sandbox",
  PAYMENT_MOCK_SECRET: "e2e-mock-payment-secret-00000000000000000000",
  EMAIL_MODE: "mock",
  NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${PORT}`,
});
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    command: `npx next start -p ${PORT} -H 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: process.env as Record<string, string>,
  },
});
