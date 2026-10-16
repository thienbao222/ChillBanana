import { NextResponse } from "next/server";
import { getCurrentPricingConfig } from "@/features/pricing/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await getCurrentPricingConfig();
    return NextResponse.json({ version: config.version, values: config.values, updatedAt: config.createdAt.toISOString() }, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("[PricingConfig] Could not load current config:", error);
    return NextResponse.json({ error: "Chưa tải được cấu hình giá." }, { status: 503 });
  }
}
