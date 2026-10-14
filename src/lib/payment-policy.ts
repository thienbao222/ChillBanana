export const DEPOSIT_PERCENT_OPTIONS = [50, 100] as const;
export type DepositPercent = (typeof DEPOSIT_PERCENT_OPTIONS)[number];
export type RecordedPaymentStatus = "DEPOSITED_50" | "PAID_100";

export function isRecordedPaymentStatus(value: string): value is RecordedPaymentStatus {
  return value === "DEPOSITED_50" || value === "PAID_100";
}

export function parseDepositPercent(value: unknown): DepositPercent | null {
  return value === 50 || value === 100 ? value : null;
}

export function getDepositAmount(baseOrderCostVnd: number, depositPercent: DepositPercent): number {
  if (!Number.isSafeInteger(baseOrderCostVnd) || baseOrderCostVnd < 0) {
    throw new Error("Base order cost must be a non-negative safe integer.");
  }
  return depositPercent === 100 ? baseOrderCostVnd : Math.round(baseOrderCostVnd * 0.5);
}

export function getRecordedPaymentStatus(depositPercent: number): RecordedPaymentStatus {
  return depositPercent === 100 ? "PAID_100" : "DEPOSITED_50";
}
