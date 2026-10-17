"use client";

import React, { useState, useEffect } from "react";
import {
  FlaskConical,
  Truck,
  Mail,
  Sliders,
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Trash2,
  Eye,
  X,
  CreditCard,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { useAdminToast } from "@/context/AdminToastContext";

interface OrderSummary {
  id: string;
  orderCode: string;
  customerName: string;
  productName: string;
  status: string;
  paymentStatus: string;
  depositAmountVnd: number;
}

interface DemoEmail {
  id: string;
  to: string;
  subject: string;
  html: string;
  type: string;
  sentAt: string;
  isSimulated: boolean;
}

interface SystemConfigItem {
  value: string;
  description: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export default function SandboxTab() {
  const { adminToast } = useAdminToast();

  // Sub-tabs trong Sandbox: "logistics" | "emails" | "config"
  const [subTab, setSubTab] = useState<"logistics" | "emails" | "config">("logistics");

  // State Logistics Controller
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [selectedOrderCode, setSelectedOrderCode] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [creatingPayment, setCreatingPayment] = useState(false);

  // State Demo Emails
  const [emails, setEmails] = useState<DemoEmail[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<DemoEmail | null>(null);

  // State System Config
  const [config, setConfig] = useState<Record<string, SystemConfigItem>>({});
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configInputs, setConfigInputs] = useState<Record<string, string>>({});

  // ─── Tải dữ liệu ban đầu ───────────────────────────────────────────────────

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (res.ok && Array.isArray(data.orders)) {
        setOrders(data.orders.slice(0, 20));
        if (!selectedOrderCode && data.orders.length > 0) {
          setSelectedOrderCode(data.orders[0].orderCode);
        }
      }
    } catch {
      adminToast.error("Không thể tải danh sách đơn hàng");
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadEmails = async () => {
    setLoadingEmails(true);
    try {
      const res = await fetch("/api/admin/demo-emails");
      const data = await res.json();
      if (res.ok && Array.isArray(data.emails)) {
        setEmails(data.emails);
      }
    } catch {
      adminToast.error("Không thể tải danh sách email");
    } finally {
      setLoadingEmails(false);
    }
  };

  const loadConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch("/api/admin/system-config");
      const data = await res.json();
      if (res.ok && data.config) {
        setConfig(data.config);
        const inputs: Record<string, string> = {};
        for (const [k, v] of Object.entries(data.config as Record<string, SystemConfigItem>)) {
          inputs[k] = v.value;
        }
        setConfigInputs(inputs);
      }
    } catch {
      adminToast.error("Không thể tải cấu hình hệ thống");
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    loadOrders();
    loadEmails();
    loadConfig();
  }, []);

  // ─── Handlers Logistics ────────────────────────────────────────────────────

  const handleMockTransition = async (targetStatus: string) => {
    if (!selectedOrderCode) {
      adminToast.error("Vui lòng chọn một đơn hàng");
      return;
    }

    setTransitioning(true);
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(selectedOrderCode)}/mock-transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        adminToast.success(data.message);
        // Reload lại danh sách đơn và email
        await loadOrders();
        await loadEmails();
      } else {
        adminToast.error(data.error || "Lỗi chuyển trạng thái");
      }
    } catch {
      adminToast.error("Không thể kết nối đến API");
    } finally {
      setTransitioning(false);
    }
  };

  const selectedOrder = orders.find((o) => o.orderCode === selectedOrderCode);

  const handleOpenMockPayment = async () => {
    if (!selectedOrder) return;
    setCreatingPayment(true);
    try {
      const res = await fetch("/api/payment/vnpay-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderCode: selectedOrder.orderCode }),
      });
      const data = await res.json();
      if (res.ok && data.paymentUrl) {
        window.open(data.paymentUrl, "_blank");
      } else {
        adminToast.error(data.error || "Không thể tạo phiên thanh toán test");
      }
    } catch {
      adminToast.error("Lỗi kết nối máy chủ");
    } finally {
      setCreatingPayment(false);
    }
  };

  // ─── Handlers Email ────────────────────────────────────────────────────────

  const handleClearEmails = async () => {
    try {
      const res = await fetch("/api/admin/demo-emails", { method: "DELETE" });
      if (res.ok) {
        setEmails([]);
        adminToast.success("Đã xóa sạch hộp thư Demo");
      }
    } catch {
      adminToast.error("Lỗi xóa email");
    }
  };

  // ─── Handlers Config ───────────────────────────────────────────────────────

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const updates = Object.entries(configInputs).map(([key, value]) => ({ key, value }));
      const res = await fetch("/api/admin/system-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        adminToast.success("Đã lưu cấu hình hệ thống thành công!");
        await loadConfig();
      } else {
        adminToast.error(data.error || "Lỗi lưu cấu hình");
      }
    } catch {
      adminToast.error("Không thể lưu cấu hình");
    } finally {
      setSavingConfig(false);
    }
  };


  return (
    <div className="space-y-6">
      {/* Header Sandbox */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Sandbox & Pre-Production Testbed</span>
              <span className="text-xs bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                V1.0
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Bộ công cụ mô phỏng vận đơn 7 bước, hộp thư email giả lập, cổng thanh toán test và quản trị phí động.
            </p>
          </div>
        </div>

        {/* Sub-tab navigation */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
          {[
            { key: "logistics", label: "Tua Nhanh Vận Đơn", icon: <Truck className="w-4 h-4" /> },
            { key: "emails", label: `Hộp Thư Demo (${emails.length})`, icon: <Mail className="w-4 h-4" /> },
            { key: "config", label: "Cấu Hình Phí Động", icon: <Sliders className="w-4 h-4" /> },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setSubTab(item.key as typeof subTab)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                subTab === item.key
                  ? "bg-slate-800 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── TAB 1: LOGISTICS CONTROLLER ─── */}
      {subTab === "logistics" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cột trái: Chọn đơn hàng & Cổng thanh toán Sandbox */}
          <div className="lg:col-span-1 space-y-6">
            {/* Box chọn đơn hàng */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Truck className="w-4 h-4 text-sky-400" />
                  <span>Chọn Đơn Hàng</span>
                </h3>
                <button
                  onClick={loadOrders}
                  disabled={loadingOrders}
                  className="text-slate-400 hover:text-white text-xs flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? "animate-spin" : ""}`} />
                  <span>Làm mới</span>
                </button>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">
                  Đơn hàng gần đây:
                </label>
                <select
                  value={selectedOrderCode}
                  onChange={(e) => setSelectedOrderCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  {orders.map((o) => (
                    <option key={o.id} value={o.orderCode}>
                      {o.orderCode} — {o.customerName} ({o.status})
                    </option>
                  ))}
                </select>
              </div>

              {selectedOrder && (
                <div className="bg-slate-950/70 rounded-xl p-3.5 border border-slate-800/80 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Khách hàng:</span>
                    <span className="font-medium text-white">{selectedOrder.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sản phẩm:</span>
                    <span className="font-medium text-white truncate max-w-[170px]" title={selectedOrder.productName}>
                      {selectedOrder.productName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Trạng thái:</span>
                    <span className="font-bold text-amber-400">{selectedOrder.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Thanh toán:</span>
                    <span className="font-bold text-emerald-400">{selectedOrder.paymentStatus}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tiền cọc:</span>
                    <span className="font-mono font-bold text-white">
                      {selectedOrder.depositAmountVnd.toLocaleString("vi-VN")} đ
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex gap-2">
                    <a
                      href={`/tracking?orderCode=${encodeURIComponent(selectedOrder.orderCode)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-sky-300 py-1.5 px-2 rounded-lg text-center font-medium flex items-center justify-center gap-1"
                    >
                      <span>Xem Tracking</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    {selectedOrder.paymentStatus === "UNPAID" && (
                      <a
                        href={`/payment/mock-sandbox?orderCode=${encodeURIComponent(selectedOrder.orderCode)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 py-1.5 px-2 rounded-lg text-center font-medium flex items-center justify-center gap-1"
                      >
                        <span>Cổng Sandbox</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Banner Cổng Sandbox */}
            <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-800/40 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <CreditCard className="w-5 h-5" />
                <h4 className="text-sm font-bold">Cổng Thanh Toán Mock Sandbox</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Mở giao diện cổng thanh toán độc lập để test toàn diện luồng: nhập thẻ test, chọn mã kết quả 00 (thành công) / 51 (hết tiền) / 24 (hủy).
              </p>
              {selectedOrder && (
                <button
                  type="button"
                  onClick={handleOpenMockPayment}
                  disabled={creatingPayment}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs transition"
                >
                  {creatingPayment ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                  <span>{creatingPayment ? "Đang tạo phiên..." : `Mở Sandbox Đơn #${selectedOrder.orderCode}`}</span>
                </button>
              )}
            </div>
          </div>

          {/* Cột phải: Các nút tua nhanh 6 chặng */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white">Bàn Phím Tua Nhanh 7 Bước</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Click 1 lần để chuyển trạng thái, tạo TrackingLog thực tế và gửi thông báo email/Zalo mô phỏng.
                  </p>
                </div>
                {transitioning && (
                  <span className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/30">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang cập nhật...</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    status: "PURCHASING_JP",
                    step: "Bước 2",
                    icon: "🛒",
                    title: "Mua Hàng Tại Tokyo",
                    desc: "Nhân viên tại Nhật đang đặt đơn từ sàn nội địa (Amazon JP / Mercari / Rakuten).",
                    badgeColor: "bg-sky-500/10 text-sky-400 border-sky-500/30",
                  },
                  {
                    status: "WAREHOUSE_JP",
                    step: "Bước 3",
                    icon: "📦",
                    title: "Nhập Kho Tokyo",
                    desc: "Hàng về kho Shinjuku. Tự tạo mã vận đơn Nhật (Yamato/Sagawa) và cân đo trọng lượng.",
                    badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
                  },
                  {
                    status: "IN_TRANSIT_AIR",
                    step: "Bước 4",
                    icon: "✈️",
                    title: "Đang Bay Narita ➔ VN",
                    desc: "Hải quan Narita thông quan. Kiện hàng đang trên chuyến bay quốc tế về Việt Nam.",
                    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/30",
                  },
                  {
                    status: "WAREHOUSE_VN",
                    step: "Bước 5",
                    icon: "🇻🇳",
                    title: "Đã Nhập Kho Việt Nam",
                    desc: "Hạ cánh cảng hàng không Nội Bài/Tân Sơn Nhất. Đã thông quan và phân loại.",
                    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/30",
                  },
                  {
                    status: "LOCAL_DELIVERY",
                    step: "Bước 6",
                    icon: "🚚",
                    title: "Đang Giao Tận Tay (GHN)",
                    desc: "Bàn giao đối tác giao vận chặng cuối. Tự sinh mã tracking GHN nội địa.",
                    badgeColor: "bg-orange-500/10 text-orange-400 border-orange-500/30",
                  },
                  {
                    status: "COMPLETED",
                    step: "Bước 7",
                    icon: "🎉",
                    title: "Giao Thành Công",
                    desc: "Khách đã nhận kiện hàng nguyên vẹn. Đơn hàng hoàn tất và thanh toán đủ 100%.",
                    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
                  },
                ].map((item) => {
                  const isCurrent = selectedOrder?.status === item.status;
                  return (
                    <button
                      key={item.status}
                      type="button"
                      disabled={transitioning || !selectedOrderCode}
                      onClick={() => handleMockTransition(item.status)}
                      className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between ${
                        isCurrent
                          ? "bg-amber-500/10 border-amber-500/60 ring-2 ring-amber-500/40 shadow-lg"
                          : "bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950"
                      } disabled:opacity-50`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{item.icon}</span>
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">
                              {item.step}
                            </span>
                            <h4 className="font-bold text-sm text-white">{item.title}</h4>
                          </div>
                        </div>
                        {isCurrent ? (
                          <span className="text-[10px] font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full">
                            Hiện tại
                          </span>
                        ) : (
                          <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                            {item.status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed mb-3">
                        {item.desc}
                      </p>
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-300">
                        <span>Chuyển sang bước này</span>
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: DEMO EMAIL VIEWER ─── */}
      {subTab === "emails" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-amber-400" />
                <span>Hộp Thư Mô Phỏng (Demo Email Viewer)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Hiển thị tối đa 50 thông báo email/Zalo đã gửi đi gần nhất để kiểm tra giao diện và nội dung.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadEmails}
                disabled={loadingEmails}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingEmails ? "animate-spin" : ""}`} />
                <span>Làm mới</span>
              </button>
              {emails.length > 0 && (
                <button
                  onClick={handleClearEmails}
                  className="bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa hết</span>
                </button>
              )}
            </div>
          </div>

          {emails.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              <Mail className="w-10 h-10 mx-auto text-slate-700 mb-3" />
              <p className="font-semibold text-slate-400 text-sm">Chưa có email nào trong hộp thư demo.</p>
              <p className="mt-1">
                Hãy thử đặt một đơn hàng mới hoặc bấm nút &quot;Tua nhanh vận đơn&quot; ở tab bên cạnh để kích hoạt gửi email.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="py-3 px-4">Thời Gian</th>
                    <th className="py-3 px-4">Loại</th>
                    <th className="py-3 px-4">Người Nhận</th>
                    <th className="py-3 px-4">Tiêu Đề</th>
                    <th className="py-3 px-4">Chế Độ</th>
                    <th className="py-3 px-4 text-right">Xem Chi Tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {emails.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-850/60 transition">
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap font-mono">
                        {new Date(m.sentAt).toLocaleTimeString("vi-VN")} {new Date(m.sentAt).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-slate-700">
                          {m.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-white font-medium whitespace-nowrap">{m.to}</td>
                      <td className="py-3 px-4 text-slate-200 max-w-[320px] truncate" title={m.subject}>
                        {m.subject}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {m.isSimulated ? (
                          <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                            Mô phỏng
                          </span>
                        ) : (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                            SMTP Thật
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedEmail(m)}
                          className="bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 font-semibold px-2.5 py-1 rounded-lg text-xs inline-flex items-center gap-1 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Xem HTML</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: SYSTEM CONFIG EDITOR ─── */}
      {subTab === "config" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-400" />
                <span>Cấu Hình Tỷ Lệ Phí Động (SystemConfig Editor)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Các giá trị này được lưu trên Neon DB và áp dụng tự động cho mọi đơn hàng mới mà không cần redeploy.
              </p>
            </div>
            <button
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition self-start sm:self-auto shadow-lg shadow-amber-950/40"
            >
              {savingConfig ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Lưu Cấu Hình Mới</span>
            </button>
          </div>

          {loadingConfig ? (
            <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span>Đang đọc cấu hình từ Database...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  key: "service_fee_percent",
                  title: "Phí Dịch Vụ Mua Hộ (%)",
                  unit: "%",
                  hint: "Áp dụng theo % trên tổng giá trị hàng quy đổi VND. Mặc định 4%.",
                },
                {
                  key: "min_service_fee_vnd",
                  title: "Phí Mua Hộ Tối Thiểu (VND)",
                  unit: "đ",
                  hint: "Mức sàn khi % tính ra thấp hơn. Mặc định 20.000 đ.",
                },
                {
                  key: "air_shipping_per_kg_vnd",
                  title: "Cước Hàng Không Quốc Tế / kg (VND)",
                  unit: "đ/kg",
                  hint: "Cước bay chuyên tuyến Tokyo ➔ Hà Nội/TP.HCM. Mặc định 185.000 đ/kg.",
                },
                {
                  key: "group_buy_discount_percent",
                  title: "Giảm Giá Cước Khi Gộp Đơn (%)",
                  unit: "%",
                  hint: "Giảm cước bay cho kiện hàng ≤ 0.5kg khi gom đơn chung. Mặc định 25%.",
                },
                {
                  key: "floor_exchange_rate_jpy",
                  title: "Tỷ Giá Sàn An Toàn (JPY/VND)",
                  unit: "đ",
                  hint: "Tỷ giá tối thiểu phòng vệ biến động mạnh khi API tỷ giá gặp sự cố. Mặc định 172 đ.",
                },
                {
                  key: "min_order_threshold_vnd",
                  title: "Giá Trị Đơn Hàng Tối Thiểu (VND)",
                  unit: "đ",
                  hint: "Ngưỡng tiền hàng tối thiểu để hệ thống chấp nhận nhận đơn. Mặc định 300.000 đ.",
                },
              ].map((item) => (
                <div key={item.key} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-white">{item.title}</label>
                    <span className="font-mono text-[10px] text-slate-500">{item.key}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      value={configInputs[item.key] ?? ""}
                      onChange={(e) =>
                        setConfigInputs({ ...configInputs, [item.key]: e.target.value })
                      }
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                    />
                    <span className="text-xs font-bold text-slate-400 min-w-[36px]">{item.unit}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">{item.hint}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL XEM CHI TIẾT EMAIL HTML ─── */}
      {selectedEmail && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white truncate max-w-[500px]">
                  {selectedEmail.subject}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Đến: <strong className="text-slate-200">{selectedEmail.to}</strong> · {new Date(selectedEmail.sentAt).toLocaleString("vi-VN")}
                </p>
              </div>
              <button
                onClick={() => setSelectedEmail(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Render HTML trong sandbox iframe */}
            <div className="flex-1 bg-white p-4 overflow-y-auto">
              <div
                dangerouslySetInnerHTML={{ __html: selectedEmail.html }}
                className="max-w-2xl mx-auto"
              />
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedEmail(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition"
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
