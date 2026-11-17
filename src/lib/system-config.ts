/**
 * system-config.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Đọc cấu hình hệ thống từ nguồn chân lý duy nhất (PricingConfig).
 * Hợp nhất theo WP1.3: Mọi tham số giá, cước, tỷ giá được ủy quyền trực tiếp
 * sang PricingConfig, loại bỏ dữ liệu phân mảnh.
 * Có cache in-memory TTL 5 phút để giảm số lần query DB.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getCurrentPricingConfig, invalidatePricingConfigCache } from "@/features/pricing/config";

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

/** Giá trị mặc định — dùng khi DB chưa có row tương ứng. */
export const SYSTEM_CONFIG_DEFAULTS: SystemConfigMap = {
  service_fee_percent: 4,
  min_service_fee_vnd: 50_000,
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
// Hàm đọc chính (Ủy quyền sang PricingConfig theo WP1.3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trả về toàn bộ SystemConfig dưới dạng số, lấy từ PricingConfig đang hiệu lực.
 * Kết quả được cache 5 phút để tránh overload DB.
 */
export async function getSystemConfig(): Promise<SystemConfigMap> {
  const now = Date.now();
  if (configCache && now < cacheExpiresAt) {
    return configCache;
  }

  try {
    const pricing = await getCurrentPricingConfig();
    const merged: SystemConfigMap = {
      service_fee_percent: pricing.values.serviceFeePercent,
      min_service_fee_vnd: pricing.values.serviceFeeMinimumVnd,
      air_shipping_per_kg_vnd: pricing.values.airShippingPerKgVnd,
      group_buy_discount_percent: pricing.values.groupBuyShippingDiscountPercent,
      floor_exchange_rate_jpy: pricing.values.fallbackJpyVndRate,
      min_order_threshold_vnd: pricing.values.minimumBaseOrderVnd,
    };

    configCache = merged;
    cacheExpiresAt = now + CACHE_TTL_MS;
    return merged;
  } catch (err) {
    console.error("[SystemConfig] Không đọc được config từ PricingConfig, dùng giá trị mặc định:", err);
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
