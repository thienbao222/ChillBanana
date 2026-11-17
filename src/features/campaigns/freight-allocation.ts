import { prisma } from "@/lib/prisma";
import { createCostLine } from "@/features/finance/cost-lines";

export interface BatchItemWeight {
  orderId: string;
  orderCode: string;
  weightKg: number;
}

export interface AllocatedFreightResult {
  orderId: string;
  orderCode: string;
  weightKg: number;
  allocatedFreightVnd: number;
  weightRatio: number;
}

/**
 * Thuật toán phân bổ cước lô thực tế cho từng đơn theo tỷ lệ trọng lượng (WP5.2).
 * ĐẢM BẢO BẤT BIẾN:
 * 1. Mọi số tiền phân bổ là số nguyên VND (Safe Integer).
 * 2. Tổng cước phân bổ BẰNG ĐÚNG TUYỆT ĐỐI tổng cước thực tế (totalFreightVnd).
 * 3. Chênh lệch làm tròn được gán vào đơn có trọng lượng lớn nhất.
 */
export function allocateBatchFreight(
  items: BatchItemWeight[],
  totalFreightVnd: number
): AllocatedFreightResult[] {
  if (!items || items.length === 0) return [];
  if (!Number.isSafeInteger(totalFreightVnd) || totalFreightVnd < 0) {
    throw new Error("Total batch freight must be a non-negative safe integer.");
  }

  const totalWeightKg = items.reduce((sum, it) => sum + Math.max(0, it.weightKg), 0);
  if (totalWeightKg <= 0) {
    // Nếu tổng cân = 0, chia đều
    const equalShare = Math.floor(totalFreightVnd / items.length);
    let remainder = totalFreightVnd - equalShare * items.length;

    return items.map((it, idx) => {
      const extra = idx === 0 ? remainder : 0;
      return {
        orderId: it.orderId,
        orderCode: it.orderCode,
        weightKg: it.weightKg,
        allocatedFreightVnd: equalShare + extra,
        weightRatio: 1 / items.length,
      };
    });
  }

  // 1. Phân bổ sơ bộ theo tỷ lệ cân nặng
  let sumAllocated = 0;
  const results: AllocatedFreightResult[] = items.map((it) => {
    const ratio = it.weightKg / totalWeightKg;
    const allocated = Math.round(totalFreightVnd * ratio);
    sumAllocated += allocated;
    return {
      orderId: it.orderId,
      orderCode: it.orderCode,
      weightKg: it.weightKg,
      allocatedFreightVnd: allocated,
      weightRatio: ratio,
    };
  });

  // 2. Xử lý phần dư do làm tròn (discrepancy)
  const discrepancy = totalFreightVnd - sumAllocated;
  if (discrepancy !== 0) {
    // Tìm phần tử có cân nặng lớn nhất
    let maxIdx = 0;
    for (let i = 1; i < results.length; i++) {
      if (results[i].weightKg > results[maxIdx].weightKg) {
        maxIdx = i;
      }
    }
    results[maxIdx].allocatedFreightVnd += discrepancy;
  }

  return results;
}

/**
 * Ghi nhận cước lô vào OrderCostLine của từng đơn hàng trong chiến dịch.
 */
export async function applyBatchFreightToCampaignOrders(
  campaignId: string,
  totalActualFreightVnd: number,
  actor: string
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      campaignItems: {
        include: {
          entries: {
            include: {
              orderItem: {
                include: { order: true },
              },
            },
          },
        },
      },
    },
  });

  if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");

  // Gom các đơn hàng hợp lệ
  const orderMap = new Map<string, { orderId: string; orderCode: string; weightKg: number }>();
  for (const item of campaign.campaignItems) {
    for (const entry of item.entries) {
      if (entry.orderItem?.order) {
        const order = entry.orderItem.order;
        const current = orderMap.get(order.id);
        const itemWeight = entry.orderItem.weightKg * entry.quantity;
        if (current) {
          current.weightKg += itemWeight;
        } else {
          orderMap.set(order.id, {
            orderId: order.id,
            orderCode: order.orderCode,
            weightKg: itemWeight,
          });
        }
      }
    }
  }

  const batchItems = Array.from(orderMap.values());
  const allocations = allocateBatchFreight(batchItems, totalActualFreightVnd);

  for (const alloc of allocations) {
    await createCostLine({
      orderId: alloc.orderId,
      category: "INTL_FREIGHT",
      amountOriginal: alloc.allocatedFreightVnd,
      currency: "VND",
      amountVnd: alloc.allocatedFreightVnd,
      note: `[Cước lô gom đơn] Chiến dịch ${campaign.title} (${alloc.weightKg.toFixed(2)} kg)`,
      createdBy: actor,
    });
  }

  return { allocations, totalOrders: allocations.length };
}
