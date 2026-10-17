import { MIN_ORDER_THRESHOLD_VND } from "@/features/orders/policy";

// Cấu hình giá (thuần, không phụ thuộc database) để dùng được cả ở trình duyệt lẫn server.
// Giá trị thật đang áp dụng được đọc từ bảng PricingConfig (xem config-store.ts); đây là giá trị mặc định
// khi database chưa có bản ghi nào hoặc không đọc được.

export type PricingConfigValues = {
  /** Tỷ lệ phí mua hộ trên tiền hàng, ví dụ 0.04 = 4%. */
  serviceFeeRate: number;
  /** Phí mua hộ tối thiểu (VND). */
  minServiceFeeVnd: number;
  /** Cước bay quốc tế mỗi kg (VND). */
  airShippingPerKgVnd: number;
  /** Mức giảm cước cho đơn gộp, ví dụ 0.25 = giảm 25%. */
  groupBuyDiscountRate: number;
  /** Cân nặng tối đa (kg) để được giảm cước gộp đơn. */
  groupBuyMaxWeightKg: number;
  /** Giá trị tối thiểu (tiền hàng + phí mua hộ) của một đơn. */
  minOrderThresholdVnd: number;
  /** Số phút giữ hàng catalog cho đơn chưa thanh toán. */
  reservationMinutes: number;
};

export const DEFAULT_PRICING_CONFIG: PricingConfigValues = {
  serviceFeeRate: 0.04,
  minServiceFeeVnd: 20_000,
  airShippingPerKgVnd: 185_000,
  groupBuyDiscountRate: 0.25,
  groupBuyMaxWeightKg: 0.5,
  minOrderThresholdVnd: MIN_ORDER_THRESHOLD_VND,
  reservationMinutes: 30,
};

export const PRICING_CONFIG_FIELDS = [
  "serviceFeeRate",
  "minServiceFeeVnd",
  "airShippingPerKgVnd",
  "groupBuyDiscountRate",
  "groupBuyMaxWeightKg",
  "minOrderThresholdVnd",
  "reservationMinutes",
] as const satisfies readonly (keyof PricingConfigValues)[];

type FieldRule = { label: string; min: number; max: number; integer: boolean };

const RULES: Record<keyof PricingConfigValues, FieldRule> = {
  serviceFeeRate: { label: "Tỷ lệ phí mua hộ", min: 0, max: 0.3, integer: false },
  minServiceFeeVnd: { label: "Phí mua hộ tối thiểu", min: 0, max: 500_000, integer: true },
  airShippingPerKgVnd: { label: "Cước bay mỗi kg", min: 0, max: 2_000_000, integer: true },
  groupBuyDiscountRate: { label: "Mức giảm cước gộp đơn", min: 0, max: 0.9, integer: false },
  groupBuyMaxWeightKg: { label: "Cân nặng tối đa để giảm cước gộp đơn", min: 0, max: 50, integer: false },
  minOrderThresholdVnd: { label: "Giá trị đơn tối thiểu", min: 0, max: 10_000_000, integer: true },
  reservationMinutes: { label: "Thời gian giữ hàng (phút)", min: 5, max: 1440, integer: true },
};

export type PricingValidation =
  | { ok: true; value: PricingConfigValues }
  | { ok: false; errors: string[] };

/** Kiểm tra dữ liệu cấu hình giá do admin gửi lên: đủ trường, là số hữu hạn, trong khoảng cho phép. */
export function validatePricingConfig(input: unknown): PricingValidation {
  const errors: string[] = [];
  const source = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const value = {} as PricingConfigValues;

  for (const field of PRICING_CONFIG_FIELDS) {
    const rule = RULES[field];
    const raw = source[field];
    const num = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
    if (!Number.isFinite(num)) {
      errors.push(`${rule.label}: thiếu hoặc không phải số.`);
      continue;
    }
    if (rule.integer && !Number.isInteger(num)) {
      errors.push(`${rule.label}: phải là số nguyên.`);
      continue;
    }
    if (num < rule.min || num > rule.max) {
      errors.push(`${rule.label}: phải nằm trong khoảng ${rule.min} đến ${rule.max}.`);
      continue;
    }
    value[field] = num;
  }

  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function pricingValuesEqual(a: PricingConfigValues, b: PricingConfigValues): boolean {
  return PRICING_CONFIG_FIELDS.every((field) => a[field] === b[field]);
}
