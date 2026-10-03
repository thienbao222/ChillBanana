import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const dynamic = "force-dynamic";

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
    return NextResponse.json({ error: "Không có quyền truy cập quản trị." }, { status: 401 });
  }
  try {
    // 1. Lấy danh sách phiên trò chuyện kèm tin nhắn
    let sessions: any[] = [];
    try {
      sessions = await prisma.chatSession.findMany({
        include: {
          messages: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      });
    } catch (dbErr) {
      console.warn("Lỗi truy vấn chat sessions:", dbErr);
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

    // 3. Tổng hợp
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

    // 4. Sessions theo ngày - 7 ngày gần nhất
    const now = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });

    const dailySessions = last7Days.map((dateStr) => {
      const daySessions = sessions.filter(
        (s) => new Date(s.createdAt).toISOString().slice(0, 10) === dateStr
      );
      return {
        date: dateStr,
        count: daySessions.length,
        messages: daySessions.reduce((acc, s) => acc + (s.messages?.length || 0), 0),
      };
    });

    return NextResponse.json({
      success: true,
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
        dailySessions,
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
        userMessagesCount: s.messages?.filter((m: any) => m.role === "user").length || 0,
        messages: s.messages || [],
      })),
    });
  } catch (error) {
    console.error("Lỗi lấy dữ liệu xu hướng chat AI:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi lấy thống kê AI." }, { status: 500 });
  }
}
