import { NextRequest, NextResponse } from "next/server";
import { askGeminiAgent } from "@/lib/gemini-agent";
import { saveChatInteraction } from "@/lib/chat-store";
import { AIPersonality } from "@/types";

export const dynamic = "force-dynamic";

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

    // 1. Gọi Gemini AI Agent đàm thoại trực tiếp
    const reply = await askGeminiAgent(message, selectedPersonality, history);

    // 2. Lưu lại phiên hội thoại vào CSDL & Store để phục vụ thống kê xu hướng khách hàng
    try {
      saveChatInteraction(sessionId, message, reply, selectedPersonality);
    } catch (saveErr) {
      console.warn("Could not save chat interaction:", saveErr);
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
