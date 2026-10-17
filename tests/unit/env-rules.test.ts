import { describe, expect, it } from "vitest";
import { validateProductionEnv } from "../../scripts/env-rules.js";
import { getAppUrl, getPaymentProviderMode } from "@/lib/env";

const good = {
  DATABASE_URL: "postgresql://x",
  ADMIN_SESSION_SECRET: "a".repeat(40),
  CUSTOMER_SESSION_SECRET: "b".repeat(40),
  CRON_SECRET: "c".repeat(40),
  NEXT_PUBLIC_APP_URL: "https://shop.example.com",
  PAYMENT_PROVIDER: "vnpay-sandbox",
  VNPAY_TMN_CODE: "T",
  VNPAY_HASH_SECRET: "S",
  VNPAY_URL: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
};

describe("validateProductionEnv (khởi động production)", () => {
  it("cấu hình đầy đủ thì không có lỗi", () => {
    expect(validateProductionEnv(good).errors).toEqual([]);
  });

  it.each(["DATABASE_URL", "ADMIN_SESSION_SECRET", "CUSTOMER_SESSION_SECRET", "CRON_SECRET", "NEXT_PUBLIC_APP_URL"])("thiếu %s thì từ chối", (key) => {
    const env: Record<string, string | undefined> = { ...good };
    delete env[key];
    expect(validateProductionEnv(env).errors.length).toBeGreaterThan(0);
  });

  it("từ chối provider mock trên production", () => {
    const r = validateProductionEnv({ ...good, PAYMENT_PROVIDER: "mock" });
    expect(r.errors.some((e) => e.includes("mock"))).toBe(true);
  });

  it("từ chối giá trị PAYMENT_PROVIDER không hợp lệ", () => {
    expect(validateProductionEnv({ ...good, PAYMENT_PROVIDER: "momo" }).errors.length).toBeGreaterThan(0);
  });

  it("từ chối APP_ENV=test, URL không https hoặc localhost", () => {
    expect(validateProductionEnv({ ...good, APP_ENV: "test" }).errors.length).toBeGreaterThan(0);
    expect(validateProductionEnv({ ...good, NEXT_PUBLIC_APP_URL: "http://shop.example.com" }).errors.length).toBeGreaterThan(0);
    expect(validateProductionEnv({ ...good, NEXT_PUBLIC_APP_URL: "https://localhost:3000" }).errors.length).toBeGreaterThan(0);
  });

  it("chế độ và địa chỉ VNPAY phải khớp nhau (tránh nhận tiền thật khi chạy thử)", () => {
    expect(validateProductionEnv({ ...good, PAYMENT_PROVIDER: "vnpay-live" }).errors.length).toBeGreaterThan(0);
    expect(validateProductionEnv({ ...good, VNPAY_URL: "https://pay.vnpay.vn/vpcpay.html" }).errors.length).toBeGreaterThan(0);
    expect(validateProductionEnv({ ...good, PAYMENT_PROVIDER: "vnpay-live", VNPAY_URL: "https://pay.vnpay.vn/vpcpay.html" }).errors).toEqual([]);
  });

  it("chỉ cảnh báo (không chặn) khi thiếu cấu hình VNPAY hoặc còn ADMIN_INITIAL_PASSWORD", () => {
    const r = validateProductionEnv({ ...good, VNPAY_TMN_CODE: undefined, ADMIN_INITIAL_PASSWORD: "x", ADMIN_SESSION_SECRET: "ngan" });
    expect(r.errors).toEqual([]);
    expect(r.warnings.length).toBeGreaterThanOrEqual(3);
  });
});

describe("getPaymentProviderMode", () => {
  it("mặc định vnpay-sandbox", () => {
    expect(getPaymentProviderMode({})).toBe("vnpay-sandbox");
  });
  it("nhận mock ngoài production, từ chối mock trên production", () => {
    expect(getPaymentProviderMode({ PAYMENT_PROVIDER: "mock" })).toBe("mock");
    expect(() => getPaymentProviderMode({ PAYMENT_PROVIDER: "mock", VERCEL_ENV: "production" })).toThrow(/production/);
  });
  it("giá trị lạ thì báo lỗi rõ ràng", () => {
    expect(() => getPaymentProviderMode({ PAYMENT_PROVIDER: "paypal" })).toThrow(/không hợp lệ/);
  });
});

describe("getAppUrl", () => {
  it("dùng APP_URL rồi NEXT_PUBLIC_APP_URL, bỏ dấu / cuối", () => {
    expect(getAppUrl({ APP_URL: "https://a.example/" })).toBe("https://a.example");
    expect(getAppUrl({ NEXT_PUBLIC_APP_URL: "https://b.example//" })).toBe("https://b.example");
  });
  it("local dev dùng localhost; production không có biến thì báo lỗi (không dùng domain mặc định)", () => {
    expect(getAppUrl({ NODE_ENV: "development" })).toBe("http://localhost:3000");
    expect(() => getAppUrl({ NODE_ENV: "production" })).toThrow(/NEXT_PUBLIC_APP_URL/);
  });
});
