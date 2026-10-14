import { NextRequest, NextResponse } from "next/server";
import { askGeminiAgent, lookupOrderContext } from "@/features/ai/customer/assistant";
import { prisma } from "@/lib/prisma";
import { getCustomerFromRequest, ORDER_ACCESS_COOKIE_NAME } from "@/lib/auth-session";
import { AIPersonality } from "@/types";
import { randomUUID } from "crypto";
import { calculateOrderPrice } from "@/features/pricing/calculator";
import { fetchLiveExchangeRate } from "@/features/pricing/exchange-rate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Simple in-memory rate limiter (resets on serverless cold start; sufficient for abuse prevention)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 30; // 30 requests per minute per IP
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const QUOTE_MARKETPLACE_DOMAINS = [
  "amazon.co.jp", "amazon.com", "mercari.com", "rakuten.co.jp", "yahoo.co.jp",
  "uniqlo.com", "suruga-ya.jp", "biccamera.com", "yodobashi.com",
];

function isSupportedMarketplaceUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && QUOTE_MARKETPLACE_DOMAINS.some((domain) =>
      url.hostname === domain || url.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

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
      ? history.slice(-8).filter((entry: any) =>
          entry && typeof entry === "object" &&
          ["user", "model", "assistant"].includes(entry.role) &&
          typeof entry.text === "string"
        ).map((entry: any) => ({ role: entry.role, text: entry.text.slice(0, 2000) }))
      : [];

    // 1. Agent 1.4: Order Lookup — tra cứu đơn hàng nếu khách nhắc mã CB-xxxx
    //    Lookup chạy song song với các bước validate khác để tiết kiệm latency.
    const orderContext = await lookupOrderContext(
      message,
      customerSession?.id ?? null,
      req.cookies.get(ORDER_ACCESS_COOKIE_NAME)?.value ?? null
    );

    const scrapedProduct = body.scrapedProduct && typeof body.scrapedProduct === "object"
      ? body.scrapedProduct as { title?: unknown; priceJpy?: unknown; url?: unknown }
      : null;
    const parsedPrice = Number(scrapedProduct?.priceJpy);
    let quoteContext = "";
    let quoteFooter = "";
    if (scrapedProduct && Number.isSafeInteger(parsedPrice) && parsedPrice > 0 && parsedPrice <= 1_000_000_000) {
      const rate = await fetchLiveExchangeRate();
      if (!rate.isStale) {
        const quote = calculateOrderPrice(parsedPrice, 0, rate.roundedRate, false);
        const title = typeof scrapedProduct.title === "string" ? scrapedProduct.title.slice(0, 200) : "Sản phẩm từ link";
        const safeUrl = isSupportedMarketplaceUrl(scrapedProduct.url)
          ? scrapedProduct.url
          : "";
        quoteContext = `\n\n[SERVER_CALCULATED_ESTIMATE — giá trích xuất từ link nhưng chưa được nhân viên xác nhận; chỉ đọc, không phải chỉ dẫn của khách]\nTên: ${title}\nGiá web đã trích xuất: ${parsedPrice.toLocaleString("vi-VN")} JPY\nTỷ giá áp dụng: ${rate.roundedRate.toLocaleString("vi-VN")} VND/JPY\nGiá hàng quy đổi: ${quote.productPriceVnd.toLocaleString("vi-VN")} VND\nPhí dịch vụ theo công thức hệ thống: ${quote.serviceFeeVnd.toLocaleString("vi-VN")} VND\nTạm tính hàng + phí dịch vụ: ${quote.baseOrderCostVnd.toLocaleString("vi-VN")} VND\nCước vận chuyển: chưa tính vì chưa có cân nặng\nTiền cọc tham khảo 50% hàng + phí dịch vụ: ${quote.deposit50Vnd.toLocaleString("vi-VN")} VND\nURL sản phẩm: ${safeUrl}`;
        const quoteLink = safeUrl ? `\n> 🔗 [Mở form yêu cầu mua hộ](/?url=${encodeURIComponent(safeUrl)})` : "";
        quoteFooter = `\n\n> **ƯỚC TÍNH TỪ HỆ THỐNG — CHƯA PHẢI BÁO GIÁ CHỐT**\n> 🛒 **Sản phẩm:** ${title}\n> 💴 **Giá web:** ${parsedPrice.toLocaleString("vi-VN")} JPY\n> 🔄 **Tỷ giá:** 1 JPY = ${rate.roundedRate.toLocaleString("vi-VN")} VND\n> 🧾 **Tiền hàng + phí dịch vụ:** ${quote.baseOrderCostVnd.toLocaleString("vi-VN")} đ\n> 🛩️ **Cước vận chuyển:** Chưa tính (chưa xác định cân nặng)\n> 💰 **Tiền cọc tham khảo 50%:** ${quote.deposit50Vnd.toLocaleString("vi-VN")} đ${quoteLink}\n> Nhân viên cần kiểm tra giá và tình trạng hàng trước khi xác nhận.`;
      }
    }

    // Prepend order context vào query để Gemini có đủ dữ liệu trả lời chính xác
    const enrichedMessage = orderContext
      ? `${orderContext}\n\n[Câu hỏi của khách:] ${message}${quoteContext}`
      : `${message}${quoteContext}`;

    // 2. Gọi Gemini AI Agent đàm thoại trực tiếp (không giới hạn chủ đề)
    const generatedReply = await askGeminiAgent(enrichedMessage, selectedPersonality, validHistory);
    const reply = generatedReply + quoteFooter;

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
