import { NextResponse } from "next/server";
import { getActivePricingConfig } from "@/features/pricing/config-store";

export const dynamic = "force-dynamic";

// Công khai: giá trị cấu hình giá đang áp dụng, để ước tính trên giao diện khớp với báo giá của server.
export async function GET() {
  const active = await getActivePricingConfig();
  return NextResponse.json({ pricing: active.values, source: active.source });
}
