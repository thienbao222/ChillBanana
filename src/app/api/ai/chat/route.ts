import { NextRequest, NextResponse } from "next/server";
import { 
  CHILLBANANA_OMOTENASHI_PROMPT, 
  CHILLBANANA_FRIENDLY_PROMPT, 
  getChillBananaSmartFallback, 
  isQueryOutOfDomain 
} from "@/lib/ai-consultant";
import { AIPersonality } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, personality = "omotenashi", history = [] } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Vui lòng cung cấp nội dung tin nhắn hợp lệ." },
        { status: 400 }
      );
    }

    const selectedPersonality: AIPersonality = personality === "vietnamese" ? "vietnamese" : "omotenashi";
    const systemPrompt = selectedPersonality === "omotenashi" ? CHILLBANANA_OMOTENASHI_PROMPT : CHILLBANANA_FRIENDLY_PROMPT;

    // 1. Kiểm tra Guardrail cơ bản ngay lập tức
    if (isQueryOutOfDomain(message)) {
      const refusalText = getChillBananaSmartFallback(message, selectedPersonality);
      return NextResponse.json({
        reply: refusalText,
        personality: selectedPersonality,
        isGuardrailTriggered: true,
      });
    }

    // 2. Thử gọi Google Gemini API trực tiếp từ Google AI Studio
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (geminiKey && geminiKey.trim() !== "") {
      try {
        // Chuẩn bị payload hội thoại với Gemini API
        const contentsPayload = [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\n[LỊCH SỬ HỘI THOẠI TRƯỚC ĐÓ]\n${JSON.stringify(history.slice(-4))}\n\n[CÂU HỎI HIỆN TẠI CỦA KHÁCH HÀNG]\n${message}` }],
          },
        ];

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: contentsPayload,
              generationConfig: {
                temperature: 0.3, // Giữ câu trả lời chính xác, bám sát nghiệp vụ
                maxOutputTokens: 800,
              },
            }),
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const generatedText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (generatedText && generatedText.trim().length > 0) {
            return NextResponse.json({
              reply: generatedText,
              personality: selectedPersonality,
              source: "gemini_api",
            });
          }
        } else {
          const errText = await geminiRes.text();
          console.warn("Gemini API call returned non-200:", errText);
        }
      } catch (geminiError) {
        console.warn("Gemini API call failed, switching to Smart Knowledge Engine:", geminiError);
      }
    }

    // 3. Fallback Knowledge Engine chuyên sâu cho ChillBanana
    const fallbackReply = getChillBananaSmartFallback(message, selectedPersonality);

    return NextResponse.json({
      reply: fallbackReply,
      personality: selectedPersonality,
      source: "chillbanana_knowledge_base",
    });
  } catch (error) {
    console.error("ChillBanana AI API Error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi xử lý tin nhắn của bạn." },
      { status: 500 }
    );
  }
}
