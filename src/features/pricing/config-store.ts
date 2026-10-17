import { prisma } from "@/lib/prisma";
import { DEFAULT_PRICING_CONFIG, type PricingConfigValues } from "@/features/pricing/config";

// Đọc/ghi cấu hình giá trong database (chỉ dùng ở server).

export type ActivePricingConfig = {
  values: PricingConfigValues;
  /** null khi đang dùng giá trị mặc định trong code (database chưa có bản ghi hoặc không đọc được). */
  id: string | null;
  effectiveFrom: Date | null;
  source: "database" | "default";
};

export type PricingConfigRow = PricingConfigValues & {
  id: string;
  effectiveFrom: Date;
  createdBy: string;
  note: string | null;
  createdAt: Date;
};

function toValues(row: PricingConfigValues): PricingConfigValues {
  return {
    serviceFeeRate: row.serviceFeeRate,
    minServiceFeeVnd: row.minServiceFeeVnd,
    airShippingPerKgVnd: row.airShippingPerKgVnd,
    groupBuyDiscountRate: row.groupBuyDiscountRate,
    groupBuyMaxWeightKg: row.groupBuyMaxWeightKg,
    minOrderThresholdVnd: row.minOrderThresholdVnd,
    reservationMinutes: row.reservationMinutes,
  };
}

/** Bản cấu hình có effectiveFrom mới nhất không vượt quá thời điểm `now`; không có thì dùng mặc định trong code. */
export async function getActivePricingConfig(now: Date = new Date()): Promise<ActivePricingConfig> {
  try {
    const row = await prisma.pricingConfig.findFirst({
      where: { effectiveFrom: { lte: now } },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    });
    if (row) return { values: toValues(row), id: row.id, effectiveFrom: row.effectiveFrom, source: "database" };
  } catch (error) {
    console.error("[PricingConfig] Không đọc được cấu hình giá, dùng giá trị mặc định:", error);
  }
  return { values: { ...DEFAULT_PRICING_CONFIG }, id: null, effectiveFrom: null, source: "default" };
}

export async function listPricingConfigs(limit = 50): Promise<PricingConfigRow[]> {
  return prisma.pricingConfig.findMany({
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
}

export async function createPricingConfig(
  values: PricingConfigValues,
  meta: { createdBy: string; effectiveFrom?: Date; note?: string | null }
): Promise<PricingConfigRow> {
  return prisma.pricingConfig.create({
    data: {
      ...values,
      effectiveFrom: meta.effectiveFrom ?? new Date(),
      createdBy: meta.createdBy,
      note: meta.note?.trim().slice(0, 300) || null,
    },
  });
}

/** Ảnh chụp lưu cùng đơn hàng để sau này truy xuất đúng cách báo giá đã dùng. */
export function buildPricingSnapshot(input: {
  active: ActivePricingConfig;
  exchangeRate: { value: number; source: string; fetchedAt: string | null };
  breakdown: { productPriceVnd: number; serviceFeeVnd: number; shippingFeeVnd: number; totalVnd: number; depositAmountVnd: number };
  isGroupBuy: boolean;
  weightKg: number;
}) {
  return {
    version: 1,
    calculatedAt: new Date().toISOString(),
    pricingConfigId: input.active.id,
    pricingConfigSource: input.active.source,
    config: input.active.values,
    exchangeRate: input.exchangeRate,
    isGroupBuy: input.isGroupBuy,
    weightKg: input.weightKg,
    breakdown: input.breakdown,
  };
}
