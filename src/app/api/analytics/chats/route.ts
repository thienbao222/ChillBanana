import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }
  try {
    const totalChats = await prisma.chatSession.count();
    const totalMessages = await prisma.chatMessage.count();
    const recentSessions = await prisma.chatSession.findMany({
      take: 20,
      orderBy: { updatedAt: "desc" },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        totalChats,
        totalMessages,
        recentSessions,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Lỗi khi lấy dữ liệu thống kê xu hướng." },
      { status: 500 }
    );
  }
}
