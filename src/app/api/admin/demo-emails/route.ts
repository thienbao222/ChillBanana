import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getRecentSentEmails, clearSentEmails } from "@/lib/mailer";
import { enforceMockSandboxAllowed } from "@/features/payments/sandbox-guard";

export const dynamic = "force-dynamic";

/**
 * GET: Lấy danh sách tối đa 50 email đã gửi (hoặc mô phỏng) gần nhất
 * Dùng cho Demo Email Viewer trong Sandbox Admin Portal.
 */
export async function GET(req: NextRequest) {
  const sandboxGuard = enforceMockSandboxAllowed();
  if (sandboxGuard) return sandboxGuard;

  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;

  const emails = getRecentSentEmails();
  return NextResponse.json({
    success: true,
    count: emails.length,
    emails,
  });
}

/**
 * DELETE: Xóa sạch bộ đệm email demo
 */
export async function DELETE(req: NextRequest) {
  const sandboxGuard = enforceMockSandboxAllowed();
  if (sandboxGuard) return sandboxGuard;

  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;

  clearSentEmails();
  return NextResponse.json({
    success: true,
    message: "Đã làm trống hộp thư Demo.",
  });
}
