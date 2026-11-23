import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { recentVietnamDateKeys, vietnamDayEnd, vietnamDayStart } from "@/lib/vietnam-time";

export const dynamic = "force-dynamic";


export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;
  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("dateFrom");     // ISO date string "YYYY-MM-DD"
    const dateTo = searchParams.get("dateTo");         // ISO date string "YYYY-MM-DD"
    const customerType = searchParams.get("customerType"); // "ALL" | "REGISTERED" | "GUEST_ORDER" | "CHAT_LEAD" | "ANONYMOUS_GUEST"
    const searchQ = searchParams.get("search")?.toLowerCase().trim().slice(0, 120) || "";
    const requestedLimit = Number(searchParams.get("limit") || "150");
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(Math.floor(requestedLimit), 500) : 150;

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
    const validCustomerTypes = new Set(["ALL", "REGISTERED", "GUEST_ORDER", "CHAT_LEAD", "ANONYMOUS_GUEST"]);
    if (customerType && !validCustomerTypes.has(customerType)) {
      return NextResponse.json({ error: "Loại khách hàng không hợp lệ." }, { status: 400 });
    }
    const customerTypeFilter = customerType && customerType !== "ALL" ? { customerType } : {};
    const searchableText = (field: string) => ({ [field]: { contains: searchQ, mode: "insensitive" as const } });
    const sessionWhere: Prisma.ChatSessionWhereInput = {
      ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
      ...customerTypeFilter,
      ...(searchQ ? { OR: [
        searchableText("sessionId"), searchableText("topic"), searchableText("detectedKeywords"),
        searchableText("customerEmail"), searchableText("customerName"),
        { customerPhone: { contains: searchQ } },
        { messages: { some: { content: { contains: searchQ, mode: "insensitive" } } } },
      ] } : {}),
    };

    // Aggregate over every matching session. The table's 150-row page is only for details.
    const [sessions, totalSessions, topicGroups, keywordGroups, sentimentGroups, customerGroups, messageGroups] = await Promise.all([
      prisma.chatSession.findMany({
        where: sessionWhere,
        include: { messages: { orderBy: { createdAt: "asc" } } },
        orderBy: { updatedAt: "desc" },
        take: limit,
      }),
      prisma.chatSession.count({ where: sessionWhere }),
      prisma.chatSession.groupBy({ by: ["topic"], where: sessionWhere, _count: { _all: true } }),
      prisma.chatSession.groupBy({ by: ["detectedKeywords"], where: sessionWhere, _count: { _all: true } }),
      prisma.chatSession.groupBy({ by: ["sentiment"], where: sessionWhere, _count: { _all: true } }),
      prisma.chatSession.groupBy({ by: ["customerType"], where: sessionWhere, _count: { _all: true } }),
      prisma.chatMessage.groupBy({ by: ["role"], where: { chatSession: sessionWhere }, _count: { _all: true } }),
    ]);

    const keywordCounts: Record<string, number> = {};
    keywordGroups.forEach((group) => {
      if (!group.detectedKeywords) return;
      group.detectedKeywords.split(",").map((word) => word.trim()).filter(Boolean).forEach((word) => {
        keywordCounts[word] = (keywordCounts[word] || 0) + group._count._all;
      });
    });
    const topKeywords = Object.entries(keywordCounts)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
    const topicsChart = topicGroups.map((group) => ({ name: group.topic || "Khác", count: group._count._all }));
    const messageCountForRole = (role: string) => messageGroups.find((group) => group.role === role)?._count._all || 0;
    const totalMessages = messageGroups.reduce((sum, group) => sum + group._count._all, 0);
    const userMessages = messageCountForRole("user");
    const aiMessages = messageCountForRole("assistant");
    const hotKeyword = topKeywords[0]?.keyword || "—";
    const sentimentSummary = { inquiry: 0, positive: 0, complaint: 0 };
    sentimentGroups.forEach((group) => {
      const sentiment = group.sentiment || "inquiry";
      if (sentiment in sentimentSummary) sentimentSummary[sentiment as keyof typeof sentimentSummary] += group._count._all;
    });
    const dominantSentiment = Object.entries(sentimentSummary).sort((a, b) => b[1] - a[1])[0]?.[0] || "inquiry";
    const customerTypeCounts = {
      REGISTERED: 0, GUEST_ORDER: 0, CHAT_LEAD: 0, ANONYMOUS_GUEST: 0,
    };
    customerGroups.forEach((group) => {
      const type = group.customerType || "ANONYMOUS_GUEST";
      if (type in customerTypeCounts) customerTypeCounts[type as keyof typeof customerTypeCounts] += group._count._all;
    });

    // Exact day counts, not counts from the limited detail table.
    const last7Days = recentVietnamDateKeys(7);
    const dailySessions = await Promise.all(last7Days.map(async (dateStr) => {
      const start = vietnamDayStart(dateStr)!;
      const end = vietnamDayEnd(dateStr)!;
      const where = { AND: [sessionWhere, { createdAt: { gte: start, lte: end } }] } satisfies Prisma.ChatSessionWhereInput;
      const [count, dailyMessageGroups] = await Promise.all([
        prisma.chatSession.count({ where }),
        prisma.chatMessage.groupBy({ by: ["role"], where: { chatSession: where }, _count: { _all: true } }),
      ]);
      return { date: dateStr, count, messages: dailyMessageGroups.reduce((sum, group) => sum + group._count._all, 0) };
    }));

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
        sentimentSummary,
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
