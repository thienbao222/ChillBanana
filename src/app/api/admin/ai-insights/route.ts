import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COOKIE_NAME = "chillbanana_admin_session";
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "chillbanana_secure_admin_salt_2026";

function verifyAdmin(req: NextRequest): boolean {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie?.value) return false;
  try {
    const decoded = Buffer.from(cookie.value, "base64").toString("utf-8");
    const [payloadStr, signature] = decoded.split("::");
    const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(payloadStr).digest("hex");
    if (signature !== expectedSig) return false;
    const payload = JSON.parse(payloadStr);
    return payload.exp > Date.now();
  } catch { return false; }
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "Gemini API key chưa cấu hình." }, { status: 500 });
    }

    // 1. Lấy ChatSessions + messages
    const chatSessions = await prisma.chatSession.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      include: { messages: true },
    });

    if (chatSessions.length === 0) {
      return NextResponse.json({
        success: true,
        insights: {
          marketOverview: "Chưa có dữ liệu chat để phân tích. Hãy khuyến khích khách hàng sử dụng Chatbot AI trên trang chủ.",
          topDemandProducts: [],
          groupBuySuggestions: [],
          riskAlerts: [],
          actionItems: ["Thêm sản phẩm mới vào danh mục", "Chia sẻ link web cho khách hàng"],
        },
        generatedAt: new Date().toISOString(),
      });
    }

    // Thu thập tin nhắn user
    const userMessages: string[] = [];
    let totalMessages = 0;
    const topicCounts: Record<string, number> = {};
    const keywordSet: Record<string, number> = {};

    chatSessions.forEach((s) => {
      s.messages.forEach((m) => {
        totalMessages++;
        if (m.role === "user") userMessages.push(m.content);
      });
      if (s.topic) topicCounts[s.topic] = (topicCounts[s.topic] || 0) + 1;
      if (s.detectedKeywords) {
        s.detectedKeywords.split(",").map((w) => w.trim()).forEach((w) => {
          if (w) keywordSet[w] = (keywordSet[w] || 0) + 1;
        });
      }
    });

    // 2. Lấy Orders
    const orders = await prisma.order.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
    });

    const totalRevenue = orders.reduce((acc, o) => acc + o.totalVnd, 0);
    const depositedRevenue = orders
      .filter((o) => o.paymentStatus !== "UNPAID")
      .reduce((acc, o) => acc + o.depositAmountVnd, 0);

    const productCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    orders.filter((o) => o.status !== "CANCELLED").forEach((o) => {
      const name = o.productName.trim();
      productCounts[name] = (productCounts[name] || 0) + 1;
      categoryCounts[o.category] = (categoryCounts[o.category] || 0) + 1;
    });

    const topProducts = Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topKeywords = Object.entries(keywordSet).sort((a, b) => b[1] - a[1]).slice(0, 15);
    const sampledMessages = userMessages.slice(0, 40).join("\n- ");

    // 3. Gửi Gemini phân tích
    const prompt = `Bạn là chuyên gia phân tích kinh doanh thương mại điện tử cho "ChillBanana" - Dịch vụ mua hộ hàng nội địa Nhật Bản tại Việt Nam.

DỮ LIỆU THỰC TẾ:
- ${chatSessions.length} phiên chat AI gần nhất (${totalMessages} tin nhắn)
- Chủ đề được hỏi nhiều: ${JSON.stringify(Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 7))}
- Từ khóa hot: ${JSON.stringify(topKeywords)}
- Mẫu tin nhắn khách: \n- ${sampledMessages}
- ${orders.length} đơn hàng gần nhất. Tổng giá trị: ${totalRevenue.toLocaleString()} VND. Cọc thực thu: ${depositedRevenue.toLocaleString()} VND.
- Mặt hàng đặt nhiều: ${JSON.stringify(topProducts)}
- Phân bổ danh mục: ${JSON.stringify(categoryCounts)}

Trả về phân tích bằng tiếng Việt, dạng JSON hợp lệ với schema:
{
  "marketOverview": "2-3 câu tóm tắt xu hướng thị trường",
  "topDemandProducts": [
    { "name": "tên sản phẩm", "demand": "high/medium", "reason": "lý do" }
  ],
  "groupBuySuggestions": [
    { "productName": "tên", "estimatedDemand": số, "shippingMethod": "đường biển/đường bay", "savingsPercent": số, "reason": "lý do" }
  ],
  "riskAlerts": ["chuỗi cảnh báo"],
  "actionItems": ["hành động cụ thể admin nên làm"]
}

CHỈ trả về JSON. Bọc trong \`\`\`json ... \`\`\``;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey.trim()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
        }),
      }
    );

    if (!response.ok) {
      console.error("Gemini API Error:", await response.text());
      throw new Error(`Gemini API trả về ${response.status}`);
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const textPart = parts.filter((p: any) => p.text && !p.thought).pop();
    const textOutput = textPart?.text || "";

    // Parse JSON
    let jsonString = textOutput.trim();
    if (jsonString.includes("```json")) {
      jsonString = jsonString.split("```json")[1];
    } else if (jsonString.includes("```")) {
      jsonString = jsonString.split("```")[1];
    }
    if (jsonString.includes("```")) {
      jsonString = jsonString.split("```")[0];
    }

    const parsedInsights = JSON.parse(jsonString.trim());

    return NextResponse.json({
      success: true,
      insights: parsedInsights,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[AI INSIGHTS]", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Lỗi máy chủ khi tạo phân tích AI.",
    }, { status: 500 });
  }
}
