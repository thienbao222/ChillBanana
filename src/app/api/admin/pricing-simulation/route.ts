import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getCurrentPricingConfig } from "@/features/pricing/config";
import {
  estimateMargin,
  DEFAULT_COST_ASSUMPTIONS,
  CostAssumptions,
} from "@/features/pricing/unit-economics";
import { PricingConfigValues, DEFAULT_PRICING_CONFIG } from "@/features/pricing/calculator";

export const dynamic = "force-dynamic";

interface SampleOrderInput {
  name?: string;
  priceJpy: number;
  weightKg: number;
  exchangeRate?: number;
  isGroupBuy?: boolean;
  fulfillmentOrigin?: string;
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Body JSON không hợp lệ." }, { status: 400 });
    }

    const currentPricing = await getCurrentPricingConfig();

    const sampleOrders: SampleOrderInput[] = Array.isArray(body?.sampleOrders) && body.sampleOrders.length > 0
      ? body.sampleOrders
      : [
          { name: "Đơn vừa mẫu (Ví dụ 1)", priceJpy: 3850, weightKg: 0.5, exchangeRate: 170 },
          { name: "Đơn nhỏ mẫu (Ví dụ 2)", priceJpy: 2000, weightKg: 0.3, exchangeRate: 170 },
          { name: "Đơn lớn mẫu (Gundam/Mỹ phẩm)", priceJpy: 15000, weightKg: 1.5, exchangeRate: 172 },
          { name: "Đơn nhẹ giá trị cao", priceJpy: 25000, weightKg: 0.2, exchangeRate: 172 },
        ];

    const assumptions: CostAssumptions = {
      ...DEFAULT_COST_ASSUMPTIONS,
      ...(body?.costAssumptions || {}),
    };

    const configA: PricingConfigValues = body?.pricingConfigA || currentPricing.values;
    const configB: PricingConfigValues | null = body?.pricingConfigB || null;

    const resultsA = sampleOrders.map((sample) => ({
      name: sample.name || `${sample.priceJpy} ¥ - ${sample.weightKg} kg`,
      sample,
      estimate: estimateMargin(sample, assumptions, configA),
    }));

    const resultsB = configB
      ? sampleOrders.map((sample) => ({
          name: sample.name || `${sample.priceJpy} ¥ - ${sample.weightKg} kg`,
          sample,
          estimate: estimateMargin(sample, assumptions, configB),
        }))
      : null;

    const summaryA = {
      totalOrders: resultsA.length,
      ordersMeetingTarget: resultsA.filter((r) => !r.estimate.isBelowMargin).length,
      ordersBelowTarget: resultsA.filter((r) => r.estimate.isBelowMargin).length,
      averageMarginVnd: Math.round(
        resultsA.reduce((sum, r) => sum + r.estimate.grossProfitVnd, 0) / resultsA.length
      ),
    };

    const summaryB = resultsB
      ? {
          totalOrders: resultsB.length,
          ordersMeetingTarget: resultsB.filter((r) => !r.estimate.isBelowMargin).length,
          ordersBelowTarget: resultsB.filter((r) => r.estimate.isBelowMargin).length,
          averageMarginVnd: Math.round(
            resultsB.reduce((sum, r) => sum + r.estimate.grossProfitVnd, 0) / resultsB.length
          ),
        }
      : null;

    return NextResponse.json({
      success: true,
      costAssumptions: assumptions,
      configA: {
        results: resultsA,
        summary: summaryA,
      },
      configB: resultsB
        ? {
            results: resultsB,
            summary: summaryB,
          }
        : null,
    });
  } catch (error) {
    console.error("[ADMIN PRICING SIMULATION]", error);
    return NextResponse.json({ error: "Lỗi khi chạy mô phỏng giá." }, { status: 500 });
  }
}

