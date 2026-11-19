import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { agentOrchestrator, AgentExecutionRequest } from "@/features/ai-workspace";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN", "OPERATOR"] });
  if (!guard.ok) {
    return guard.response;
  }

  try {
    const body = (await req.json()) as AgentExecutionRequest;

    if (!body || !body.agentId || !body.action) {
      return NextResponse.json(
        {
          success: false,
          error: "Dữ liệu yêu cầu không hợp lệ. Bắt buộc có agentId và action.",
        },
        { status: 400 }
      );
    }

    // Gắn thông tin người kích hoạt từ phiên admin đã xác thực
    body.triggeredBy = guard.username;

    const result = await agentOrchestrator.executeAgentAction(body);

    return NextResponse.json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    console.error("[AI Workspace] Lỗi khi thực thi tác vụ AI:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Lỗi hệ thống khi thực thi Agent.",
      },
      { status: 500 }
    );
  }
}
