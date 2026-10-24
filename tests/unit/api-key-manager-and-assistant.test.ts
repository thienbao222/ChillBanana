import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiKeyPool } from "@/lib/api-key-manager";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("ApiKeyPool Error Classification & Cooldowns", () => {
  it("HTTP 429: cooldown khóa theo Retry-After (tối thiểu 5s, tối đa 60s, mặc định 30s)", () => {
    vi.stubEnv("TEST_KEYS_429", "key-429-1,key-429-2");
    const pool = new ApiKeyPool("TEST_KEYS_429");
    const k1 = pool.getNextKey()!;
    expect(k1).toBe("key-429-1");

    // Test mặc định: không có retry-after -> 30s
    const beforeDef = Date.now();
    pool.markError(k1, 429);
    const s1 = pool.getStatus().find((s) => s.keyPreview.endsWith(k1.slice(-8)))!;
    expect(s1.status).toBe("RATE_LIMITED");
    expect(s1.cooldownUntil).toBeGreaterThanOrEqual(beforeDef + 29_000);
    expect(s1.cooldownUntil).toBeLessThanOrEqual(beforeDef + 31_000);

    // Test có retry-after = 10s
    const k2 = pool.getNextKey()!;
    expect(k2).toBe("key-429-2");
    const before10 = Date.now();
    pool.markError(k2, 429, "gemini-3.5-flash", 10);
    const s2 = pool.getStatus().find((s) => s.keyPreview.endsWith(k2.slice(-8)))!;
    expect(s2.status).toBe("RATE_LIMITED");
    expect(s2.cooldownUntil).toBeGreaterThanOrEqual(before10 + 9_000);
    expect(s2.cooldownUntil).toBeLessThanOrEqual(before10 + 11_000);

    // Test kẹp tối thiểu 5s (khi retry-after = 2s)
    vi.stubEnv("TEST_KEYS_MINMAX", "key-min,key-max");
    const poolMinMax = new ApiKeyPool("TEST_KEYS_MINMAX");
    const kMin = poolMinMax.getNextKey()!;
    const beforeMin = Date.now();
    poolMinMax.markError(kMin, 429, "gemini-3.5-flash", 2);
    const sMin = poolMinMax.getStatus().find((s) => s.keyPreview.endsWith(kMin.slice(-8)))!;
    expect(sMin.cooldownUntil).toBeGreaterThanOrEqual(beforeMin + 4_900);
    expect(sMin.cooldownUntil).toBeLessThanOrEqual(beforeMin + 5_500);

    // Test kẹp tối đa 60s (khi retry-after = 120s)
    const kMax = poolMinMax.getNextKey()!;
    const beforeMax = Date.now();
    poolMinMax.markError(kMax, 429, "gemini-3.5-flash", 120);
    const sMax = poolMinMax.getStatus().find((s) => s.keyPreview.endsWith(kMax.slice(-8)))!;
    expect(sMax.cooldownUntil).toBeGreaterThanOrEqual(beforeMax + 59_000);
    expect(sMax.cooldownUntil).toBeLessThanOrEqual(beforeMax + 61_000);
  });

  it("HTTP 500 / 503: lỗi tạm thời của model, KHÔNG cooldown khóa", () => {
    vi.stubEnv("TEST_KEYS_503", "key-503-test");
    const pool = new ApiKeyPool("TEST_KEYS_503");
    const key = pool.getNextKey()!;
    expect(key).toBe("key-503-test");

    pool.markError(key, 503, "gemini-3.5-flash");
    const status503 = pool.getStatus()[0];
    expect(status503.status).toBe("ACTIVE");
    expect(status503.cooldownUntil).toBe(0);

    pool.markError(key, 500, "gemini-3.5-flash");
    const status500 = pool.getStatus()[0];
    expect(status500.status).toBe("ACTIVE");
    expect(status500.cooldownUntil).toBe(0);

    // Key vẫn tiếp tục lấy được bình thường
    expect(pool.getNextKey()).toBe("key-503-test");
  });
});

describe("Assistant Fault Tolerance & Model Chain", () => {
  it("HTTP 503: thử lại cùng model 1 lần -> nếu vẫn lỗi thì chuyển model kế tiếp thành công", async () => {
    vi.resetModules();
    vi.stubEnv("GEMINI_CHAT_KEYS", "test-chat-key-503");

    // Model 1 (gemini-3.5-flash) gặp 503 lần 1
    // Model 1 retry gặp 503 lần 2
    // Model 2 (gemini-3.6-flash) thành công 200
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("Service Unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response("Service Unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: "Trả lời từ model dự phòng 3.6-flash" }] } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));

    vi.stubGlobal("fetch", fetchMock);

    const { askGeminiAgentDetailed } = await import("@/features/ai/customer/assistant");
    const result = await askGeminiAgentDetailed("Tư vấn sản phẩm", "omotenashi");

    expect(result.mode).toBe("gemini");
    expect(result.text).toBe("Trả lời từ model dự phòng 3.6-flash");
    expect(result.model).toBe("gemini-3.6-flash");

    const calledUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(calledUrls.length).toBe(3);
    expect(calledUrls[0]).toContain("/gemini-3.5-flash:generateContent");
    expect(calledUrls[1]).toContain("/gemini-3.5-flash:generateContent"); // retry cùng model 1
    expect(calledUrls[2]).toContain("/gemini-3.6-flash:generateContent"); // chuyển sang model 2
  });

  it("Timeout ở model 1 -> KHÔNG cooldown khóa -> model 2 trả lời được", async () => {
    vi.resetModules();
    vi.stubEnv("GEMINI_CHAT_KEYS", "test-chat-key-timeout");

    // Model 1 bị timeout (AbortError)
    // Model 2 thành công 200
    const timeoutErr = new DOMException("The operation was aborted due to timeout", "TimeoutError");
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(timeoutErr)
      .mockResolvedValueOnce(new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: "Trả lời sau khi model 1 timeout" }] } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));

    vi.stubGlobal("fetch", fetchMock);

    const { askGeminiAgentDetailed } = await import("@/features/ai/customer/assistant");
    const result = await askGeminiAgentDetailed("Hỏi giá hàng", "chill");

    expect(result.mode).toBe("gemini");
    expect(result.text).toBe("Trả lời sau khi model 1 timeout");
    expect(result.model).toBe("gemini-3.6-flash");

    const calledUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(calledUrls.length).toBe(2);
    expect(calledUrls[0]).toContain("/gemini-3.5-flash:generateContent");
    expect(calledUrls[1]).toContain("/gemini-3.6-flash:generateContent");
  });
});
