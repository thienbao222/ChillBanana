import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAdminSessionToken,
  createAdminSessionTokenWithRole,
  createCustomerEmailVerificationToken,
  createCustomerSessionToken,
  createGuestOrderAccessToken,
  hasGuestOrderAccessForEmail,
  verifyAdminSessionToken,
  verifyAdminSessionTokenFull,
  verifyCustomerEmailVerificationToken,
  verifyCustomerSessionToken,
  verifyGuestOrderAccessToken,
} from "@/lib/auth-session";

describe("auth-session unit tests", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "test-admin-secret-key-1234567890123456");
    vi.stubEnv("CUSTOMER_SESSION_SECRET", "test-customer-secret-key-1234567890123456");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("Admin Session Tokens & RBAC", () => {
    it("tạo và xác minh token Admin hợp lệ", () => {
      const token = createAdminSessionToken("admin_cb");
      const result = verifyAdminSessionToken(token);
      expect(result.valid).toBe(true);
      expect(result.username).toBe("admin_cb");
    });

    it("từ chối token Admin khi bị chỉnh sửa chữ ký hoặc payload", () => {
      const token = createAdminSessionToken("admin_cb");
      const parts = Buffer.from(token, "base64").toString("utf-8").split("::");
      const tamperedPayload = JSON.stringify({ username: "super_hacker", exp: Date.now() + 100_000 });
      const tamperedToken = Buffer.from(`${tamperedPayload}::${parts[1]}`).toString("base64");

      expect(verifyAdminSessionToken(tamperedToken).valid).toBe(false);
      expect(verifyAdminSessionToken(`${token}invalid`).valid).toBe(false);
      expect(verifyAdminSessionToken("not-a-token").valid).toBe(false);
    });

    it("từ chối token Admin đã hết hạn", () => {
      vi.useFakeTimers();
      try {
        const token = createAdminSessionToken("admin_cb");
        // Token có hạn 7 ngày, tua tới ngày thứ 8
        vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);
        expect(verifyAdminSessionToken(token).valid).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it("phân quyền SUPER_ADMIN và OPERATOR chính xác với verifyAdminSessionTokenFull", () => {
      const superToken = createAdminSessionTokenWithRole("boss", "SUPER_ADMIN");
      const opToken = createAdminSessionTokenWithRole("staff1", "OPERATOR");
      const fallbackToken = createAdminSessionTokenWithRole("guest_admin", "UNKNOWN_ROLE");

      const superVerified = verifyAdminSessionTokenFull(superToken);
      expect(superVerified.valid).toBe(true);
      expect(superVerified.role).toBe("SUPER_ADMIN");
      expect(superVerified.username).toBe("boss");

      const opVerified = verifyAdminSessionTokenFull(opToken);
      expect(opVerified.valid).toBe(true);
      expect(opVerified.role).toBe("OPERATOR");
      expect(opVerified.username).toBe("staff1");

      const fallbackVerified = verifyAdminSessionTokenFull(fallbackToken);
      expect(fallbackVerified.role).toBe("SUPER_ADMIN");
    });
  });

  describe("Customer Session & Verification Tokens", () => {
    it("tạo và xác minh token Customer hợp lệ", () => {
      const token = createCustomerSessionToken({ id: "cust_123", email: "khach@chillbanana.vn" });
      const res = verifyCustomerSessionToken(token);
      expect(res).not.toBeNull();
      expect(res?.id).toBe("cust_123");
      expect(res?.email).toBe("khach@chillbanana.vn");
    });

    it("từ chối token Customer khi bị can thiệp dữ liệu", () => {
      const token = createCustomerSessionToken({ id: "cust_123", email: "khach@chillbanana.vn" });
      expect(verifyCustomerSessionToken(`${token}corrupted`)).toBeNull();
      expect(verifyCustomerSessionToken("")).toBeNull();
    });

    it("tạo và xác minh token xác thực Email (chỉ dùng cho purpose verify-email)", () => {
      const token = createCustomerEmailVerificationToken({ id: "cust_123", email: "khach@chillbanana.vn" });
      const res = verifyCustomerEmailVerificationToken(token);
      expect(res).not.toBeNull();
      expect(res?.email).toBe("khach@chillbanana.vn");

      // Không dùng lẫn token email verification cho customer session
      expect(verifyCustomerSessionToken(token)).toBeNull();
    });

    it("từ chối token Email verification khi hết hạn (sau 24h)", () => {
      vi.useFakeTimers();
      try {
        const token = createCustomerEmailVerificationToken({ id: "cust_123", email: "khach@chillbanana.vn" });
        vi.advanceTimersByTime(25 * 60 * 60 * 1000);
        expect(verifyCustomerEmailVerificationToken(token)).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("Guest Order Access Tokens (Bảo mật tra cứu đơn vãng lai)", () => {
    const orderCode = "CB-2026-ABCD-123456";
    const email = "guest@example.com";

    it("cấp quyền tra cứu khi đúng mã đơn và email", () => {
      const token = createGuestOrderAccessToken(orderCode, email);
      expect(verifyGuestOrderAccessToken(token)).not.toBeNull();
      expect(hasGuestOrderAccessForEmail(token, orderCode, email)).toBe(true);
    });

    it("chuẩn hóa email không phân biệt chữ hoa thường khi so khớp", () => {
      const token = createGuestOrderAccessToken(orderCode, email);
      expect(hasGuestOrderAccessForEmail(token, orderCode, "GUEST@EXAMPLE.COM")).toBe(true);
      expect(hasGuestOrderAccessForEmail(token, orderCode, "  guest@example.com  ")).toBe(true);
    });

    it("từ chối khi sai email hoặc sai mã đơn", () => {
      const token = createGuestOrderAccessToken(orderCode, email);
      expect(hasGuestOrderAccessForEmail(token, orderCode, "another@example.com")).toBe(false);
      expect(hasGuestOrderAccessForEmail(token, "CB-2026-FAKE-999999", email)).toBe(false);
    });

    it("từ chối token khách khi bị giả mạo", () => {
      const token = createGuestOrderAccessToken(orderCode, email);
      expect(hasGuestOrderAccessForEmail(`${token}tampered`, orderCode, email)).toBe(false);
      expect(hasGuestOrderAccessForEmail(null, orderCode, email)).toBe(false);
      expect(hasGuestOrderAccessForEmail(undefined, orderCode, email)).toBe(false);
    });

    it("từ chối token tra cứu khách vãng lai sau 7 ngày", () => {
      vi.useFakeTimers();
      try {
        const token = createGuestOrderAccessToken(orderCode, email);
        vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);
        expect(hasGuestOrderAccessForEmail(token, orderCode, email)).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
