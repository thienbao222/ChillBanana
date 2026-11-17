export const DEPOSIT_PERCENT_OPTIONS = [50, 70, 100] as const;
export type DepositPercent = (typeof DEPOSIT_PERCENT_OPTIONS)[number];
export type RecordedPaymentStatus = "UNPAID" | "DEPOSITED_50" | "DEPOSITED_70" | "PAID_100";

export function isRecordedPaymentStatus(value: string): value is RecordedPaymentStatus {
  return (
    value === "UNPAID" ||
    value === "DEPOSITED_50" ||
    value === "DEPOSITED_70" ||
    value === "PAID_100"
  );
}

export function parseDepositPercent(value: unknown): DepositPercent | null {
  return value === 50 || value === 70 || value === 100 ? value : null;
}

export function getDepositAmount(baseOrderCostVnd: number, depositPercent: DepositPercent | number): number {
  if (!Number.isSafeInteger(baseOrderCostVnd) || baseOrderCostVnd < 0) {
    throw new Error("Base order cost must be a non-negative safe integer.");
  }
  if (depositPercent === 100) return baseOrderCostVnd;
  return Math.round((baseOrderCostVnd * depositPercent) / 100);
}

export function getRecordedPaymentStatus(depositPercent: number): RecordedPaymentStatus {
  if (depositPercent === 100) return "PAID_100";
  if (depositPercent === 70) return "DEPOSITED_70";
  return "DEPOSITED_50";
}

// ─────────────────────────────────────────────────────────────────────────────
// CHÍNH SÁCH DÒNG TIỀN V2 (WP3.3)
// ─────────────────────────────────────────────────────────────────────────────

export type DepositTier = "LOW" | "STANDARD" | "HIGH";

export interface DepositPolicy {
  fullPaymentThresholdVnd: number;      // Đơn < 1.000.000 VND cọc 100%
  highValueThresholdVnd: number;        // Đơn > 10.000.000 VND cọc 50%
  standardDepositPercent: number;       // Đơn 1tr - 10tr cọc 70%
  highValueDepositPercent: number;      // Đơn > 10tr cọc 50%
  weightTolerancePercent: number;       // Dung sai 5%
  weightToleranceMinKg: number;         // Dung sai 0.05kg (50g)
}

export const DEFAULT_DEPOSIT_POLICY: DepositPolicy = {
  fullPaymentThresholdVnd: 1_000_000,
  highValueThresholdVnd: 10_000_000,
  standardDepositPercent: 70,
  highValueDepositPercent: 50,
  weightTolerancePercent: 5,
  weightToleranceMinKg: 0.05,
};

/**
 * Tính số tiền cọc đợt 1 phân tầng theo giá trị đơn hàng (WP3.3):
 * - Đơn < 1.000.000 đ: cọc 100% (bảo vệ các đơn nhỏ dễ bị bỏ)
 * - Đơn 1.000.000 đ - 10.000.000 đ: cọc 70%
 * - Đơn > 10.000.000 đ: cọc 50%
 */
export function calculateDepositV2(
  orderTotalVnd: number,
  _optionalBaseGoodsOrPolicy?: number | DepositPolicy,
  policy: DepositPolicy = DEFAULT_DEPOSIT_POLICY
): {
  tier: DepositTier;
  depositPercent: number;
  depositAmountVnd: number;
} {
  const effectivePolicy =
    typeof _optionalBaseGoodsOrPolicy === "object" && _optionalBaseGoodsOrPolicy !== null
      ? _optionalBaseGoodsOrPolicy
      : policy;

  if (orderTotalVnd < effectivePolicy.fullPaymentThresholdVnd) {
    return {
      tier: "LOW",
      depositPercent: 100,
      depositAmountVnd: orderTotalVnd,
    };
  }

  if (orderTotalVnd <= effectivePolicy.highValueThresholdVnd) {
    const depositPercent = effectivePolicy.standardDepositPercent;
    return {
      tier: "STANDARD",
      depositPercent,
      depositAmountVnd: Math.round((orderTotalVnd * depositPercent) / 100),
    };
  }

  const depositPercent = effectivePolicy.highValueDepositPercent;
  return {
    tier: "HIGH",
    depositPercent,
    depositAmountVnd: Math.round((orderTotalVnd * depositPercent) / 100),
  };
}

/**
 * Kiểm tra dung sai cân nặng tại kho Tokyo (WP3.3):
 * Nếu cân nặng thực tế tại Tokyo lệch ≤ 5% hoặc ≤ 50g so với báo giá: KHÔNG phạt / miễn phí.
 * Lệch > 5% và > 50g: kích hoạt tự động tính lại cước.
 */
export function checkWeightTolerance(
  estimatedWeightKg: number,
  actualWeightKg: number,
  policy: DepositPolicy = DEFAULT_DEPOSIT_POLICY
): {
  withinTolerance: boolean;
  isWithinTolerance: boolean;
  allowedToleranceKg: number;
  weightDiffKg: number;
  percentageDiff: number;
  weightDiffPercent: number;
} {
  const rawDiff = actualWeightKg - estimatedWeightKg;
  const weightDiffKg = Math.round(rawDiff * 1000) / 1000;
  const percentageDiff = estimatedWeightKg > 0 ? (weightDiffKg / estimatedWeightKg) * 100 : 0;

  // Nếu thực tế nhẹ hơn hoặc bằng ước tính -> luôn chấp nhận
  if (weightDiffKg <= 0) {
    return {
      withinTolerance: true,
      isWithinTolerance: true,
      allowedToleranceKg: policy.weightToleranceMinKg,
      weightDiffKg,
      percentageDiff,
      weightDiffPercent: percentageDiff,
    };
  }

  const percentToleranceKg = (estimatedWeightKg * policy.weightTolerancePercent) / 100;
  const allowedToleranceKg = Math.max(policy.weightToleranceMinKg, percentToleranceKg);
  const withinTolerance = weightDiffKg <= allowedToleranceKg;

  return {
    withinTolerance,
    isWithinTolerance: withinTolerance,
    allowedToleranceKg,
    weightDiffKg,
    percentageDiff,
    weightDiffPercent: percentageDiff,
  };
}

export type WarehouseVnBalanceInput = {
  totalVnd: number;
  totalPaidVnd: number;
  domesticVnShippingEstimateVnd?: number;
};

/**
 * Tính số dư cần thu hoặc hoàn tại WAREHOUSE_VN (WP3.3).
 * Chỉ giao hàng khi đã thanh toán 100% (trừ B2B công nợ).
 */
export function calculateWarehouseVnBalance(
  arg1: number | WarehouseVnBalanceInput,
  arg2?: number,
  arg3?: number
): {
  remainingGoodsBalanceVnd: number;
  totalRemainingVnd: number;
  isFullySettled: boolean;
  balanceVnd: number;
  actionNeeded: "COLLECT_BALANCE" | "REFUND" | "NONE";
} {
  let totalVnd: number;
  let totalPaidVnd: number;
  let domesticShippingVnd = 0;

  if (typeof arg1 === "object" && arg1 !== null) {
    totalVnd = arg1.totalVnd;
    totalPaidVnd = arg1.totalPaidVnd;
    domesticShippingVnd = arg1.domesticVnShippingEstimateVnd || 0;
  } else {
    totalVnd = arg1;
    totalPaidVnd = typeof arg2 === "number" ? arg2 : 0;
    domesticShippingVnd = typeof arg3 === "number" ? arg3 : 0;
  }

  const remainingGoodsBalanceVnd = Math.max(0, totalVnd - totalPaidVnd);
  const totalRemainingVnd = remainingGoodsBalanceVnd + domesticShippingVnd;
  const balanceVnd = totalVnd - totalPaidVnd;

  let actionNeeded: "COLLECT_BALANCE" | "REFUND" | "NONE" = "NONE";
  if (balanceVnd > 0) {
    actionNeeded = "COLLECT_BALANCE";
  } else if (balanceVnd < 0) {
    actionNeeded = "REFUND";
  }

  return {
    remainingGoodsBalanceVnd,
    totalRemainingVnd,
    isFullySettled: totalRemainingVnd === 0,
    balanceVnd,
    actionNeeded,
  };
}
