import { NextResponse } from "next/server";
import { getChatTrendAnalytics } from "@/lib/chat-store";

export const dynamic = "force-dynamic";

export async function GET() {
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
