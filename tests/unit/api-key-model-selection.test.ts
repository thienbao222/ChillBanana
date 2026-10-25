import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiKeyPool } from "@/lib/api-key-manager";
import { clearModelQuotaStates } from "@/lib/model-quota";

afterEach(() => {
  clearModelQuotaStates();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("PHẦN 2: ApiKeyPool.getNextKey(model) - Chọn khóa theo model", () => {
  const MODEL_FLASH = "gemini-3.8-flash";
  const MODEL_LITE = "gemini-3.5-flash-lite";

  it("Khóa 1 bị 429 hết ngày ở Flash -> getNextKey(Flash) trả khóa 2, nhưng getNextKey(Flash-Lite) vẫn dùng được khóa 1", () => {
    vi.stubEnv("TEST_KEYS_POOL", "key-alpha,key-beta");
    const pool = new ApiKeyPool("TEST_KEYS_POOL");

    // Lấy khóa 1 cho Flash
    const k1 = pool.getNextKey(MODEL_FLASH);
    expect(k1).toBe("key-alpha");

    // Khóa 1 bị 429 hết ngày ở model Flash
    pool.markModelError(k1!, MODEL_FLASH, 429, "PerDay limit reached for generate content");

    // Lượt tiếp theo gọi getNextKey(MODEL_FLASH): khóa 1 bị loại, trả khóa 2
    const k2ForFlash = pool.getNextKey(MODEL_FLASH);
    expect(k2ForFlash).toBe("key-beta");

    // Quan trọng: Gọi getNextKey(MODEL_LITE): khóa 1 (key-alpha) VẪN HOÀN TOÀN KHẢ DỤNG và được trả về!
    // (Bởi vì hạn mức là độc lập theo từng cặp khóa - model)
    const kForLite = pool.getNextKey(MODEL_LITE);
    expect(kForLite).toBe("key-alpha");
  });

  it("Khi TẤT CẢ các khóa đều hết ngày cho Flash -> getNextKey(Flash) trả null, nhưng Flash-Lite vẫn lấy được khóa", () => {
    vi.stubEnv("TEST_KEYS_POOL", "key-1,key-2");
    const pool = new ApiKeyPool("TEST_KEYS_POOL");

    // Cả 2 khóa đều bị hết ngày với Flash
    pool.markModelError("key-1", MODEL_FLASH, 429, "RequestsPerDay exceeded");
    pool.markModelError("key-2", MODEL_FLASH, 429, "RequestsPerDay exceeded");

    // Model Flash không còn khóa nào khả dụng -> trả null để vòng lặp fallback sang model kế tiếp
    expect(pool.getNextKey(MODEL_FLASH)).toBeNull();
    expect(pool.hasAvailableKeyForModel(MODEL_FLASH)).toBe(false);

    // Nhưng với Flash-Lite, cả 2 khóa vẫn sẵn sàng!
    expect(pool.hasAvailableKeyForModel(MODEL_LITE)).toBe(true);
    const liteKey1 = pool.getNextKey(MODEL_LITE);
    expect(liteKey1).toBeTruthy();
    expect(["key-1", "key-2"]).toContain(liteKey1);
  });

  it("Khóa bị 401/403 (DEAD) thì bị loại bỏ với MỌI model", () => {
    vi.stubEnv("TEST_KEYS_POOL", "key-dead,key-alive");
    const pool = new ApiKeyPool("TEST_KEYS_POOL");

    // Khóa key-dead bị 401
    pool.markModelError("key-dead", MODEL_FLASH, 401, "API_KEY_INVALID");

    // Cả Flash lẫn Flash-Lite đều không được nhận key-dead
    const fKey = pool.getNextKey(MODEL_FLASH);
    expect(fKey).toBe("key-alive");

    const lKey = pool.getNextKey(MODEL_LITE);
    expect(lKey).toBe("key-alive");
  });
});
