import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth-session";
import { getRecentSentEmails, clearSentEmails } from "@/lib/mailer";

export const dynamic = "force-dynamic";

/**
 * GET: Lấy danh sách tối đa 50 email đã gửi (hoặc mô phỏng) gần nhất
 * Dùng cho Demo Email Viewer trong Sandbox Admin Portal.
 */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  clearSentEmails();
  return NextResponse.json({
    success: true,
    message: "Đã làm trống hộp thư Demo.",
  });
}
