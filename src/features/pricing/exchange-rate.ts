// Module Quản lý Tỷ Giá Thời Gian Thực Tế (Live Exchange Rate Engine)
// Nâng cấp Agent 1.2: Multi-source fallback (3 nguồn) + Volatility Alert
import { getCurrentPricingConfig } from "@/features/pricing/config";
import { DEFAULT_PRICING_CONFIG } from "@/features/pricing/calculator";

export interface LiveRateData {
  rate: number;          // Tỷ giá JPY -> VND (VD: 171.8)
  roundedRate: number;   // Làm tròn số nguyên (VD: 172)
  previousRate: number;  // Tỷ giá trước đó để tính biến động
  changePercent: number; // % Tăng giảm
  updatedAt: string;     // Thời điểm cập nhật
  source: string;        // Nguồn dữ liệu (Ngân hàng / Open Exchange API)
  isFallback: boolean;
  isStale: boolean;
  isVolatile?: boolean;  // true nếu biến động >= VOLATILITY_THRESHOLD_PERCENT trong chu kỳ
}

const FALLBACK_RATE: LiveRateData = {
  rate: DEFAULT_PRICING_CONFIG.fallbackJpyVndRate,
  roundedRate: DEFAULT_PRICING_CONFIG.fallbackJpyVndRate,
  previousRate: DEFAULT_PRICING_CONFIG.fallbackJpyVndRate,
  changePercent: 0,
  updatedAt: "",
  source: "Tỷ giá tham chiếu mặc định",
  isFallback: true,
  isStale: true,
  isVolatile: false,
};

let cachedRate: LiveRateData = FALLBACK_RATE;
let lastFetchTime = 0;
let lastFetchSucceeded = false;
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 phút

// Ngưỡng biến động tỷ giá cần cảnh báo Admin (2%)
const VOLATILITY_THRESHOLD_PERCENT = 2;

/**
 * Kiểm tra và ghi log cảnh báo khi tỷ giá biến động mạnh.
 * Trả về true nếu đang trong tình trạng volatile.
 * TODO Nhóm 2: Mở rộng → gửi email admin hoặc webhook Zalo OA.
 */
function checkVolatilityAlert(newRate: number, oldRate: number): boolean {
  if (oldRate <= 0) return false;
  const changePct = Math.abs(((newRate - oldRate) / oldRate) * 100);
  if (changePct >= VOLATILITY_THRESHOLD_PERCENT) {
    const direction = newRate > oldRate ? "TĂNG" : "GIẢM";
    console.warn(
      `[ExchangeRate] ⚠️ BIẾN ĐỘNG MẠNH: JPY/VND ${direction} ${changePct.toFixed(2)}% ` +
        `(${oldRate} → ${newRate}). Kiểm tra lại phí dịch vụ nếu cần.`
    );
    return true;
  }
  return false;
}

/**
 * Nguồn 1 (Ưu tiên): open.er-api.com
 * Cập nhật thường xuyên, miễn phí, độ trễ thấp — nguồn chính hiện tại.
 */
async function fetchFromOpenErApi(): Promise<number | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/JPY", {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rate = data?.rates?.VND;
    if (typeof rate === "number" && rate > 100 && rate < 300) return rate;
  } catch {
    // Ignore, thử nguồn tiếp theo
  }
  return null;
}

/**
 * Nguồn 2 (Dự phòng): Frankfurter API (dữ liệu ECB - Ngân hàng Trung ương Châu Âu)
 * JPY/VND không trực tiếp → cross rate qua JPY/USD × USD/VND tham chiếu.
 * Độ chính xác thấp hơn một chút nhưng rất ổn định, không rate-limit.
 */
async function fetchFromFrankfurter(usdToVnd: number): Promise<number | null> {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=JPY&to=USD", {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const jpyToUsd: unknown = data?.rates?.USD;
    if (typeof jpyToUsd !== "number" || jpyToUsd <= 0) return null;
    const rate = jpyToUsd * usdToVnd;
    if (rate > 100 && rate < 300) return rate;
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Nguồn 3 (Sàn cứng — Floor Rate): Tỷ giá tham chiếu cập nhật thủ công.
 * Chỉ dùng khi cả 2 API trên đều không kết nối được.
 * Cập nhật con số này nếu tỷ giá thực tế lệch > 5% so với giá trị này.
 */
/**
 * Chỉ dùng cho kiểm thử tự động (E2E): khi APP_ENV=test và có TEST_FIXED_JPY_VND_RATE thì
 * trả tỷ giá cố định, không gọi API ngoài. Tuyệt đối bị bỏ qua trên Vercel production.
 * Sẽ được thay bằng lớp provider mock/sandbox/live ở Giai đoạn 3.
 */
function getTestFixedRate(): LiveRateData | null {
  if (process.env.APP_ENV !== "test" || process.env.VERCEL_ENV === "production") return null;
  const fixed = Number(process.env.TEST_FIXED_JPY_VND_RATE);
  if (!Number.isFinite(fixed) || fixed <= 0) return null;
  return {
    rate: fixed,
    roundedRate: Math.round(fixed),
    previousRate: fixed,
    changePercent: 0,
    updatedAt: new Date().toISOString(),
    source: "test-fixed-rate",
    isFallback: false,
    isStale: false,
    isVolatile: false,
  };
}

export async function fetchLiveExchangeRate(): Promise<LiveRateData> {
  const testRate = getTestFixedRate();
  if (testRate) return testRate;

  const now = Date.now();
  if (now - lastFetchTime < CACHE_DURATION_MS && cachedRate.rate > 0) {
    return { ...cachedRate, isStale: !lastFetchSucceeded };
  }

  let pricing = DEFAULT_PRICING_CONFIG;
  try {
    pricing = (await getCurrentPricingConfig()).values;
  } catch (error) {
    console.warn("[ExchangeRate] Không đọc được cấu hình giá; dùng tỷ giá dự phòng mặc định.", error);
  }

  // Thử lần lượt từng nguồn theo thứ tự ưu tiên
  const sources: { name: string; fetch: () => Promise<number | null> }[] = [
    { name: "open.er-api.com", fetch: fetchFromOpenErApi },
    { name: "frankfurter.app (ECB) × USD/VND cấu hình", fetch: () => fetchFromFrankfurter(pricing.usdVndReferenceRate) },
  ];

  for (const source of sources) {
    const rawRate = await source.fetch();
    if (rawRate !== null) {
      const rounded = Math.round(rawRate);
      // A hard-coded fallback is not a historical market quote. On a cold
      // start, report no change until a real previous API quote exists.
      const hasPreviousLiveRate = !cachedRate.isFallback && cachedRate.rate > 0;
      const change = hasPreviousLiveRate
        ? Number((((rawRate - cachedRate.rate) / cachedRate.rate) * 100).toFixed(2))
        : 0;

      const isVolatile = hasPreviousLiveRate
        ? checkVolatilityAlert(rawRate, cachedRate.rate)
        : false;

      cachedRate = {
        rate: Number(rawRate.toFixed(2)),
        roundedRate: rounded,
        previousRate: hasPreviousLiveRate ? cachedRate.rate : rawRate,
        changePercent: change,
        updatedAt: new Date().toISOString(),
        source: source.name,
        isFallback: false,
        isStale: false,
        isVolatile,
      };
      lastFetchTime = now;
      lastFetchSucceeded = true;
      return cachedRate;
    }
  }

  // Tất cả API đều thất bại
  console.warn("[ExchangeRate] Tất cả nguồn tỷ giá thất bại, dùng tỷ giá dự phòng.");
  lastFetchTime = now;
  lastFetchSucceeded = false;

  // Nếu còn cache hợp lệ từ lần trước → dùng lại, đánh dấu stale
  if (cachedRate.rate > 0 && !cachedRate.isFallback) {
    return { ...cachedRate, isStale: true };
  }

  // Hoàn toàn không có dữ liệu → floor rate hardcoded
  const floorRate = pricing.fallbackJpyVndRate;
  cachedRate = {
    ...FALLBACK_RATE,
    rate: floorRate,
    roundedRate: floorRate,
    updatedAt: new Date().toISOString(),
    source: "Tỷ giá dự phòng theo cấu hình",
  };
  return { ...cachedRate, isStale: true };
}
