/**
 * system-config.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Đọc cấu hình hệ thống từ bảng SystemConfig trong DB.
 * Có cache in-memory TTL 5 phút để giảm số lần query DB.
 *
 * Các key được định nghĩa sẵn (với giá trị mặc định dự phòng):
 *   - service_fee_percent          : Tỷ lệ phí mua hộ (%) — mặc định 4
 *   - min_service_fee_vnd          : Phí mua hộ tối thiểu (VND) — mặc định 20000
 *   - air_shipping_per_kg_vnd      : Cước hàng không /kg (VND) — mặc định 185000
 *   - group_buy_discount_percent   : Giảm cước khi gộp đơn (%) — mặc định 25
 *   - floor_exchange_rate_jpy      : Tỷ giá sàn an toàn JPY/VND — mặc định 172
 *   - min_order_threshold_vnd      : Giá trị đơn tối thiểu (VND) — mặc định 300000
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { prisma } from "@/lib/prisma";
import { invalidatePricingConfigCache } from "@/features/pricing/config";

// ─────────────────────────────────────────────────────────────────────────────
// Kiểu và giá trị mặc định
// ─────────────────────────────────────────────────────────────────────────────

export interface SystemConfigMap {
  service_fee_percent: number;         // %
  min_service_fee_vnd: number;         // VND
  air_shipping_per_kg_vnd: number;     // VND/kg
  group_buy_discount_percent: number;  // %
  floor_exchange_rate_jpy: number;     // VND / 1 JPY
  min_order_threshold_vnd: number;     // VND
}

/** Giá trị mặc định — dùng khi DB chưa có row tương ứng (seed chưa chạy, hoặc dev chưa set). */
export const SYSTEM_CONFIG_DEFAULTS: SystemConfigMap = {
  service_fee_percent: 4,
  min_service_fee_vnd: 20_000,
  air_shipping_per_kg_vnd: 185_000,
  group_buy_discount_percent: 25,
  floor_exchange_rate_jpy: 172,
  min_order_threshold_vnd: 300_000,
};

/** Danh sách key hợp lệ để validate input từ Admin UI. */
export const VALID_CONFIG_KEYS = Object.keys(SYSTEM_CONFIG_DEFAULTS) as (keyof SystemConfigMap)[];

// ─────────────────────────────────────────────────────────────────────────────
// Cache in-memory
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút

let configCache: SystemConfigMap | null = null;
let cacheExpiresAt = 0;

/**
 * Làm mới cache ngay lập tức (gọi sau khi Admin cập nhật config).
 */
export function invalidateSystemConfigCache(): void {
  configCache = null;
  cacheExpiresAt = 0;
  invalidatePricingConfigCache();
}

// ─────────────────────────────────────────────────────────────────────────────
// Hàm đọc chính
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trả về toàn bộ SystemConfig dưới dạng số, merge với defaults.
 * Kết quả được cache 5 phút để tránh overload DB.
 */
export async function getSystemConfig(): Promise<SystemConfigMap> {
  const now = Date.now();
  if (configCache && now < cacheExpiresAt) {
    return configCache;
  }

  try {
    const rows = await prisma.systemConfig.findMany();
    const merged = { ...SYSTEM_CONFIG_DEFAULTS };
    for (const row of rows) {
      const key = row.key as keyof SystemConfigMap;
      if (key in merged) {
        const parsed = parseFloat(row.value);
        if (Number.isFinite(parsed)) {
          merged[key] = parsed;
        }
      }
    }
    configCache = merged;
    cacheExpiresAt = now + CACHE_TTL_MS;
    return merged;
  } catch (err) {
    // Nếu DB lỗi (cold start, migration chưa chạy...) → fallback về default
    console.error("[SystemConfig] Không đọc được config từ DB, dùng giá trị mặc định:", err);
    return { ...SYSTEM_CONFIG_DEFAULTS };
  }
}

/**
 * Đọc một key duy nhất (typed). Nhanh hơn khi chỉ cần 1 giá trị.
 */
export async function getConfigValue<K extends keyof SystemConfigMap>(key: K): Promise<SystemConfigMap[K]> {
  const config = await getSystemConfig();
  return config[key];
}
