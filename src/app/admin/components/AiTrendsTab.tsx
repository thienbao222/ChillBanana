"use client";

import React, { useState, useEffect } from "react";
import {
  RefreshCw, MessageSquare, AlertCircle, Eye, X, TrendingUp, Bot,
  BarChart3, Users, ShieldCheck, Sparkles, Search, Filter, Clock, Activity,
} from "lucide-react";
import { useAdminToast } from "@/context/AdminToastContext";

export default function AiTrendsTab() {
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
  const [insightsData, setInsightsData] = useState<any>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

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
                  Thống Kê Xu Hướng &amp; Nhu Cầu Khách Hàng (AI Chat Insights)
                </h2>
                <p className="text-xs text-navy-900/80 mt-1 max-w-2xl">
                  Dữ liệu hội thoại giữa khách hàng và Trợ lý Gemini AI được lưu trữ tự động vào CSDL, giúp doanh nghiệp nắm bắt mặt hàng hot, xu hướng tìm kiếm và tối ưu chiến dịch nhập hàng.
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
                  <p className="text-xs text-slate-500 mt-1">Tự động chuyển đổi khóa khi bị quá tải (HTTP 429/503). Đang có {apiKeyStatus.activeKeys} khóa sẵn sàng.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {apiKeyStatus.keys?.map((k: any) => (
                    <div key={k.index} className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-medium flex items-center space-x-2 ${
                      k.status === "ACTIVE" 
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                        : "bg-rose-50 border-rose-200 text-rose-700"
                    }`}>
                      <span>Key {k.index}: {k.keyPreview}</span>
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
                  <div className="text-[10px] text-slate-400">Xuất hiện nhiều nhất</div>
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
                    {aiStats?.sentimentSummary?.positive || 0} tích cực • {aiStats?.sentimentSummary?.complaint || 0} phàn nàn
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
                    <span>Top 10 Từ Khóa &amp; Sản Phẩm Được Khách Hỏi Nhiều Nhất</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">Trích xuất tự động</span>
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
                          {item.count} lượt hỏi
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
                            style={{ width: `${Math.min(100, Math.max(8, pct * 2))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* AI Business Insights Generator */}
                <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-banana-50 to-amber-50 border border-banana-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-banana-900 flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-banana-600" />
                      <span>Gợi Ý Kinh Doanh Từ AI (Gemini Analysis)</span>
                    </h4>
                    <button
                      onClick={async () => {
                        setLoadingInsights(true);
                        try {
                          const res = await fetch("/api/admin/ai-insights");
                          const data = await res.json();
                          if (res.ok && data.success) {
                            setInsightsData(data.insights);
                          }
                        } catch {} finally { setLoadingInsights(false); }
                      }}
                      disabled={loadingInsights}
                      className="px-3 py-1 bg-banana-500 hover:bg-banana-400 text-navy-950 font-bold text-[10px] rounded-xl transition-all flex items-center space-x-1 disabled:opacity-50"
                    >
                      {loadingInsights ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      <span>{loadingInsights ? "Đang phân tích..." : "Tạo Phân Tích AI"}</span>
                    </button>
                  </div>

                  {insightsData ? (
                    <div className="space-y-2.5 text-xs text-banana-900">
                      {insightsData.marketOverview && (
                        <p className="leading-relaxed">📊 <strong>Tổng quan:</strong> {insightsData.marketOverview}</p>
                      )}
                      {insightsData.topDemandProducts?.length > 0 && (
                        <div>
                          <p className="font-bold mb-1">🔥 Mặt hàng nhu cầu cao:</p>
                          {insightsData.topDemandProducts.map((p: any, i: number) => (
                            <p key={i} className="pl-3">• <strong>{p.name}</strong> — {p.reason}</p>
                          ))}
                        </div>
                      )}
                      {insightsData.groupBuySuggestions?.length > 0 && (
                        <div>
                          <p className="font-bold mb-1">📦 Đề xuất Gom Đơn:</p>
                          {insightsData.groupBuySuggestions.map((g: any, i: number) => (
                            <p key={i} className="pl-3">• <strong>{g.productName}</strong> (~{g.estimatedDemand} đơn, tiết kiệm {g.savingsPercent}% cước — {g.shippingMethod})</p>
                          ))}
                        </div>
                      )}
                      {insightsData.actionItems?.length > 0 && (
                        <div>
                          <p className="font-bold mb-1">✅ Hành động đề xuất:</p>
                          {insightsData.actionItems.map((a: string, i: number) => (
                            <p key={i} className="pl-3">• {a}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-banana-700">Bấm "Tạo Phân Tích AI" để Gemini tổng hợp xu hướng kinh doanh từ dữ liệu Chat & Đơn hàng thực tế.</p>
                  )}
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
                    <p className="text-xs text-slate-500 mt-0.5">Nhấp vào một phiên để xem toàn bộ nội dung trò chuyện với Gemini AI</p>
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

      {/* MODAL 2: XEM CHI TIẾT ĐỐI THOẠI AI CỦA KHÁCH HÀNG */}
      {selectedAiSession && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 relative my-8 flex flex-col max-h-[85vh]">
            <button
              onClick={() => setSelectedAiSession(null)}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="border-b pb-3 mb-3">
              <span className="text-[10px] font-bold text-banana-900 bg-banana-100 px-2.5 py-0.5 rounded-full border border-banana-200">
                Phiên: {selectedAiSession.sessionId}
              </span>
              <h3 className="text-base font-bold text-navy-900 mt-1">
                Lịch Sử Trò Chuyện Khách Hàng ⇄ Gemini AI Agent
              </h3>
              <p className="text-xs text-slate-500">
                Chủ đề nhận diện: <strong>{selectedAiSession.topic}</strong> • Từ khóa: {selectedAiSession.detectedKeywords || "Chưa có"}
              </p>
            </div>

            {/* Messages Transcript */}
            <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-slate-50 rounded-2xl border text-xs">
              {selectedAiSession.messages?.map((msg: any, idx: number) => (
                <div
                  key={msg.id || idx}
                  className={`flex items-start gap-2 ${
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      msg.role === "user" ? "bg-navy-900 text-white" : "bg-banana-500 text-navy-950 font-extrabold"
                    }`}
                  >
                    {msg.role === "user" ? "Khách" : "🍌"}
                  </div>

                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${
                      msg.role === "user"
                        ? "bg-navy-900 text-white rounded-tr-none"
                        : "bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 flex justify-end">
              <button
                onClick={() => setSelectedAiSession(null)}
                className="px-5 py-2 bg-navy-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

          </div>
  );
}
