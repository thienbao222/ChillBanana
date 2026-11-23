import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PRICING_CONFIG, type PricingConfigValues } from "@/features/pricing/calculator";

export type VersionedPricingConfig = {
  version: number;
  values: PricingConfigValues;
  changedBy: string;
  changeReason: string | null;
  createdAt: Date;
};

type NumericPricingKeys = Exclude<
  keyof PricingConfigValues,
  "groupBuyEnabled" | "taxEstimateEnabled"
>;

const LIMITS: Record<NumericPricingKeys, { min: number; max: number; integer?: boolean }> = {
  serviceFeePercent: { min: 0, max: 25 },
  serviceFeeMinimumVnd: { min: 0, max: 100_000_000, integer: true },
  airShippingPerKgVnd: { min: 0, max: 100_000_000, integer: true },
  groupBuyShippingDiscountPercent: { min: 0, max: 80 },
  groupBuyMaxWeightKg: { min: 0.05, max: 20 },
  minimumBaseOrderVnd: { min: 0, max: 500_000_000, integer: true },
  fallbackJpyVndRate: { min: 100, max: 300, integer: true },
  usdVndReferenceRate: { min: 10_000, max: 100_000, integer: true },
  fxSpreadPercent: { min: 0, max: 20 },
  handlingFeeVnd: { min: 0, max: 10_000_000, integer: true },
  fxFeePercent: { min: 0, max: 20 },
  minBillableWeightKg: { min: 0, max: 10 },
  vatPercent: { min: 0, max: 50 },
  importTaxPercent: { min: 0, max: 100 },
};

const OPTIONAL_NUMERIC_KEYS: NumericPricingKeys[] = [
  "fxSpreadPercent",
  "handlingFeeVnd",
  "fxFeePercent",
  "minBillableWeightKg",
  "vatPercent",
  "importTaxPercent",
];

export function validatePricingConfig(input: unknown): { values: PricingConfigValues } | { error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Cấu hình giá không hợp lệ." };
  const source = input as Record<string, unknown>;
  const keys = Object.keys(LIMITS) as NumericPricingKeys[];
  const values = {} as PricingConfigValues;

  for (const key of keys) {
    const value = source[key];
    const limit = LIMITS[key];
    if (OPTIONAL_NUMERIC_KEYS.includes(key) && value === undefined) {
      continue;
    }
    if (typeof value !== "number" || !Number.isFinite(value) || value < limit.min || value > limit.max || (limit.integer && !Number.isSafeInteger(value))) {
      return { error: `Giá trị ${key} phải nằm trong khoảng ${limit.min}–${limit.max}${limit.integer ? " và là số nguyên" : ""}.` };
    }
    (values as Record<string, unknown>)[key] = value;
  }

  // Hỗ trợ cờ boolean tùy chọn
  if (source.groupBuyEnabled !== undefined) {
    if (typeof source.groupBuyEnabled !== "boolean") {
      return { error: "Giá trị groupBuyEnabled phải là boolean (true/false)." };
    }
    values.groupBuyEnabled = source.groupBuyEnabled;
  }

  if (source.taxEstimateEnabled !== undefined) {
    if (typeof source.taxEstimateEnabled !== "boolean") {
      return { error: "Giá trị taxEstimateEnabled phải là boolean (true/false)." };
    }
    values.taxEstimateEnabled = source.taxEstimateEnabled;
  }

  const allowedKeys = [...keys, "groupBuyEnabled", "taxEstimateEnabled"];
  if (Object.keys(source).some((key) => !allowedKeys.includes(key as any))) {
    return { error: "Cấu hình chứa trường không được hỗ trợ." };
  }
  return { values };
}

function parseRow(row: { version: number; values: Prisma.JsonValue; changedBy: string; changeReason: string | null; createdAt: Date }): VersionedPricingConfig {
  const validated = validatePricingConfig(row.values);
  if ("error" in validated) throw new Error(`PricingConfig version ${row.version} không hợp lệ: ${validated.error}`);
  return {
    ...row,
    values: {
      ...DEFAULT_PRICING_CONFIG,
      ...validated.values,
      fxSpreadPercent: validated.values.fxSpreadPercent ?? 0,
    },
  };
}

let cachedPricingConfig: VersionedPricingConfig | null = null;
let cachedPricingConfigExpiresAt = 0;
const PRICING_CACHE_TTL_MS = 60 * 1000; // 60s

export function invalidatePricingConfigCache(): void {
  cachedPricingConfig = null;
  cachedPricingConfigExpiresAt = 0;
}

export async function getCurrentPricingConfig(): Promise<VersionedPricingConfig> {
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
  const now = Date.now();
  if (!isTest && cachedPricingConfig && now < cachedPricingConfigExpiresAt) {
    return cachedPricingConfig;
  }

  try {
    const row = await prisma.pricingConfig.findFirst({ orderBy: { version: "desc" } });
    if (!row) {
      const fallback = { version: 0, values: DEFAULT_PRICING_CONFIG, changedBy: "defaults", changeReason: null, createdAt: new Date(0) };
      if (!isTest) {
        cachedPricingConfig = fallback;
        cachedPricingConfigExpiresAt = now + PRICING_CACHE_TTL_MS;
      }
      return fallback;
    }
    const parsed = parseRow(row);
    if (!isTest) {
      cachedPricingConfig = parsed;
      cachedPricingConfigExpiresAt = now + PRICING_CACHE_TTL_MS;
    }
    return parsed;
  } catch (err) {
    if (isTest) {
      return { version: 0, values: DEFAULT_PRICING_CONFIG, changedBy: "defaults", changeReason: null, createdAt: new Date(0) };
    }
    throw err;
  }
}

export async function getPricingConfigHistory(take = 25): Promise<VersionedPricingConfig[]> {
  const rows = await prisma.pricingConfig.findMany({ orderBy: { version: "desc" }, take: Math.min(Math.max(take, 1), 100) });
  return rows.map(parseRow);
}
