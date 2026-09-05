import { AIPersonality, ChatSessionRecord, TrendAnalytics } from "@/types";

// In-memory + Database storage for Chat Sessions & Customer Trends
export interface StoredChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  categoryTag?: string;
  createdAt: string;
}

export interface StoredChatSession {
  id: string;
  sessionId: string;
  personality: AIPersonality;
  topic?: string;
  detectedKeywords: string[];
  sentiment?: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredChatMessage[];
}

const INITIAL_SAMPLES: StoredChatSession[] = [
  {
    id: "session-sample-1",
    sessionId: "sess-1001",
    personality: "omotenashi",
    topic: "Mô hình & Anime",
    detectedKeywords: ["gundam", "gunpla", "rx-78-2", "bandai"],
    sentiment: "inquiry",
    createdAt: "2026-09-04T14:20:00.000Z",
    updatedAt: "2026-09-04T14:22:00.000Z",
    messages: [
      {
        id: "msg-1-1",
        sessionId: "sess-1001",
        role: "user",
        content: "Bên bạn có nhận mua mô hình Gundam RG RX-78-2 Ver 2.0 của Bandai không?",
        categoryTag: "anime",
        createdAt: "2026-09-04 14:20",
      },
      {
        id: "msg-1-2",
        sessionId: "sess-1001",
        role: "assistant",
        content: "Dạ thưa Quý khách, ChillBanana nhận mua hộ tất cả các mẫu Gundam Bandai chính hãng từ Amazon JP và Surugaya. Quý khách chỉ cần dán link sản phẩm là hệ thống tự động tính chi phí trọn gói ạ!",
        createdAt: "2026-09-04 14:21",
      },
    ],
  },
  {
    id: "session-sample-2",
    sessionId: "sess-1002",
    personality: "vietnamese",
    topic: "Gia Dụng & Điện Tử Mini",
    detectedKeywords: ["nồi cơm zojirushi", "điện áp 100v", "biến áp lioa"],
    sentiment: "inquiry",
    createdAt: "2026-09-04T15:10:00.000Z",
    updatedAt: "2026-09-04T15:13:00.000Z",
    messages: [
      {
        id: "msg-2-1",
        sessionId: "sess-1002",
        role: "user",
        content: "Nồi cơm điện cao tần Zojirushi ở Nhật về Việt Nam có cắm điện dùng được không shop?",
        categoryTag: "gadgets",
        createdAt: "2026-09-04 15:10",
      },
      {
        id: "msg-2-2",
        sessionId: "sess-1002",
        role: "assistant",
        content: "Dạ đồ điện nội địa Nhật như nồi cơm Zojirushi dùng nguồn điện 100V, anh/chị cần mua thêm cục biến áp đổi nguồn (tầm 1500W-2000W) cắm vào là xài bền bỉ 10-20 năm cực ngon luôn ạ! 🍌",
        createdAt: "2026-09-04 15:11",
      },
    ],
  },
  {
    id: "session-sample-3",
    sessionId: "sess-1003",
    personality: "vietnamese",
    topic: "Mỹ Phẩm & Chăm Sóc Da",
    detectedKeywords: ["kem chống nắng anessa", "dhc tẩy trang", "hạn sử dụng batch code"],
    sentiment: "inquiry",
    createdAt: "2026-09-04T16:30:00.000Z",
    updatedAt: "2026-09-04T16:35:00.000Z",
    messages: [
      {
        id: "msg-3-1",
        sessionId: "sess-1003",
        role: "user",
        content: "Kem chống nắng Anessa nội địa Nhật kiểm tra hạn sử dụng thế nào vậy em?",
        categoryTag: "cosmetics",
        createdAt: "2026-09-04 16:30",
      },
      {
        id: "msg-3-2",
        sessionId: "sess-1003",
        role: "assistant",
        content: "Dạ mỹ phẩm Nhật thường in mã lô (Batch code) dưới đáy chai, hạn sử dụng chuẩn là 3 năm chưa mở nắp và 12 tháng sau khi mở nắp nha bạn ơi! Hàng ChillBanana mua date luôn mới nhất ạ! ✨",
        createdAt: "2026-09-04 16:31",
      },
    ],
  },
];

const globalForChat = global as unknown as { chatStore: StoredChatSession[] };
export const chatStore: StoredChatSession[] = globalForChat.chatStore || [...INITIAL_SAMPLES];
if (process.env.NODE_ENV !== "production") globalForChat.chatStore = chatStore;

// Hàm phân tích từ khóa và danh mục từ tin nhắn của người dùng
export function extractKeywordsAndCategory(text: string): { keywords: string[]; category: string } {
  const lower = text.toLowerCase();
  const keywords: string[] = [];
  let category = "general";

  // Phân loại
  if (lower.includes("gundam") || lower.includes("gunpla") || lower.includes("figure") || lower.includes("anime") || lower.includes("luffy") || lower.includes("bandai")) {
    category = "anime";
    if (lower.includes("gundam")) keywords.push("gundam");
    if (lower.includes("gunpla")) keywords.push("gunpla");
    if (lower.includes("figure")) keywords.push("figure");
    if (lower.includes("luffy")) keywords.push("luffy gear 5");
    if (lower.includes("bandai")) keywords.push("bandai");
  } else if (lower.includes("chuột") || lower.includes("mouse") || lower.includes("bàn phím") || lower.includes("tai nghe") || lower.includes("nồi cơm") || lower.includes("máy cạo râu") || lower.includes("100v")) {
    category = "gadgets";
    if (lower.includes("chuột") || lower.includes("mouse")) keywords.push("chuột gaming");
    if (lower.includes("bàn phím")) keywords.push("bàn phím");
    if (lower.includes("nồi cơm")) keywords.push("nồi cơm zojirushi");
    if (lower.includes("100v")) keywords.push("điện áp 100V");
  } else if (lower.includes("dhc") || lower.includes("anessa") || lower.includes("kem") || lower.includes("son") || lower.includes("mỹ phẩm") || lower.includes("hada labo")) {
    category = "cosmetics";
    if (lower.includes("anessa")) keywords.push("anessa sun");
    if (lower.includes("dhc")) keywords.push("dhc tẩy trang");
    if (lower.includes("son")) keywords.push("son dưỡng");
  } else if (lower.includes("tảo") || lower.includes("orihiro") || lower.includes("ginkgo") || lower.includes("vitamin") || lower.includes("bổ não")) {
    category = "health";
    if (lower.includes("tảo")) keywords.push("tảo xoắn spirulina");
    if (lower.includes("orihiro")) keywords.push("orihiro ginkgo");
    if (lower.includes("vitamin")) keywords.push("vitamin dHC");
  } else if (lower.includes("size") || lower.includes("kích thước") || lower.includes("giày") || lower.includes("áo") || lower.includes("uniqlo")) {
    category = "sizing";
    if (lower.includes("size")) keywords.push("quy đổi size");
    if (lower.includes("giày")) keywords.push("size giày cm");
    if (lower.includes("uniqlo")) keywords.push("áo uniqlo");
  } else if (lower.includes("gộp đơn") || lower.includes("cước") || lower.includes("phí ship") || lower.includes("tỷ giá")) {
    category = "shipping";
    if (lower.includes("gộp đơn")) keywords.push("gộp đơn tiết kiệm");
    if (lower.includes("tỷ giá")) keywords.push("tỷ giá yên");
  }

  return { keywords, category };
}

// Lưu tin nhắn vào session
export function saveChatInteraction(
  sessionId: string,
  userMessage: string,
  assistantMessage: string,
  personality: AIPersonality
) {
  const now = new Date().toISOString();
  const nowFormatted = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  
  let session = chatStore.find((s) => s.sessionId === sessionId);
  const analysis = extractKeywordsAndCategory(userMessage);

  if (!session) {
    session = {
      id: "sess-" + Date.now(),
      sessionId,
      personality,
      topic: analysis.category !== "general" ? analysis.category : "Tư vấn tổng quát",
      detectedKeywords: analysis.keywords,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    chatStore.unshift(session);
  } else {
    session.updatedAt = now;
    session.personality = personality;
    if (analysis.keywords.length > 0) {
      for (const kw of analysis.keywords) {
        if (!session.detectedKeywords.includes(kw)) {
          session.detectedKeywords.push(kw);
        }
      }
    }
  }

  session.messages.push({
    id: "msg-" + Date.now() + "-u",
    sessionId,
    role: "user",
    content: userMessage,
    categoryTag: analysis.category,
    createdAt: nowFormatted,
  });

  session.messages.push({
    id: "msg-" + Date.now() + "-a",
    sessionId,
    role: "assistant",
    content: assistantMessage,
    createdAt: nowFormatted,
  });
}

// Tổng hợp thống kê xu hướng khách hàng cho Admin
export function getChatTrendAnalytics(): TrendAnalytics {
  const totalChats = chatStore.length;
  let totalMessages = 0;
  const keywordMap: Record<string, { count: number; category: string }> = {};
  const categoryCountMap: Record<string, number> = {
    anime: 0,
    gadgets: 0,
    cosmetics: 0,
    health: 0,
    sizing: 0,
    shipping: 0,
    general: 0,
  };

  for (const session of chatStore) {
    totalMessages += session.messages.length;

    for (const msg of session.messages) {
      if (msg.role === "user" && msg.categoryTag) {
        categoryCountMap[msg.categoryTag] = (categoryCountMap[msg.categoryTag] || 0) + 1;
      }
    }

    for (const kw of session.detectedKeywords) {
      if (!keywordMap[kw]) {
        keywordMap[kw] = { count: 0, category: session.topic || "Khác" };
      }
      keywordMap[kw].count += 1;
    }
  }

  // Top Keywords
  const topKeywords = Object.entries(keywordMap)
    .map(([keyword, data]) => ({ keyword, count: data.count, category: data.category }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Category breakdown
  const totalCategorized = Object.values(categoryCountMap).reduce((a, b) => a + b, 0) || 1;
  const categoryLabels: Record<string, string> = {
    anime: "Mô Hình & Anime",
    gadgets: "Gia Dụng & Điện Tử",
    cosmetics: "Mỹ Phẩm & Làm Đẹp",
    health: "Thực Phẩm Chức Năng",
    sizing: "Tư Vấn Size & Quần Áo",
    shipping: "Cước Phí & Gộp Đơn",
    general: "Khác / Tổng Quát",
  };

  const categoryBreakdown = Object.entries(categoryCountMap)
    .filter(([_, count]) => count > 0)
    .map(([catKey, count]) => ({
      category: categoryLabels[catKey] || catKey,
      count,
      percentage: Math.round((count / totalCategorized) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  const recentSessions: ChatSessionRecord[] = chatStore.slice(0, 20).map((s) => ({
    id: s.id,
    sessionId: s.sessionId,
    personality: s.personality,
    topic: s.topic,
    detectedKeywords: s.detectedKeywords,
    messageCount: s.messages.length,
    lastMessage: s.messages[s.messages.length - 1]?.content || "",
    createdAt: new Date(s.createdAt).toLocaleString("vi-VN"),
    updatedAt: new Date(s.updatedAt).toLocaleString("vi-VN"),
    messages: s.messages,
  }));

  return {
    totalChats,
    totalMessages,
    topKeywords,
    categoryBreakdown,
    recentSessions,
  };
}
