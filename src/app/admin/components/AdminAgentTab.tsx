"use client";

import React, { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowUp, BarChart3, Bot, Boxes, ClipboardList, MessageSquareText, PackageSearch, Users, Sparkles } from "lucide-react";
import { ADMIN_AI_MODULES, AdminAiModuleId } from "@/lib/admin-ai/definitions";

type AgentMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  dataAsOf?: string;
};

const moduleIcons: Record<AdminAiModuleId, React.ReactNode> = {
  overview: <Sparkles className="h-4 w-4" />,
  reports: <BarChart3 className="h-4 w-4" />,
  trends: <MessageSquareText className="h-4 w-4" />,
  orders: <ClipboardList className="h-4 w-4" />,
  products: <Boxes className="h-4 w-4" />,
  customers: <Users className="h-4 w-4" />,
};

const quickPrompts: Record<AdminAiModuleId, string[]> = {
  overview: ["Tóm tắt tình hình hiện tại và các điểm cần chú ý.", "Có số liệu nào tăng hoặc giảm đáng chú ý?"],
  reports: ["So sánh 30 ngày gần nhất với 30 ngày trước đó.", "Giải thích doanh thu thực thu và giá trị đơn ước tính."],
  trends: ["Các chủ đề nào được ghi nhận nhiều nhất trong 30 ngày?", "Dữ liệu chat có giới hạn gì trước khi dùng để ra quyết định?"],
  orders: ["Có bao nhiêu đơn chờ cọc quá 3 ngày?", "Đơn nào đang mở lâu nhất và đang ở trạng thái nào?"],
  products: ["Sản phẩm nào đang còn ít suất hiển thị?", "Tên mặt hàng nào có nhiều đơn nhất trong 30 ngày?"],
  customers: ["Tóm tắt số khách đăng ký mới trong 30 ngày.", "So sánh số phiên chat với số đơn theo loại khách."],
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

export default function AdminAgentTab({ initialModule = "overview" }: { initialModule?: AdminAiModuleId }) {
  const [moduleId, setModuleId] = useState<AdminAiModuleId>(initialModule);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setModuleId(initialModule);
    setMessages([]);
    setError("");
  }, [initialModule]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const chooseModule = (nextModule: AdminAiModuleId) => {
    if (nextModule === moduleId) return;
    setModuleId(nextModule);
    setMessages([]);
    setError("");
  };

  const askAgent = async (event: FormEvent) => {
    event.preventDefault();
    const cleanQuestion = question.trim();
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
      }]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Có lỗi khi kết nối trợ lý AI.";
      setError(message);
    } finally {
      setLoading(false);
    }
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
              <div className="mx-auto max-w-2xl py-5 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-banana-100 text-banana-700"><Sparkles className="h-6 w-6" /></div>
                <h4 className="font-bold text-slate-800">Bạn muốn xem điều gì về {activeModule.label.toLowerCase()}?</h4>
                <p className="mt-1 text-xs text-slate-500">Câu trả lời dựa trên số liệu website đang lưu, không tự tra cứu dữ liệu thị trường bên ngoài.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {quickPrompts[moduleId].map((prompt) => (
                    <button key={prompt} type="button" onClick={() => setQuestion(prompt)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-700 hover:border-banana-300 hover:bg-banana-50">{prompt}</button>
                  ))}
                </div>
              </div>
            ) : messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[92%] rounded-2xl px-4 py-3 sm:max-w-[82%] ${message.role === "user" ? "rounded-br-md bg-navy-900 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-800 shadow-sm"}`}>
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
