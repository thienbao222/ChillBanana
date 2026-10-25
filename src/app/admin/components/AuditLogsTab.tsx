"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, ShieldCheck } from "lucide-react";

type AuditLog = {
  id: string;
  actor: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string | null;
  createdAt: string;
};

type AuditPage = { page: number; pageSize: number; total: number; totalPages: number };

function formatDate(value: string) {
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

export default function AuditLogsTab({ initialFilter }: { initialFilter?: string } = {}) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<AuditPage>({ page: 1, pageSize: 50, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [action, setAction] = useState(() => {
    if (initialFilter === "emails" || initialFilter === "email") return "EMAIL";
    return "";
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialFilter === "emails" || initialFilter === "email") {
      setAction("EMAIL");
      setPage(1);
    }
  }, [initialFilter]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (action) params.set("action", action);
      const response = await fetch(`/api/admin/audit-logs?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không tải được nhật ký.");
      setLogs(data.logs || []);
      setPagination(data.pagination);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được nhật ký kiểm toán.");
    } finally {
      setLoading(false);
    }
  }, [action, page]);

  useEffect(() => { void reload(); }, [reload]);

  return (
    <section className="space-y-5" aria-label="Nhật ký kiểm toán">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-800"><ShieldCheck className="h-3.5 w-3.5" />Bảo mật & truy vết</div>
          <h1 className="text-2xl font-extrabold text-slate-900">Nhật ký kiểm toán</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Lịch sử thao tác quản trị và tác vụ mua hộ. Thông tin IP và metadata nội bộ không hiển thị tại đây.</p>
        </div>
        <button type="button" onClick={() => void reload()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Làm mới</button>
      </header>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            Lọc thao tác
            <input aria-label="Lọc thao tác" maxLength={80} value={action} onChange={(event) => { setAction(event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "")); setPage(1); }} placeholder="Ví dụ: PURCHASE_TASK_CREATED" className="w-64 max-w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
          </label>
          <span className="text-xs text-slate-500">{pagination.total.toLocaleString("vi-VN")} bản ghi · 50 bản ghi mỗi trang</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500"><th className="px-4 py-3">Thời điểm</th><th className="px-4 py-3">Người thực hiện</th><th className="px-4 py-3">Thao tác</th><th className="px-4 py-3">Đối tượng</th><th className="px-4 py-3">Chi tiết</th></tr></thead>
            <tbody>
              {logs.map((log) => <tr key={log.id} className="border-b border-slate-100 last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{formatDate(log.createdAt)}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{log.actor}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-bold text-sky-800">{log.action}</span></td>
                <td className="px-4 py-3 text-xs text-slate-600">{log.entityType || "—"}{log.entityId ? <span className="ml-1 font-mono text-slate-500">{log.entityId}</span> : ""}</td>
                <td className="max-w-md px-4 py-3 text-sm text-slate-700">{log.summary || "—"}</td>
              </tr>)}
              {!loading && !logs.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">Chưa có bản ghi phù hợp.</td></tr>}
              {loading && !logs.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">Đang tải nhật ký…</td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <span className="text-xs text-slate-500">Trang {pagination.page} / {Math.max(1, pagination.totalPages)}</span>
          <div className="flex gap-2">
            <button type="button" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Trước</button>
            <button type="button" disabled={loading || page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Sau<ChevronRight className="h-4 w-4" /></button>
          </div>
        </footer>
      </section>
    </section>
  );
}
