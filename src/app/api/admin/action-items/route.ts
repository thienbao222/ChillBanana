import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getDailyActionItems } from "@/features/ai/admin/action-items";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN", "OPERATOR"] });
  if (!guard.ok) return guard.response;

  try {
    const actionItems = await getDailyActionItems();
    return NextResponse.json({ success: true, actionItems });
  } catch (error) {
    console.error("[ActionItems] Lỗi tính việc cần làm:", error);
    return NextResponse.json(
      { error: "Không thể tính danh sách việc cần làm hôm nay." },
      { status: 500 }
    );
  }
}
