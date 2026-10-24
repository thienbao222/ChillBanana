"use client";

import React, { useState } from "react";
import { Mail, Sparkles, AlertCircle, X, Send, Loader2, CheckCircle2 } from "lucide-react";
import { ControlledDraftType, CONTROLLED_DRAFT_DESCRIPTIONS } from "@/features/ai/admin/controlled-email";
import { useAdminToast } from "@/context/AdminToastContext";

interface OrderInfo {
  id?: string;
  orderCode: string;
  customerName: string;
  customerEmail: string;
  status: string;
}

interface Props {
  order: OrderInfo | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ControlledEmailModal({ order, onClose, onSuccess }: Props) {
  const { adminToast } = useAdminToast();
  const [draftType, setDraftType] = useState<ControlledDraftType>("price_verification");
  const [customInstructions, setCustomInstructions] = useState("");
  const [recipientEmail, setRecipientEmail] = useState(order?.customerEmail || "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);

  if (!order) return null;

  const handleDraftWithAi = async () => {
    setDrafting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/draft-customer-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode: order.orderCode,
          draftType,
          customInstructions: customInstructions.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Không thể tạo bản nháp email.");
      }

      setRecipientEmail(data.email.customerEmail || order.customerEmail);
      setSubject(data.email.draftSubject);
      setBody(data.email.draftBody);
      setIsDraftLoaded(true);
      adminToast.success("AI đã soạn thảo xong bản nháp email. Vui lòng rà soát trước khi gửi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi khi tạo bản nháp email.");
    } finally {
      setDrafting(false);
    }
  };

  const handleSendEmail = async () => {
    if (!subject.trim() || !body.trim() || !recipientEmail.trim()) {
      setError("Vui lòng điền đầy đủ email người nhận, tiêu đề và nội dung.");
      return;
    }

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/admin/send-customer-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode: order.orderCode,
          recipientEmail: recipientEmail.trim(),
          subject: subject.trim(),
          body: body.trim(),
          draftType,
          confirmSend: true, // Xác nhận rõ ràng từ Quản trị viên
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Không thể gửi email.");
      }

      adminToast.success(`Đã gửi email thành công cho khách hàng (${recipientEmail})!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi khi gửi email.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-navy-950 to-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-400/20 text-amber-300">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Soạn Email Cho Khách Hàng
                <span className="text-xs font-mono font-normal text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/30">
                  #{order.orderCode}
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                Khách: <strong>{order.customerName}</strong> ({order.customerEmail})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
            aria-label="Đóng modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[calc(85vh-130px)] overflow-y-auto">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Chọn mục đích soạn email */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              1. Chọn mục đích soạn thảo
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(
                [
                  { type: "price_verification", label: "Xác nhận giá", desc: "Đã duyệt giá, đề nghị cọc" },
                  { type: "delay_apology", label: "Xin lỗi chậm trễ", desc: "Thông quan / bay phát sinh" },
                  { type: "status_adjustment", label: "Cập nhật trạng thái", desc: "Báo trạng thái mới" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setDraftType(opt.type)}
                  className={`rounded-xl border p-2.5 text-left transition text-xs flex flex-col justify-between ${
                    draftType === opt.type
                      ? "border-amber-500 bg-amber-50/80 font-bold text-amber-950 ring-2 ring-amber-200"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className="font-semibold">{opt.label}</span>
                  <span className="text-[10px] text-slate-500 font-normal mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Chỉ dẫn bổ sung cho AI (tùy chọn):
              </label>
              <input
                type="text"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="VD: Nhắc khách đơn này được miễn phí công mua hộ..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <button
              type="button"
              onClick={handleDraftWithAi}
              disabled={drafting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-xs font-bold text-slate-950 shadow-sm hover:from-amber-400 hover:to-amber-300 transition disabled:opacity-60"
            >
              {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {drafting ? "AI đang soạn thảo..." : "🤖 AI Soạn thảo bản nháp"}
            </button>
          </div>

          {/* Form nội dung email để Admin rà soát và chỉnh sửa */}
          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Người nhận (To):
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tiêu đề email (Subject):
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Tiêu đề thư..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nội dung thư (Body):
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                placeholder="Nhấp 'AI Soạn thảo bản nháp' bên trên hoặc tự viết nội dung thư..."
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs leading-relaxed text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100 resize-y font-sans"
              />
            </div>

            {/* Cảnh báo an toàn */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
              <div>
                <strong>Nguyên tắc kiểm soát an toàn:</strong> AI chỉ hỗ trợ soạn thảo bản nháp có chỗ giữ; server đã điền dữ liệu thật. Email <strong>CHỈ được gửi</strong> khi Quản trị viên bấm nút xác nhận bên dưới. Mọi thao tác đều được ghi lại trong Nhật ký Kiểm toán (AuditLog).
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3.5 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            Hủy / Đóng
          </button>

          <button
            type="button"
            onClick={handleSendEmail}
            disabled={sending || !subject.trim() || !body.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-navy-950 px-5 py-2 text-xs font-bold text-amber-300 hover:bg-navy-900 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Đang gửi email..." : "Xác nhận gửi email cho khách"}
          </button>
        </div>
      </div>
    </div>
  );
}
