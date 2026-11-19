import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { agentOrchestrator } from "@/features/ai-workspace";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN", "OPERATOR"] });
  if (!guard.ok) {
    return guard.response;
  }

  try {
    const data = await agentOrchestrator.getWorkspaceOverview();
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("[AI Workspace] Lỗi khi nạp dữ liệu tổng quan:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Không thể nạp dữ liệu AI Workspace lúc này.",
      },
      { status: 500 }
    );
  }
}
