import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;


export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
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
      include: { messages: { select: { role: true } } },
    });

    // Thu thập tin nhắn user
    let totalMessages = 0;
    const topicCounts: Record<string, number> = {};
    const keywordSet: Record<string, number> = {};

    chatSessions.forEach((s) => {
      s.messages.forEach((m) => {
        totalMessages++;
      });
      if (s.topic) topicCounts[s.topic] = (topicCounts[s.topic] || 0) + 1;
      if (s.detectedKeywords) {
        s.detectedKeywords.split(",").map((w) => w.trim()).forEach((w) => {
          if (w) keywordSet[w] = (keywordSet[w] || 0) + 1;
        });
      }
    });

    // Keep financial totals complete, even when the order history grows beyond the
    // recent chat sample used for demand trends.
    const [totalOrderCount, orderValue, paidDeposits, productGroups, categoryGroups] = await Promise.all([
      prisma.order.count(),
      prisma.order.aggregate({
        where: { status: { not: "CANCELLED" } },
        _sum: { totalVnd: true },
      }),
      prisma.order.aggregate({
        where: { paymentStatus: { notIn: ["UNPAID", "REFUNDED"] } },
        _sum: { depositAmountVnd: true },
      }),
      prisma.order.groupBy({
        by: ["productName"],
        where: { status: { not: "CANCELLED" } },
        _count: { _all: true },
        orderBy: { _count: { productName: "desc" } },
        take: 10,
      }),
      prisma.order.groupBy({
        by: ["category"],
        where: { status: { not: "CANCELLED" } },
        _count: { _all: true },
      }),
    ]);

    const totalRevenue = orderValue._sum.totalVnd || 0;
    const depositedRevenue = paidDeposits._sum.depositAmountVnd || 0;
    const topProducts = productGroups.map((group) => [group.productName, group._count._all] as [string, number]);
    const categoryCounts = Object.fromEntries(categoryGroups.map((group) => [group.category, group._count._all]));
    const topKeywords = Object.entries(keywordSet).sort((a, b) => b[1] - a[1]).slice(0, 15);

    // 3. Gửi Gemini phân tích
    const prompt = `Bạn là chuyên gia phân tích kinh doanh thương mại điện tử cho "ChillBanana" - Dịch vụ mua hộ hàng nội địa Nhật Bản tại Việt Nam.

DỮ LIỆU THỰC TẾ:
- ${chatSessions.length} phiên chat AI gần nhất (${totalMessages} tin nhắn trong mẫu)
- Chủ đề được hỏi nhiều: ${JSON.stringify(Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 7))}
- Từ khóa hot: ${JSON.stringify(topKeywords)}
- ${totalOrderCount} đơn hàng toàn bộ lịch sử. Tổng giá trị ước tính của các đơn chưa hủy: ${totalRevenue.toLocaleString()} VND. Cọc đã ghi nhận: ${depositedRevenue.toLocaleString()} VND.
- Mặt hàng đặt nhiều: ${JSON.stringify(topProducts)}
- Phân bổ danh mục: ${JSON.stringify(categoryCounts)}

Chỉ dựa vào các số liệu tổng hợp ở trên; không suy diễn rằng dữ liệu chat mẫu đại diện cho toàn bộ khách hàng.

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
