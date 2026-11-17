import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN", "OPERATOR"] });
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      campaignItems: {
        include: {
          entries: {
            include: {
              orderItem: {
                include: {
                  order: {
                    include: {
                      costLines: { where: { voidedAt: null } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Không tìm thấy chiến dịch." }, { status: 404 });
  }

  // Thu thập danh sách các đơn hàng duy nhất
  const uniqueOrdersMap = new Map<string, any>();
  for (const item of campaign.campaignItems) {
    for (const entry of item.entries) {
      if (entry.orderItem?.order) {
        uniqueOrdersMap.set(entry.orderItem.order.id, entry.orderItem.order);
      }
    }
  }

  const orders = Array.from(uniqueOrdersMap.values());
  const ordersCount = orders.length;

  let totalGmvVnd = 0;
  let totalServiceRevenueVnd = 0;
  let totalActualCostsVnd = 0;
  let totalWeightKg = 0;

  for (const order of orders) {
    totalGmvVnd += order.totalVnd;
    totalServiceRevenueVnd += (order.serviceFeeVnd || 0) + (order.shippingFeeVnd || 0);
    totalWeightKg += order.weightKg || 0;

    const orderCosts = order.costLines.reduce((sum: number, c: any) => sum + c.amountVnd, 0);
    totalActualCostsVnd += orderCosts;
  }

  const grossProfitVnd = totalServiceRevenueVnd - totalActualCostsVnd;
  const marginPercent = totalGmvVnd > 0 ? (grossProfitVnd / totalGmvVnd) * 100 : 0;

  return NextResponse.json({
    success: true,
    campaign: {
      id: campaign.id,
      slug: campaign.slug,
      title: campaign.title,
      status: campaign.status,
    },
    metrics: {
      ordersCount,
      totalWeightKg: Math.round(totalWeightKg * 100) / 100,
      totalGmvVnd,
      totalServiceRevenueVnd,
      totalActualCostsVnd,
      grossProfitVnd,
      marginPercent: Math.round(marginPercent * 10) / 10,
    },
  });
}
