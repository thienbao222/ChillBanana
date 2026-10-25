/**
 * FILE: src/lib/model-quota.ts
 * Quản lý hạn mức và trạng thái cooldown theo từng cặp (API Key, Model).
 * Bộ nhớ tồn tại trong tiến trình (in-memory per serverless instance).
 */

export type QuotaLimitType = "DAILY_EXHAUSTED" | "MINUTE_RATE_LIMITED" | "DEAD" | "TEMPORARY" | "NONE";

export interface QuotaClassification {
  type: QuotaLimitType;
  cooldownUntil: number; // timestamp ms
  reason: string;
}

export interface ModelQuotaState {
  key: string;
  keyPreview: string;
  model: string;
  status: "ACTIVE" | "MINUTE_RATE_LIMITED" | "DAILY_EXHAUSTED";
  cooldownUntil: number;
  lastUpdated: number;
  reason?: string;
}

// Map lưu trạng thái theo khóa "key|model"
const quotaMap = new Map<string, ModelQuotaState>();

function pairKey(apiKey: string, model: string): string {
  return `${apiKey.trim()}|${model.trim().toLowerCase()}`;
}

export function tailKey(apiKey: string): string {
  const trimmed = (apiKey || "").trim();
  return trimmed.length > 4 ? `...${trimmed.slice(-4)}` : trimmed;
}

/**
 * Tính toán mốc 00:00:00 giờ Thái Bình Dương kế tiếp (America/Los_Angeles),
 * xử lý chính xác cả 2 mùa giờ: Giờ chuẩn mùa đông (PST - UTC-8) và Giờ mùa hè (PDT - UTC-7).
 */
export function getNextPacificMidnightMs(fromMs = Date.now()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date(fromMs));

  const m: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== "literal") {
      m[p.type] = parseInt(p.value, 10);
    }
  }

  // Ngày kế tiếp theo lịch tại Los Angeles
  const nextDay = new Date(Date.UTC(m.year, m.month - 1, m.day + 1));
  const nextY = nextDay.getUTCFullYear();
  const nextMo = nextDay.getUTCMonth() + 1;
  const nextD = nextDay.getUTCDate();

  // 00:00:00 tại America/Los_Angeles ứng với 07:00 UTC (PDT) hoặc 08:00 UTC (PST)
  for (const utcHour of [7, 8]) {
    const candidate = new Date(Date.UTC(nextY, nextMo - 1, nextD, utcHour, 0, 0, 0));
    const laParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    }).formatToParts(candidate);

    const laMap: Record<string, number> = {};
    for (const p of laParts) {
      if (p.type !== "literal") {
        laMap[p.type] = parseInt(p.value, 10);
      }
    }

    if (
      laMap.year === nextY &&
      laMap.month === nextMo &&
      laMap.day === nextD &&
      laMap.hour === 0 &&
      laMap.minute === 0
    ) {
      return candidate.getTime();
    }
  }

  return Date.UTC(nextY, nextMo - 1, nextD, 8, 0, 0, 0);
}

/**
 * Định dạng timestamp ms sang chuỗi giờ VN (HH:mm) theo múi giờ Asia/Ho_Chi_Minh.
 */
export function formatVietnamTime(ms: number): string {
  if (!ms || ms <= 0) return "--:--";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ms));
}

/**
 * Kiểm tra xem body hoặc error message từ Google Gemini có phải là hết hạn mức ngày (Daily Quota) hay không.
 */
export function isDailyQuotaError(bodyOrMessage: unknown): boolean {
  if (!bodyOrMessage) return false;
  const str = typeof bodyOrMessage === "string" ? bodyOrMessage : JSON.stringify(bodyOrMessage);
  const lower = str.toLowerCase();
  return (
    lower.includes("perday") ||
    lower.includes("per_day") ||
    lower.includes("per day") ||
    lower.includes("daily") ||
    lower.includes("requestsperday") ||
    lower.includes("day quota") ||
    lower.includes("generatecontent requests per day")
  );
}

/**
 * Phân loại lỗi HTTP và xác định thời gian cooldown chính xác.
 */
export function classifyQuotaError(
  status: number,
  bodyOrMessage?: unknown,
  retryAfterHeader?: string | number | null,
  now = Date.now()
): QuotaClassification {
  if (status === 401 || status === 403) {
    return {
      type: "DEAD",
      cooldownUntil: now + 15 * 60_000,
      reason: "API key revoked or unauthorized (HTTP 401/403)",
    };
  }

  if (status === 500 || status === 503) {
    return {
      type: "TEMPORARY",
      cooldownUntil: 0,
      reason: `Temporary model error (HTTP ${status})`,
    };
  }

  if (status === 429) {
    if (isDailyQuotaError(bodyOrMessage)) {
      const midnight = getNextPacificMidnightMs(now);
      return {
        type: "DAILY_EXHAUSTED",
        cooldownUntil: midnight,
        reason: `Daily quota exhausted until ${formatVietnamTime(midnight)} VN (${new Date(midnight).toISOString()})`,
      };
    }

    // Lỗi 429 theo phút: đọc Retry-After hoặc retryDelay (kẹp 5 - 60s, mặc định 30s)
    let seconds = 30;
    if (typeof retryAfterHeader === "number" && !isNaN(retryAfterHeader)) {
      seconds = retryAfterHeader;
    } else if (typeof retryAfterHeader === "string") {
      const parsed = parseInt(retryAfterHeader, 10);
      if (!isNaN(parsed)) seconds = parsed;
    } else if (bodyOrMessage && typeof bodyOrMessage === "object") {
      const str = JSON.stringify(bodyOrMessage);
      const m = str.match(/"retryDelay"\s*:\s*"(\d+)s?"/i);
      if (m) seconds = parseInt(m[1], 10);
    }

    seconds = Math.min(60, Math.max(5, Math.round(seconds)));
    return {
      type: "MINUTE_RATE_LIMITED",
      cooldownUntil: now + seconds * 1000,
      reason: `Minute rate limit cooldown for ${seconds}s`,
    };
  }

  return {
    type: "NONE",
    cooldownUntil: 0,
    reason: `HTTP ${status}`,
  };
}

/**
 * Ghi nhận lỗi và đặt cooldown cho đúng cặp (apiKey, model).
 */
export function recordModelQuotaError(
  apiKey: string,
  model: string,
  status: number,
  bodyOrMessage?: unknown,
  retryAfter?: string | number | null,
  now = Date.now()
): QuotaClassification {
  const classification = classifyQuotaError(status, bodyOrMessage, retryAfter, now);
  const pk = pairKey(apiKey, model);

  if (classification.type === "DAILY_EXHAUSTED" || classification.type === "MINUTE_RATE_LIMITED") {
    quotaMap.set(pk, {
      key: apiKey,
      keyPreview: tailKey(apiKey),
      model: model.toLowerCase(),
      status: classification.type,
      cooldownUntil: classification.cooldownUntil,
      lastUpdated: now,
      reason: classification.reason,
    });
  }

  return classification;
}

/**
 * Ghi nhận gọi thành công cho cặp (apiKey, model) - nếu trước đó chỉ bị rate limit theo phút thì gỡ bỏ.
 */
export function recordModelSuccess(apiKey: string, model: string, now = Date.now()): void {
  const pk = pairKey(apiKey, model);
  const current = quotaMap.get(pk);
  if (current && current.status === "MINUTE_RATE_LIMITED") {
    quotaMap.delete(pk);
  }
}

/**
 * Kiểm tra xem cặp (apiKey, model) có khả dụng tại thời điểm `now` không.
 */
export function isModelAvailableForKey(apiKey: string, model: string, now = Date.now()): boolean {
  const pk = pairKey(apiKey, model);
  const entry = quotaMap.get(pk);
  if (!entry) return true;

  if (now >= entry.cooldownUntil) {
    quotaMap.delete(pk);
    return true;
  }

  return false;
}

/**
 * Lấy trạng thái hiện tại của cặp (apiKey, model).
 */
export function getModelQuotaState(apiKey: string, model: string, now = Date.now()): ModelQuotaState {
  const pk = pairKey(apiKey, model);
  const entry = quotaMap.get(pk);
  if (!entry || now >= entry.cooldownUntil) {
    return {
      key: apiKey,
      keyPreview: tailKey(apiKey),
      model: model.toLowerCase(),
      status: "ACTIVE",
      cooldownUntil: 0,
      lastUpdated: entry?.lastUpdated || now,
    };
  }
  return entry;
}

/**
 * Trả về danh sách tất cả các cặp đang được theo dõi trạng thái hạn mức.
 */
export function getAllModelQuotaStates(now = Date.now()): ModelQuotaState[] {
  const results: ModelQuotaState[] = [];
  for (const [pk, entry] of quotaMap.entries()) {
    if (now >= entry.cooldownUntil) {
      quotaMap.delete(pk);
    } else {
      results.push(entry);
    }
  }
  return results;
}

/**
 * Xóa sạch trạng thái hạn mức trong bộ nhớ (phục vụ kiểm thử).
 */
export function clearModelQuotaStates(): void {
  quotaMap.clear();
}
