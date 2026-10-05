"use client";

import React, { useState, useEffect } from "react";
import {
  RefreshCw,
  ExternalLink,
  Trash2,
  Edit3,
  X,
  CheckCircle2,
  AlertCircle,
  Printer,
  Search,
  Filter,
  Columns,
  ChevronRight,
  Ban
} from "lucide-react";
import Link from "next/link";
import { OrderStatus } from "@/types";
import { StoredOrder } from "@/lib/order-store";
import { useAdminToast } from "@/context/AdminToastContext";

interface OrderManagementTabProps {
  adminViewMode: "dashboard" | "operations";
  activeTab: string;
  externalSearchTerm: string;
  onClearSearch: () => void;
}

export default function OrderManagementTab({ adminViewMode, activeTab, externalSearchTerm, onClearSearch }: OrderManagementTabProps) {
  const { adminToast } = useAdminToast();
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<StoredOrder | null>(null);
  const [newStatus, setNewStatus] = useState<OrderStatus>("PURCHASING_JP");
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateDesc, setUpdateDesc] = useState("");
  const [updateLocation, setUpdateLocation] = useState("Tokyo, Nhật Bản");
  const [jpTrack, setJpTrack] = useState("");
  const [vnTrack, setVnTrack] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [cancelModalOrder, setCancelModalOrder] = useState<StoredOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("Sản phẩm hết hàng tại Nhật / Người bán hủy bán");
  const [cancelCustomReason, setCancelCustomReason] = useState("");
  const [refundDeposit, setRefundDeposit] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [packingSlipOrder, setPackingSlipOrder] = useState<StoredOrder | null>(null);

  // Sync external search term
  useEffect(() => {
    if (externalSearchTerm) {
      setSearchTerm(externalSearchTerm);
    }
  }, [externalSearchTerm]);

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (res.ok && data.orders) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.error(err);
      adminToast.error("Lỗi tải đơn hàng");
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openUpdateModal = (order: StoredOrder) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setJpTrack(order.jpDomesticTrack || "");
    setVnTrack(order.vnDomesticTrack || "");

    if (order.status === "PENDING_DEPOSIT") {
      setNewStatus("PURCHASING_JP");
      setUpdateTitle("Đã nhận cọc - Đang mua hàng tại Tokyo");
      setUpdateDesc("Nhân viên văn phòng Tokyo đã tiến hành order hàng trực tiếp từ người bán.");
      setUpdateLocation("Tokyo, Nhật Bản");
    } else if (order.status === "PURCHASING_JP") {
      setNewStatus("WAREHOUSE_JP");
      setUpdateTitle("Đã nhập kho Tokyo");
      setUpdateDesc("Kiện hàng đã về kho Nhật, kiểm tra seal nguyên vẹn và cân nặng chuẩn xác.");
      setUpdateLocation("Kho Tokyo (Edogawa-ku)");
    } else if (order.status === "WAREHOUSE_JP") {
      setNewStatus("IN_TRANSIT_AIR");
      setUpdateTitle("Đang vận chuyển quốc tế Tokyo ⇄ Việt Nam");
      setUpdateDesc("Kiện hàng đã được đóng gói chống sốc và lên lộ trình chuyển về Việt Nam.");
      setUpdateLocation("Sân bay Quốc tế Narita (NRT)");
    } else if (order.status === "IN_TRANSIT_AIR") {
      setNewStatus("WAREHOUSE_VN");
      setUpdateTitle("Đã nhập kho phân loại tại Việt Nam");
      setUpdateDesc("Hàng hoàn tất thông quan hải quan và chuyển về kho trung chuyển.");
      setUpdateLocation("Kho ChillBanana Hà Nội / TP.HCM");
    } else if (order.status === "WAREHOUSE_VN") {
      setNewStatus("LOCAL_DELIVERY");
      setUpdateTitle("Đang giao hàng chặng cuối");
      setUpdateDesc("Đã bàn giao cho đơn vị vận chuyển nội địa (GHTK/GHN/ViettelPost) phát tận tay khách.");
      setUpdateLocation("Việt Nam");
    } else if (order.status === "LOCAL_DELIVERY") {
      setNewStatus("COMPLETED");
      setUpdateTitle("Giao hàng thành công");
      setUpdateDesc("Khách hàng đã nhận đủ hàng và hoàn tất đơn hàng.");
      setUpdateLocation("Việt Nam");
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setIsUpdating(true);

    try {
      const res = await fetch(`/api/orders/${selectedOrder.orderCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          title: updateTitle || "Cập nhật tiến độ đơn hàng",
          description: updateDesc || "Đơn hàng đã chuyển sang trạng thái mới.",
          location: updateLocation || "Việt Nam",
          jpTrack,
          vnTrack,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        adminToast.success(`Đã cập nhật đơn #${selectedOrder.orderCode} thành công!`);
        setSelectedOrder(null);
        fetchOrders();
      } else {
        alert("Lỗi cập nhật: " + (data.error || "Vui lòng thử lại"));
      }
    } catch {
      adminToast.error("Lỗi kết nối máy chủ");
    } finally {
      setIsUpdating(false);
    }
  };

  const openCancelModal = (order: StoredOrder) => {
    setCancelModalOrder(order);
    setCancelReason("Sản phẩm hết hàng tại Nhật / Người bán hủy bán");
    setCancelCustomReason("");
    setRefundDeposit(order.paymentStatus !== "UNPAID");
  };

  const handleCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalOrder) return;
    setIsCancelling(true);

    const finalReason =
      cancelReason === "Khác" && cancelCustomReason.trim()
        ? cancelCustomReason.trim()
        : cancelReason;

    try {
      const res = await fetch(`/api/orders/${cancelModalOrder.orderCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          by: "ADMIN",
          reason: finalReason,
          paymentStatus: refundDeposit ? "UNPAID" : cancelModalOrder.paymentStatus,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        adminToast.success(`Đã hủy đơn hàng #${cancelModalOrder.orderCode} thành công!`);
        setCancelModalOrder(null);
        fetchOrders();
      } else {
        alert("Lỗi khi hủy đơn: " + (data.error || "Vui lòng thử lại"));
      }
    } catch {
      adminToast.error("Lỗi kết nối máy chủ");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDeleteOrder = async (orderCode: string) => {
    const confirmed = window.confirm(
      `CẢNH BÁO: Bạn có chắc chắn muốn XÓA VĨNH VIỄN đơn hàng #${orderCode} khỏi cơ sở dữ liệu?\nThao tác này sẽ dọn sạch dữ liệu và không thể hoàn tác!`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/orders/${orderCode}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        adminToast.error(`Đã xóa vĩnh viễn đơn #${orderCode}!`);
        fetchOrders();
      } else {
        alert("Lỗi khi xóa đơn: " + (data.error || "Vui lòng thử lại"));
      }
    } catch {
      adminToast.error("Lỗi kết nối máy chủ khi xóa");
    }
  };

  const quickMoveStatus = async (
    orderCode: string,
    nextStatus: OrderStatus,
    title: string,
    desc: string,
    loc: string
  ) => {
    try {
      const res = await fetch(`/api/orders/${orderCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, title, description: desc, location: loc }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchOrders();
      } else {
        alert("Lỗi cập nhật: " + (data.error || "Vui lòng thử lại"));
      }
    } catch {
      adminToast.error("Lỗi kết nối máy chủ");
    }
  };

  const filteredOrders = orders.filter((ord) => {
    const matchesStatus = filterStatus === "ALL" || ord.status === filterStatus;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      ord.orderCode.toLowerCase().includes(term) ||
      ord.customerName.toLowerCase().includes(term) ||
      (ord.customerEmail && ord.customerEmail.toLowerCase().includes(term)) ||
      ord.customerPhone.includes(searchTerm) ||
      ord.productName.toLowerCase().includes(term);
    return matchesStatus && matchesSearch;
  });

  const totalRevenue = orders.reduce((acc, curr) => acc + curr.totalVnd, 0);
  const actualRevenue = orders
    .filter((o) => o.paymentStatus !== "UNPAID")
    .reduce((acc, curr) => acc + curr.depositAmountVnd, 0);
  const depositedCount = orders.filter((o) => o.paymentStatus !== "UNPAID").length;
  const completedCount = orders.filter((o) => o.status === "COMPLETED").length;

  return (
    <div className="order-management-tab w-full">
      {adminViewMode === "dashboard" && activeTab === "orders" && (
              <div className="space-y-6">
            
            {/* Quick Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Tổng Đơn Hàng</span>
                <div className="text-2xl font-bold text-navy-900 mt-1">{orders.length} đơn</div>
                <span className="text-[11px] text-emerald-600 font-bold mt-1 inline-block">Lưu trữ an toàn trong CSDL</span>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Doanh Thu Thực Thu</span>
                <div className="text-2xl font-bold text-banana-600 mt-1 font-mono">
                  {actualRevenue.toLocaleString("vi-VN")} đ
                </div>
                <span className="text-[11px] text-slate-500 mt-1 inline-block">Tổng cọc đã nhận từ {depositedCount} đơn</span>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Đơn Hoàn Thành</span>
                <div className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
                  {completedCount} / {orders.length}
                </div>
                <span className="text-[11px] text-emerald-600 mt-1 inline-block">
                  Tỷ lệ: {orders.length > 0 ? Math.round((completedCount / orders.length) * 100) : 0}% hoàn thành
                </span>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Đang Xử Lý Mua & Vận Chuyển</span>
                <div className="text-2xl font-bold text-blue-600 mt-1 font-mono">
                  {orders.filter((o) => o.status !== "COMPLETED" && o.status !== "PENDING_DEPOSIT" && o.status !== "CANCELLED").length} đơn
                </div>
                <span className="text-[11px] text-slate-500 mt-1 inline-block">Tiến độ 7 bước liên tục</span>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo mã đơn, khách, sđt, sản phẩm..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-banana-500 focus:bg-white"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <Filter className="w-4 h-4 text-slate-400 mr-1 hidden sm:inline" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-banana-500"
                >
                  <option value="ALL">Tất cả trạng thái ({orders.length})</option>
                  <option value="PENDING_DEPOSIT">1. Chờ cọc (Pending Deposit)</option>
                  <option value="PURCHASING_JP">2. Đang mua hàng tại Nhật</option>
                  <option value="WAREHOUSE_JP">3. Đã nhập kho Tokyo</option>
                  <option value="IN_TRANSIT_AIR">4. Đang vận chuyển quốc tế</option>
                  <option value="WAREHOUSE_VN">5. Đã về kho Việt Nam</option>
                  <option value="LOCAL_DELIVERY">6. Đang phát nội địa VN</option>
                  <option value="COMPLETED">7. Giao hàng thành công</option>
                  <option value="CANCELLED">❌ Đã hủy (Cancelled)</option>
                </select>

                <button
                  onClick={fetchOrders}
                  className="p-2 text-slate-600 hover:text-banana-600 hover:bg-slate-100 rounded-xl transition-colors"
                  title="Làm mới danh sách"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingOrders ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-4">Mã Đơn</th>
                      <th className="p-4">Khách Hàng</th>
                      <th className="p-4">Sản Phẩm &amp; Sàn</th>
                      <th className="p-4">Tổng Tiền (VND)</th>
                      <th className="p-4">Cọc / TT</th>
                      <th className="p-4">Trạng Thái 7 Bước</th>
                      <th className="p-4 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-slate-500">
                          <div className="max-w-md mx-auto space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl mx-auto">
                              📦
                            </div>
                            <div className="font-bold text-navy-900 text-sm">
                              Chưa có đơn hàng nào trong CSDL SQLite
                            </div>
                            <p className="text-xs text-slate-400">
                              Hệ thống đã dọn sạch toàn bộ dữ liệu mẫu. Khi có khách hàng thật đặt đơn trên trang chủ, thông tin đơn sẽ xuất hiện ngay tại đây!
                            </p>
                            <div className="pt-1">
                              <Link
                                href="/#calculator"
                                target="_blank"
                                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-banana-500 hover:bg-banana-600 text-navy-950 font-bold text-xs rounded-xl shadow-sm transition-all"
                              >
                                <span>Mở Trang Chủ Đặt Hàng Thử Nghiệm</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4 font-mono font-bold text-navy-900">
                            #{ord.orderCode}
                            {ord.isGroupBuy && (
                              <span className="block text-[10px] font-sans text-amber-600 font-bold">
                                📦 Gộp đơn
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900">{ord.customerName}</span>
                              {((ord as any).customerType === "REGISTERED" || (ord as any).customerId) ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">
                                  👤 Thành viên
                                </span>
                              ) : (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-orange-100 text-orange-700 border border-orange-200 shrink-0">
                                  🛍️ Khách lạ
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">{ord.customerPhone}</div>
                          </td>
                          <td className="p-4 max-w-xs">
                            <div className="font-semibold text-navy-950 truncate" title={ord.productName}>
                              {ord.productName}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {ord.priceJpy.toLocaleString()} ¥ • {ord.weightKg} kg
                            </div>
                          </td>
                          <td className="p-4 font-mono font-bold text-navy-900">
                            {ord.totalVnd.toLocaleString()} đ
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                ord.paymentStatus === "UNPAID"
                                  ? "bg-rose-100 text-rose-700"
                                  : ord.paymentStatus === "DEPOSITED_50"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {ord.paymentStatus === "UNPAID"
                                ? "Chưa cọc"
                                : ord.paymentStatus === "DEPOSITED_50"
                                ? "Cọc 50%"
                                : "Đã trả 100%"}
                            </span>
                          </td>
                          <td className="p-4">
                            {ord.status === "CANCELLED" ? (
                              <span className="inline-flex items-center text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-xl">
                                ✕ Đã Hủy
                              </span>
                            ) : ord.status === "COMPLETED" ? (
                              <span className="inline-flex items-center text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
                                ✓ Hoàn Tất
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl">
                                {ord.status}
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {ord.status !== "CANCELLED" && (
                                <>
                                  <button
                                    onClick={() => openUpdateModal(ord)}
                                    title="Cập nhật tiến độ"
                                    className="px-2.5 py-1.5 bg-banana-500 hover:bg-banana-600 text-navy-950 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center space-x-1"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Tiến độ</span>
                                  </button>
                                  <button
                                    onClick={() => openCancelModal(ord)}
                                    title="Hủy đơn hàng"
                                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-all flex items-center space-x-1"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                    <span>Hủy</span>
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => handleDeleteOrder(ord.orderCode)}
                                title="Xóa vĩnh viễn đơn rác / test"
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
      )}

      {adminViewMode === "operations" && (
          <div className="space-y-6">
            {/* Header Toolbar */}
            <div className="bg-gradient-to-r from-slate-900 via-navy-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center space-x-2 bg-banana-500/20 text-banana-300 text-xs font-bold px-3 py-1 rounded-full mb-2 border border-banana-500/30">
                  <Columns className="w-3.5 h-3.5 text-banana-400" />
                  <span>Giao Diện Tác Nghiệp Kho Vận Tokyo ⇄ Việt Nam</span>
                </div>
                <h2 className="text-2xl font-serif font-bold text-white">
                  Bàn Điều Phối &amp; Xử Lý Đơn Hàng 1-Click
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-xl">
                  Giao diện chuyên sâu dành cho nhân viên kho Nhật và điều phối giao hàng Việt Nam: chuyển trạng thái 1 chạm, in phiếu gửi và cập nhật mã vận đơn tức thì.
                </p>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <div className="relative w-64">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm mã đơn, tên khách..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-banana-500"
                  />
                </div>
                <button
                  onClick={fetchOrders}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors border border-slate-700"
                  title="Làm mới dữ liệu"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingOrders ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* Kanban Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
              
              {/* CỘT 1: CHỜ CỌC */}
              <div className="bg-slate-100/90 rounded-2xl p-4 border border-slate-200 flex flex-col min-h-[400px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                  <div className="flex items-center space-x-1.5 font-bold text-xs text-amber-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span>1. Chờ Cọc</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
                    {orders.filter((o) => o.status === "PENDING_DEPOSIT").length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[70vh]">
                  {orders
                    .filter((o) => o.status === "PENDING_DEPOSIT")
                    .map((ord) => (
                      <div key={ord.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all text-xs space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="font-mono font-bold text-navy-900 text-xs">#{ord.orderCode}</span>
                          <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-200">
                            Chưa Cọc
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 line-clamp-1">{ord.customerName}</div>
                        <div className="text-[11px] text-slate-500">📞 {ord.customerPhone}</div>
                        <div className="text-[11px] text-navy-900 line-clamp-2 bg-slate-50 p-2 rounded-lg border">
                          {ord.productName}
                        </div>
                        <div className="text-right font-mono font-bold text-banana-700">
                          {ord.totalVnd?.toLocaleString()} đ
                        </div>
                        <div className="pt-2 border-t flex flex-col gap-1.5">
                          <button
                            onClick={() => quickMoveStatus(
                              ord.orderCode,
                              "PURCHASING_JP",
                              "Đã nhận cọc - Đang mua hàng tại Tokyo",
                              "Nhân viên văn phòng Tokyo đã tiến hành order trực tiếp từ người bán.",
                              "Tokyo, Nhật Bản"
                            )}
                            className="w-full py-1.5 bg-banana-500 hover:bg-banana-600 text-navy-950 font-bold rounded-lg text-[11px] transition-colors flex items-center justify-center space-x-1"
                          >
                            <span>Xác nhận cọc &amp; Mua</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setPackingSlipOrder(ord)}
                              className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold"
                            >
                              In Phiếu
                            </button>
                            <button
                              onClick={() => openUpdateModal(ord)}
                              className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold"
                            >
                              Chi Tiết
                            </button>
                            <button
                              onClick={() => openCancelModal(ord)}
                              title="Hủy đơn"
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px]"
                            >
                              <Ban className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteOrder(ord.orderCode)}
                              title="Xóa đơn rác"
                              className="px-2 py-1 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg text-[10px]"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  {orders.filter((o) => o.status === "PENDING_DEPOSIT").length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      Không có đơn chờ cọc
                    </div>
                  )}
                </div>
              </div>

              {/* CỘT 2: ĐANG MUA TẠI NHẬT */}
              <div className="bg-slate-100/90 rounded-2xl p-4 border border-slate-200 flex flex-col min-h-[400px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                  <div className="flex items-center space-x-1.5 font-bold text-xs text-blue-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    <span>2. Mua Tại Nhật</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold bg-blue-200/80 text-blue-900 px-2 py-0.5 rounded-full">
                    {orders.filter((o) => o.status === "PURCHASING_JP").length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[70vh]">
                  {orders
                    .filter((o) => o.status === "PURCHASING_JP")
                    .map((ord) => (
                      <div key={ord.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all text-xs space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="font-mono font-bold text-navy-900 text-xs">#{ord.orderCode}</span>
                          <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200">
                            Đang Mua
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 line-clamp-1">{ord.customerName}</div>
                        <div className="text-[11px] text-slate-500">📞 {ord.customerPhone}</div>
                        <div className="text-[11px] text-navy-900 line-clamp-2 bg-slate-50 p-2 rounded-lg border">
                          {ord.productName}
                        </div>
                        <div className="text-right font-mono font-bold text-banana-700">
                          {ord.priceJpy?.toLocaleString()} ¥
                        </div>
                        <div className="pt-2 border-t flex flex-col gap-1.5">
                          <button
                            onClick={() => quickMoveStatus(
                              ord.orderCode,
                              "WAREHOUSE_JP",
                              "Đã nhập kho Tokyo",
                              "Kiện hàng đã về kho Nhật, kiểm tra seal nguyên vẹn và cân nặng chuẩn xác.",
                              "Kho Tokyo (Edogawa-ku)"
                            )}
                            className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[11px] transition-colors flex items-center justify-center space-x-1"
                          >
                            <span>Đã Mua $\rightarrow$ Về Kho Tokyo</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setPackingSlipOrder(ord)}
                              className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold"
                            >
                              In Phiếu
                            </button>
                            <button
                              onClick={() => openUpdateModal(ord)}
                              className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold"
                            >
                              Chi Tiết
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  {orders.filter((o) => o.status === "PURCHASING_JP").length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      Không có đơn đang mua
                    </div>
                  )}
                </div>
              </div>

              {/* CỘT 3: KHO TOKYO */}
              <div className="bg-slate-100/90 rounded-2xl p-4 border border-slate-200 flex flex-col min-h-[400px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                  <div className="flex items-center space-x-1.5 font-bold text-xs text-purple-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                    <span>3. Kho Tokyo</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold bg-purple-200/80 text-purple-900 px-2 py-0.5 rounded-full">
                    {orders.filter((o) => o.status === "WAREHOUSE_JP").length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[70vh]">
                  {orders
                    .filter((o) => o.status === "WAREHOUSE_JP")
                    .map((ord) => (
                      <div key={ord.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all text-xs space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="font-mono font-bold text-navy-900 text-xs">#{ord.orderCode}</span>
                          <span className="bg-purple-50 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-200">
                            Tại Kho Nhật
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 line-clamp-1">{ord.customerName}</div>
                        <div className="text-[11px] text-slate-500">Trọng lượng: {ord.weightKg} kg</div>
                        <div className="text-[11px] text-navy-900 line-clamp-2 bg-slate-50 p-2 rounded-lg border">
                          {ord.productName}
                        </div>
                        <div className="pt-2 border-t flex flex-col gap-1.5">
                          <button
                            onClick={() => quickMoveStatus(
                              ord.orderCode,
                              "IN_TRANSIT_AIR",
                              "Đang vận chuyển quốc tế Tokyo ⇄ Việt Nam",
                              "Kiện hàng đã được đóng gói chống sốc và lên lộ trình chuyển về Việt Nam.",
                              "Tokyo, Nhật Bản"
                            )}
                            className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-[11px] transition-colors flex items-center justify-center space-x-1"
                          >
                            <span>Xuất Kho $\rightarrow$ Bay Về VN</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setPackingSlipOrder(ord)}
                              className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold"
                            >
                              In Phiếu
                            </button>
                            <button
                              onClick={() => openUpdateModal(ord)}
                              className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold"
                            >
                              Chi Tiết
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  {orders.filter((o) => o.status === "WAREHOUSE_JP").length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      Kho Tokyo trống
                    </div>
                  )}
                </div>
              </div>

              {/* CỘT 4: VẬN CHUYỂN QUỐC TẾ & KHO VN */}
              <div className="bg-slate-100/90 rounded-2xl p-4 border border-slate-200 flex flex-col min-h-[400px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                  <div className="flex items-center space-x-1.5 font-bold text-xs text-orange-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                    <span>4. Về Kho VN</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold bg-orange-200/80 text-orange-900 px-2 py-0.5 rounded-full">
                    {orders.filter((o) => o.status === "IN_TRANSIT_AIR" || o.status === "WAREHOUSE_VN").length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[70vh]">
                  {orders
                    .filter((o) => o.status === "IN_TRANSIT_AIR" || o.status === "WAREHOUSE_VN")
                    .map((ord) => (
                      <div key={ord.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all text-xs space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="font-mono font-bold text-navy-900 text-xs">#{ord.orderCode}</span>
                          <span className="bg-orange-50 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded border border-orange-200">
                            {ord.status === "IN_TRANSIT_AIR" ? "Đang Vận Chuyển" : "Kho VN"}
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 line-clamp-1">{ord.customerName}</div>
                        <div className="text-[11px] text-slate-500">📍 {ord.customerAddress}</div>
                        <div className="text-[11px] text-navy-900 line-clamp-2 bg-slate-50 p-2 rounded-lg border">
                          {ord.productName}
                        </div>
                        <div className="pt-2 border-t flex flex-col gap-1.5">
                          <button
                            onClick={() => quickMoveStatus(
                              ord.orderCode,
                              "LOCAL_DELIVERY",
                              "Đang giao hàng chặng cuối",
                              "Đã bàn giao cho đơn vị vận chuyển nội địa (GHTK/GHN/ViettelPost) phát tận tay khách.",
                              "Việt Nam"
                            )}
                            className="w-full py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg text-[11px] transition-colors flex items-center justify-center space-x-1"
                          >
                            <span>Bàn Giao Shipper</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setPackingSlipOrder(ord)}
                              className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold"
                            >
                              In Phiếu
                            </button>
                            <button
                              onClick={() => openUpdateModal(ord)}
                              className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold"
                            >
                              Chi Tiết
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  {orders.filter((o) => o.status === "IN_TRANSIT_AIR" || o.status === "WAREHOUSE_VN").length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      Không có đơn đang chuyển
                    </div>
                  )}
                </div>
              </div>

              {/* CỘT 5: GIAO HÀNG & HOÀN TẤT */}
              <div className="bg-slate-100/90 rounded-2xl p-4 border border-slate-200 flex flex-col min-h-[400px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                  <div className="flex items-center space-x-1.5 font-bold text-xs text-emerald-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span>5. Giao Hàng &amp; Xong</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full">
                    {orders.filter((o) => o.status === "LOCAL_DELIVERY" || o.status === "COMPLETED").length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[70vh]">
                  {orders
                    .filter((o) => o.status === "LOCAL_DELIVERY" || o.status === "COMPLETED")
                    .map((ord) => (
                      <div key={ord.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all text-xs space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="font-mono font-bold text-navy-900 text-xs">#{ord.orderCode}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            ord.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}>
                            {ord.status === "COMPLETED" ? "Đã Giao Xong" : "Đang Phát Hàng"}
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 line-clamp-1">{ord.customerName}</div>
                        <div className="text-[11px] text-slate-500">Mã VN: {ord.vnDomesticTrack || "Chưa gán"}</div>
                        <div className="text-[11px] text-navy-900 line-clamp-2 bg-slate-50 p-2 rounded-lg border">
                          {ord.productName}
                        </div>
                        <div className="pt-2 border-t flex flex-col gap-1.5">
                          {ord.status !== "COMPLETED" && (
                            <button
                              onClick={() => quickMoveStatus(
                                ord.orderCode,
                                "COMPLETED",
                                "Giao hàng thành công",
                                "Khách hàng đã nhận đủ hàng và hoàn tất đơn hàng.",
                                "Việt Nam"
                              )}
                              className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] transition-colors flex items-center justify-center space-x-1"
                            >
                              <span>Xác Nhận Đã Nhận</span>
                              <CheckCircle2 className="w-3 h-3" />
                            </button>
                          )}
                          <div className="flex gap-1">
                            <button
                              onClick={() => setPackingSlipOrder(ord)}
                              className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold"
                            >
                              In Phiếu
                            </button>
                            <button
                              onClick={() => openUpdateModal(ord)}
                              className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold"
                            >
                              Chi Tiết
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  {orders.filter((o) => o.status === "LOCAL_DELIVERY" || o.status === "COMPLETED").length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      Chưa có đơn hoàn tất
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
      )}


      {/* MODAL 1: CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG (7 BƯỚC) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative my-8">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-6 h-6" />
            </button>

            <h3 className="text-lg font-bold text-navy-900 mb-1">
              Cập Nhật Tiến Độ Đơn #{selectedOrder.orderCode}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Khách: <strong>{selectedOrder.customerName}</strong> • {selectedOrder.productName}
            </p>

            <form onSubmit={handleUpdateStatus} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Trạng thái tiếp theo</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-banana-500"
                >
                  <option value="PENDING_DEPOSIT">1. Chờ cọc (Pending Deposit)</option>
                  <option value="PURCHASING_JP">2. Đang mua hàng tại Nhật (Tokyo)</option>
                  <option value="WAREHOUSE_JP">3. Đã nhập kho Tokyo (Cân &amp; Đóng gói)</option>
                  <option value="IN_TRANSIT_AIR">4. Đang vận chuyển quốc tế Tokyo ⇄ VN</option>
                  <option value="WAREHOUSE_VN">5. Đã nhập kho phân phối Việt Nam</option>
                  <option value="LOCAL_DELIVERY">6. Đang giao hàng chặng cuối (GHTK/GHN)</option>
                  <option value="COMPLETED">7. Giao hàng thành công</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tiêu đề thông báo</label>
                <input
                  type="text"
                  value={updateTitle}
                  onChange={(e) => setUpdateTitle(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  placeholder="VD: Đã nhập kho Tokyo"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mô tả chi tiết</label>
                <textarea
                  rows={2}
                  value={updateDesc}
                  onChange={(e) => setUpdateDesc(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  placeholder="VD: Kiện hàng đã được kiểm tra và cân nặng chuẩn xác."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mã vận đơn JP (Sagawa/Yamato)</label>
                  <input
                    type="text"
                    value={jpTrack}
                    onChange={(e) => setJpTrack(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                    placeholder="VD: SGW-88219"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mã vận đơn VN (GHTK/GHN)</label>
                  <input
                    type="text"
                    value={vnTrack}
                    onChange={(e) => setVnTrack(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                    placeholder="VD: GHTK-VN0982"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 bg-banana-500 hover:bg-banana-600 text-navy-950 rounded-xl font-bold disabled:opacity-50"
                >
                  {isUpdating ? "Đang lưu..." : "Xác nhận cập nhật"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: HỦY ĐƠN HÀNG DÀNH CHO ADMIN */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative my-8">
            <button
              onClick={() => setCancelModalOrder(null)}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex items-center space-x-2 text-rose-600 mb-1">
              <Ban className="w-5 h-5" />
              <h3 className="text-lg font-bold text-navy-900">
                Xác Nhận Hủy Đơn Hàng #{cancelModalOrder.orderCode}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Khách hàng: <strong>{cancelModalOrder.customerName}</strong> ({cancelModalOrder.customerPhone}) • {cancelModalOrder.productName}
            </p>

            <form onSubmit={handleCancelOrder} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Lý do hủy đơn hàng <span className="text-rose-500">*</span>
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-rose-500"
                >
                  <option value="Sản phẩm hết hàng tại Nhật / Người bán hủy bán">
                    1. Sản phẩm hết hàng tại Nhật / Người bán hủy bán
                  </option>
                  <option value="Người bán có dấu hiệu lừa đảo / Đánh giá quá thấp">
                    2. Người bán có dấu hiệu lừa đảo / Đánh giá quá thấp
                  </option>
                  <option value="Hàng thuộc danh mục cấm bay quốc tế (Pin, Bình xịt khí nén, Chất lỏng cấm)">
                    3. Hàng thuộc danh mục cấm bay quốc tế (Pin, Khí nén...)
                  </option>
                  <option value="Khách hàng yêu cầu hủy đơn hàng">
                    4. Khách hàng yêu cầu hủy đơn hàng
                  </option>
                  <option value="Khác">5. Lý do khác (Nhập chi tiết bên dưới)</option>
                </select>
              </div>

              {cancelReason === "Khác" && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Chi tiết lý do hủy
                  </label>
                  <textarea
                    rows={2}
                    value={cancelCustomReason}
                    onChange={(e) => setCancelCustomReason(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500"
                    placeholder="Nhập lý do chi tiết để thông báo đến khách hàng..."
                    required
                  />
                </div>
              )}

              {cancelModalOrder.paymentStatus !== "UNPAID" && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
                  <div className="font-bold text-amber-800 flex items-center space-x-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Đơn hàng đã có tiền cọc ({cancelModalOrder.depositAmountVnd.toLocaleString("vi-VN")} đ)</span>
                  </div>
                  <label className="flex items-center space-x-2 text-slate-700 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={refundDeposit}
                      onChange={(e) => setRefundDeposit(e.target.checked)}
                      className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                    />
                    <span className="font-semibold text-xs">
                      Xác nhận đã hoàn trả tiền cọc cho khách hàng (Chuyển trạng thái thanh toán về Chưa cọc)
                    </span>
                  </label>
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">
                Lưu ý: Sau khi hủy, đơn hàng sẽ chuyển sang trạng thái <strong>CANCELLED</strong> và được ghi nhật ký hành trình để khách hàng tra cứu minh bạch.
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setCancelModalOrder(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isCancelling}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>{isCancelling ? "Đang xử lý..." : "Xác Nhận Hủy Đơn"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: PHIẾU GIAO HÀNG & ĐÓNG GÓI (PACKING SLIP PRINT) */}
      {packingSlipOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-300 relative my-8 text-slate-900 font-sans">
            <button
              onClick={() => setPackingSlipOrder(null)}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 print:hidden"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Slip Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-4 flex justify-between items-start">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">🍌</span>
                  <span className="font-serif font-extrabold text-xl tracking-tight text-navy-950">
                    Chill<span className="text-banana-600">Banana</span>
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-0.5">
                  Phiếu Giao Hàng &amp; Vận Đơn Ủy Thác Nhật - Việt
                </div>
              </div>

              <div className="text-right">
                <div className="font-mono text-base font-black bg-slate-100 px-3 py-1 rounded-lg border border-slate-300">
                  #{packingSlipOrder.orderCode}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-1">
                  Ngày tạo: {new Date(packingSlipOrder.createdAt).toLocaleDateString("vi-VN")}
                </div>
              </div>
            </div>

            {/* Sender & Receiver Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="font-bold text-[10px] uppercase text-slate-400 block mb-1">Người gửi / Đơn vị mua hộ:</span>
                <p className="font-bold text-navy-950">Kho ChillBanana Express</p>
                <p className="text-slate-600 text-[11px]">Tokyo Hub ⇄ Hà Nội / TP.HCM</p>
                <p className="text-slate-600 text-[11px]">Hotline: 1900 8888</p>
              </div>

              <div>
                <span className="font-bold text-[10px] uppercase text-slate-400 block mb-1">Người nhận:</span>
                <p className="font-bold text-navy-950">{packingSlipOrder.customerName}</p>
                <p className="font-mono text-slate-800 text-[11px]">📞 {packingSlipOrder.customerPhone}</p>
                <p className="text-slate-600 text-[11px] leading-tight mt-0.5">{packingSlipOrder.customerAddress}</p>
              </div>
            </div>

            {/* Product Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden mb-4 text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Sản Phẩm</th>
                    <th className="p-2.5 text-center">Trọng Lượng</th>
                    <th className="p-2.5 text-right">Tổng Tiền</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2.5 font-medium max-w-[200px]">
                      <div className="font-bold text-navy-950 line-clamp-2">{packingSlipOrder.productName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Giá gốc: {packingSlipOrder.priceJpy?.toLocaleString()} ¥</div>
                    </td>
                    <td className="p-2.5 text-center font-mono">{packingSlipOrder.weightKg} kg</td>
                    <td className="p-2.5 text-right font-mono font-bold text-navy-950">
                      {packingSlipOrder.totalVnd?.toLocaleString()} đ
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Payment Summary */}
            <div className="space-y-1.5 text-xs border-t pt-3 mb-4 font-medium">
              <div className="flex justify-between text-slate-600">
                <span>Số tiền đã đặt cọc:</span>
                <span className="font-mono font-bold text-emerald-700">
                  - {packingSlipOrder.depositAmountVnd?.toLocaleString()} đ ({packingSlipOrder.paymentStatus === "PAID_100" ? "Đã trả 100%" : "Đã cọc 50%"})
                </span>
              </div>
              <div className="flex justify-between text-navy-950 font-bold text-sm pt-1 border-t">
                <span>Thu hộ khi giao hàng (COD):</span>
                <span className="font-mono text-banana-700">
                  {(packingSlipOrder.totalVnd - packingSlipOrder.depositAmountVnd).toLocaleString()} đ
                </span>
              </div>
            </div>

            {/* Tracking Identifiers */}
            <div className="p-3 bg-slate-100 rounded-xl font-mono text-[11px] text-slate-700 space-y-1 mb-4">
              <div>🇯🇵 Mã vận đơn Nhật: <strong className="text-navy-900">{packingSlipOrder.jpDomesticTrack || "YAMATO-PENDING"}</strong></div>
              <div>🇻🇳 Mã bưu cục Việt Nam: <strong className="text-navy-900">{packingSlipOrder.vnDomesticTrack || "GHTK-PENDING"}</strong></div>
            </div>

            {/* Signature Box */}
            <div className="grid grid-cols-2 gap-4 text-center text-xs pt-2 border-t text-slate-600 mb-4">
              <div>
                <p className="font-bold text-[11px]">Người lập phiếu</p>
                <div className="h-10"></div>
                <p className="text-[10px] text-slate-400">(Ký &amp; ghi rõ họ tên)</p>
              </div>
              <div>
                <p className="font-bold text-[11px]">Người nhận hàng</p>
                <div className="h-10"></div>
                <p className="text-[10px] text-slate-400">(Xác nhận hàng nguyên vẹn)</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-2 border-t print:hidden">
              <button
                onClick={() => setPackingSlipOrder(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
              >
                Đóng
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 bg-navy-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow flex items-center space-x-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In Phiếu Gửi Hàng</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
