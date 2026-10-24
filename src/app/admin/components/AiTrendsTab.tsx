"use client";

import React, { useState, useEffect } from "react";
import {
  RefreshCw,
  MessageSquare,
  Eye,
  X,
  TrendingUp,
  BarChart3,
  Sparkles,
  Search,
  Send,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ShoppingCart,
  UserCheck,
  Copy,
  Calculator
} from "lucide-react";
import { useAdminToast } from "@/context/AdminToastContext";

export default function AiTrendsTab({ onOpenAgent }: { onOpenAgent?: () => void }) {
  const { adminToast } = useAdminToast();
  const [aiStats, setAiStats] = useState<any>(null);
  const [aiSessions, setAiSessions] = useState<any[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [selectedAiSession, setSelectedAiSession] = useState<any | null>(null);
  const [chatSearch, setChatSearch] = useState("");
  const [chatCustomerType, setChatCustomerType] = useState<string>("ALL");
  const [chatDateFrom, setChatDateFrom] = useState("");
  const [chatDateTo, setChatDateTo] = useState("");
  const [apiKeyStatus, setApiKeyStatus] = useState<any>(null);
  const [takeoverMessage, setTakeoverMessage] = useState("");
  const [sendingTakeover, setSendingTakeover] = useState(false);
  const [showTakeoverInput, setShowTakeoverInput] = useState(false);

  const fetchAiTrends = async () => {
    setLoadingAi(true);
    try {
      const params = new URLSearchParams();
      if (chatSearch) params.append("search", chatSearch);
      if (chatCustomerType !== "ALL") params.append("customerType", chatCustomerType);
      if (chatDateFrom) params.append("dateFrom", chatDateFrom);
      if (chatDateTo) params.append("dateTo", chatDateTo);
      const res = await fetch(`/api/admin/chat-trends?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setAiStats(data.stats);
        setAiSessions(data.sessions || []);
      }
    } catch { adminToast.error("Lỗi tải xu hướng AI"); }
    finally { setLoadingAi(false); }
  };

  const fetchApiKeyStatus = async () => {
    try {
      const res = await fetch("/api/admin/api-keys");
      const data = await res.json();
      if (res.ok && data.success) setApiKeyStatus(data);
    } catch { /* silent */ }
  };

  const handleSendTakeover = async () => {
    if (!selectedAiSession || !takeoverMessage.trim() || sendingTakeover) return;
    setSendingTakeover(true);
    try {
      const res = await fetch("/api/admin/chat-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedAiSession.sessionId,
          message: takeoverMessage.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        adminToast.success("Đã gửi tin nhắn trực tiếp tới khách hàng!");
        setSelectedAiSession((prev: any) => ({
          ...prev,
          messages: [...(prev.messages || []), data.message],
        }));
        setTakeoverMessage("");
        setShowTakeoverInput(false);
      } else {
        adminToast.error(data.error || "Không thể gửi tin nhắn.");
      }
    } catch {
      adminToast.error("Lỗi kết nối khi gửi tin nhắn tiếp quản.");
    } finally {
      setSendingTakeover(false);
    }
  };

  const handleQuickQuote = () => {
    if (!selectedAiSession) return;
    const sampleMsg = `[Báo giá từ ChillBanana]: Chuyên viên đã tiếp nhận yêu cầu về sản phẩm ${selectedAiSession.detectedKeywords || ""}. Quý khách có thể lựa chọn Đặt cọc 50% để mua hàng ngay, hoặc Thanh toán 100% để được ưu tiên chốt đơn tức thì. Vui lòng liên hệ hotline/zalo để được hỗ trợ chi tiết!`;
    setTakeoverMessage(sampleMsg);
    setShowTakeoverInput(true);
  };

  const handleSendLink = () => {
    if (!selectedAiSession) return;
    const kw = selectedAiSession.detectedKeywords ? encodeURIComponent(selectedAiSession.detectedKeywords) : "";
    const sampleMsg = `[Gợi ý link sản phẩm từ sàn Nhật]: Quý khách có thể tham khảo trực tiếp các mẫu sản phẩm tại Amazon JP (https://www.amazon.co.jp/s?k=${kw}) và Mercari JP (https://jp.mercari.com/search?keyword=${kw}). Sau đó gửi link vào đây để ChillBanana báo giá mua hộ nhé!`;
    setTakeoverMessage(sampleMsg);
    setShowTakeoverInput(true);
  };

  const handleCopySessionId = () => {
    if (!selectedAiSession) return;
    navigator.clipboard.writeText(selectedAiSession.sessionId);
    adminToast.success("Đã sao chép mã phiên chat vào clipboard!");
  };

  useEffect(() => {
    fetchAiTrends();
    fetchApiKeyStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
          <div className="space-y-6">
            
            {/* Header Description */}
            <div className="bg-gradient-to-r from-banana-500 via-amber-500 to-banana-600 text-navy-950 p-6 rounded-3xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center space-x-1.5 bg-navy-950 text-banana-300 text-xs font-bold px-3 py-1 rounded-full mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-banana-400" />
                  <span>Google Gemini AI Analytics Engine</span>
                </span>
                <h2 className="text-2xl font-serif font-bold text-navy-950">
                  Thống Kê Tag Chủ Đề &amp; Từ Khóa Trong Chat
                </h2>
                <p className="text-xs text-navy-900/80 mt-1 max-w-2xl">
                  Thống kê từ tag chủ đề và từ khóa website ghi nhận trong các phiên chat. Đây là tín hiệu nội bộ, không đại diện toàn thị trường; trợ lý AI có thể giải thích nhưng không tự thêm số liệu.
                </p>
              </div>

              <button
                onClick={fetchAiTrends}
                className="px-4 py-2.5 bg-navy-950 hover:bg-navy-900 text-white font-bold text-xs rounded-2xl shadow transition-all flex items-center space-x-2 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAi ? "animate-spin" : ""}`} />
                <span>Làm Mới Thống Kê</span>
              </button>
            </div>

            {/* API Key Failover Monitor */}
            {apiKeyStatus && (
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-navy-900 flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Hệ Thống API Key Pool (Gemini)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Tự động chuyển đổi khóa khi bị quá tải (HTTP 429/503). Đang có {apiKeyStatus.activeKeys}/{apiKeyStatus.totalKeys} khóa thực tế sẵn sàng.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {apiKeyStatus.keys?.map((k: any) => (
                    <div key={k.index} className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-medium flex items-center space-x-2 ${
                      k.status === "ACTIVE" 
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                        : "bg-rose-50 border-rose-200 text-rose-700"
                    }`}>
                      <span>Key {k.index}: {k.keyPreview}</span>
                      {k.pools && k.pools.length > 0 && (
                        <span className="text-[10px] opacity-70 font-sans">({k.pools.join(", ")})</span>
                      )}
                      {k.status === "ACTIVE" ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      ) : (
                        <span className="text-[10px] text-rose-500 animate-pulse">Nghỉ {k.cooldownRemainingSec}s</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metric Summaries */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-banana-100 flex items-center justify-center text-xl font-bold">💬</div>
                <div>
                  <span className="text-xs text-slate-500 font-medium">Tổng Phiên Hội Thoại</span>
                  <div className="text-2xl font-bold text-navy-900 font-mono">{aiStats?.totalSessions || 0}</div>
                  <div className="text-[10px] text-slate-400">{aiStats?.userMessages || 0} tin nhắn từ khách</div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-xl font-bold">⚡</div>
                <div>
                  <span className="text-xs text-slate-500 font-medium">Tổng Tin Nhắn Tư Vấn</span>
                  <div className="text-2xl font-bold text-navy-900 font-mono">{aiStats?.totalMessages || 0}</div>
                  <div className="text-[10px] text-slate-400">{aiStats?.aiMessages || 0} phản hồi từ AI</div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-banana-100 flex items-center justify-center text-xl font-bold">🔥</div>
                <div>
                  <span className="text-xs text-slate-500 font-medium">Từ Khóa Hot Nhất</span>
                  <div className="text-sm font-bold text-banana-700 mt-1 truncate max-w-[120px]">{aiStats?.hotKeyword || "—"}</div>
                  <div className="text-[10px] text-slate-400">Số phiên có tag này nhiều nhất</div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-xl font-bold">🎭</div>
                <div>
                  <span className="text-xs text-slate-500 font-medium">Cảm Xúc Chủ Đạo</span>
                  <div className="text-sm font-bold text-navy-900 mt-1">
                    {aiStats?.dominantSentiment === "positive" ? "😊 Tích cực" :
                     aiStats?.dominantSentiment === "complaint" ? "😤 Phàn nàn" : "🤔 Tìm hiểu"}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {aiStats?.sentimentSummary?.positive || 0} tích cực • {aiStats?.sentimentSummary?.complaint || 0} phàn nàn (tag phiên)
                  </div>
                </div>
              </div>
            </div>

            {/* Two Column Layout: Top Keywords & Topics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Top Keywords / Products */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="font-bold text-sm text-navy-900 flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-banana-600" />
                    <span>Top Từ Khóa Được Gắn Vào Phiên Chat</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">Đếm phiên có tag · không phải lượt tìm kiếm</span>
                </div>

                <div className="space-y-2.5">
                  {aiStats?.topKeywords?.length > 0 ? (
                    aiStats.topKeywords.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-2.5 bg-slate-50 rounded-2xl hover:bg-banana-50/60 transition-colors">
                        <div className="flex items-center space-x-3">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            idx === 0 ? "bg-banana-500 text-navy-950 font-extrabold" :
                            idx === 1 ? "bg-slate-300 text-slate-900" :
                            idx === 2 ? "bg-amber-300 text-amber-950" : "bg-slate-200 text-slate-600"
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-slate-800">{item.keyword}</span>
                        </div>
                        <span className="font-mono font-bold text-navy-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                          {item.count} phiên có tag
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 py-4 text-center">Chưa có dữ liệu từ khóa.</p>
                  )}
                </div>
              </div>

              {/* Topics Breakdown */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="font-bold text-sm text-navy-900 flex items-center space-x-2">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                    <span>Phân Bổ Chủ Đề Quan Tâm</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">Danh mục thị trường</span>
                </div>

                <div className="space-y-3">
                  {aiStats?.topicsChart?.map((topic: any, idx: number) => {
                    const pct = Math.round((topic.count / (aiStats.totalSessions || 1)) * 100);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700">{topic.name}</span>
                          <span className="font-mono font-bold text-slate-900">{topic.count} lượt ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-banana-400 to-amber-500 rounded-full"
                            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-bold text-indigo-950"><Sparkles className="h-4 w-4 text-indigo-600" />Cần phân tích sâu hơn?</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-indigo-800">Trợ lý AI sẽ dùng tag chat và số liệu mới nhất, đồng thời nêu rõ giới hạn dữ liệu thay vì khẳng định xu hướng thị trường.</p>
                    </div>
                    <button onClick={onOpenAgent} className="shrink-0 rounded-xl bg-indigo-700 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-800">Mở AI Agent · Xu hướng khách</button>
                  </div>
                </div>
              </div>

            </div>

            {/* Recent Conversations Inspector */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-navy-900 flex items-center space-x-2">
                      <MessageSquare className="w-4 h-4 text-banana-600" />
                      <span>Lịch Sử Các Phiên Chat Của Khách Hàng (Lưu Trữ CSDL)</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">KPI tính trên toàn bộ kết quả lọc; bảng dưới hiển thị tối đa 150 phiên mới nhất. Nhấp để xem nội dung đã lưu.</p>
                  </div>
                </div>
                
                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm ID, email, số điện thoại, nội dung..."
                      value={chatSearch}
                      onChange={(e) => setChatSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && fetchAiTrends()}
                      className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={chatDateFrom}
                      onChange={(e) => setChatDateFrom(e.target.value)}
                      className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500"
                      title="Từ ngày"
                    />
                    <input
                      type="date"
                      value={chatDateTo}
                      onChange={(e) => setChatDateTo(e.target.value)}
                      className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500"
                      title="Đến ngày"
                    />
                    <select
                      value={chatCustomerType}
                      onChange={(e) => setChatCustomerType(e.target.value)}
                      className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500 bg-white"
                    >
                      <option value="ALL">Tất cả khách hàng</option>
                      <option value="REGISTERED">Thành viên</option>
                      <option value="GUEST_ORDER">Khách mua hàng</option>
                      <option value="CHAT_LEAD">Khách tiềm năng (Lead)</option>
                      <option value="ANONYMOUS_GUEST">Khách vô danh</option>
                    </select>
                    <button
                      onClick={fetchAiTrends}
                      className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors flex items-center space-x-1"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Lọc</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-4">Khách Hàng</th>
                      <th className="p-4">Phiên Chat</th>
                      <th className="p-4">Chủ Đề & Từ Khóa</th>
                      <th className="p-4 text-center">Tương Tác</th>
                      <th className="p-4 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {aiSessions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400">
                          Chưa có phiên trò chuyện nào phù hợp với bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      aiSessions.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-navy-900">{s.customerName || "Khách Ẩn Danh"}</span>
                              {(s.customerEmail || s.customerPhone) && (
                                <span className="text-[10px] text-slate-500">{s.customerEmail} {s.customerPhone ? `• ${s.customerPhone}` : ""}</span>
                              )}
                              <span className={`inline-block mt-1 px-2 py-0.5 w-fit rounded-full text-[9px] font-bold ${
                                s.customerType === "REGISTERED" ? "bg-emerald-100 text-emerald-800" :
                                s.customerType === "GUEST_ORDER" ? "bg-amber-100 text-amber-800" :
                                s.customerType === "CHAT_LEAD" ? "bg-purple-100 text-purple-800" : "bg-slate-100 text-slate-500"
                              }`}>
                                {s.customerType === "REGISTERED" ? "Thành Viên" :
                                 s.customerType === "GUEST_ORDER" ? "Khách Mua" :
                                 s.customerType === "CHAT_LEAD" ? "Lead Tiềm Năng" : "Vô Danh"}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="text-[11px] text-slate-500 font-mono mb-1">{s.sessionId.substring(0, 16)}...</div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              {s.personality === "omotenashi" ? "🇯🇵 Omotenashi" : "🇻🇳 Thân thiện"}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="font-medium text-slate-800">{s.topic}</div>
                            <div className="text-[10px] text-slate-500 truncate max-w-[200px] mt-0.5">{s.detectedKeywords || "—"}</div>
                          </td>
                          <td className="p-4 text-center">
                            <span className="font-mono font-bold text-navy-900 bg-white border border-slate-200 px-2 py-1 rounded-lg shadow-sm">
                              {s.messagesCount} msgs
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => setSelectedAiSession(s)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-banana-100 hover:text-banana-900 text-slate-700 font-bold text-xs rounded-xl transition-colors inline-flex items-center space-x-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Xem lịch sử</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

      {/* MODAL 2: XEM CHI TIẾT ĐỐI THOẠI AI CỦA KHÁCH HÀNG & TIẾP QUẢN TRỰC TIẾP */}
      {selectedAiSession && (() => {
        const isHotLead = selectedAiSession.customerType === "CHAT_LEAD" ||
          selectedAiSession.topic?.includes("Buying Lead") ||
          /jpy|yên|triệu|¥/i.test(selectedAiSession.detectedKeywords || "");

        const budgetMatch = selectedAiSession.detectedKeywords?.match(/(\d+(?:\.\d+)?\s*(?:-\s*\d+(?:\.\d+)?\s*)?(?:JPY|yên|triệu|VND|¥))/i);
        const recognizedBudget = budgetMatch ? budgetMatch[0] : null;

        const needsHumanAssistance = selectedAiSession.messages?.some((m: any) =>
          /kết quả đâu|vẫn chưa có|sao lâu thế|lỗi|chưa có/i.test(m.content)
        );

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 relative my-8 flex flex-col max-h-[90vh]">
              <button
                onClick={() => { setSelectedAiSession(null); setShowTakeoverInput(false); }}
                className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Modal Header & Intelligence Tags */}
              <div className="border-b pb-4 mb-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopySessionId}
                    title="Sao chép mã phiên"
                    className="text-[10px] font-bold text-banana-900 bg-banana-100 hover:bg-banana-200 px-2.5 py-0.5 rounded-full border border-banana-200 font-mono flex items-center gap-1 transition"
                  >
                    <span>Phiên: {selectedAiSession.sessionId.substring(0, 18)}...</span>
                    <Copy className="w-3 h-3 text-banana-700" />
                  </button>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedAiSession.customerType === "REGISTERED" ? "bg-emerald-100 text-emerald-800" :
                    selectedAiSession.customerType === "CHAT_LEAD" ? "bg-purple-100 text-purple-800" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {selectedAiSession.customerType === "REGISTERED" ? "Thành Viên" :
                     selectedAiSession.customerType === "CHAT_LEAD" ? "Hot Lead Tiềm Năng" : "Khách Vãng Lai"}
                  </span>
                  {selectedAiSession.customerName && (
                    <span className="text-[11px] font-bold text-navy-900">
                      Khách: {selectedAiSession.customerName}
                    </span>
                  )}
                  {selectedAiSession.customerEmail && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      ({selectedAiSession.customerEmail})
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-navy-950">
                    Lịch Sử Trò Chuyện Khách Hàng ⇄ Gemini AI Agent
                  </h3>
                  {/* Trạng thái AI */}
                  {needsHumanAssistance ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>AI cần hỗ trợ (Khách thúc giục/chờ kết quả)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>AI phản hồi bình thường</span>
                    </span>
                  )}
                </div>

                {/* Badges bar */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                  <span className="px-2.5 py-1 rounded-xl font-bold bg-indigo-50 border border-indigo-200 text-indigo-800 flex items-center gap-1">
                    <span>Ý định:</span>
                    <strong>{selectedAiSession.topic}</strong>
                  </span>

                  {recognizedBudget && (
                    <span className="px-2.5 py-1 rounded-xl font-bold bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-1">
                      <span>Ngân sách:</span>
                      <strong>{recognizedBudget}</strong>
                    </span>
                  )}

                  <span className={`px-2.5 py-1 rounded-xl font-bold border flex items-center gap-1 ${
                    isHotLead ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-slate-50 border-slate-200 text-slate-700"
                  }`}>
                    <span>Tiềm năng:</span>
                    <strong>{isHotLead ? "🔥 Hot Lead (Sẵn sàng mua)" : "Khách hỏi thông tin"}</strong>
                  </span>
                </div>
              </div>

              {/* Messages Transcript */}
              <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-slate-50 rounded-2xl border text-xs">
                {selectedAiSession.messages?.map((msg: any, idx: number) => {
                  const isStaff = msg.content?.startsWith("[Hỗ trợ trực tiếp") || msg.categoryTag === "HUMAN_TAKEOVER";
                  return (
                    <div
                      key={msg.id || idx}
                      className={`flex items-start gap-2 ${
                        msg.role === "user" ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          msg.role === "user"
                            ? "bg-navy-900 text-white"
                            : isStaff
                            ? "bg-indigo-600 text-white font-extrabold"
                            : "bg-banana-500 text-navy-950 font-extrabold"
                        }`}
                      >
                        {msg.role === "user" ? "Khách" : isStaff ? "Admin" : "🍌"}
                      </div>

                      <div
                        className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${
                          msg.role === "user"
                            ? "bg-navy-900 text-white rounded-tr-none"
                            : isStaff
                            ? "bg-indigo-50 border border-indigo-200 text-indigo-950 rounded-tl-none shadow-sm font-medium"
                            : "bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Human Takeover Interactive Panel */}
              {showTakeoverInput && (
                <div className="mt-3 p-3 bg-indigo-50/80 rounded-2xl border border-indigo-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-950">
                    <span className="flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-indigo-600" />
                      Tiếp Quản Hội Thoại &amp; Phản Hồi Trực Tiếp Tới Khách Hàng
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowTakeoverInput(false)}
                      className="text-[11px] text-slate-500 hover:text-slate-800"
                    >
                      Đóng ô nhập
                    </button>
                  </div>
                  <textarea
                    value={takeoverMessage}
                    onChange={(e) => setTakeoverMessage(e.target.value)}
                    rows={2}
                    maxLength={2000}
                    placeholder="Nhập nội dung tư vấn, gửi link sản phẩm Nhật hoặc báo giá trực tiếp vào phiên chat khách..."
                    className="w-full rounded-xl border border-indigo-200 bg-white p-2.5 text-xs text-slate-800 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTakeoverInput(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleSendTakeover}
                      disabled={!takeoverMessage.trim() || sendingTakeover}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{sendingTakeover ? "Đang gửi..." : "Gửi tới phiên chat khách"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Modal Action Bar */}
              <div className="pt-3 border-t mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTakeoverInput(true)}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>💬 Tiếp quản &amp; Chat trực tiếp</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickQuote}
                    className="px-3.5 py-2 bg-banana-500 hover:bg-banana-400 text-navy-950 rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>🛒 Tạo Báo Giá Nhanh</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSendLink}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>🔗 Đẩy Link Sàn Nhật</span>
                  </button>
                  <a
                    href="/tracking"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Tra cứu đơn</span>
                  </a>
                  <a
                    href="/#calculator-section"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Bảng tính giá</span>
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => { setSelectedAiSession(null); setShowTakeoverInput(false); }}
                  className="px-5 py-2 bg-navy-950 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}

          </div>
  );
}
