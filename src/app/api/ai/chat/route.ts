import { NextRequest, NextResponse } from "next/server";
import { askGeminiAgent, askGeminiAgentDetailed, ensureCatalogFactsInReply } from "@/features/ai/customer/assistant";
import { runCustomerSupportTools, type ProductCardData } from "@/features/ai/customer/support-tools";
import { translateToJapaneseKeywords, parseBudgetAndCurrency } from "@/features/ai/customer/japanese-translator";
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

    const isVnJpRegistration = message.startsWith("[ĐĂNG KÝ GỬI HÀNG VN -> NHẬT]");

    let reply = "";
    let supportSources: unknown[] = [];
    let isGuardrailTriggered = false;
    let aiMode: "gemini" | "offline" = "offline";
    let productCards: ProductCardData[] = [];

    if (isVnJpRegistration) {
      aiMode = "offline";
      const codeMatch = message.match(/Mã\s*phiếu:\s*([^-\n]+)/i);
      const dispatchCode = codeMatch ? codeMatch[1].trim() : "";

      const nameMatch = message.match(/Họ\s*tên:\s*([^-\n]+)/i);
      const parsedName = nameMatch ? nameMatch[1].trim() : "";

      const phoneMatch = message.match(/SĐT:\s*([^-\n]+)/i) || message.match(/(?:0|\+84)[3|5|7|8|9]\d{8}\b/);
      const parsedPhone = phoneMatch ? (phoneMatch[1] || phoneMatch[0]).trim() : "";

      reply = `ChillBanana đã tiếp nhận yêu cầu gửi hàng từ Việt Nam sang Nhật Bản${dispatchCode ? ` (Mã phiếu điều phối: ${dispatchCode})` : ""}${parsedName ? ` của Quý khách ${parsedName}` : ""}. Đơn vị điều phối sẽ liên hệ số điện thoại ${parsedPhone || "của Quý khách"} trong ít phút để hướng dẫn đóng gói và lấy hàng tận nơi!`;
    } else {
      const scrapedProduct = body.scrapedProduct && typeof body.scrapedProduct === "object" && !Array.isArray(body.scrapedProduct)
        ? body.scrapedProduct as { title?: unknown; priceJpy?: unknown; url?: unknown }
        : null;
      const supportRun = await runCustomerSupportTools({
        message,
        customerId: customerSession?.id ?? null,
        guestOrderAccessToken: req.cookies.get(ORDER_ACCESS_COOKIE_NAME)?.value ?? null,
        scrapedProduct,
        history: validHistory,
      });

      // Order privacy and missing quote inputs use deterministic replies; never ask the model
      // to infer private order state or invent the missing price/rate.
      let generatedReply = "";
      if (supportRun.guardedReply) {
        generatedReply = supportRun.guardedReply;
        aiMode = "offline";
      } else {
        const agentResult = await askGeminiAgentDetailed(
          message,
          selectedPersonality,
          validHistory,
          supportRun.evidence
        );
        generatedReply = agentResult.text;
        aiMode = agentResult.mode;
      }

      generatedReply = ensureCatalogFactsInReply(
        generatedReply,
        supportRun.evidence,
        selectedPersonality === "omotenashi"
      );
      reply = generatedReply + (supportRun.quoteFooter ?? "");
      supportSources = supportRun.sources;
      isGuardrailTriggered = supportRun.evidence.some((item) => item.toolId === "order_status" && item.status === "restricted");
      productCards = supportRun.productCards || [];
    }

    console.log(`[AI Chat] Session: ${resolvedSessionId} | Mode: ${aiMode}`);

    // 3. Phân loại chủ đề đa chiều (Intent & Topic Classifier)
    const msgLower = message.toLowerCase();
    const budgetInfo = parseBudgetAndCurrency(message);
    const translated = await translateToJapaneseKeywords(message);

    const detectedKeywords: string[] = [];
    if (translated.detectedBrand) detectedKeywords.push(translated.detectedBrand);
    if (budgetInfo.rawJpyText) detectedKeywords.push(budgetInfo.rawJpyText);
    if (budgetInfo.rawVndText) detectedKeywords.push(budgetInfo.rawVndText);

    let topic = "Tư vấn chung";

    if (isVnJpRegistration) {
      topic = "Gửi hàng VN -> Nhật";
      detectedKeywords.push("gửi hàng vn -> nhật", "tuyến vn-jp");
    } else if (/\b(cb-\d|vnjp-\d|mã đơn|tra cứu đơn|tình trạng đơn|kiểm tra đơn)\b/i.test(msgLower)) {
      topic = "Tra cứu đơn hàng";
      detectedKeywords.push("tra cứu đơn");
    } else if (/\b(ảnh|hình ảnh|image|chụp ảnh)\b/i.test(msgLower) && msgLower.includes("tìm")) {
      topic = "Tìm kiếm từ ảnh (Vision)";
      detectedKeywords.push("tìm bằng ảnh");
    } else if (/\b(100v|220v|biến áp|đổi nguồn|cháy máy|cắm điện|điện áp)\b/i.test(msgLower)) {
      topic = "Tư vấn điện áp 100V";
      detectedKeywords.push("điện 100v", "biến áp");
    } else if (/\b(bảng size|chọn size|vừa không|size mấy|chiều dài chân|hướng dẫn size|vừa chân|kích cỡ)\b/i.test(msgLower)) {
      topic = "Tư vấn kích cỡ (Sizing)";
      detectedKeywords.push("tư vấn size");
    } else if (
      budgetInfo.minJpy || budgetInfo.rawVndText ||
      /\b(tìm|mua|order|săn|giá|báo giá|bao nhiêu|gucci|t-fal|tfal|zojirushi|anessa|gundam|uniqlo|giày|túi|nồi cơm|ấm đun|tai nghe|đồng hồ|quần áo|sneaker)\b/i.test(msgLower)
    ) {
      topic = "Tìm mua sản phẩm (Buying Lead)";
      if (/\b(giày|sneaker|gucci|uniqlo|quần áo|túi)\b/i.test(msgLower)) {
        detectedKeywords.push("fashion");
        if (msgLower.includes("giày")) detectedKeywords.push("giày");
        if (msgLower.includes("gucci")) detectedKeywords.push("gucci");
        if (msgLower.includes("uniqlo")) detectedKeywords.push("uniqlo");
        if (msgLower.includes("túi")) detectedKeywords.push("túi");
      }
      if (/\b(đồng hồ|t-fal|tfal|ấm đun|nồi cơm|tai nghe)\b/i.test(msgLower)) {
        detectedKeywords.push("gadgets");
        if (msgLower.includes("đồng hồ")) detectedKeywords.push("đồng hồ");
        if (msgLower.includes("ấm đun") || msgLower.includes("t-fal")) detectedKeywords.push("ấm đun t-fal");
        if (msgLower.includes("nồi cơm")) detectedKeywords.push("nồi cơm");
      }
      if (msgLower.includes("gundam")) detectedKeywords.push("gundam");
      if (msgLower.includes("anessa")) detectedKeywords.push("anessa");
    } else if (/\b(vận chuyển|cước|ship|gộp đơn|thời gian giao)\b/i.test(msgLower)) {
      topic = "Chính sách vận chuyển";
      detectedKeywords.push("vận chuyển");
    } else if (/\b(đặt cọc|50%|100%|tính giá|tỷ giá|báo giá)\b/i.test(msgLower)) {
      topic = "Báo giá & Đặt cọc";
      detectedKeywords.push("báo giá");
    }

    const hasStrongBuyingIntent = Boolean(
      budgetInfo.minJpy || budgetInfo.rawVndText || body.scrapedProduct ||
      /\b(gucci|t-fal|zojirushi|nike|adidas|panasonic|sony)\b/i.test(msgLower)
    );

    const sentiment = isVnJpRegistration
      ? "inquiry"
      : (msgLower.includes("không") || msgLower.includes("lỗi") || msgLower.includes("sai") ? "complaint"
      : msgLower.includes("?") || msgLower.includes("hỏi") || msgLower.includes("tư vấn") ? "inquiry"
      : "positive");

    let customerId = customerSession?.id || null;
    let customerType = customerId
      ? "REGISTERED"
      : (isVnJpRegistration || hasStrongBuyingIntent ? "CHAT_LEAD" : "ANONYMOUS_GUEST");
    let customerName: string | null = null;
    let customerEmail: string | null = customerSession?.email || null;
    let customerPhone: string | null = null;

    if (isVnJpRegistration) {
      const nameMatch = message.match(/Họ\s*tên:\s*([^-\n]+)/i);
      if (nameMatch && nameMatch[1].trim()) {
        customerName = nameMatch[1].trim();
      }
      const phoneMatch = message.match(/SĐT:\s*([^-\n]+)/i) || message.match(/(?:0|\+84)[3|5|7|8|9]\d{8}\b/);
      if (phoneMatch) {
        customerPhone = (phoneMatch[1] || phoneMatch[0]).trim();
      }
      if (!customerId) customerType = "CHAT_LEAD";
    }

    if (customerId) {
      const customerProfile = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { name: true, email: true, phone: true },
      });
      if (customerProfile) {
        if (!customerName) customerName = customerProfile.name;
        customerEmail = customerProfile.email;
        if (!customerPhone) customerPhone = customerProfile.phone;
      } else {
        customerId = null;
        customerEmail = null;
        customerType = isVnJpRegistration ? "CHAT_LEAD" : "ANONYMOUS_GUEST";
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
      const existingChatSession = await prisma.chatSession.findUnique({
        where: { sessionId: resolvedSessionId },
        select: { topic: true, detectedKeywords: true },
      });

      const existingKeywordsList = existingChatSession?.detectedKeywords
        ? existingChatSession.detectedKeywords.split(",").map((k) => k.trim()).filter(Boolean)
        : [];
      const mergedKeywords = [...new Set([...existingKeywordsList, ...detectedKeywords])].slice(0, 20).join(",");
      const finalTopic = (topic === "Tư vấn chung" && existingChatSession?.topic)
        ? existingChatSession.topic
        : topic;

      await prisma.chatSession.upsert({
        where: { sessionId: resolvedSessionId },
        update: {
          personality: selectedPersonality,
          topic: finalTopic,
          detectedKeywords: mergedKeywords,
          sentiment,
          ...(customerId ? { customerId, customerType: "REGISTERED" } : {}),
          ...(customerName ? { customerName } : {}),
          ...(customerEmail ? { customerEmail } : {}),
          ...(customerPhone ? { customerPhone } : {}),
          ...(!customerId && customerType === "CHAT_LEAD" ? { customerType: "CHAT_LEAD" } : {}),
          messages: {
            create: [
              { role: "user", content: message, categoryTag: finalTopic },
              { role: "assistant", content: reply, categoryTag: aiMode === "offline" ? "AI_OFFLINE" : "AI_GEMINI" },
            ],
          },
        },
        create: {
          sessionId: resolvedSessionId,
          personality: selectedPersonality,
          topic: finalTopic,
          detectedKeywords: mergedKeywords,
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
              { role: "assistant", content: reply, categoryTag: aiMode === "offline" ? "AI_OFFLINE" : "AI_GEMINI" },
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
      sources: supportSources,
      isGuardrailTriggered,
      aiMode,
      productCards,
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
