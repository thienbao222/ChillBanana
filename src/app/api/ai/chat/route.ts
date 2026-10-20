import { NextRequest, NextResponse } from "next/server";
import { askGeminiAgent } from "@/features/ai/customer/assistant";
import { runCustomerSupportTools } from "@/features/ai/customer/support-tools";
import { prisma } from "@/lib/prisma";
import { getCustomerFromRequest, ORDER_ACCESS_COOKIE_NAME } from "@/lib/auth-session";
import { checkAndRecordHit, getClientIp } from "@/lib/rate-limit";
import { AIPersonality } from "@/types";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CHAT_RATE_LIMIT = { max: 30, windowMs: 60 * 1000, blockMs: 60 * 1000 };

export async function POST(req: NextRequest) {
  try {
    // Rate limiting by IP
    const ip = getClientIp(req);
    const retryAfter = await checkAndRecordHit(`chat:${ip}`, CHAT_RATE_LIMIT).catch(() => 0);
    if (retryAfter > 0) {
      return NextResponse.json(
        { error: "Bạn gửi tin nhắn quá nhanh. Vui lòng chờ 1 phút rồi thử lại." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Dữ liệu tin nhắn không hợp lệ." }, { status: 400 });
    }
    const { message, personality = "omotenashi", history = [] } = body;

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

    const customerSession = getCustomerFromRequest(req);
    const sessionCookieName = "cb_chat_session";
    let resolvedSessionId = req.cookies.get(sessionCookieName)?.value || "";
    if (!/^cbchat_[a-f0-9-]{36}$/.test(resolvedSessionId)) {
      resolvedSessionId = `cbchat_${randomUUID()}`;
    }

    // A browser-provided session ID is not an identity credential. Bind the
    // server-issued cookie to its owner and rotate it if another account uses it.
    const existingChatSession = await prisma.chatSession.findUnique({
      where: { sessionId: resolvedSessionId },
      select: { customerId: true },
    });
    if (existingChatSession?.customerId && existingChatSession.customerId !== customerSession?.id) {
      resolvedSessionId = `cbchat_${randomUUID()}`;
    }

    const selectedPersonality: AIPersonality = personality === "vietnamese" ? "vietnamese" : "omotenashi";
    const validHistory = Array.isArray(history)
      ? history.slice(-8).flatMap((entry: unknown) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
          const candidate = entry as { role?: unknown; text?: unknown };
          if (
            typeof candidate.role !== "string" ||
            !["user", "model", "assistant"].includes(candidate.role) ||
            typeof candidate.text !== "string"
          ) return [];
          return [{ role: candidate.role, text: candidate.text.slice(0, 2000) }];
        })
      : [];

    const scrapedProduct = body.scrapedProduct && typeof body.scrapedProduct === "object" && !Array.isArray(body.scrapedProduct)
      ? body.scrapedProduct as { title?: unknown; priceJpy?: unknown; url?: unknown }
      : null;
    const supportRun = await runCustomerSupportTools({
      message,
      customerId: customerSession?.id ?? null,
      guestOrderAccessToken: req.cookies.get(ORDER_ACCESS_COOKIE_NAME)?.value ?? null,
      scrapedProduct,
    });

    // Order privacy and missing quote inputs use deterministic replies; never ask the model
    // to infer private order state or invent the missing price/rate.
    const generatedReply = supportRun.guardedReply ?? await askGeminiAgent(
      message,
      selectedPersonality,
      validHistory,
      supportRun.evidence
    );
    const reply = generatedReply + (supportRun.quoteFooter ?? "");

    // 3. Trích xuất metadata từ tin nhắn để phục vụ thống kê xu hướng
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

    let customerId = customerSession?.id || null;
    let customerType = customerId ? "REGISTERED" : "ANONYMOUS_GUEST";
    let customerName: string | null = null;
    let customerEmail: string | null = customerSession?.email || null;
    let customerPhone: string | null = null;

    if (customerId) {
      const customerProfile = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { name: true, email: true, phone: true },
      });
      if (customerProfile) {
        customerName = customerProfile.name;
        customerEmail = customerProfile.email;
        customerPhone = customerProfile.phone;
      } else {
        customerId = null;
        customerEmail = null;
        customerType = "ANONYMOUS_GUEST";
      }
    }

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

    const response = NextResponse.json({
      success: true,
      reply,
      personality: selectedPersonality,
      sessionId: resolvedSessionId,
      sources: supportRun.sources,
      isGuardrailTriggered: supportRun.evidence.some((item) => item.toolId === "order_status" && item.status === "restricted"),
    });
    response.cookies.set(sessionCookieName, resolvedSessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    console.error("ChillBanana Gemini AI Error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi kết nối với AI Agent." },
      { status: 500 }
    );
  }
}
