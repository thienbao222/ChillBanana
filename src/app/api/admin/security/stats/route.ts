import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getSecurityTelemetry } from "@/features/security/monitor";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN", "OPERATOR"] });
  if (!guard.ok) return guard.response;

  try {
    const telemetry = await getSecurityTelemetry();
    return NextResponse.json({
      success: true,
      data: telemetry,
    });
  } catch (error) {
    console.error("[SECURITY_TELEMETRY_API_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Không thể thu thập dữ liệu an ninh mạng." },
      { status: 500 }
    );
  }
}
