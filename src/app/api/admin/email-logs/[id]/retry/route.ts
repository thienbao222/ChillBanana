import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { writeAuditLog } from "@/lib/audit";
import { retryEmailLog } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;
  const { id } = await params;
  if (!id || id.length > 40) return NextResponse.json({ error: "Mã nhật ký không hợp lệ." }, { status: 400 });
  try {
    const sent = await retryEmailLog(id);
    await writeAuditLog({
      actor: guard.username,
      action: "EMAIL_RETRY_REQUESTED",
      entityType: "EmailLog",
      entityId: id,
      summary: sent ? "Thử gửi lại email thành công." : "Đã thử lại email nhưng chưa gửi được hoặc đang ở chế độ mô phỏng.",
      req,
    });
    return NextResponse.json({ success: true, sent, message: sent ? "Email đã gửi thành công." : "Email chưa được gửi. Xem trạng thái/log và cấu hình SMTP." });
  } catch (error) {
    console.error("[AdminEmailLog] Retry failed:", error);
    return NextResponse.json({ error: "Không thể thử gửi lại email." }, { status: 503 });
  }
}
