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

const LIMITS: Record<keyof PricingConfigValues, { min: number; max: number; integer?: boolean }> = {
  serviceFeePercent: { min: 0, max: 25 },
  serviceFeeMinimumVnd: { min: 0, max: 100_000_000, integer: true },
  airShippingPerKgVnd: { min: 0, max: 100_000_000, integer: true },
  groupBuyShippingDiscountPercent: { min: 0, max: 80 },
  groupBuyMaxWeightKg: { min: 0.05, max: 20 },
  minimumBaseOrderVnd: { min: 0, max: 500_000_000, integer: true },
  fallbackJpyVndRate: { min: 100, max: 300, integer: true },
  usdVndReferenceRate: { min: 10_000, max: 100_000, integer: true },
  fxSpreadPercent: { min: 0, max: 20 },
};

export function validatePricingConfig(input: unknown): { values: PricingConfigValues } | { error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Cấu hình giá không hợp lệ." };
  const source = input as Record<string, unknown>;
  const keys = Object.keys(LIMITS) as (keyof PricingConfigValues)[];
  const values = {} as PricingConfigValues;

  for (const key of keys) {
    const value = source[key];
    const limit = LIMITS[key];
    if (key === "fxSpreadPercent" && value === undefined) {
      continue;
    }
    if (typeof value !== "number" || !Number.isFinite(value) || value < limit.min || value > limit.max || (limit.integer && !Number.isSafeInteger(value))) {
      return { error: `Giá trị ${key} phải nằm trong khoảng ${limit.min}–${limit.max}${limit.integer ? " và là số nguyên" : ""}.` };
    }
    values[key] = value;
  }
  if (Object.keys(source).some((key) => !keys.includes(key as keyof PricingConfigValues))) {
    return { error: "Cấu hình chứa trường không được hỗ trợ." };
  }
  return { values };
}

function parseRow(row: { version: number; values: Prisma.JsonValue; changedBy: string; changeReason: string | null; createdAt: Date }): VersionedPricingConfig {
  const validated = validatePricingConfig(row.values);
  if ("error" in validated) throw new Error(`PricingConfig version ${row.version} không hợp lệ: ${validated.error}`);
  return { ...row, values: { ...validated.values, fxSpreadPercent: validated.values.fxSpreadPercent ?? 0 } };
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
}

export async function getPricingConfigHistory(take = 25): Promise<VersionedPricingConfig[]> {
  const rows = await prisma.pricingConfig.findMany({ orderBy: { version: "desc" }, take: Math.min(Math.max(take, 1), 100) });
  return rows.map(parseRow);
}
