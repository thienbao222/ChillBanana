"use client";

/**
 * PurchaseTasksTab — Nhóm 3: Auto-Purchasing Agent UI
 *
 * Tab này hiển thị trong Admin Dashboard, cho phép:
 *   - Xem danh sách Purchase Tasks theo trạng thái
 *   - Tạo task mới từ orderId
 *   - Duyệt / Hủy / Đánh dấu đã mua task
 *   - Xem thông tin sản phẩm từ platform (giá, deeplink)
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  ShoppingCart,
  RefreshCw,
  Plus,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Clock,
  ChevronDown,
  Package,
  Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PurchaseTask {
  id: string;
  orderId: string;
  platform: string;
  status: string;
  externalProductId: string | null;
  externalOrderId: string | null;
  platformUrl: string | null;
  scrapedPriceJpy: number | null;
  priceDiffPercent: number | null;
  createdByAdmin: string | null;
  approvedByAdmin: string | null;
  approvedAt: string | null;
  purchasedByStaff: string | null;
  purchasedAt: string | null;
  adminNote: string | null;
  lastError: string | null;
  attempts: number;
  createdAt: string;
  order: {
    orderCode: string;
    customerName: string;
    productName: string;
    priceJpy: number;
    originalUrl: string | null;
    paymentStatus: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  QUEUED:      { label: "Chờ duyệt",    color: "text-amber-600 bg-amber-50 border-amber-200",    icon: <Clock className="w-3 h-3" /> },
  APPROVED:    { label: "Đã duyệt",     color: "text-blue-600 bg-blue-50 border-blue-200",       icon: <CheckCircle className="w-3 h-3" /> },
  IN_PROGRESS: { label: "Đang mua",     color: "text-purple-600 bg-purple-50 border-purple-200", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  PURCHASED:   { label: "Đã mua ✓",    color: "text-green-600 bg-green-50 border-green-200",    icon: <CheckCircle className="w-3 h-3" /> },
  FAILED:      { label: "Thất bại",     color: "text-red-600 bg-red-50 border-red-200",          icon: <XCircle className="w-3 h-3" /> },
  CANCELLED:   { label: "Đã hủy",      color: "text-slate-500 bg-slate-50 border-slate-200",    icon: <XCircle className="w-3 h-3" /> },
};

const PLATFORM_EMOJI: Record<string, string> = {
  amazon_jp: "🛒 Amazon JP",
  rakuten:   "🔴 Rakuten",
  mercari:   "🟠 Mercari",
  yahoo_jp:  "🟣 Yahoo JP",
  unknown:   "❓ Unknown",
};

function fmt(n: number) {
  return n.toLocaleString("ja-JP");
}

function fmtDate(s: string) {
  return new Date(s).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PurchaseTasksTab() {
  const [tasks, setTasks] = useState<PurchaseTask[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState(""); // "" = tất cả
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Form tạo task mới
  const [creating, setCreating] = useState(false);
  const [newOrderId, setNewOrderId] = useState("");
  const [createMsg, setCreateMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Action modal
  const [actionTask, setActionTask] = useState<PurchaseTask | null>(null);
  const [actionType, setActionType] = useState<string>("");
  const [actionNote, setActionNote] = useState("");
  const [actionExtId, setActionExtId] = useState("");
  const [actionStaff, setActionStaff] = useState("");
  const [actioning, setActioning] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (filterStatus) params.set("status", filterStatus);
      const res = await fetch(`/api/admin/purchase-tasks?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      }
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Tạo task mới
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newOrderId.trim()) return;
    setCreating(true);
    setCreateMsg(null);
    try {
      const res = await fetch("/api/admin/purchase-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: newOrderId.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setCreateMsg({ type: "ok", text: `✅ Đã tạo task cho đơn ${data.task?.order?.orderCode ?? newOrderId}` });
        setNewOrderId("");
        fetchTasks();
      } else {
        setCreateMsg({ type: "err", text: `❌ ${data.error}` });
      }
    } catch {
      setCreateMsg({ type: "err", text: "❌ Lỗi kết nối server." });
    } finally {
      setCreating(false);
    }
  }

  // Thực hiện action
  async function handleAction(e: React.FormEvent) {
    e.preventDefault();
    if (!actionTask || !actionType) return;
    setActioning(true);
    setActionMsg(null);
    try {
      const body: Record<string, string> = { action: actionType };
      if (actionNote) body.adminNote = actionNote;
      if (actionExtId) body.externalOrderId = actionExtId;
      if (actionStaff) body.staffName = actionStaff;

      const res = await fetch(`/api/admin/purchase-tasks/${actionTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg({ type: "ok", text: `✅ ${data.message}` });
        fetchTasks();
        setTimeout(() => { setActionTask(null); setActionMsg(null); }, 1500);
      } else {
        setActionMsg({ type: "err", text: `❌ ${data.error}` });
      }
    } catch {
      setActionMsg({ type: "err", text: "❌ Lỗi kết nối server." });
    } finally {
      setActioning(false);
    }
  }

  function openAction(task: PurchaseTask, type: string) {
    setActionTask(task);
    setActionType(type);
    setActionNote("");
    setActionExtId("");
    setActionStaff("");
    setActionMsg(null);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const statusBadge = (status: string) => {
    const cfg = STATUS_LABEL[status] ?? { label: status, color: "text-slate-500 bg-slate-50 border-slate-200", icon: null };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.color}`}>
        {cfg.icon}{cfg.label}
      </span>
    );
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-sky-600" />
            Purchase Tasks — Auto-Purchasing Agent
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {total} task · Phase A (Amazon JP + Rakuten) · Human-in-the-loop bắt buộc
          </p>
        </div>
        <button
          onClick={fetchTasks}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </button>
      </div>

      {/* Tạo task mới */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5 text-sky-600" />
          Tạo Purchase Task mới
        </p>
        <form onSubmit={handleCreate} className="flex gap-2 items-center flex-wrap">
          <input
            type="text"
            placeholder="Nhập Order ID (chuỗi cuid — xem trong DB)"
            value={newOrderId}
            onChange={e => setNewOrderId(e.target.value)}
            className="flex-1 min-w-48 px-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-sky-400"
          />
          <button
            type="submit"
            disabled={creating || !newOrderId.trim()}
            className="px-4 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Tạo Task
          </button>
        </form>
        {createMsg && (
          <p className={`mt-2 text-xs ${createMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>
            {createMsg.text}
          </p>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-1.5 flex-wrap">
        {["", "QUEUED", "APPROVED", "IN_PROGRESS", "PURCHASED", "FAILED", "CANCELLED"].map(s => (
          <button
            key={s}
            onClick={() => { setFilterStatus(s); setPage(1); }}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              filterStatus === s
                ? "bg-sky-600 text-white border-sky-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"
            }`}
          >
            {s === "" ? "Tất cả" : (STATUS_LABEL[s]?.label ?? s)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400 text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />Đang tải...
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs gap-2">
            <Package className="w-8 h-8 opacity-30" />
            <span>Chưa có purchase task nào{filterStatus ? ` (${STATUS_LABEL[filterStatus]?.label})` : ""}.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold">
                  <th className="px-3 py-2.5 text-left">Đơn hàng</th>
                  <th className="px-3 py-2.5 text-left">Sản phẩm</th>
                  <th className="px-3 py-2.5 text-left">Platform</th>
                  <th className="px-3 py-2.5 text-right">Giá ¥</th>
                  <th className="px-3 py-2.5 text-center">Chênh lệch</th>
                  <th className="px-3 py-2.5 text-center">Trạng thái</th>
                  <th className="px-3 py-2.5 text-left">Ngày tạo</th>
                  <th className="px-3 py-2.5 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tasks.map(task => {
                  const priceDiff = task.priceDiffPercent;
                  const diffColor = priceDiff === null ? "" : Math.abs(priceDiff) > 5 ? "text-red-600 font-bold" : "text-green-600";

                  return (
                    <tr key={task.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-slate-800">{task.order.orderCode}</div>
                        <div className="text-slate-400">{task.order.customerName}</div>
                      </td>
                      <td className="px-3 py-2.5 max-w-[160px]">
                        <div className="text-slate-700 line-clamp-2">{task.order.productName}</div>
                        {task.platformUrl && (
                          <a href={task.platformUrl} target="_blank" rel="noopener noreferrer"
                            className="text-sky-500 hover:underline flex items-center gap-0.5 mt-0.5">
                            <ExternalLink className="w-3 h-3" />Mở link mua
                          </a>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {PLATFORM_EMOJI[task.platform] ?? task.platform}
                        {task.externalProductId && (
                          <div className="text-slate-400 font-mono text-[10px]">{task.externalProductId}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        <div className="text-slate-800">¥{fmt(task.order.priceJpy)}</div>
                        {task.scrapedPriceJpy !== null && (
                          <div className="text-slate-400 text-[10px]">Thực: ¥{fmt(task.scrapedPriceJpy)}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {priceDiff !== null ? (
                          <span className={diffColor}>
                            {priceDiff > 0 ? "+" : ""}{priceDiff.toFixed(1)}%
                            {Math.abs(priceDiff) > 5 && <AlertTriangle className="inline w-3 h-3 ml-0.5" />}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {statusBadge(task.status)}
                        {task.externalOrderId && (
                          <div className="text-green-600 font-mono text-[10px] mt-0.5">{task.externalOrderId}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400">
                        {fmtDate(task.createdAt)}
                        {task.approvedByAdmin && (
                          <div className="text-[10px] text-slate-400">Duyệt: {task.approvedByAdmin}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <ActionButtons task={task} onAction={openAction} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-3 border-t border-slate-100">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-2.5 py-1 text-xs rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
            >← Trước</button>
            <span className="text-xs text-slate-500">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-2.5 py-1 text-xs rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
            >Sau →</button>
          </div>
        )}
      </div>

      {/* Action Modal */}
      {actionTask && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setActionTask(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-sky-600" />
              {ACTION_LABEL[actionType] ?? actionType}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Đơn: <strong>{actionTask.order.orderCode}</strong> · Platform: {PLATFORM_EMOJI[actionTask.platform]}
            </p>

            <form onSubmit={handleAction} className="space-y-3">
              {actionType === "complete" && (
                <>
                  <div>
                    <label className="text-xs text-slate-600 block mb-1">Mã đơn tại sàn (externalOrderId) *</label>
                    <input
                      required
                      type="text"
                      placeholder="VD: 503-1234567-8901234 (Amazon) hoặc mã đơn Rakuten"
                      value={actionExtId}
                      onChange={e => setActionExtId(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-sky-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 block mb-1">Tên nhân viên JP đã mua</label>
                    <input
                      type="text"
                      placeholder="VD: Nguyen Van A"
                      value={actionStaff}
                      onChange={e => setActionStaff(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-sky-400"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-xs text-slate-600 block mb-1">
                  {actionType === "fail" ? "Lý do thất bại *" : "Ghi chú (tùy chọn)"}
                </label>
                <textarea
                  required={actionType === "fail"}
                  rows={2}
                  placeholder={actionType === "fail" ? "VD: Hàng hết stock, giá tăng..." : "Ghi chú thêm..."}
                  value={actionNote}
                  onChange={e => setActionNote(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-sky-400 resize-none"
                />
              </div>

              {actionMsg && (
                <p className={`text-xs ${actionMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>
                  {actionMsg.text}
                </p>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setActionTask(null)}
                  className="px-4 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actioning}
                  className={`px-4 py-1.5 text-xs rounded-lg font-semibold text-white flex items-center gap-1.5 ${ACTION_BTN_COLOR[actionType] ?? "bg-sky-600 hover:bg-sky-700"} disabled:opacity-50`}
                >
                  {actioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {ACTION_LABEL[actionType] ?? actionType}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Action Buttons per row ───────────────────────────────────────────────────

const ACTION_LABEL: Record<string, string> = {
  approve: "✅ Duyệt task",
  start:   "▶️ Bắt đầu mua",
  complete: "🎉 Đánh dấu đã mua",
  fail:    "❌ Báo thất bại",
  cancel:  "🚫 Hủy task",
  retry:   "🔄 Thử lại",
};

const ACTION_BTN_COLOR: Record<string, string> = {
  approve: "bg-blue-600 hover:bg-blue-700",
  start:   "bg-purple-600 hover:bg-purple-700",
  complete: "bg-green-600 hover:bg-green-700",
  fail:    "bg-red-600 hover:bg-red-700",
  cancel:  "bg-slate-600 hover:bg-slate-700",
  retry:   "bg-amber-600 hover:bg-amber-700",
};

const STATUS_ACTIONS: Record<string, string[]> = {
  QUEUED:      ["approve", "cancel"],
  APPROVED:    ["start", "cancel"],
  IN_PROGRESS: ["complete", "fail"],
  FAILED:      ["retry"],
  PURCHASED:   [],
  CANCELLED:   [],
};

function ActionButtons({
  task,
  onAction,
}: {
  task: PurchaseTask;
  onAction: (task: PurchaseTask, action: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const actions = STATUS_ACTIONS[task.status] ?? [];

  if (actions.length === 0) return <span className="text-slate-300 text-xs">—</span>;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
      >
        Hành động <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[140px]"
          onMouseLeave={() => setOpen(false)}
        >
          {actions.map(action => (
            <button
              key={action}
              onClick={() => { onAction(task, action); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 text-slate-700"
            >
              {ACTION_LABEL[action] ?? action}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
