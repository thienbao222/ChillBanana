/**
 * Admin Daily Insights API — Nhóm 2.2: Proactive AI Insight Engine
 *
 * Endpoint này được gọi bởi:
 *   - Cron hàng ngày (Vercel cron / cron-job.org) lúc 8:00 SA ICT
 *   - Thủ công từ Admin Dashboard (nút "Làm mới Báo cáo AI")
 *
 * Gemini phân tích dữ liệu 24h qua và trả về:
 *   1. Top sản phẩm được hỏi nhiều nhưng CHƯA có trong catalog → gợi ý nhập thêm
 *   2. Theo dõi số phiên được phân loại là khiếu nại và các từ khóa tổng hợp
 *   3. Tóm tắt hiệu suất đơn hàng ngày qua
 *   4. 3 hành động ưu tiên đề xuất cho Admin hôm nay
 *
 * Bảo mật: Chấp nhận cả CRON_SECRET (từ cron job) lẫn Admin session cookie.
 */

import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminKeyPool } from "@/lib/api-key-manager";
import { GEMINI_MODELS } from "@/lib/gemini-models";
import { isAdminRequest } from "@/lib/auth-session";
import { isRecordedPaymentStatus } from "@/features/payments/policy";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

function hasValidCronSecret(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  const supplied = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || !supplied) return false;
  const expectedBuf = Buffer.from(expected);
  const suppliedBuf = Buffer.from(supplied);
  return expectedBuf.length === suppliedBuf.length && timingSafeEqual(expectedBuf, suppliedBuf);
}

async function buildDailySnapshot() {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000);
  const since24h = periodStart;
  const trackingCutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const [
    newOrders24h,
    chatSessions24h,
    stuckOrders,
    catalogProducts,
    pendingUnpaidOrders,
  ] = await Promise.all([
    // Đơn hàng mới 24h qua
    prisma.order.findMany({
      where: { createdAt: { gte: since24h } },
      select: {
        orderCode: true, status: true, paymentStatus: true,
        productName: true, category: true, totalVnd: true, depositAmountVnd: true,
      },
    }),

    // Chỉ lấy metadata tổng hợp; không gửi nội dung chat hoặc dữ liệu định danh sang mô hình.
    prisma.chatSession.findMany({
      where: { createdAt: { gte: since24h } },
      select: { topic: true, detectedKeywords: true, sentiment: true },
      take: 100,
    }),

    // Đơn bị kẹt: đang vận chuyển nhưng không có tracking update 3+ ngày
    prisma.order.findMany({
      where: {
        status: { in: ["PURCHASING_JP", "WAREHOUSE_JP", "IN_TRANSIT_AIR", "WAREHOUSE_VN", "LOCAL_DELIVERY"] },
        trackingLogs: { none: { createdAt: { gte: trackingCutoff } } },
      },
      select: {
        orderCode: true,
        status: true,
        createdAt: true,
        trackingLogs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
      orderBy: { updatedAt: "asc" },
      take: 20,
    }),

    // Catalog hiện tại — để biết sản phẩm nào đã có
    prisma.product.findMany({
      select: { name: true, category: true, stockSlots: true },
    }),

    // Đơn chờ thanh toán > 2 ngày
    prisma.order.findMany({
      where: {
        status: "PENDING_DEPOSIT",
        paymentStatus: "UNPAID",
        createdAt: { lte: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      },
      select: { orderCode: true, productName: true, totalVnd: true, createdAt: true },
      take: 20,
    }),
  ]);

  // Tổng hợp keywords từ chat sessions
  const keywordFreq = new Map<string, number>();
  for (const session of chatSessions24h) {
    for (const kw of (session.detectedKeywords || "").split(",")) {
      const clean = kw.trim();
      if (clean) keywordFreq.set(clean, (keywordFreq.get(clean) || 0) + 1);
    }
  }

  const topKeywords = Array.from(keywordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([kw, count]) => ({ keyword: kw, count }));

  const catalogNames = catalogProducts.map((p) => p.name.toLowerCase());
  const lowStockProducts = catalogProducts.filter((p) => p.stockSlots <= 2);

  const recordedPayments = newOrders24h.filter((order) => isRecordedPaymentStatus(order.paymentStatus));

  return {
    generatedAt: periodEnd.toISOString(),
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    period: "24 giờ qua",
    orders: {
      new24h: newOrders24h.length,
      paid24h: recordedPayments.length,
      collectedAmountEstimate24h: recordedPayments.reduce((sum, order) => sum + order.depositAmountVnd, 0),
      categoryBreakdown: Object.entries(
        newOrders24h.reduce((acc: Record<string, number>, o) => {
          acc[o.category] = (acc[o.category] || 0) + 1;
          return acc;
        }, {})
      ),
      pendingUnpaid: pendingUnpaidOrders.length,
      stuckInTransit: stuckOrders.length,
      stuckSamples: stuckOrders.slice(0, 5).map((o) => ({
        code: o.orderCode,
        status: o.status,
        daysSinceTrackingUpdate: Math.floor(
          (Date.now() - new Date(o.trackingLogs[0]?.createdAt ?? o.createdAt).getTime()) / 86400000
        ),
      })),
    },
    chat: {
      sessions24h: chatSessions24h.length,
      complaints24h: chatSessions24h.filter((session) => session.sentiment === "complaint").length,
      topKeywords,
    },
    catalog: {
      totalProducts: catalogProducts.length,
      lowStock: lowStockProducts.map((p) => ({ name: p.name, slots: p.stockSlots })),
      catalogNames: catalogNames.slice(0, 30), // Để Gemini biết sản phẩm nào đã có
    },
  };
}

async function generateDailyInsight() {
  const apiKey = adminKeyPool.getNextKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini Admin key chưa cấu hình hoặc đang quá tải." },
      { status: 503 }
    );
  }

  try {
    const snapshot = await buildDailySnapshot();

    const systemInstruction = `Bạn là Trợ lý AI phân tích kinh doanh nội bộ của ChillBanana.vn — dịch vụ mua hộ hàng nội địa Nhật Bản.
Nhiệm vụ: Phân tích snapshot dữ liệu 24 giờ qua và tạo báo cáo HÀNH ĐỘNG cho Admin.

QUY TẮC BẮT BUỘC:
- Chỉ dùng số liệu trong snapshot JSON. KHÔNG tự bịa thêm dữ liệu.
- Phân biệt rõ: "quan sát được" vs "gợi ý/đề xuất".
- Ngắn gọn, dễ đọc nhanh — Admin bận, cần quét trong < 2 phút.
- Output dùng Markdown: ## cho phần, **bold** cho số liệu quan trọng, emoji để dễ scan.

YÊU CẦU OUTPUT gồm 4 phần theo thứ tự:
1. 📊 TÓM TẮT NGÀY QUA (3-5 bullet points về đơn hàng, chat, số tiền đã ghi nhận từ cọc/thanh toán)
2. 🔥 GỢI Ý NHẬP HÀNG (keywords được hỏi nhiều mà CHƯA có trong catalog — so sánh với catalogNames)
3. ⚠️ CẢNH BÁO CẦN XỬ LÝ (đơn kẹt, số phiên khiếu nại, suất đặt thấp — chỉ nêu điều snapshot chứng minh; không suy diễn nội dung hay nguyên nhân khiếu nại)
4. ✅ 3 HÀNH ĐỘNG ƯU TIÊN HÔM NAY (cụ thể, có thể thực hiện ngay)`;

    const userPrompt = `Snapshot dữ liệu ${snapshot.period} (lấy lúc ${snapshot.generatedAt}):\n${JSON.stringify(snapshot, null, 2)}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODELS.admin}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            maxOutputTokens: 2000,
            thinkingConfig: { thinkingLevel: "low" },
          },
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!response.ok) {
      adminKeyPool.markError(apiKey, response.status);
      return NextResponse.json(
        { error: `Gemini API lỗi: ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const insight = parts
      .filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
      .pop()?.text?.trim();

    if (!insight) {
      return NextResponse.json({ error: "Gemini không trả về nội dung." }, { status: 502 });
    }

    const snapshotSummary = {
      orders24h: snapshot.orders.new24h,
      chats24h: snapshot.chat.sessions24h,
      complaints24h: snapshot.chat.complaints24h,
      stuckOrders: snapshot.orders.stuckInTransit,
      lowStockCount: snapshot.catalog.lowStock.length,
    };
    const localDateParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date(snapshot.generatedAt));
    const datePart = (type: string) => localDateParts.find((part) => part.type === type)?.value || "00";
    const businessDate = `${datePart("year")}-${datePart("month")}-${datePart("day")}`;
    const report = await prisma.adminDailyInsight.upsert({
      where: { businessDate },
      update: {
        periodStart: new Date(snapshot.periodStart),
        periodEnd: new Date(snapshot.periodEnd),
        generatedAt: new Date(snapshot.generatedAt),
        insight,
        snapshotSummary,
      },
      create: {
        businessDate,
        periodStart: new Date(snapshot.periodStart),
        periodEnd: new Date(snapshot.periodEnd),
        generatedAt: new Date(snapshot.generatedAt),
        insight,
        snapshotSummary,
      },
    });

    console.log(`[DailyInsight] Đã lưu báo cáo AI cho ngày ${businessDate} (giờ Việt Nam).`);
    return NextResponse.json({ success: true, report });
  } catch (err) {
    console.error("[DailyInsight] Error:", err);
    return NextResponse.json({ error: "Lỗi tạo báo cáo AI." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (hasValidCronSecret(req)) return generateDailyInsight();
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const report = await prisma.adminDailyInsight.findFirst({ orderBy: { businessDate: "desc" } });
    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error("[DailyInsight] Không đọc được báo cáo đã lưu:", error);
    return NextResponse.json({ error: "Không tải được báo cáo AI đã lưu." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return generateDailyInsight();
}
