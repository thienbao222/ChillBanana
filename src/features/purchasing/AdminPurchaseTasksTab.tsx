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
  Search,
  Info,
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

interface EligibleOrder {
  id: string;
  orderCode: string;
  customerName: string;
  productName: string;
  priceJpy: number;
  paymentStatus: string;
  platform: string;
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

const PLATFORM_GUIDANCE: Record<string, { label: string; mode: string; note: string; tone: string }> = {
  amazon_jp: {
    label: "Amazon JP",
    mode: "Tra cứu bổ sung",
    note: "Chuẩn hóa link/ASIN; giá và tồn kho có thể không lấy được, cần đối chiếu trên sàn.",
    tone: "border-sky-200 bg-sky-50 text-sky-800",
  },
  rakuten: {
    label: "Rakuten",
    mode: "API nếu đã cấu hình",
    note: "Có thể lấy thông tin sản phẩm qua API khi môi trường đã có RAKUTEN_APP_ID.",
    tone: "border-rose-200 bg-rose-50 text-rose-800",
  },
  mercari: {
    label: "Mercari",
    mode: "Nhân viên kiểm tra",
    note: "Task vẫn tạo được; nhân viên cần tự xác nhận giá, người bán và tình trạng hàng.",
    tone: "border-orange-200 bg-orange-50 text-orange-800",
  },
  yahoo_jp: {
    label: "Yahoo! JAPAN",
    mode: "Nhân viên kiểm tra",
    note: "Task vẫn tạo được; nhân viên cần tự xác nhận giá và tình trạng sản phẩm trên link gốc.",
    tone: "border-violet-200 bg-violet-50 text-violet-800",
  },
  unknown: {
    label: "Sàn khác / chưa nhận diện",
    mode: "Nhân viên kiểm tra",
    note: "Task lưu link gốc để nhân viên kiểm tra thủ công; không có giá/tồn kho tự động.",
    tone: "border-slate-200 bg-slate-50 text-slate-700",
  },
};

function platformGuidance(platform: string) {
  return PLATFORM_GUIDANCE[platform] ?? PLATFORM_GUIDANCE.unknown;
}

function paymentStatusLabel(status: string) {
  if (status === "PAID_100") return "Đã thanh toán 100%";
  if (status === "DEPOSITED_50") return "Đã cọc 50%";
  return status;
}

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
  const [taskLoadError, setTaskLoadError] = useState("");
  const [filterStatus, setFilterStatus] = useState(""); // "" = tất cả
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Form tạo task mới
  const [creating, setCreating] = useState(false);
  const [orderQuery, setOrderQuery] = useState("");
  const [orderResults, setOrderResults] = useState<EligibleOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<EligibleOrder | null>(null);
  const [searchingOrders, setSearchingOrders] = useState(false);
  const [orderSearchError, setOrderSearchError] = useState("");
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);
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
    setTaskLoadError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (filterStatus) params.set("status", filterStatus);
      const res = await fetch(`/api/admin/purchase-tasks?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể tải danh sách tác vụ.");
      setTasks(data.tasks);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      setTaskLoadError(error instanceof Error ? error.message : "Lỗi kết nối server.");
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Search only eligible orders; keep the order's internal ID out of the manual workflow.
  useEffect(() => {
    const query = orderQuery.trim();
    if (selectedOrder || query.length < 2) {
      setOrderResults([]);
      setSearchingOrders(false);
      setOrderSearchError("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchingOrders(true);
      setOrderSearchError("");
      try {
        const res = await fetch(`/api/admin/purchase-tasks/orders?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Không thể tìm đơn hàng.");
        setOrderResults(data.orders ?? []);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setOrderSearchError(error instanceof Error ? error.message : "Lỗi kết nối server.");
        setOrderResults([]);
      } finally {
        if (!controller.signal.aborted) setSearchingOrders(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [orderQuery, selectedOrder]);

  // Tạo task mới
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrder) {
      setCreateMsg({ type: "err", text: "Hãy tìm và chọn một đơn đủ điều kiện trước khi tạo task." });
      return;
    }
    setCreating(true);
    setCreateMsg(null);
    try {
      const res = await fetch("/api/admin/purchase-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: selectedOrder.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setCreateMsg({ type: "ok", text: `✅ Đã tạo task cho đơn ${data.task?.order?.orderCode ?? selectedOrder.orderCode}` });
        setOrderQuery("");
        setOrderResults([]);
        setSelectedOrder(null);
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
            Tác vụ mua hộ — Purchase Tasks
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {total} task · Hệ thống hỗ trợ tra cứu và theo dõi; nhân viên xác nhận, đặt hàng trên sàn
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
        <p className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5 text-sky-600" />
          Tạo task từ đơn đủ điều kiện
        </p>
        <p className="text-[11px] text-slate-500 mb-3">
          Tìm bằng mã đơn, tên khách hoặc sản phẩm. Chỉ hiện đơn đã xác minh giá, đã cọc/đã thanh toán và đang mua tại Nhật.
        </p>
        <form onSubmit={handleCreate} className="flex gap-2 items-start flex-wrap">
          <div
            className="relative flex-1 min-w-64"
            onBlur={(event) => {
              const nextTarget = event.relatedTarget;
              if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) setOrderSearchOpen(false);
            }}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="search"
                placeholder="Tìm mã #CB-..., tên khách hoặc tên sản phẩm"
                value={orderQuery}
                onFocus={() => setOrderSearchOpen(true)}
                onChange={(event) => {
                  setOrderQuery(event.target.value);
                  setSelectedOrder(null);
                  setCreateMsg(null);
                  setOrderSearchOpen(true);
                }}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-sky-400"
                role="combobox"
                aria-label="Tìm đơn hàng đủ điều kiện tạo task mua hộ"
                aria-autocomplete="list"
                aria-expanded={orderSearchOpen && !selectedOrder && orderQuery.trim().length >= 2}
                aria-controls="eligible-purchase-orders"
              />
            </div>
            {orderSearchOpen && !selectedOrder && orderQuery.trim().length >= 2 && (
              <div id="eligible-purchase-orders" role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                {searchingOrders ? (
                  <div className="flex items-center gap-2 px-3 py-3 text-xs text-slate-500"><Loader2 className="w-3.5 h-3.5 animate-spin" />Đang tìm đơn đủ điều kiện…</div>
                ) : orderSearchError ? (
                  <div role="status" className="px-3 py-3 text-xs text-red-600">{orderSearchError}</div>
                ) : orderResults.length > 0 ? orderResults.map((order) => {
                  const support = platformGuidance(order.platform);
                  return (
                    <button
                      key={order.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => {
                        setSelectedOrder(order);
                        setOrderQuery(`${order.orderCode} · ${order.customerName}`);
                        setOrderResults([]);
                        setOrderSearchOpen(false);
                      }}
                      className="flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left hover:bg-sky-50 focus:bg-sky-50 focus:outline-none"
                    >
                      <span className="flex w-full flex-wrap items-center justify-between gap-1 text-xs">
                        <span className="font-semibold text-slate-800">{order.orderCode} · {order.customerName}</span>
                        <span className="text-slate-500">¥{fmt(order.priceJpy)}</span>
                      </span>
                      <span className="w-full truncate text-[11px] text-slate-600">{order.productName}</span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] ${support.tone}`}>
                          {support.label} · {support.mode}
                        </span>
                        <span className="text-[10px] text-emerald-700">{paymentStatusLabel(order.paymentStatus)}</span>
                      </span>
                    </button>
                  );
                }) : (
                  <div className="px-3 py-3 text-xs text-slate-500">Không tìm thấy đơn đủ điều kiện. Kiểm tra trạng thái đơn, tiền cọc và xác minh giá.</div>
                )}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={creating || !selectedOrder}
            className="px-4 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Tạo Task
          </button>
        </form>
        {selectedOrder && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
            <span>Đã chọn <strong className="text-slate-800">{selectedOrder.orderCode}</strong> · {selectedOrder.productName}</span>
            <span className={`rounded-full border px-2 py-0.5 ${platformGuidance(selectedOrder.platform).tone}`}>
              {platformGuidance(selectedOrder.platform).label} · {platformGuidance(selectedOrder.platform).mode}
            </span>
            <button type="button" onClick={() => { setSelectedOrder(null); setOrderQuery(""); }} className="font-semibold text-sky-700 hover:underline">Bỏ chọn</button>
          </div>
        )}
        {createMsg && (
          <p className={`mt-2 text-xs ${createMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>
            {createMsg.text}
          </p>
        )}
      </div>

      <details className="group rounded-xl border border-sky-100 bg-white/90 px-4 py-3 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-slate-700">
          <span className="flex items-center gap-2"><Info className="h-4 w-4 text-sky-600" />Hướng dẫn sử dụng và phạm vi hỗ trợ sàn</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 space-y-4 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-600">
          <div className="grid gap-2 md:grid-cols-3">
            {Object.entries(PLATFORM_GUIDANCE).map(([platform, support]) => (
              <div key={platform} className={`rounded-lg border p-3 ${support.tone}`}>
                <p className="font-semibold">{support.label} <span className="font-normal">· {support.mode}</span></p>
                <p className="mt-1 opacity-90">{support.note}</p>
              </div>
            ))}
          </div>
          <ol className="space-y-1.5 pl-5 list-decimal">
            <li><strong>Tìm và chọn đơn:</strong> tra theo mã đơn, tên khách hoặc tên sản phẩm. Đơn phải đang ở bước mua tại Nhật, đã cọc/đã thanh toán, giá đã xác minh và chưa có task.</li>
            <li><strong>Tạo task rồi duyệt:</strong> task bắt đầu ở “Chờ duyệt”. Admin kiểm tra link, giá và ghi chú trước khi duyệt.</li>
            <li><strong>Mua thủ công:</strong> sau khi duyệt, chuyển sang “Đang mua”, mở link và nhân viên đặt hàng trực tiếp trên sàn. Hệ thống không tự đăng nhập, đặt mua hay thanh toán.</li>
            <li><strong>Ghi nhận kết quả:</strong> khi đã mua, nhập mã đơn của sàn và tên nhân viên. Nếu mua không thành công, báo thất bại kèm lý do rồi dùng “Thử lại” khi đã xử lý nguyên nhân.</li>
          </ol>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">Giá lấy từ sàn có thể thiếu hoặc thay đổi. Cột chênh lệch trên 5% được cảnh báo để admin đối chiếu trước khi nhân viên đặt mua.</p>
        </div>
      </details>

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
        ) : taskLoadError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-xs text-red-600" role="alert">
            <span>{taskLoadError}</span>
            <button type="button" onClick={fetchTasks} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold hover:bg-red-50">Tải lại danh sách</button>
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
                        <div>{PLATFORM_EMOJI[task.platform] ?? task.platform}</div>
                        <div className="text-[10px] text-slate-400">{platformGuidance(task.platform).mode}</div>
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
