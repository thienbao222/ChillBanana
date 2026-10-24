"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Sparkles, AlertCircle, ArrowUpRight, CheckCircle2 } from "lucide-react";
import type { ActionItem } from "./action-items";

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
    actionItems?: ActionItem[];
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

  const actionItems = report?.snapshotSummary?.actionItems || [];

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

          {/* Việc cần làm hôm nay — Tính toán bằng quy tắc xác định */}
          {actionItems.length > 0 && (
            <div className="mt-5 rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-700" />
                <h3 className="text-sm font-bold text-slate-900">Việc cần làm hôm nay ({actionItems.length} việc)</h3>
              </div>
              <p className="mt-1 text-xs text-slate-600">Được tính tự động bằng quy tắc hệ thống; AI cung cấp gợi ý xử lý ngắn gọn.</p>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {actionItems.map((item) => {
                  const isHigh = item.priority === "high";
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-3.5 flex flex-col justify-between bg-white shadow-sm transition hover:shadow ${
                        isHigh ? "border-rose-300 ring-1 ring-rose-100" : "border-amber-200"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              isHigh
                                ? "bg-rose-100 text-rose-800"
                                : item.priority === "medium"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-sky-100 text-sky-800"
                            }`}
                          >
                            {isHigh ? "Khẩn cấp" : item.priority === "medium" ? "Cần xử lý" : "Theo dõi"}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">{item.itemCount} đơn/mục</span>
                        </div>

                        <h4 className="mt-2 text-sm font-bold text-slate-900">{item.title}</h4>
                        <p className="mt-1 text-xs text-slate-600">{item.reason}</p>

                        {item.aiExplanation && (
                          <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-2 text-xs text-slate-700">
                            <span className="font-semibold text-amber-800">💡 Gợi ý AI: </span>
                            {item.aiExplanation}
                          </div>
                        )}

                        {item.orderCodes.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {item.orderCodes.slice(0, 5).map((code) => (
                              <span key={code} className="font-mono rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">
                                {code}
                              </span>
                            ))}
                            {item.orderCodes.length > 5 && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                                +{item.orderCodes.length - 5}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100">
                        <Link
                          href={item.deepLink}
                          className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-900 transition"
                        >
                          Mở xử lý ngay <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Báo cáo văn bản hiện có */}
          <div className="mt-5 rounded-2xl border border-amber-100 bg-white p-4 text-sm leading-6 text-slate-800">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Báo cáo phân tích chuyên sâu</h3>
            <pre className="whitespace-pre-wrap font-sans text-xs leading-5 text-slate-700">{report.insight}</pre>
          </div>
        </>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-amber-300 bg-white/70 p-4 text-sm text-slate-600">Chưa có báo cáo được lưu. Tạo phân tích mới để sinh và lưu báo cáo đầu tiên.</p>
      )}
    </section>
  );
}
