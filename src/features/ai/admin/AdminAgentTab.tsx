"use client";

import React, { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowUp, BarChart3, Bot, Boxes, ClipboardList, MessageSquareText, PackageSearch, Users, Sparkles, CheckCheck, Truck, CreditCard, Mail } from "lucide-react";
import { ADMIN_AI_MODULES, AdminAiModuleId } from "./definitions";
import type { ActionItem } from "./action-items";

type AgentMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  dataAsOf?: string;
  resolvedModules?: string[];
};

const moduleIcons: Record<AdminAiModuleId, React.ReactNode> = {
  auto: <Sparkles className="h-4 w-4 text-amber-500" />,
  overview: <Sparkles className="h-4 w-4" />,
  reports: <BarChart3 className="h-4 w-4" />,
  trends: <MessageSquareText className="h-4 w-4" />,
  orders: <ClipboardList className="h-4 w-4" />,
  products: <Boxes className="h-4 w-4" />,
  customers: <Users className="h-4 w-4" />,
  approvals: <CheckCheck className="h-4 w-4" />,
  logistics: <Truck className="h-4 w-4" />,
  payments: <CreditCard className="h-4 w-4" />,
  emails: <Mail className="h-4 w-4" />,
};

const quickPrompts: Record<AdminAiModuleId, string[]> = {
  auto: ["Hôm nay có những vấn đề gì cần ưu tiên xử lý?", "Tình hình đơn hàng chờ duyệt giá và thanh toán?", "Có đơn hàng nào đứng yên hoặc email gửi lỗi không?"],
  overview: ["Tóm tắt tình hình hiện tại và các điểm cần chú ý.", "Có số liệu nào tăng hoặc giảm đáng chú ý?"],
  reports: ["So sánh 30 ngày gần nhất với 30 ngày trước đó.", "Giải thích doanh thu thực thu và giá trị đơn ước tính."],
  trends: ["Các chủ đề nào được ghi nhận nhiều nhất trong 30 ngày?", "Dữ liệu chat có giới hạn gì trước khi dùng để ra quyết định?"],
  orders: ["Có bao nhiêu đơn chờ cọc quá 3 ngày?", "Đơn nào đang mở lâu nhất và đang ở trạng thái nào?"],
  products: ["Sản phẩm nào đang còn ít suất hiển thị?", "Tên mặt hàng nào có nhiều đơn nhất trong 30 ngày?"],
  customers: ["Tóm tắt số khách đăng ký mới trong 30 ngày.", "So sánh số phiên chat với số đơn theo loại khách."],
  approvals: ["Có bao nhiêu đơn chờ duyệt giá quá 4 giờ?", "Những đơn nào chưa duyệt giá mà cân nặng bằng 0?", "Đơn chờ cọc nào sắp hết hạn giữ chỗ?"],
  logistics: ["Những đơn nào đứng yên quá 3 ngày theo từng trạng thái?", "Vận đơn VN->JP nào có hàng cần lưu ý kiểm dịch MAFF?"],
  payments: ["Có đơn nào khách đã cọc nhưng trạng thái vẫn là chờ cọc không?", "Tỷ giá hiện tại có bị cũ hoặc biến động không?"],
  emails: ["Có bao nhiêu email thông báo đang bị lỗi cần gửi lại?", "Các lỗi email gần đây chủ yếu là gì?"],
};

function renderAnswer(content: string) {
  return content.split("\n").map((line, lineIndex) => {
    const isBullet = line.trimStart().startsWith("- ") || line.trimStart().startsWith("• ");
    const cleanLine = isBullet ? line.trimStart().slice(2) : line;
    const pieces = cleanLine.split(/(\*\*[^*]+\*\*)/g);
    const formatted = pieces.map((piece, pieceIndex) => piece.startsWith("**") && piece.endsWith("**")
      ? <strong key={pieceIndex}>{piece.slice(2, -2)}</strong>
      : <React.Fragment key={pieceIndex}>{piece}</React.Fragment>);
    return <div key={lineIndex} className={isBullet ? "flex gap-2 pl-1" : "min-h-[1.25rem]"}>{isBullet && <span className="text-banana-600">•</span>}<span>{formatted}</span></div>;
  });
}

export default function AdminAgentTab({ initialModule = "auto", initialQuestion = "" }: { initialModule?: AdminAiModuleId; initialQuestion?: string }) {
  const [moduleId, setModuleId] = useState<AdminAiModuleId>(initialModule);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [question, setQuestion] = useState(initialQuestion);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [operationalData, setOperationalData] = useState<any>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/admin/ai-analytics")
      .then((res) => res.json())
      .then((data) => {
        if (data.overview) setOperationalData(data);
      })
      .catch(() => { /* silent fallback */ });

    fetch("/api/admin/action-items")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.actionItems)) setActionItems(data.actionItems);
      })
      .catch(() => { /* silent fallback */ });
  }, []);

  useEffect(() => {
    setModuleId(initialModule);
    setMessages([]);
    setError("");
    if (initialQuestion) {
      setQuestion(initialQuestion);
    }
  }, [initialModule, initialQuestion]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const chooseModule = (nextModule: AdminAiModuleId) => {
    if (nextModule === moduleId) return;
    setModuleId(nextModule);
    setMessages([]);
    setError("");
  };

  const executePrompt = async (promptText: string) => {
    const cleanQuestion = promptText.trim();
    if (!cleanQuestion || loading) return;
    const currentHistory = messages.map(({ role, content }) => ({ role, content }));
    setQuestion("");
    setError("");
    setMessages((previous) => [...previous, { id: `user-${Date.now()}`, role: "user", content: cleanQuestion }]);
    setLoading(true);
    try {
      const response = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: moduleId, question: cleanQuestion, history: currentHistory }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Không thể tạo câu trả lời.");
      setMessages((previous) => [...previous, {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.answer,
        dataAsOf: data.dataAsOf,
        resolvedModules: data.resolvedModules,
      }]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Có lỗi khi kết nối trợ lý AI.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const askAgent = async (event: FormEvent) => {
    event.preventDefault();
    void executePrompt(question);
  };

  const activeModule = ADMIN_AI_MODULES.find((item) => item.id === moduleId)!;

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-banana-400/30 bg-banana-500/10 px-3 py-1 text-xs font-bold text-banana-200">
              <Bot className="h-4 w-4" /> Trợ lý AI quản trị · Gemini
            </div>
            <h2 className="text-2xl font-bold">Một trợ lý, nhiều nghiệp vụ</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">Chọn module để AI chỉ đọc đúng nhóm số liệu cần thiết. Mỗi câu hỏi lấy snapshot mới từ cơ sở dữ liệu.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
            <div className="font-bold text-emerald-300">Chế độ chỉ đọc</div>
            AI phân tích và đề xuất, không tự sửa đơn hàng, khách hàng hay sản phẩm.
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
            <PackageSearch className="h-4 w-4 text-banana-600" /> Chọn phạm vi hỗ trợ
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {ADMIN_AI_MODULES.map((item) => (
              <button key={item.id} type="button" onClick={() => chooseModule(item.id)}
                aria-pressed={moduleId === item.id}
                className={`rounded-2xl border p-3 text-left transition ${moduleId === item.id ? "border-banana-400 bg-banana-50 text-navy-950 ring-2 ring-banana-100" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}>
                <span className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl ${moduleId === item.id ? "bg-banana-400 text-navy-950" : "bg-slate-100 text-slate-600"}`}>{moduleIcons[item.id]}</span>
                <span className="block text-xs font-bold">{item.label}</span>
                <span className="mt-1 block text-[10px] leading-relaxed text-slate-500">{item.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-[360px] flex-col bg-slate-50/70">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
            <div>
              <h3 className="text-sm font-bold text-navy-950">Trợ lý {activeModule.label}</h3>
              <p className="text-[11px] text-slate-500">{activeModule.description}</p>
            </div>
            <button type="button" onClick={() => { setMessages([]); setError(""); }} disabled={loading || messages.length === 0}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-40">Cuộc trò chuyện mới</button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {messages.length === 0 ? (
              <div className="mx-auto max-w-4xl py-4 space-y-6">
                {/* Việc cần làm hôm nay — Tính toán bằng quy tắc xác định */}
                {actionItems.length > 0 && (
                  <div className="rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50/70 to-orange-50/50 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-amber-500 text-white font-bold text-xs">
                          !
                        </span>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-950">
                          Việc cần làm hôm nay ({actionItems.length} việc)
                        </h4>
                      </div>
                      <span className="text-[10px] text-amber-800 font-medium">Quy tắc xác định · AI giải thích</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      {actionItems.map((item) => (
                        <div key={item.id} className="rounded-xl border border-amber-200/90 bg-white p-3.5 shadow-sm flex flex-col justify-between hover:shadow transition">
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1.5">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                item.priority === "high" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                              }`}>
                                {item.priority === "high" ? "Khẩn cấp" : "Cần xử lý"}
                              </span>
                              <span className="text-[11px] text-slate-500 font-semibold">{item.itemCount} đơn/mục</span>
                            </div>
                            <h5 className="text-xs font-bold text-slate-900">{item.title}</h5>
                            <p className="mt-1 text-[11px] text-slate-600">{item.reason}</p>
                            {item.aiExplanation && (
                              <p className="mt-1.5 text-[11px] text-amber-900 bg-amber-50/80 rounded p-1.5 border border-amber-100 font-medium">
                                💡 {item.aiExplanation}
                              </p>
                            )}
                            {item.orderCodes.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {item.orderCodes.slice(0, 4).map((c) => (
                                  <span key={c} className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                                    {c}
                                  </span>
                                ))}
                                {item.orderCodes.length > 4 && (
                                  <span className="text-[10px] bg-slate-100 px-1 py-0.5 rounded text-slate-500">
                                    +{item.orderCodes.length - 4}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                            <a
                              href={item.deepLink}
                              className="text-[11px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 transition"
                            >
                              Mở xử lý ngay →
                            </a>
                            <button
                              type="button"
                              onClick={() => executePrompt(`Phân tích và hướng dẫn xử lý cho đầu việc: "${item.title}". Danh sách mã: ${item.orderCodes.join(", ")}`)}
                              className="text-[11px] text-slate-500 hover:text-navy-900 transition underline"
                            >
                              Hỏi trợ lý
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active AI Ops: Live Operational Cards */}
                <div>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-xs font-bold text-navy-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-banana-600" />
                      Trung Tâm Điều Hành Nghiệp Vụ Tức Thời (Live Operational Ops)
                    </span>
                    <span className="text-[10px] text-slate-400">Dữ liệu thời gian thực</span>
                  </div>

                  {moduleId === "orders" && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                            <span>Đơn chờ cọc &gt; 3 ngày</span>
                            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px]">Cần nhắc</span>
                          </div>
                          <div className="mt-2 text-2xl font-bold font-mono text-amber-950">
                            {operationalData?.operationalAlerts?.orders?.pendingDepositOver3Days ?? "..."} <span className="text-xs font-normal">đơn</span>
                          </div>
                          <p className="mt-1 text-[11px] text-amber-800/80">Khách chưa hoàn tất cọc 50% sau 72 giờ.</p>
                        </div>
                        <button type="button" onClick={() => executePrompt("Liệt kê các đơn hàng đang ở trạng thái chờ cọc quá 3 ngày và đề xuất hành động xử lý.")}
                          className="mt-3 w-full rounded-xl bg-amber-900 text-white py-1.5 text-xs font-bold hover:bg-amber-800 transition">
                          AI phân tích &amp; xử lý →
                        </button>
                      </div>

                      <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                            <span>Đơn chờ mua tại Nhật</span>
                            <span className="rounded-full bg-blue-200 px-2 py-0.5 text-[10px]">Mua hộ</span>
                          </div>
                          <div className="mt-2 text-2xl font-bold font-mono text-blue-950">
                            {operationalData?.operationalAlerts?.orders?.purchasingJp ?? "..."} <span className="text-xs font-normal">đơn</span>
                          </div>
                          <p className="mt-1 text-[11px] text-blue-800/80">Đã cọc thành công, đang trong hàng đợi buyout.</p>
                        </div>
                        <button type="button" onClick={() => executePrompt("Kiểm tra tiến độ các đơn hàng đã cọc đang chờ mua tại Nhật Bản (PURCHASING_JP).")}
                          className="mt-3 w-full rounded-xl bg-blue-900 text-white py-1.5 text-xs font-bold hover:bg-blue-800 transition">
                          Kiểm tra tác vụ mua →
                        </button>
                      </div>

                      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold text-rose-900">
                            <span>Đơn thiếu cân nặng (0kg)</span>
                            <span className="rounded-full bg-rose-200 px-2 py-0.5 text-[10px]">Cần cân</span>
                          </div>
                          <div className="mt-2 text-2xl font-bold font-mono text-rose-950">
                            {operationalData?.operationalAlerts?.orders?.unweighedOrders ?? "..."} <span className="text-xs font-normal">đơn</span>
                          </div>
                          <p className="mt-1 text-[11px] text-rose-800/80">Cần cân thực tế tại kho JP trước khi bay.</p>
                        </div>
                        <button type="button" onClick={() => executePrompt("Rà soát các đơn hàng chưa có cân nặng thực tế tại kho Nhật Bản để cập nhật cước bay.")}
                          className="mt-3 w-full rounded-xl bg-rose-900 text-white py-1.5 text-xs font-bold hover:bg-rose-800 transition">
                          Rà soát cân nặng →
                        </button>
                      </div>
                    </div>
                  )}

                  {(moduleId === "trends" || moduleId === "customers") && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-4 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                            <span>Lead Nóng từ AI Chat</span>
                            <span className="rounded-full bg-purple-200 px-2 py-0.5 text-[10px]">Hot Lead</span>
                          </div>
                          <div className="mt-2 text-2xl font-bold font-mono text-purple-950">
                            {operationalData?.operationalAlerts?.customersAndLeads?.hotLeads ?? "..."} <span className="text-xs font-normal">khách</span>
                          </div>
                          <p className="mt-1 text-[11px] text-purple-800/80">Khách đã hỏi giá/gửi ảnh nhưng chưa lên đơn.</p>
                        </div>
                        <button type="button" onClick={() => executePrompt("Tóm tắt danh sách Lead nóng từ chat AI chưa lên đơn hàng để nhân viên tư vấn chốt đơn.")}
                          className="mt-3 w-full rounded-xl bg-purple-900 text-white py-1.5 text-xs font-bold hover:bg-purple-800 transition">
                          Mở danh sách Hot Leads →
                        </button>
                      </div>

                      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                            <span>Phiên chat cần hỗ trợ</span>
                            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px]">Can thiệp</span>
                          </div>
                          <div className="mt-2 text-2xl font-bold font-mono text-amber-950">
                            {operationalData?.operationalAlerts?.customersAndLeads?.stuckSessions ?? "..."} <span className="text-xs font-normal">phiên</span>
                          </div>
                          <p className="mt-1 text-[11px] text-amber-800/80">Khách có phản hồi phàn nàn hoặc cần nhân viên tiếp quản.</p>
                        </div>
                        <button type="button" onClick={() => executePrompt("Có những phiên chat nào khách đang phàn nàn hoặc cần nhân viên can thiệp trực tiếp?")}
                          className="mt-3 w-full rounded-xl bg-amber-900 text-white py-1.5 text-xs font-bold hover:bg-amber-800 transition">
                          Xem phiên cần hỗ trợ →
                        </button>
                      </div>

                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                            <span>Khách hàng thành viên</span>
                            <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px]">Hệ thống</span>
                          </div>
                          <div className="mt-2 text-2xl font-bold font-mono text-emerald-950">
                            {operationalData?.operationalAlerts?.customersAndLeads?.totalCustomers ?? "..."} <span className="text-xs font-normal">thành viên</span>
                          </div>
                          <p className="mt-1 text-[11px] text-emerald-800/80">Đã đăng ký tài khoản trên nền tảng.</p>
                        </div>
                        <button type="button" onClick={() => executePrompt("Tóm tắt tình hình khách hàng đăng ký và tỷ lệ chuyển đổi sang đơn hàng trong 30 ngày qua.")}
                          className="mt-3 w-full rounded-xl bg-emerald-900 text-white py-1.5 text-xs font-bold hover:bg-emerald-800 transition">
                          Phân tích hành vi khách →
                        </button>
                      </div>
                    </div>
                  )}

                  {(moduleId === "overview" || moduleId === "reports") && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                            <span>Tiền cọc thực thu (JP ➔ VN)</span>
                            <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px]">Mua hộ</span>
                          </div>
                          <div className="mt-2 text-xl font-bold font-mono text-emerald-950">
                            {Number(operationalData?.overview?.jpVnCollectedRevenueVnd || 0).toLocaleString("vi-VN")} <span className="text-xs font-normal">đ</span>
                          </div>
                          <p className="mt-1 text-[11px] text-emerald-800/80">Cọc 50% / thanh toán 100% đã xác nhận.</p>
                        </div>
                        <button type="button" onClick={() => executePrompt("Giải thích doanh thu tiền cọc thực thu và đối chiếu với giá trị đơn ước tính.")}
                          className="mt-3 w-full rounded-xl bg-emerald-900 text-white py-1.5 text-xs font-bold hover:bg-emerald-800 transition">
                          Báo cáo doanh thu →
                        </button>
                      </div>

                      <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                            <span>Cước bay (VN ➔ JP)</span>
                            <span className="rounded-full bg-blue-200 px-2 py-0.5 text-[10px]">Vận chuyển</span>
                          </div>
                          <div className="mt-2 text-xl font-bold font-mono text-blue-950">
                            {Number(operationalData?.overview?.vnJpCollectedRevenueVnd || 0).toLocaleString("vi-VN")} <span className="text-xs font-normal">đ</span>
                          </div>
                          <p className="mt-1 text-[11px] text-blue-800/80">Vận chuyển ký gửi chiều đi Nhật.</p>
                        </div>
                        <button type="button" onClick={() => executePrompt("Báo cáo số liệu vận chuyển hàng không chiều Việt Nam đi Nhật Bản.")}
                          className="mt-3 w-full rounded-xl bg-blue-900 text-white py-1.5 text-xs font-bold hover:bg-blue-800 transition">
                          Xem chi tiết tuyến bay →
                        </button>
                      </div>

                      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                            <span>Tổng đơn toàn hệ thống</span>
                            <span className="rounded-full bg-indigo-200 px-2 py-0.5 text-[10px]">2 chiều</span>
                          </div>
                          <div className="mt-2 text-2xl font-bold font-mono text-indigo-950">
                            {operationalData?.overview?.totalOrdersAllTime ?? "..."} <span className="text-xs font-normal">đơn</span>
                          </div>
                          <p className="mt-1 text-[11px] text-indigo-800/80">Bao gồm cả đơn mua hộ JP và vận đơn VN-JP.</p>
                        </div>
                        <button type="button" onClick={() => executePrompt("Tóm tắt tình hình hiện tại và các điểm cần chú ý nhất trong vận hành.")}
                          className="mt-3 w-full rounded-xl bg-indigo-900 text-white py-1.5 text-xs font-bold hover:bg-indigo-800 transition">
                          Đánh giá hiệu quả →
                        </button>
                      </div>
                    </div>
                  )}

                  {moduleId === "products" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold text-rose-900">
                            <span>Sản phẩm sắp hết suất (≤ 2 slot)</span>
                            <span className="rounded-full bg-rose-200 px-2 py-0.5 text-[10px]">Cảnh báo</span>
                          </div>
                          <div className="mt-2 text-2xl font-bold font-mono text-rose-950">
                            {operationalData?.operationalAlerts?.products?.lowSlots ?? "..."} <span className="text-xs font-normal">sản phẩm</span>
                          </div>
                          <p className="mt-1 text-[11px] text-rose-800/80">Cần bổ sung suất hiển thị hoặc cập nhật catalog.</p>
                        </div>
                        <button type="button" onClick={() => executePrompt("Sản phẩm nào đang còn ít hơn 2 suất hiển thị trên website?")}
                          className="mt-3 w-full rounded-xl bg-rose-900 text-white py-1.5 text-xs font-bold hover:bg-rose-800 transition">
                          Xem sản phẩm ít suất →
                        </button>
                      </div>

                      <div className="rounded-2xl border border-banana-300 bg-banana-50/70 p-4 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold text-banana-950">
                            <span>Sản phẩm có nhiều đơn đặt</span>
                            <span className="rounded-full bg-banana-200 px-2 py-0.5 text-[10px]">Top Bán Chạy</span>
                          </div>
                          <div className="mt-2 text-base font-bold text-navy-950">
                            Thống kê 30 ngày qua
                          </div>
                          <p className="mt-1 text-[11px] text-slate-600">Nhóm sản phẩm được khách chọn mua nhiều nhất.</p>
                        </div>
                        <button type="button" onClick={() => executePrompt("Tên mặt hàng nào có nhiều đơn nhất trong 30 ngày qua?")}
                          className="mt-3 w-full rounded-xl bg-navy-950 text-white py-1.5 text-xs font-bold hover:bg-slate-800 transition">
                          Xem top sản phẩm bán chạy →
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Prompts */}
                <div className="pt-2 text-center">
                  <span className="text-xs text-slate-500 font-medium">Hoặc bấm chọn nhanh câu hỏi mẫu:</span>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {quickPrompts[moduleId].map((prompt) => (
                      <button key={prompt} type="button" onClick={() => executePrompt(prompt)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-700 hover:border-banana-300 hover:bg-banana-50 transition shadow-sm">
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[92%] rounded-2xl px-4 py-3 sm:max-w-[82%] ${message.role === "user" ? "rounded-br-md bg-navy-900 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-800 shadow-sm"}`}>
                  {message.role === "assistant" && message.resolvedModules && message.resolvedModules.length > 0 && (
                    <div className="mb-2 flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/80 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                        <Sparkles className="h-3 w-3 text-amber-600" />
                        Tự động chọn: {message.resolvedModules.join(", ")}
                      </span>
                    </div>
                  )}
                  <div className="break-words text-sm leading-relaxed">{message.role === "assistant" ? renderAnswer(message.content) : <div className="whitespace-pre-wrap">{message.content}</div>}</div>
                  {message.dataAsOf && <div className="mt-2 border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">Snapshot dữ liệu: {new Date(message.dataAsOf).toLocaleString("vi-VN")}</div>}
                </div>
              </div>
            ))}
            {loading && <div className="flex"><div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">Đang lấy số liệu mới và phân tích…</div></div>}
            {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={askAgent} className="border-t border-slate-200 bg-white p-3 sm:p-4">
            <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 focus-within:border-banana-400 focus-within:ring-2 focus-within:ring-banana-100">
              <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={2} maxLength={2000}
                onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
                placeholder={`Hỏi về ${activeModule.label.toLowerCase()}…`} className="max-h-36 min-h-12 flex-1 resize-y border-0 bg-transparent px-2 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0" />
              <button type="submit" disabled={!question.trim() || loading} aria-label="Gửi câu hỏi"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-banana-500 text-navy-950 hover:bg-banana-400 disabled:cursor-not-allowed disabled:opacity-50"><ArrowUp className="h-5 w-5" /></button>
            </div>
            <div className="mt-1 flex justify-between px-1 text-[10px] text-slate-400"><span>Enter để gửi · Shift + Enter để xuống dòng</span><span>{question.length}/2000</span></div>
          </form>
        </div>
      </section>
    </div>
  );
}
