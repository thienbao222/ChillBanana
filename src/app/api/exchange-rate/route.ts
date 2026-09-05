import { NextResponse } from "next/server";
import { fetchLiveExchangeRate } from "@/lib/exchange-rate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rateData = await fetchLiveExchangeRate();
    return NextResponse.json({
      success: true,
      data: rateData,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        data: {
          rate: 172,
          roundedRate: 172,
          changePercent: 0,
          updatedAt: "Vừa xong",
          source: "Tỷ giá tham chiếu",
        },
      },
      { status: 200 }
    );
  }
}
