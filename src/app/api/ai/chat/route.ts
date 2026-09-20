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

    // 2. Trích xuất metadata từ tin nhắn để phục vụ thống kê xu hướng
    const msgLower = message.toLowerCase();
    const keywordMap: Record<string, string> = {
      "mỹ phẩm": "cosmetics", "kem chống nắng": "cosmetics", "sữa rửa mặt": "cosmetics", "tẩy trang": "cosmetics", "son": "cosmetics", "serum": "cosmetics",
      "thực phẩm": "health", "tảo": "health", "vitamin": "health", "bổ não": "health", "collagen": "health",
      "nồi cơm": "gadgets", "điện tử": "gadgets", "máy cạo": "gadgets", "đồng hồ": "gadgets", "tai nghe": "gadgets", "100v": "gadgets", "biến áp": "gadgets",
      "gundam": "anime", "figure": "anime", "anime": "anime", "mô hình": "anime", "manga": "anime", "bandai": "anime",
      "vận chuyển": "shipping", "cước": "shipping", "ship": "shipping", "gộp đơn": "shipping",
      "tỷ giá": "exchange", "giá": "pricing", "bao nhiêu": "pricing",
      "size": "sizing", "quần áo": "sizing", "giày": "sizing",
    };
    const detectedKeywords: string[] = [];
    let topic = "Khác";
    for (const [kw, cat] of Object.entries(keywordMap)) {
      if (msgLower.includes(kw)) {
        detectedKeywords.push(kw);
        if (topic === "Khác") topic = cat;
      }
    }
    const sentiment = msgLower.includes("không") || msgLower.includes("lỗi") || msgLower.includes("sai") ? "complaint"
      : msgLower.includes("?") || msgLower.includes("hỏi") || msgLower.includes("tư vấn") ? "inquiry"
      : "positive";

    try {
      saveChatInteraction(sessionId, message, reply, selectedPersonality);

      await prisma.chatSession.upsert({
        where: { sessionId },
        update: {
          personality: selectedPersonality,
          topic,
          detectedKeywords: detectedKeywords.join(","),
          sentiment,
          messages: {
            create: [
              { role: "user", content: message, categoryTag: topic },
              { role: "assistant", content: reply },
            ],
          },
        },
        create: {
          sessionId,
          personality: selectedPersonality,
          topic,
          detectedKeywords: detectedKeywords.join(","),
          sentiment,
          messages: {
            create: [
              { role: "user", content: message, categoryTag: topic },
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
