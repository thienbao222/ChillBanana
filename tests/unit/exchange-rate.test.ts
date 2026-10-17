import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Không để test đơn vị chạm database khi lưu ảnh chụp tỷ giá.
vi.mock("@/features/pricing/rate-snapshots", () => ({ recordExchangeRateSnapshot: vi.fn().mockResolvedValue(undefined) }));

type Responder = (url: string) => { ok: boolean; json: () => Promise<unknown> } | Error;

function stubFetch(responder: Responder) {
  const fn = vi.fn(async (input: unknown) => {
    const result = responder(String(input));
    if (result instanceof Error) throw result;
    return result;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const ok = (data: unknown) => ({ ok: true, json: async () => data });
const erApi = (rate: unknown) => ok({ rates: { VND: rate } });
const frankfurter = (usd: unknown) => ok({ rates: { USD: usd } });

// Mỗi test cần module mới vì tỷ giá được cache ở cấp module.
async function load() {
  vi.resetModules();
  return import("@/features/pricing/exchange-rate");
}

describe("fetchLiveExchangeRate", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("dùng nguồn chính khi hợp lệ", async () => {
    stubFetch((url) => (url.includes("open.er-api.com") ? erApi(171.6) : new Error("không được gọi")));
    const { fetchLiveExchangeRate } = await load();
    const r = await fetchLiveExchangeRate();
    expect(r).toMatchObject({ rate: 171.6, roundedRate: 172, source: "open.er-api.com", isFallback: false, isStale: false });
  });

  it("chuyển sang nguồn dự phòng khi nguồn chính lỗi", async () => {
    stubFetch((url) => (url.includes("open.er-api.com") ? new Error("timeout") : frankfurter(0.0065)));
    const { fetchLiveExchangeRate } = await load();
    const r = await fetchLiveExchangeRate();
    expect(r.source).toContain("frankfurter");
    expect(r.rate).toBeCloseTo(0.0065 * 25400, 1); // dùng USD/VND cố định 25.400 (xem docs/STATUS.md)
    expect(r.isStale).toBe(false);
  });

  it("bỏ qua tỷ giá ngoài khoảng hợp lý (100–300)", async () => {
    stubFetch((url) => (url.includes("open.er-api.com") ? erApi(5) : frankfurter(0.0065)));
    const { fetchLiveExchangeRate } = await load();
    expect((await fetchLiveExchangeRate()).source).toContain("frankfurter");
  });

  it("tất cả nguồn lỗi và chưa có cache: trả tỷ giá cứng, đánh dấu fallback + stale", async () => {
    stubFetch(() => new Error("mất mạng"));
    const { fetchLiveExchangeRate } = await load();
    const r = await fetchLiveExchangeRate();
    expect(r).toMatchObject({ rate: 172, isFallback: true, isStale: true });
  });

  it("dùng cache trong 10 phút, không gọi lại API", async () => {
    const fetchSpy = stubFetch(() => erApi(170));
    const { fetchLiveExchangeRate } = await load();
    await fetchLiveExchangeRate();
    await fetchLiveExchangeRate();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("khi API lỗi sau lần thành công: giữ giá cũ nhưng đánh dấu stale", async () => {
    vi.useFakeTimers();
    try {
      let healthy = true;
      stubFetch(() => (healthy ? erApi(170) : new Error("down")));
      const { fetchLiveExchangeRate } = await load();
      expect((await fetchLiveExchangeRate()).isStale).toBe(false);
      healthy = false;
      vi.advanceTimersByTime(11 * 60_000);
      const r = await fetchLiveExchangeRate();
      expect(r.rate).toBe(170);
      expect(r.isStale).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("tính phần trăm biến động và cảnh báo khi ≥ 2%", async () => {
    vi.useFakeTimers();
    try {
      let value = 170;
      stubFetch(() => erApi(value));
      const { fetchLiveExchangeRate } = await load();
      await fetchLiveExchangeRate();
      value = 175; // +2,94%
      vi.advanceTimersByTime(11 * 60_000);
      const r = await fetchLiveExchangeRate();
      expect(r.isVolatile).toBe(true);
      expect(r.changePercent).toBeCloseTo(2.94, 1);
    } finally {
      vi.useRealTimers();
    }
  });
});
