import { NextRequest, NextResponse } from "next/server";
import { askGeminiAgent } from "@/lib/gemini-agent";
import { saveChatInteraction } from "@/lib/chat-store";
import { prisma } from "@/lib/prisma";
import { AIPersonality } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, personality = "omotenashi", history = [], sessionId = "default-session" } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Vui lòng cung cấp nội dung tin nhắn hợp lệ." },
        { status: 400 }
      );
    }

    const selectedPersonality: AIPersonality = personality === "vietnamese" ? "vietnamese" : "omotenashi";

    // 1. Gọi Gemini AI Agent đàm thoại trực tiếp (không giới hạn chủ đề)
    const reply = await askGeminiAgent(message, selectedPersonality, history);

    // 2. Lưu lại phiên hội thoại vào CSDL SQLite Prisma & Store để phục vụ thống kê xu hướng khách hàng
    try {
      saveChatInteraction(sessionId, message, reply, selectedPersonality);

      await prisma.chatSession.upsert({
        where: { sessionId },
        update: {
          personality: selectedPersonality,
          messages: {
            create: [
              { role: "user", content: message },
              { role: "assistant", content: reply },
            ],
          },
        },
        create: {
          sessionId,
          personality: selectedPersonality,
          messages: {
            create: [
              { role: "user", content: message },
              { role: "assistant", content: reply },
            ],
          },
        },
      });
    } catch (saveErr) {
      console.warn("Could not save chat interaction to SQLite:", saveErr);
    }

    return NextResponse.json({
      success: true,
      reply,
      personality: selectedPersonality,
      sessionId,
    });
  } catch (error) {
    console.error("ChillBanana Gemini AI Error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi kết nối với AI Agent." },
      { status: 500 }
    );
  }
}
