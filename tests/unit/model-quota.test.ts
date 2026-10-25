import { describe, it, expect, beforeEach } from "vitest";
import {
  classifyQuotaError,
  recordModelQuotaError,
  recordModelSuccess,
  isModelAvailableForKey,
  getNextPacificMidnightMs,
  formatVietnamTime,
  clearModelQuotaStates,
} from "@/lib/model-quota";

describe("PHẦN 1: Model Quota Manager (Hạn mức theo cặp khóa - model)", () => {
  beforeEach(() => {
    clearModelQuotaStates();
  });

  describe("Phân loại lỗi HTTP 429: Hết ngày vs Hết phút", () => {
    it("Nhận diện 429 hết NGÀY khi error.details / violations chứa 'PerDay' hoặc 'per day'", () => {
      const dailyErrorBody = {
        error: {
          code: 429,
          message: "Quota exceeded for quota metric 'GenerateContent requests per day'",
          status: "RESOURCE_EXHAUSTED",
          details: [
            {
              "@type": "type.googleapis.com/google.rpc.QuotaFailure",
              violations: [{ description: "RequestsPerDay limit exceeded" }],
            },
          ],
        },
      };

      const result = classifyQuotaError(429, dailyErrorBody);
      expect(result.type).toBe("DAILY_EXHAUSTED");
      expect(result.cooldownUntil).toBeGreaterThan(Date.now());
      expect(result.reason).toContain("Daily quota exhausted");
    });

    it("Nhận diện 429 hết PHÚT và kẹp thời gian cooldown từ 5s đến 60s (mặc định 30s)", () => {
      // Mặc định không có Retry-After -> 30s
      const resDefault = classifyQuotaError(429, "Rate limit exceeded");
      expect(resDefault.type).toBe("MINUTE_RATE_LIMITED");
      expect(resDefault.cooldownUntil - Date.now()).toBeCloseTo(30_000, -3);

      // Retry-After = 10s
      const res10 = classifyQuotaError(429, "Rate limit exceeded", "10");
      expect(res10.cooldownUntil - Date.now()).toBeCloseTo(10_000, -3);

      // Kẹp tối thiểu 5s nếu Retry-After quá nhỏ (ví dụ 1s)
      const resMin = classifyQuotaError(429, "Rate limit exceeded", 1);
      expect(resMin.cooldownUntil - Date.now()).toBeCloseTo(5_000, -3);

      // Kẹp tối đa 60s nếu Retry-After quá lớn (ví dụ 120s)
      const resMax = classifyQuotaError(429, "Rate limit exceeded", 120);
      expect(resMax.cooldownUntil - Date.now()).toBeCloseTo(60_000, -3);

      // Đọc retryDelay từ body json
      const resDelay = classifyQuotaError(429, { details: [{ retryDelay: "45s" }] });
      expect(resDelay.cooldownUntil - Date.now()).toBeCloseTo(45_000, -3);
    });
  });

  describe("Phân loại các lỗi khác: 500, 503, 401, 403", () => {
    it("500 / 503 là lỗi tạm thời, cooldown = 0 (KHÔNG khóa key)", () => {
      const res503 = classifyQuotaError(503, "Service Unavailable");
      expect(res503.type).toBe("TEMPORARY");
      expect(res503.cooldownUntil).toBe(0);

      const res500 = classifyQuotaError(500, "Internal Server Error");
      expect(res500.type).toBe("TEMPORARY");
      expect(res500.cooldownUntil).toBe(0);
    });

    it("401 / 403 đánh dấu DEAD với cooldown 15 phút", () => {
      const res401 = classifyQuotaError(401, "API_KEY_INVALID");
      expect(res401.type).toBe("DEAD");
      expect(res401.cooldownUntil - Date.now()).toBeCloseTo(15 * 60_000, -3);

      const res403 = classifyQuotaError(403, "PERMISSION_DENIED");
      expect(res403.type).toBe("DEAD");
    });
  });

  describe("Tính toán mốc reset 00:00 Pacific Midnight (Mùa đông PST vs Mùa hè PDT)", () => {
    it("Mùa đông (PST - UTC-8): Reset tại 08:00:00 UTC", () => {
      // 2026-01-15T12:00:00Z -> ngày kế tiếp tại LA là 2026-01-16
      const winterTime = new Date("2026-01-15T12:00:00Z").getTime();
      const nextMidnight = getNextPacificMidnightMs(winterTime);
      const iso = new Date(nextMidnight).toISOString();
      expect(iso).toBe("2026-01-16T08:00:00.000Z");

      // Giờ tại Los Angeles phải là đúng 12:00:00 AM (00:00)
      const laStr = new Date(nextMidnight).toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
      expect(laStr).toContain("12:00:00 AM");
    });

    it("Mùa hè (PDT - UTC-7): Reset tại 07:00:00 UTC", () => {
      // 2026-07-15T12:00:00Z -> ngày kế tiếp tại LA là 2026-07-16
      const summerTime = new Date("2026-07-15T12:00:00Z").getTime();
      const nextMidnight = getNextPacificMidnightMs(summerTime);
      const iso = new Date(nextMidnight).toISOString();
      expect(iso).toBe("2026-07-16T07:00:00.000Z");

      const laStr = new Date(nextMidnight).toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
      expect(laStr).toContain("12:00:00 AM");
    });

    it("formatVietnamTime định dạng đúng giờ phút VN", () => {
      const utcTime = new Date("2026-01-16T08:00:00.000Z").getTime();
      // 08:00 UTC = 15:00 VN
      expect(formatVietnamTime(utcTime)).toBe("15:00");
    });
  });

  describe("Hạn mức độc lập theo cặp (Khóa, Model)", () => {
    const KEY_A = "AIzaSyKeyA11111111111111111111111111111";
    const MODEL_FLASH = "gemini-3.8-flash";
    const MODEL_LITE = "gemini-3.5-flash-lite";

    it("Khóa A bị 429 hết ngày ở Flash nhưng vẫn HOÀN TOÀN KHẢ DỤNG ở Flash-Lite", () => {
      // Ban đầu cả 2 model đều khả dụng
      expect(isModelAvailableForKey(KEY_A, MODEL_FLASH)).toBe(true);
      expect(isModelAvailableForKey(KEY_A, MODEL_LITE)).toBe(true);

      // Model Flash bị hết ngày
      recordModelQuotaError(KEY_A, MODEL_FLASH, 429, "PerDay limit reached");

      // MODEL_FLASH bị khóa
      expect(isModelAvailableForKey(KEY_A, MODEL_FLASH)).toBe(false);

      // MODEL_LITE trên cùng KEY_A vẫn khả dụng 100%!
      expect(isModelAvailableForKey(KEY_A, MODEL_LITE)).toBe(true);
    });

    it("429 hết phút tự động mở khóa sau khi hết thời gian cooldown", () => {
      const now = Date.now();
      // Rate limit 10 giây
      recordModelQuotaError(KEY_A, MODEL_FLASH, 429, "Rate limit", 10, now);

      expect(isModelAvailableForKey(KEY_A, MODEL_FLASH, now)).toBe(false);
      expect(isModelAvailableForKey(KEY_A, MODEL_FLASH, now + 5_000)).toBe(false);
      // Sau 10 giây -> khả dụng trở lại
      expect(isModelAvailableForKey(KEY_A, MODEL_FLASH, now + 11_000)).toBe(true);
    });

    it("recordModelSuccess gỡ bỏ rate limit theo phút nếu gọi thành công", () => {
      recordModelQuotaError(KEY_A, MODEL_FLASH, 429, "Rate limit", 30);
      expect(isModelAvailableForKey(KEY_A, MODEL_FLASH)).toBe(false);

      // Gọi thành công
      recordModelSuccess(KEY_A, MODEL_FLASH);
      expect(isModelAvailableForKey(KEY_A, MODEL_FLASH)).toBe(true);
    });
  });
});
