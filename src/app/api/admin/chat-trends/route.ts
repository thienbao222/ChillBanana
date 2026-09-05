import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // 1. Lấy danh sách phiên trò chuyện kèm tin nhắn từ CSDL
    let sessions: any[] = [];
    try {
      sessions = await prisma.chatSession.findMany({
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      });
    } catch (dbErr) {
      console.warn("Lỗi truy vấn chat sessions từ Prisma, dùng dữ liệu khởi tạo:", dbErr);
    }

    // 2. Thống kê theo chủ đề & từ khóa xu hướng
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
        const words = s.detectedKeywords.split(",").map((w: string) => w.trim());
        words.forEach((w: string) => {
          if (w) keywordCounts[w] = (keywordCounts[w] || 0) + 1;
        });
      }
    });

    // Sắp xếp top keywords
    const topKeywords = Object.entries(keywordCounts)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Thống kê chủ đề hot
    const topicsChart = Object.entries(topicCounts)
      .map(([name, count]) => ({ name, count }))
      .filter((t) => t.count > 0 || sessions.length === 0);

    const totalSessions = sessions.length;
    const totalMessages = sessions.reduce((acc, s) => acc + (s.messages?.length || 0), 0);

    const sentimentCounts = {
      inquiry: 0,
      positive: 0,
      complaint: 0,
    };
    sessions.forEach((s) => {
      const sent = (s.sentiment || "inquiry") as "inquiry" | "positive" | "complaint";
      if (sentimentCounts[sent] !== undefined) sentimentCounts[sent]++;
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalSessions,
        totalMessages,
        topKeywords,
        topicsChart,
        sentimentSummary: sentimentCounts,
      },
      sessions: sessions.map((s) => ({
        id: s.id,
        sessionId: s.sessionId,
        personality: s.personality,
        topic: s.topic || "Tư vấn chung",
        detectedKeywords: s.detectedKeywords || "",
        sentiment: s.sentiment || "inquiry",
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messagesCount: s.messages?.length || 0,
        messages: s.messages || [],
      })),
    });
  } catch (error) {
    console.error("Lỗi lấy dữ liệu xu hướng chat AI:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi lấy thống kê AI." }, { status: 500 });
  }
}
