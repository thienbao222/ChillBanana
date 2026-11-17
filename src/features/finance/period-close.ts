import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export interface ClosePeriodResult {
  period: string;
  closedAt: Date;
  closedBy: string;
  totalGmvVnd: number;
  totalRevenueVnd: number;
  totalCostVnd: number;
  grossProfitVnd: number;
  ordersCount: number;
  notes?: string | null;
}

export function parsePeriodRange(period: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new Error("INVALID_PERIOD_FORMAT: Định dạng kỳ phải là YYYY-MM (VD: 2026-10).");
  }

  const [yearStr, monthStr] = period.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (month < 1 || month > 12) {
    throw new Error("INVALID_PERIOD_MONTH: Tháng phải từ 01 đến 12.");
  }

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));

  return { start, end };
}

export async function isPeriodClosed(date: Date, tx: any = prisma): Promise<boolean> {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const period = `${year}-${month}`;

  const closed = await tx.periodClose.findUnique({
    where: { period },
  });

  return Boolean(closed);
}

export async function closePeriod(
  period: string,
  closedBy: string,
  notes?: string
): Promise<ClosePeriodResult> {
  const { start, end } = parsePeriodRange(period);

  const existing = await prisma.periodClose.findUnique({
    where: { period },
  });

  if (existing) {
    throw new Error(`PERIOD_ALREADY_CLOSED: Kỳ ${period} đã được chốt sổ trước đó bởi [${existing.closedBy}] vào lúc ${existing.closedAt.toISOString()}.`);
  }

  // Thu thập các đơn hàng trong kỳ (loại bỏ đơn hủy)
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: start, lt: end },
      status: { not: "CANCELLED" },
    },
    include: {
      costLines: { where: { voidedAt: null } },
    },
  });

  let totalGmv = 0;
  let totalRevenue = 0;
  let totalCost = 0;

  for (const order of orders) {
    totalGmv += order.totalVnd;
    totalRevenue += (order.serviceFeeVnd || 0) + (order.shippingFeeVnd || 0) + (order.handlingFeeVnd || 0) + (order.fxFeeVnd || 0);

    const orderCost = order.costLines.reduce((sum, c) => sum + c.amountVnd, 0);
    totalCost += orderCost;
  }

  const grossProfit = totalRevenue - totalCost;

  const record = await prisma.periodClose.create({
    data: {
      period,
      closedBy,
      totalGmvVnd: BigInt(totalGmv),
      totalRevenueVnd: BigInt(totalRevenue),
      totalCostVnd: BigInt(totalCost),
      grossProfitVnd: BigInt(grossProfit),
      ordersCount: orders.length,
      notes: notes || null,
    },
  });

  await writeAuditLog({
    actor: closedBy,
    action: "PERIOD_CLOSED",
    entityType: "PeriodClose",
    entityId: period,
    summary: `Chốt sổ kế toán kỳ [${period}]: ${orders.length} đơn, GMV ${totalGmv.toLocaleString("vi-VN")} đ, Lãi gộp ${grossProfit.toLocaleString("vi-VN")} đ.`,
    metadata: {
      period,
      totalGmv,
      totalRevenue,
      totalCost,
      grossProfit,
      ordersCount: orders.length,
    },
  });

  return {
    period: record.period,
    closedAt: record.closedAt,
    closedBy: record.closedBy,
    totalGmvVnd: Number(record.totalGmvVnd),
    totalRevenueVnd: Number(record.totalRevenueVnd),
    totalCostVnd: Number(record.totalCostVnd),
    grossProfitVnd: Number(record.grossProfitVnd),
    ordersCount: record.ordersCount,
    notes: record.notes,
  };
}

