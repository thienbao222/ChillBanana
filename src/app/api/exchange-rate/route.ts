import { NextResponse } from "next/server";
import { fetchLiveExchangeRate } from "@/features/pricing/exchange-rate";
import { getCurrentPricingConfig } from "@/features/pricing/config";
import { DEFAULT_EXCHANGE_RATE } from "@/features/pricing/calculator";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rateData = await fetchLiveExchangeRate();
    return NextResponse.json({
      success: true,
      data: rateData,
    });
  } catch {
    const configuredFallback = await getCurrentPricingConfig()
      .then((config) => config.values.fallbackJpyVndRate)
      .catch(() => DEFAULT_EXCHANGE_RATE);
    return NextResponse.json(
      {
        success: false,
        data: {
          rate: configuredFallback,
          roundedRate: configuredFallback,
          previousRate: configuredFallback,
          changePercent: 0,
          updatedAt: "",
          source: "Tỷ giá tham chiếu mặc định",
          isFallback: true,
          isStale: true,
        },
      },
      { status: 200 }
    );
  }
}
