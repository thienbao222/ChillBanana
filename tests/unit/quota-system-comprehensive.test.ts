import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiKeyPool } from "@/lib/api-key-manager";
import {
  clearModelQuotaStates,
  getNextPacificMidnightMs,
  isModelAvailableForKey,
  recordModelQuotaError,
} from "@/lib/model-quota";
import {
  clearChatCache,
  getChatCache,
  isCacheableQuery,
  setChatCache,
} from "@/lib/chat-cache";
import { DEFAULT_FEATURE_MODELS, parseModelList } from "@/lib/gemini-models";

describe("PHẦN 8: Kiểm thử toàn diện hệ thống Hạn mức Quota & Fallback Model (Mock fetch)", () => {
  beforeEach(() => {
    clearModelQuotaStates();
    clearChatCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    clearModelQuotaStates();
    clearChatCache();
  });

  it("(a) 429 trên model Flash KHÔNG làm khóa nghỉ với model Flash-Lite trên cùng một key", () => {
    vi.stubEnv("TEST_KEY_A", "key-flash-lite-test");
    const pool = new ApiKeyPool("TEST_KEY_A");
    const key = pool.getNextKey("gemini-3.8-flash");
    expect(key).toBe("key-flash-lite-test");

    // Giả lập lỗi 429 PerDay cho model Flash
    pool.markModelError(
      key!,
      "gemini-3.8-flash",
      429,
      JSON.stringify({
        error: {
          message: "Quota exceeded: Resource has exhausted",
          details: [{ quotaId: "GenerateRequestsPerDayPerProject" }],
        },
      })
    );

    // Cặp (key, gemini-3.8-flash) không còn khả dụng
    expect(pool.getNextKey("gemini-3.8-flash")).toBeNull();

    // Nhưng cặp (key, gemini-3.5-flash-lite) VẪN khả dụng và trả về chính key đó!
    expect(pool.getNextKey("gemini-3.5-flash-lite")).toBe("key-flash-lite-test");
  });

  it("(b) Lượt chat tiếp theo KHÔNG gọi lại cặp (khóa, model) đã bị đánh dấu hết ngày", () => {
    vi.stubEnv("TEST_KEY_B", "key-exhausted,key-backup");
    const pool = new ApiKeyPool("TEST_KEY_B");

    // Đánh dấu key-exhausted hết ngày cho model gemini-3.8-flash
    pool.markModelError(
      "key-exhausted",
      "gemini-3.8-flash",
      429,
      "Resource has exhausted: per day quota reached"
    );

    // Lượt tiếp theo gọi getNextKey cho model đó sẽ bỏ qua key-exhausted và trả về key-backup
    const nextKey = pool.getNextKey("gemini-3.8-flash");
    expect(nextKey).toBe("key-backup");

    // Đánh dấu tiếp key-backup cũng hết ngày cho model đó
    pool.markModelError("key-backup", "gemini-3.8-flash", 429, "Daily quota exceeded");

    // Không còn khóa nào khả dụng cho model đó -> trả về null (không throw, không khóa pool)
    expect(pool.getNextKey("gemini-3.8-flash")).toBeNull();
  });

  it("(c) Lỗi 429 theo phút có Retry-After: khóa hết hiệu lực sau đúng số giây quy định", () => {
    vi.stubEnv("TEST_KEY_C", "key-minute-cooldown");
    const now = 1_700_000_000_000;

    // Lỗi 429 với Retry-After = 10s
    recordModelQuotaError(
      "key-minute-cooldown",
      "gemini-3.5-flash-lite",
      429,
      "rate limited",
      "10",
      now
    );

    // Tại thời điểm now + 5s: vẫn đang bị khóa
    expect(
      isModelAvailableForKey("key-minute-cooldown", "gemini-3.5-flash-lite", now + 5_000)
    ).toBe(false);

    // Tại thời điểm now + 10_001ms: đã hết cooldown, sẵn sàng lại
    expect(
      isModelAvailableForKey("key-minute-cooldown", "gemini-3.5-flash-lite", now + 10_001)
    ).toBe(true);
  });

  it("(d) Fallback khi toàn bộ các khóa đều hết hạn mức của model 1: chuỗi chat chuyển sang model 2 và thành công", async () => {
    vi.stubEnv("GEMINI_CHAT_KEYS", "key-all-exhausted");
    clearChatCache();

    // Giả lập key-all-exhausted đã hết hạn mức ngày của model đầu tiên (gemini-3.5-flash-lite)
    recordModelQuotaError("key-all-exhausted", "gemini-3.5-flash-lite", 429, "per day quota exceeded");

    // Mock fetch: model 2 (gemini-3.1-flash-lite) trả về 200 thành công
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "Trả lời thành công từ model 2" }] } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { askGeminiAgentDetailed } = await import("@/features/ai/customer/assistant");
    const result = await askGeminiAgentDetailed("Tư vấn chọn son", "chill");

    expect(result.mode).toBe("gemini");
    expect(result.text).toBe("Trả lời thành công từ model 2");
    expect(result.model).toBe("gemini-3.1-flash-lite");

    // Model 1 hoàn toàn bị bỏ qua không gọi fetch vì không có key khả dụng
    const calledUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(calledUrls.length).toBe(1);
    expect(calledUrls[0]).toContain("/gemini-3.1-flash-lite:generateContent");
  });

  it("(e) Ngân sách thời gian: nếu model 1 timeout hoặc chạy chậm, tổng thời gian không vượt quá và trả offline an toàn", async () => {
    vi.stubEnv("GEMINI_CHAT_KEYS", "key-budget-test");
    vi.stubEnv("CHAT_TOTAL_BUDGET_MS", "5000");
    clearChatCache();

    const timeoutErr = new DOMException("The operation was aborted due to timeout", "TimeoutError");
    const fetchMock = vi
      .fn()
      .mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(timeoutErr), 30)));
    vi.stubGlobal("fetch", fetchMock);

    const { askGeminiAgentDetailed } = await import("@/features/ai/customer/assistant");
    const startTime = Date.now();
    const result = await askGeminiAgentDetailed("Tư vấn vận chuyển", "omotenashi");
    const elapsed = Date.now() - startTime;

    expect(result.mode).toBe("offline");
    expect(elapsed).toBeLessThan(10_000);
  });

  it("(f) Reset đúng 00:00 Pacific midnight: kiểm thử cả giờ mùa hè (PDT, UTC-7) và mùa đông (PST, UTC-8)", () => {
    // 1. Giờ mùa đông (PST, UTC-8): ví dụ ngày 15/01/2026 12:00 UTC (04:00 AM PST)
    // Pacific midnight tiếp theo là 00:00 PST ngày 16/01/2026 -> tức 08:00 UTC ngày 16/01/2026
    const winterUtc = Date.UTC(2026, 0, 15, 12, 0, 0);
    const nextWinterMidnight = getNextPacificMidnightMs(winterUtc);
    const expectedWinter = Date.UTC(2026, 0, 16, 8, 0, 0);
    expect(nextWinterMidnight).toBe(expectedWinter);

    // 2. Giờ mùa hè (PDT, UTC-7): ví dụ ngày 15/07/2026 12:00 UTC (05:00 AM PDT)
    // Pacific midnight tiếp theo là 00:00 PDT ngày 16/07/2026 -> tức 07:00 UTC ngày 16/07/2026
    const summerUtc = Date.UTC(2026, 6, 15, 12, 0, 0);
    const nextSummerMidnight = getNextPacificMidnightMs(summerUtc);
    const expectedSummer = Date.UTC(2026, 6, 16, 7, 0, 0);
    expect(nextSummerMidnight).toBe(expectedSummer);
  });

  it("(g) Biến môi trường GEMINI_CHAT_MODELS: khi đặt tùy biến dùng đúng thứ tự, khi không đặt dùng mặc định", () => {
    // Khi không đặt biến môi trường -> dùng mặc định
    const defaultModels = parseModelList(undefined, DEFAULT_FEATURE_MODELS.chat);
    expect(defaultModels).toEqual(["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash"]);

    // Khi cấu hình tùy biến qua env (ví dụ chế độ Demo ưu tiên Flash 3.8)
    const customEnv = "gemini-3.8-flash, gemini-3.5-flash-lite , , gemini-3.1-flash-lite ";
    const customModels = parseModelList(customEnv, DEFAULT_FEATURE_MODELS.chat);
    expect(customModels).toEqual(["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]);
  });

  it("(h) Cache câu trả lời: câu hỏi chung lần 2 trả từ cache; câu hỏi có mã đơn 'CB-...' tuyệt đối không cache", () => {
    clearChatCache();

    // 1. Câu hỏi chung
    const query = "Chính sách bảo hành hàng điện tử Nhật Bản";
    expect(isCacheableQuery(query)).toBe(true);

    setChatCache(query, "omotenashi", "vi", {
      text: "Hàng nội địa Nhật được bảo hành tại cửa hàng mua.",
      mode: "gemini",
      model: "gemini-3.5-flash-lite",
    });

    const cached = getChatCache(query, "omotenashi", "vi");
    expect(cached).not.toBeNull();
    expect(cached?.text).toBe("Hàng nội địa Nhật được bảo hành tại cửa hàng mua.");

    // 2. Câu hỏi có mã đơn hàng CB-...
    const orderQuery = "Kiểm tra đơn hàng CB-2026-AK99-12345 đã đến kho chưa";
    expect(isCacheableQuery(orderQuery)).toBe(false);

    // Cố tình ghi cache câu có mã đơn -> setChatCache từ chối lưu
    setChatCache(orderQuery, "omotenashi", "vi", {
      text: "Đơn của bạn đang bay",
      mode: "gemini",
    });
    expect(getChatCache(orderQuery, "omotenashi", "vi")).toBeNull();

    // 3. Mã đơn VNJP-...
    const vnjpQuery = "Phiếu gửi VNJP-2026-0042 bay chuyến nào?";
    expect(isCacheableQuery(vnjpQuery)).toBe(false);
  });
});
