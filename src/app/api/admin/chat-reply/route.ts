// FILE: src/app/api/admin/chat-reply/route.ts
// API Tiếp quản hội thoại (Human Takeover) cho phép Quản trị viên gửi tin nhắn trực tiếp vào phiên chat của khách.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN", "OPERATOR"] });
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const staffName = typeof body?.staffName === "string" && body.staffName.trim()
      ? body.staffName.trim()
      : "Chuyên viên ChillBanana";

    if (!sessionId || !message) {
      return NextResponse.json(
        { success: false, error: "Vui lòng cung cấp mã phiên chat và nội dung tin nhắn." },
        { status: 400 }
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { success: false, error: "Nội dung tin nhắn tối đa 2000 ký tự." },
        { status: 400 }
      );
    }

    const session = await prisma.chatSession.findUnique({
      where: { sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy phiên chat này." },
        { status: 404 }
      );
    }

    const formattedMessage = `[Hỗ trợ trực tiếp từ ${staffName}]: ${message}`;

    const createdMsg = await prisma.chatMessage.create({
      data: {
        sessionId,
        role: "assistant",
        content: formattedMessage,
        categoryTag: "HUMAN_TAKEOVER",
      },
    });

    await prisma.chatSession.update({
      where: { sessionId },
      data: {
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: createdMsg,
    });
  } catch (error) {
    console.error("[ADMIN CHAT REPLY ERROR]:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi lưu tin nhắn tiếp quản hội thoại." },
      { status: 500 }
    );
  }
}
