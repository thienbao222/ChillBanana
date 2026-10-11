import { NextRequest, NextResponse } from "next/server";
import { askGeminiAgent } from "@/lib/gemini-agent";
import { prisma } from "@/lib/prisma";
import { AIPersonality } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Simple in-memory rate limiter (resets on serverless cold start; sufficient for abuse prevention)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 30; // 30 requests per minute per IP
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true; // allowed
  }
  if (entry.count >= RATE_LIMIT_MAX) return false; // blocked
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting by IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Bạn gửi tin nhắn quá nhanh. Vui lòng chờ 1 phút rồi thử lại." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { message, personality = "omotenashi", history = [], sessionId, customer } = body;

    // Input validation
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp nội dung tin nhắn hợp lệ." },
        { status: 400 }
      );
    }
    if (message.length > 2000) {
      return NextResponse.json(
        { error: "Tin nhắn quá dài (tối đa 2000 ký tự)." },
        { status: 400 }
      );
    }

    // Use IP-based session fallback instead of shared "default-session"
    const resolvedSessionId = sessionId && sessionId !== "default-session"
      ? String(sessionId).slice(0, 100)
      : `ip-${ip}-${Date.now()}`;

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

    let customerId = customer?.id || null;
    let customerType = customerId ? "REGISTERED" : "ANONYMOUS_GUEST";
    let customerName = customer?.name || null;
    let customerEmail = customer?.email || null;
    let customerPhone = customer?.phone || null;

    if (!customerEmail) {
      const emailMatch = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        customerEmail = emailMatch[0].toLowerCase();
        if (customerType === "ANONYMOUS_GUEST") customerType = "CHAT_LEAD";
      }
    }
    if (!customerPhone) {
      const phoneMatch = message.match(/(?:0|\+84)[3|5|7|8|9]\d{8}\b/);
      if (phoneMatch) {
        customerPhone = phoneMatch[0];
        if (customerType === "ANONYMOUS_GUEST") customerType = "CHAT_LEAD";
      }
    }

    try {
      await prisma.chatSession.upsert({
        where: { sessionId: resolvedSessionId },
        update: {
          personality: selectedPersonality,
          topic,
          detectedKeywords: detectedKeywords.join(","),
          sentiment,
          ...(customerId ? { customerId, customerType: "REGISTERED" } : {}),
          ...(customerName ? { customerName } : {}),
          ...(customerEmail ? { customerEmail } : {}),
          ...(customerPhone ? { customerPhone } : {}),
          ...(!customerId && customerType === "CHAT_LEAD" ? { customerType: "CHAT_LEAD" } : {}),
          messages: {
            create: [
              { role: "user", content: message, categoryTag: topic },
              { role: "assistant", content: reply },
            ],
          },
        },
        create: {
          sessionId: resolvedSessionId,
          personality: selectedPersonality,
          topic,
          detectedKeywords: detectedKeywords.join(","),
          sentiment,
          userIp: ip,
          customerId,
          customerType,
          customerName,
          customerEmail,
          customerPhone,
          messages: {
            create: [
              { role: "user", content: message, categoryTag: topic },
              { role: "assistant", content: reply },
            ],
          },
        },
      });
    } catch (saveErr) {
      console.warn("Could not save chat interaction to database:", saveErr);
    }

    return NextResponse.json({
      success: true,
      reply,
      personality: selectedPersonality,
      sessionId: resolvedSessionId,
    });
  } catch (error) {
    console.error("ChillBanana Gemini AI Error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi kết nối với AI Agent." },
      { status: 500 }
    );
  }
}
