"use client";

import React, { useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";

type DailyReport = {
  businessDate: string;
  generatedAt: string;
  insight: string;
  snapshotSummary: {
    orders24h?: number;
    chats24h?: number;
    complaints24h?: number;
    stuckOrders?: number;
    lowStockCount?: number;
  };
};

export default function DailyInsightCard() {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/daily-insights", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Không tải được báo cáo AI.");
      setReport(data.report || null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được báo cáo AI.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const refresh = async () => {
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch("/api/admin/daily-insights", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.success || !data.report) throw new Error(data.error || "Không tạo được báo cáo AI.");
      setReport(data.report);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tạo được báo cáo AI.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <section className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm sm:p-6" aria-labelledby="daily-ai-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-bold text-amber-800">
            <Sparkles className="h-3.5 w-3.5" /> Báo cáo AI đã lưu
          </span>
          <h2 id="daily-ai-title" className="mt-3 text-lg font-bold text-slate-900">Tóm tắt vận hành 24 giờ</h2>
          <p className="mt-1 text-xs text-slate-600">AI chỉ nhận số liệu tổng hợp; nội dung hội thoại riêng của khách không được gửi vào báo cáo.</p>
        </div>
        <button type="button" onClick={refresh} disabled={refreshing || loading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Đang phân tích..." : "Tạo phân tích mới"}
        </button>
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {loading ? (
        <p className="mt-5 text-sm text-slate-500">Đang tải báo cáo đã lưu...</p>
      ) : report ? (
        <>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            <span>Ngày nghiệp vụ: <strong>{report.businessDate}</strong></span>
            <span>Dữ liệu đến: <strong>{new Date(report.generatedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</strong></span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              ["Đơn mới", report.snapshotSummary?.orders24h],
              ["Phiên chat", report.snapshotSummary?.chats24h],
              ["Khiếu nại", report.snapshotSummary?.complaints24h],
              ["Đơn cần theo dõi", report.snapshotSummary?.stuckOrders],
              ["Suất đặt thấp", report.snapshotSummary?.lowStockCount],
            ].map(([label, value]) => <span key={String(label)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">{label}: <strong>{value ?? 0}</strong></span>)}
          </div>
          <div className="mt-4 rounded-2xl border border-amber-100 bg-white p-4 text-sm leading-6 text-slate-800">
            <pre className="whitespace-pre-wrap font-sans">{report.insight}</pre>
          </div>
        </>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-amber-300 bg-white/70 p-4 text-sm text-slate-600">Chưa có báo cáo được lưu. Tạo phân tích mới để sinh và lưu báo cáo đầu tiên.</p>
      )}
    </section>
  );
}
