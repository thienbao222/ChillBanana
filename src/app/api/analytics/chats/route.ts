import { NextRequest, NextResponse } from "next/server";
import { getChatTrendAnalytics } from "@/lib/chat-store";
import { isAdminRequest } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }
  try {
    const analytics = getChatTrendAnalytics();
    return NextResponse.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Lỗi khi lấy dữ liệu thống kê xu hướng." },
      { status: 500 }
    );
  }
}
