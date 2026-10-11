import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { recentVietnamDateKeys, vietnamDateKey, vietnamDayEnd, vietnamDayStart } from "@/lib/vietnam-time";

export const dynamic = "force-dynamic";


export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập quản trị." }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("dateFrom");     // ISO date string "YYYY-MM-DD"
    const dateTo = searchParams.get("dateTo");         // ISO date string "YYYY-MM-DD"
    const customerType = searchParams.get("customerType"); // "ALL" | "REGISTERED" | "GUEST_ORDER" | "CHAT_LEAD" | "ANONYMOUS_GUEST"
    const searchQ = searchParams.get("search")?.toLowerCase().trim() || "";
    const limitParam = parseInt(searchParams.get("limit") || "150");
    const limit = Math.min(limitParam, 500); // Max 500 sessions per request

    // === Build date range filter ===
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (dateFrom) {
      const start = vietnamDayStart(dateFrom);
      if (!start) return NextResponse.json({ error: "Ngày bắt đầu không hợp lệ." }, { status: 400 });
      dateFilter.gte = start;
    }
    if (dateTo) {
      const toDate = vietnamDayEnd(dateTo);
      if (!toDate) return NextResponse.json({ error: "Ngày kết thúc không hợp lệ." }, { status: 400 });
      dateFilter.lte = toDate;
    }
    if (dateFilter.gte && dateFilter.lte && dateFilter.gte > dateFilter.lte) {
      return NextResponse.json({ error: "Khoảng ngày không hợp lệ." }, { status: 400 });
    }

    // === Build customer type filter ===
    const customerTypeFilter =
      customerType && customerType !== "ALL"
        ? { customerType }
        : undefined;

    // 1. Lấy danh sách phiên trò chuyện kèm tin nhắn
    let sessions: any[] = [];
    try {
      sessions = await prisma.chatSession.findMany({
        where: {
          ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
          ...(customerTypeFilter || {}),
        },
        include: {
          messages: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
      });
    } catch (dbErr) {
      console.warn("Lỗi truy vấn chat sessions:", dbErr);
    }

    // === Client-side search filter (topic, keywords, sessionId, email, name, phone) ===
    if (searchQ) {
      sessions = sessions.filter((s) => {
        return (
          s.sessionId?.toLowerCase().includes(searchQ) ||
          s.topic?.toLowerCase().includes(searchQ) ||
          s.detectedKeywords?.toLowerCase().includes(searchQ) ||
          s.customerEmail?.toLowerCase().includes(searchQ) ||
          s.customerName?.toLowerCase().includes(searchQ) ||
          s.customerPhone?.includes(searchQ) ||
          s.messages?.some((m: any) => m.content?.toLowerCase().includes(searchQ))
        );
      });
    }

    // 2. Từ khóa & chủ đề
    const topicCounts: Record<string, number> = {
      "Anime & Mô Hình Figure": 0,
      "Mỹ Phẩm & Chăm Sóc Da": 0,
      "Thực Phẩm Chức Năng": 0,
      "Gia Dụng & Đồ Điện 100V": 0,
      "Thời Trang & Quy Đổi Size": 0,
      "Tỷ Giá & Cước Vận Chuyển": 0,
      "Khác": 0,
    };
    const keywordCounts: Record<string, number> = {};

    sessions.forEach((s) => {
      const topic = s.topic || "Khác";
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      if (s.detectedKeywords) {
        s.detectedKeywords.split(",").map((w: string) => w.trim()).forEach((w: string) => {
          if (w) keywordCounts[w] = (keywordCounts[w] || 0) + 1;
        });
      }
    });

    const topKeywords = Object.entries(keywordCounts)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    const topicsChart = Object.entries(topicCounts)
      .map(([name, count]) => ({ name, count }))
      .filter((t) => t.count > 0 || sessions.length === 0);

    // 3. Tổng hợp stats
    const totalSessions = sessions.length;
    const totalMessages = sessions.reduce((acc, s) => acc + (s.messages?.length || 0), 0);
    const userMessages = sessions.reduce(
      (acc, s) => acc + (s.messages?.filter((m: any) => m.role === "user").length || 0), 0
    );
    const aiMessages = sessions.reduce(
      (acc, s) => acc + (s.messages?.filter((m: any) => m.role === "assistant").length || 0), 0
    );
    const hotKeyword = topKeywords.length > 0 ? topKeywords[0].keyword : "—";

    const sentimentCounts = { inquiry: 0, positive: 0, complaint: 0 };
    sessions.forEach((s) => {
      const sent = (s.sentiment || "inquiry") as keyof typeof sentimentCounts;
      if (sentimentCounts[sent] !== undefined) sentimentCounts[sent]++;
    });

    const dominantSentiment = Object.entries(sentimentCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "inquiry";

    // Phân loại khách hàng trong sessions hiện tại
    const customerTypeCounts = {
      REGISTERED: sessions.filter(s => s.customerType === "REGISTERED").length,
      GUEST_ORDER: sessions.filter(s => s.customerType === "GUEST_ORDER").length,
      CHAT_LEAD: sessions.filter(s => s.customerType === "CHAT_LEAD").length,
      ANONYMOUS_GUEST: sessions.filter(s => !s.customerType || s.customerType === "ANONYMOUS_GUEST").length,
    };

    // 4. Sessions theo ngày (7 ngày gần nhất hoặc trong range)
    const last7Days = recentVietnamDateKeys(7);

    const dailySessions = last7Days.map((dateStr) => {
      const daySessions = sessions.filter(
        (s) => vietnamDateKey(new Date(s.createdAt)) === dateStr
      );
      return {
        date: dateStr,
        count: daySessions.length,
        messages: daySessions.reduce((acc, s) => acc + (s.messages?.length || 0), 0),
      };
    });

    return NextResponse.json({
      success: true,
      filters: { dateFrom, dateTo, customerType, searchQ, limit },
      stats: {
        totalSessions,
        totalMessages,
        userMessages,
        aiMessages,
        hotKeyword,
        dominantSentiment,
        topKeywords,
        topicsChart,
        sentimentSummary: sentimentCounts,
        customerTypeCounts,
        dailySessions,
      },
      sessions: sessions.map((s) => ({
        id: s.id,
        sessionId: s.sessionId,
        personality: s.personality,
        topic: s.topic || "Tư vấn chung",
        detectedKeywords: s.detectedKeywords || "",
        sentiment: s.sentiment || "inquiry",
        // Customer identity fields
        customerType: s.customerType || "ANONYMOUS_GUEST",
        customerId: s.customerId || null,
        customerName: s.customerName || null,
        customerEmail: s.customerEmail || null,
        customerPhone: s.customerPhone || null,
        userIp: s.userIp || null,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messagesCount: s.messages?.length || 0,
        userMessagesCount: s.messages?.filter((m: any) => m.role === "user").length || 0,
        messages: s.messages || [],
      })),
    });
  } catch (error) {
    console.error("Lỗi lấy dữ liệu xu hướng chat AI:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi lấy thống kê AI." }, { status: 500 });
  }
}
