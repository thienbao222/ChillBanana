"use client";

import React, { useState, useEffect } from "react";
import {
  RefreshCw,
  ExternalLink,
  Edit3,
  X,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Copy,
  Printer,
  Search,
  Filter,
  Columns,
  ChevronRight,
  Ban,
  Mail
} from "lucide-react";
import Link from "next/link";
import { OrderStatus, StoredOrder } from "@/types";
import { useAdminToast } from "@/context/AdminToastContext";
import { ORDER_STATUS_FLOW } from "@/features/orders/policy";
import { DEFAULT_PRICING_CONFIG, type PricingConfigValues } from "@/features/pricing/calculator";
import { parseOrderItemSource } from "@/features/orders/item-source";

const ORDER_STATUS_LABELS: Record<(typeof ORDER_STATUS_FLOW)[number], string> = {
  PENDING_DEPOSIT: "1. Chờ cọc",
  PURCHASING_JP: "2. Đang mua hàng tại Nhật",
  WAREHOUSE_JP: "3. Đã nhập kho Nhật",
  IN_TRANSIT_AIR: "4. Đang vận chuyển quốc tế",
  WAREHOUSE_VN: "5. Đã nhập kho Việt Nam",
  LOCAL_DELIVERY: "6. Đang giao chặng cuối",
  COMPLETED: "7. Giao hàng thành công",
};

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
  const [updateWeightKg, setUpdateWeightKg] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [cancelModalOrder, setCancelModalOrder] = useState<StoredOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("Sản phẩm hết hàng tại Nhật / Người bán hủy bán");
  const [cancelCustomReason, setCancelCustomReason] = useState("");
  const [refundDeposit, setRefundDeposit] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [packingSlipOrder, setPackingSlipOrder] = useState<StoredOrder | null>(null);
  const [priceApprovalOrder, setPriceApprovalOrder] = useState<StoredOrder | null>(null);
  const [priceApprovalJpy, setPriceApprovalJpy] = useState("");
  const [priceApprovalWeight, setPriceApprovalWeight] = useState("");
  const [hasManualVerifiedNoLink, setHasManualVerifiedNoLink] = useState(false);
  const [isApprovingPrice, setIsApprovingPrice] = useState(false);
  const [paymentRecordOrder, setPaymentRecordOrder] = useState<StoredOrder | null>(null);
  const [paymentAmountVnd, setPaymentAmountVnd] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [pricingConfig, setPricingConfig] = useState<PricingConfigValues>(DEFAULT_PRICING_CONFIG);

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
      adminToast.error("Lỗi tải đơn hàng");
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/pricing-config")
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("pricing config unavailable")))
      .then((data) => data?.values && setPricingConfig(data.values as PricingConfigValues))
      .catch(() => adminToast.warning("Đang dùng cấu hình phí mặc định để xem trước; kiểm tra kết nối trước khi duyệt giá."));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openUpdateModal = (order: StoredOrder) => {
    setSelectedOrder(order);
    setNewStatus(order.status as OrderStatus);
    setJpTrack(order.jpDomesticTrack || "");
    setVnTrack(order.vnDomesticTrack || "");
    setUpdateWeightKg(order.weightKg > 0 ? String(order.weightKg) : "");

    if (order.status === "PENDING_DEPOSIT") {
      if (order.isPriceVerified) {
        setNewStatus("PURCHASING_JP");
        setUpdateTitle("Đã nhận cọc - Đang mua hàng tại Tokyo");
        setUpdateDesc("Nhân viên văn phòng Tokyo đã tiến hành order hàng trực tiếp từ người bán.");
        setUpdateLocation("Tokyo, Nhật Bản");
      } else {
        setUpdateTitle("Đơn đang chờ xác minh báo giá");
        setUpdateDesc("Vui lòng duyệt giá trước khi chuyển sang bước mua hàng.");
        setUpdateLocation("Việt Nam");
      }
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
          weightKg: updateWeightKg.trim() ? parseFloat(updateWeightKg) : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        adminToast.success(`Đã cập nhật đơn #${selectedOrder.orderCode} thành công!`);
        setSelectedOrder(null);
        fetchOrders();
      } else {
        adminToast.error("Lỗi cập nhật: " + (data.error || "Vui lòng thử lại"));
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
          ...(refundDeposit ? { paymentStatus: "REFUNDED" } : {}),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        adminToast.success(`Đã hủy đơn hàng #${cancelModalOrder.orderCode} thành công!`);
        setCancelModalOrder(null);
        fetchOrders();
      } else {
        adminToast.error("Lỗi khi hủy đơn: " + (data.error || "Vui lòng thử lại"));
      }
    } catch {
      adminToast.error("Lỗi kết nối máy chủ");
    } finally {
      setIsCancelling(false);
    }
  };

  const openPriceApprovalModal = (order: StoredOrder) => {
    setPriceApprovalOrder(order);
    setPriceApprovalJpy(String(order.priceJpy || ""));
    setPriceApprovalWeight(String(order.weightKg || "0"));
    setHasManualVerifiedNoLink(false);
  };

  const handleVerifyPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceApprovalOrder) return;
    const order = priceApprovalOrder;
    const finalPriceJpy = Number(priceApprovalJpy);
    const finalWeightKg = Number(priceApprovalWeight);
    if (!Number.isSafeInteger(finalPriceJpy) || finalPriceJpy < 100 || !Number.isFinite(finalWeightKg) || finalWeightKg < 0 || finalWeightKg > 100) {
      adminToast.error("Giá phải là số nguyên từ 100 ¥; cân nặng phải từ 0 đến 100 kg.");
      return;
    }
    setIsApprovingPrice(true);
    try {
      const res = await fetch(`/api/orders/${order.orderCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isPriceVerified: true,
          priceJpy: finalPriceJpy,
          weightKg: finalWeightKg,
          title: "Đã duyệt báo giá",
          description: "Quản trị viên đã kiểm tra và duyệt mức giá chính xác. Khách hàng có thể tiến hành đặt cọc.",
          location: "Hệ thống Quản trị",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPriceApprovalOrder(null);
        if (data.emailSent) {
          adminToast.success(`Đã duyệt giá đơn #${order.orderCode} và gửi email xác nhận.`);
        } else {
          adminToast.error(`Đã duyệt giá đơn #${order.orderCode}, nhưng email chưa gửi được. Kiểm tra email khách và cấu hình SMTP.`);
        }
        fetchOrders();
      } else {
        adminToast.error("Lỗi duyệt giá: " + (data.error || "Vui lòng thử lại"));
      }
    } catch {
      adminToast.error("Lỗi kết nối máy chủ");
    } finally {
      setIsApprovingPrice(false);
    }
  };

  const openPaymentRecordModal = (order: StoredOrder) => {
    setPaymentRecordOrder(order);
    setPaymentAmountVnd(String(order.depositAmountVnd));
    setPaymentReference("");
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentRecordOrder) return;
    const order = paymentRecordOrder;
    const amountVnd = Number(paymentAmountVnd);
    const reference = paymentReference.trim();
    if (!Number.isSafeInteger(amountVnd) || amountVnd !== order.depositAmountVnd) {
      adminToast.error(`Số tiền phải khớp với ${order.depositAmountVnd.toLocaleString("vi-VN")} đ.`);
      return;
    }
    if (reference.length < 4 || reference.length > 120) {
      adminToast.error("Mã tham chiếu cần có từ 4 đến 120 ký tự.");
      return;
    }

    setIsRecordingPayment(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.orderCode}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountVnd, reference }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPaymentRecordOrder(null);
        adminToast.success(`Đã ghi nhận thanh toán đơn #${order.orderCode}. Tiếp theo, bấm “Bắt đầu mua hàng”.`);
        fetchOrders();
      } else {
        adminToast.error(data.error || "Không thể ghi nhận thanh toán.");
      }
    } catch {
      adminToast.error("Lỗi kết nối máy chủ");
    } finally {
      setIsRecordingPayment(false);
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
        adminToast.error("Lỗi cập nhật: " + (data.error || "Vui lòng thử lại"));
      }
    } catch {
      adminToast.error("Lỗi kết nối máy chủ");
    }
  };

  const handleRollbackStatus = async (order: StoredOrder) => {
    if (!confirm(`Bạn có chắc chắn muốn hoàn tác lùi 1 bước trạng thái của đơn #${order.orderCode}?`)) return;
    try {
      const res = await fetch(`/api/orders/${order.orderCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rollback" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        adminToast.success(`Đã hoàn tác lùi 1 bước đơn #${order.orderCode}!`);
        fetchOrders();
      } else {
        adminToast.error("Lỗi hoàn tác: " + (data.error || "Không thể thực hiện"));
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

  const editableStatuses = selectedOrder
    ? ORDER_STATUS_FLOW.filter((status, index) =>
        status === selectedOrder.status ||
        (status === ORDER_STATUS_FLOW[ORDER_STATUS_FLOW.indexOf(selectedOrder.status as (typeof ORDER_STATUS_FLOW)[number]) + 1] &&
          (status !== "PURCHASING_JP" || (selectedOrder.isPriceVerified && ["DEPOSITED_50", "PAID_100"].includes(selectedOrder.paymentStatus))))
      )
    : [];

  const totalRevenue = orders.reduce((acc, curr) => acc + curr.totalVnd, 0);
  const actualRevenue = orders
    .filter((o) => o.status !== "CANCELLED" && o.paymentStatus !== "UNPAID" && o.paymentStatus !== "REFUNDED")
    .reduce((acc, curr) => acc + curr.depositAmountVnd, 0);
  const depositedCount = orders.filter((o) => o.status !== "CANCELLED" && o.paymentStatus !== "UNPAID" && o.paymentStatus !== "REFUNDED").length;
  const completedCount = orders.filter((o) => o.status === "COMPLETED").length;
  const approvalJpy = Number(priceApprovalJpy);
  const approvalWeight = Number(priceApprovalWeight);
  const approvalProductVnd = priceApprovalOrder && Number.isSafeInteger(approvalJpy) && approvalJpy >= 100
    ? Math.round(approvalJpy * priceApprovalOrder.exchangeRate)
    : 0;
  const approvalServiceVnd = Math.max(pricingConfig.serviceFeeMinimumVnd, Math.round(approvalProductVnd * pricingConfig.serviceFeePercent / 100));
  const approvalShippingRate = priceApprovalOrder?.isGroupBuy && approvalWeight <= pricingConfig.groupBuyMaxWeightKg
    ? Math.round(pricingConfig.airShippingPerKgVnd * (1 - pricingConfig.groupBuyShippingDiscountPercent / 100))
    : pricingConfig.airShippingPerKgVnd;
  const approvalShippingVnd = Number.isFinite(approvalWeight) && approvalWeight > 0 && approvalWeight <= 100
    ? Math.round(approvalWeight * approvalShippingRate)
    : 0;
  const approvalTotalVnd = approvalProductVnd + approvalServiceVnd + approvalShippingVnd;

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
                <table className="w-full min-w-[1000px] text-left text-xs whitespace-nowrap">
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
                              Chưa có đơn hàng nào trong hệ thống PostgreSQL
                            </div>
                            <p className="text-xs text-slate-400">
                              Hệ thống đã dọn sạch toàn bộ dữ liệu mẫu. Khi có khách hàng thật đặt đơn trên trang chủ, thông tin đơn sẽ xuất hiện ngay tại đây!
                            </p>
                            <div className="pt-1">
                              <Link
                                href="/#quote"
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
                                ord.paymentStatus === "REFUNDED"
                                  ? "bg-slate-100 text-slate-600"
                                  : ord.paymentStatus === "UNPAID"
                                  ? "bg-rose-100 text-rose-700"
                                  : ord.paymentStatus === "DEPOSITED_50"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {ord.paymentStatus === "REFUNDED"
                                ? "Đã hoàn tiền"
                                : ord.paymentStatus === "UNPAID"
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
                                {ORDER_STATUS_LABELS[ord.status as keyof typeof ORDER_STATUS_LABELS] || ord.status}
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {ord.status !== "CANCELLED" && ord.status !== "COMPLETED" && (
                                <>
                                  {!ord.isPriceVerified && ord.status === "PENDING_DEPOSIT" && (
                                    <button
                                      onClick={() => openPriceApprovalModal(ord)}
                                      title="Duyệt giá đơn hàng để khách thanh toán"
                                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center space-x-1"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      <span>Duyệt Giá</span>
                                    </button>
                                  )}
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
                    .map((ord) => {
                      const cardSource = parseOrderItemSource(
                        ord.items?.[0] || ord.orderItems?.[0] || { productName: ord.productName },
                        ord
                      );
                      return (
                        <div key={ord.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all text-xs space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-bold text-navy-900 text-xs">#{ord.orderCode}</span>
                              {cardSource.url && (
                                <a
                                  href={cardSource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={`Mở link nguồn (${cardSource.marketplace}): ${cardSource.url}`}
                                  className="p-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-0.5 border border-blue-200"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="text-[10px] font-bold">🔗 {cardSource.marketplace}</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${ord.paymentStatus === "UNPAID" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                              {ord.paymentStatus === "PAID_100" ? "Đã thanh toán 100%" : ord.paymentStatus === "DEPOSITED_50" ? "Đã cọc 50%" : ord.paymentStatus === "REFUNDED" ? "Đã hoàn tiền" : "Chưa thanh toán"}
                            </span>
                          </div>
                        <div className="font-bold text-slate-900 line-clamp-1">{ord.customerName}</div>
                        <div className="text-[11px] text-slate-500">📞 {ord.customerPhone}</div>
                        <div className="text-[11px] text-navy-900 line-clamp-2 bg-slate-50 p-2 rounded-lg border">
                          {ord.productName}
                        </div>
                        {ord.status === "LOCAL_DELIVERY" && ord.paymentStatus !== "PAID_100" && (
                          <div className="text-[11px] bg-amber-50 text-amber-900 font-semibold px-2 py-1.5 rounded-lg border border-amber-200 flex justify-between items-center">
                            <span>Thu COD lúc giao:</span>
                            <span className="font-mono font-bold text-red-600">
                              {((ord.totalVnd || 0) - (ord.depositAmountVnd || 0) > 0
                                ? (ord.totalVnd || 0) - (ord.depositAmountVnd || 0)
                                : Math.round((ord.totalVnd || 0) * 0.5)
                              ).toLocaleString("vi-VN")} đ
                            </span>
                          </div>
                        )}
                        {ord.status === "COMPLETED" && (
                          <div className="text-[11px] bg-emerald-50 text-emerald-900 font-semibold px-2 py-1 rounded-lg border border-emerald-200 flex justify-between items-center">
                            <span>Thanh toán:</span>
                            <span className="font-mono font-bold text-emerald-700">100% Đã tất toán</span>
                          </div>
                        )}
                        <div className="text-right font-mono font-bold text-banana-700">
                          {ord.totalVnd?.toLocaleString()} đ
                        </div>
                        <div className="pt-2 border-t flex flex-col gap-1.5">
                          <button
                            onClick={() => ord.paymentStatus === "UNPAID"
                              ? openPaymentRecordModal(ord)
                              : quickMoveStatus(
                                  ord.orderCode,
                                  "PURCHASING_JP",
                                  "Đã nhận cọc - Đang mua hàng tại Tokyo",
                                  "Nhân viên văn phòng Tokyo đã tiến hành order trực tiếp từ người bán.",
                                  "Tokyo, Nhật Bản"
                                )}
                            disabled={!ord.isPriceVerified || (ord.paymentStatus !== "UNPAID" && !["DEPOSITED_50", "PAID_100"].includes(ord.paymentStatus))}
                            className="w-full py-1.5 bg-banana-500 hover:bg-banana-600 text-navy-950 font-bold rounded-lg text-[11px] transition-colors flex items-center justify-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <span>{ord.paymentStatus === "UNPAID" ? (ord.isPriceVerified ? "Ghi nhận chuyển khoản" : "Duyệt giá trước khi nhận cọc") : "Bắt đầu mua hàng"}</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                          {!ord.isPriceVerified && (
                            <button
                              onClick={() => openPriceApprovalModal(ord)}
                              className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] transition-colors flex items-center justify-center space-x-1"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Duyệt Giá Báo Khách</span>
                            </button>
                          )}
                          <div className="flex gap-1">
                            <button
                              onClick={() => setPackingSlipOrder(ord)}
                              className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold"
                            >
                              In Phiếu
                            </button>
                            {ord.status !== "COMPLETED" && (
                              <button
                                onClick={() => openUpdateModal(ord)}
                                className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold"
                              >
                                Chi Tiết
                              </button>
                            )}
                            <button
                              onClick={() => openCancelModal(ord)}
                              title="Hủy đơn"
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px]"
                            >
                              <Ban className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                        {ord.status === "LOCAL_DELIVERY" && ord.paymentStatus !== "PAID_100" && (
                          <div className="text-[11px] bg-amber-50 text-amber-900 font-semibold px-2 py-1.5 rounded-lg border border-amber-200 flex justify-between items-center">
                            <span>Thu COD lúc giao:</span>
                            <span className="font-mono font-bold text-red-600">
                              {((ord.totalVnd || 0) - (ord.depositAmountVnd || 0) > 0
                                ? (ord.totalVnd || 0) - (ord.depositAmountVnd || 0)
                                : Math.round((ord.totalVnd || 0) * 0.5)
                              ).toLocaleString("vi-VN")} đ
                            </span>
                          </div>
                        )}
                        {ord.status === "COMPLETED" && (
                          <div className="text-[11px] bg-emerald-50 text-emerald-900 font-semibold px-2 py-1 rounded-lg border border-emerald-200 flex justify-between items-center">
                            <span>Thanh toán:</span>
                            <span className="font-mono font-bold text-emerald-700">100% Đã tất toán</span>
                          </div>
                        )}
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
                            <span>Đã Mua → Về Kho Tokyo</span>
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
                          <button
                            type="button"
                            onClick={() => handleRollbackStatus(ord)}
                            title="Hoàn tác về bước liền trước nếu lỡ bấm nhầm"
                            className="w-full py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold transition-colors flex items-center justify-center space-x-1"
                          >
                            <span>⏪ Lùi 1 bước (Hoàn tác)</span>
                          </button>
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
                        {ord.status === "LOCAL_DELIVERY" && ord.paymentStatus !== "PAID_100" && (
                          <div className="text-[11px] bg-amber-50 text-amber-900 font-semibold px-2 py-1.5 rounded-lg border border-amber-200 flex justify-between items-center">
                            <span>Thu COD lúc giao:</span>
                            <span className="font-mono font-bold text-red-600">
                              {((ord.totalVnd || 0) - (ord.depositAmountVnd || 0) > 0
                                ? (ord.totalVnd || 0) - (ord.depositAmountVnd || 0)
                                : Math.round((ord.totalVnd || 0) * 0.5)
                              ).toLocaleString("vi-VN")} đ
                            </span>
                          </div>
                        )}
                        {ord.status === "COMPLETED" && (
                          <div className="text-[11px] bg-emerald-50 text-emerald-900 font-semibold px-2 py-1 rounded-lg border border-emerald-200 flex justify-between items-center">
                            <span>Thanh toán:</span>
                            <span className="font-mono font-bold text-emerald-700">100% Đã tất toán</span>
                          </div>
                        )}
                        <div className="pt-2 border-t flex flex-col gap-1.5">
                          <button
                            onClick={() => {
                              if (!ord.weightKg || ord.weightKg <= 0) {
                                adminToast.error(`Đơn #${ord.orderCode} chưa có trọng lượng thực tế. Vui lòng bấm "Chi Tiết" để cập nhật cân nặng trước khi xuất kho.`);
                                return;
                              }
                              quickMoveStatus(
                                ord.orderCode,
                                "IN_TRANSIT_AIR",
                                "Đang vận chuyển quốc tế Tokyo ⇄ Việt Nam",
                                "Kiện hàng đã được đóng gói chống sốc và lên lộ trình chuyển về Việt Nam.",
                                "Tokyo, Nhật Bản"
                              );
                            }}
                            className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-[11px] transition-colors flex items-center justify-center space-x-1"
                          >
                            <span>Xuất Kho → Bay Về VN</span>
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
                          <button
                            type="button"
                            onClick={() => handleRollbackStatus(ord)}
                            title="Hoàn tác về bước liền trước nếu lỡ bấm nhầm"
                            className="w-full py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold transition-colors flex items-center justify-center space-x-1"
                          >
                            <span>⏪ Lùi 1 bước (Hoàn tác)</span>
                          </button>
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
                        {ord.status === "LOCAL_DELIVERY" && ord.paymentStatus !== "PAID_100" && (
                          <div className="text-[11px] bg-amber-50 text-amber-900 font-semibold px-2 py-1.5 rounded-lg border border-amber-200 flex justify-between items-center">
                            <span>Thu COD lúc giao:</span>
                            <span className="font-mono font-bold text-red-600">
                              {((ord.totalVnd || 0) - (ord.depositAmountVnd || 0) > 0
                                ? (ord.totalVnd || 0) - (ord.depositAmountVnd || 0)
                                : Math.round((ord.totalVnd || 0) * 0.5)
                              ).toLocaleString("vi-VN")} đ
                            </span>
                          </div>
                        )}
                        {ord.status === "COMPLETED" && (
                          <div className="text-[11px] bg-emerald-50 text-emerald-900 font-semibold px-2 py-1 rounded-lg border border-emerald-200 flex justify-between items-center">
                            <span>Thanh toán:</span>
                            <span className="font-mono font-bold text-emerald-700">100% Đã tất toán</span>
                          </div>
                        )}
                        <div className="pt-2 border-t flex flex-col gap-1.5">
                          <button
                            onClick={() => {
                              if (ord.status === "IN_TRANSIT_AIR") {
                                quickMoveStatus(
                                  ord.orderCode,
                                  "WAREHOUSE_VN",
                                  "Đã hạ cánh & Nhập kho Việt Nam",
                                  "Kiện hàng đã thông quan và nhập kho phân phối tại Việt Nam (Hà Nội / TP.HCM).",
                                  "Kho Việt Nam"
                                );
                              } else {
                                quickMoveStatus(
                                  ord.orderCode,
                                  "LOCAL_DELIVERY",
                                  "Đang giao hàng chặng cuối",
                                  "Đã bàn giao cho đơn vị vận chuyển nội địa (GHTK/GHN/ViettelPost) phát tận tay khách.",
                                  "Việt Nam"
                                );
                              }
                            }}
                            className="w-full py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg text-[11px] transition-colors flex items-center justify-center space-x-1"
                          >
                            <span>{ord.status === "IN_TRANSIT_AIR" ? "Hạ Cánh → Nhập Kho VN" : "Bàn Giao Shipper"}</span>
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
                          <button
                            type="button"
                            onClick={() => handleRollbackStatus(ord)}
                            title="Hoàn tác về bước liền trước nếu lỡ bấm nhầm"
                            className="w-full py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold transition-colors flex items-center justify-center space-x-1"
                          >
                            <span>⏪ Lùi 1 bước (Hoàn tác)</span>
                          </button>
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
                        {ord.status === "LOCAL_DELIVERY" && ord.paymentStatus !== "PAID_100" && (
                          <div className="text-[11px] bg-amber-50 text-amber-900 font-semibold px-2 py-1.5 rounded-lg border border-amber-200 flex justify-between items-center">
                            <span>Thu COD lúc giao:</span>
                            <span className="font-mono font-bold text-red-600">
                              {((ord.totalVnd || 0) - (ord.depositAmountVnd || 0) > 0
                                ? (ord.totalVnd || 0) - (ord.depositAmountVnd || 0)
                                : Math.round((ord.totalVnd || 0) * 0.5)
                              ).toLocaleString("vi-VN")} đ
                            </span>
                          </div>
                        )}
                        {ord.status === "COMPLETED" && (
                          <div className="text-[11px] bg-emerald-50 text-emerald-900 font-semibold px-2 py-1 rounded-lg border border-emerald-200 flex justify-between items-center">
                            <span>Thanh toán:</span>
                            <span className="font-mono font-bold text-emerald-700">100% Đã tất toán</span>
                          </div>
                        )}
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
                          <button
                            type="button"
                            onClick={() => handleRollbackStatus(ord)}
                            title="Hoàn tác về bước liền trước nếu lỡ bấm nhầm"
                            className="w-full py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold transition-colors flex items-center justify-center space-x-1"
                          >
                            <span>⏪ Lùi 1 bước (Hoàn tác)</span>
                          </button>
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


      {/* MODAL: DUYỆT VÀ CHỐT BÁO GIÁ */}
      {priceApprovalOrder && (() => {
        const approvalItems = (priceApprovalOrder.items && priceApprovalOrder.items.length > 0)
          ? priceApprovalOrder.items
          : (priceApprovalOrder.orderItems && priceApprovalOrder.orderItems.length > 0)
          ? priceApprovalOrder.orderItems
          : [{ productName: priceApprovalOrder.productName, priceJpy: priceApprovalOrder.priceJpy, quantity: 1, itemType: "EXTERNAL" }];

        const hasExternalWithoutLink = approvalItems.some((item) => {
          const parsed = parseOrderItemSource(item, priceApprovalOrder);
          return parsed.itemType === "EXTERNAL" && !parsed.hasUrl;
        });

        return (
          <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 relative my-6 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-700 to-teal-600 px-6 py-5 text-white">
                <button
                  type="button"
                  onClick={() => setPriceApprovalOrder(null)}
                  disabled={isApprovingPrice}
                  aria-label="Đóng"
                  className="absolute right-4 top-4 p-1 rounded-full text-white/80 hover:bg-white/15 hover:text-white disabled:opacity-50"
                ><X className="w-5 h-5" /></button>
                <div className="flex items-center gap-2 text-emerald-100 text-xs font-semibold uppercase tracking-wide">
                  <CheckCircle2 className="w-4 h-4" /> Xác nhận báo giá
                </div>
                <h3 className="mt-1 text-xl font-bold">Đơn #{priceApprovalOrder.orderCode}</h3>
                <p className="text-sm text-white/90 mt-1 font-medium">Khách: {priceApprovalOrder.customerName} · {priceApprovalOrder.customerPhone}</p>
              </div>

              <form onSubmit={handleVerifyPrice} className="p-6 space-y-5">
                {/* Danh sách sản phẩm chi tiết */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Sản phẩm trong đơn ({approvalItems.length})
                  </label>
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {approvalItems.map((item, idx) => {
                      const parsed = parseOrderItemSource(item, priceApprovalOrder);
                      const itemPriceJpy = Number(item.priceJpy || priceApprovalOrder.priceJpy || 0);
                      const itemQty = Number(item.quantity || 1);

                      return (
                        <div key={idx} className="p-3 rounded-2xl border border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            {parsed.imageUrl ? (
                              <img
                                src={parsed.imageUrl}
                                alt={parsed.cleanName}
                                className="w-14 h-14 rounded-xl object-cover border border-slate-200 bg-white shrink-0"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center text-xl shrink-0">
                                📦
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-300 text-slate-700 shadow-sm">
                                  {parsed.marketplace}
                                </span>
                                <span className="text-[11px] text-slate-500 font-medium">
                                  SL: <strong className="text-slate-800">{itemQty}</strong>
                                </span>
                              </div>
                              <h5 className="text-xs font-bold text-slate-900 line-clamp-2" title={parsed.cleanName}>
                                {parsed.cleanName}
                              </h5>
                              <div className="mt-1 text-xs text-slate-600 font-mono">
                                Giá lúc đặt: <strong className="text-amber-700">{itemPriceJpy.toLocaleString()} ¥</strong>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            {parsed.url ? (
                              <>
                                <a
                                  href={parsed.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-blue-600 hover:text-blue-700 border border-slate-200 text-xs font-bold transition-colors inline-flex items-center gap-1 shadow-sm"
                                >
                                  <span>Mở link</span>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(parsed.url!);
                                    adminToast.success("Đã sao chép link sản phẩm!");
                                  }}
                                  className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-colors inline-flex items-center gap-1 shadow-sm"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Sao chép link</span>
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-rose-600 font-semibold italic bg-rose-50 px-2 py-1 rounded-lg border border-rose-200">
                                {parsed.itemType === "CATALOG" ? "Hàng Catalog" : "Không có link"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* CẢNH BÁO KHI SẢN PHẨM NGOÀI CATALOG KHÔNG CÓ LINK */}
                {hasExternalWithoutLink && (
                  <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-950 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-rose-800 text-sm">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Không có link - không thể kiểm giá</span>
                    </div>
                    <p className="text-xs text-rose-900 leading-relaxed">
                      Sản phẩm không có link gốc để đối chiếu giá thị trường. Vui lòng liên hệ khách theo SĐT:{" "}
                      <a href={`tel:${priceApprovalOrder.customerPhone}`} className="font-bold underline text-rose-900 hover:text-rose-950">
                        {priceApprovalOrder.customerPhone}
                      </a>{" "}
                      để xác nhận nguồn mua chính xác.
                    </p>
                    <label className="flex items-center gap-2.5 pt-1 cursor-pointer text-xs font-bold text-rose-900">
                      <input
                        type="checkbox"
                        checked={hasManualVerifiedNoLink}
                        onChange={(e) => setHasManualVerifiedNoLink(e.target.checked)}
                        className="w-4 h-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                      <span>Tôi đã xác minh sản phẩm bằng cách khác</span>
                    </label>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="approval-jpy" className="block text-sm font-bold text-slate-700 mb-1.5">Giá chốt tại Nhật (JPY)</label>
                    <div className="relative">
                      <input id="approval-jpy" type="number" inputMode="numeric" min="100" step="1" required
                        value={priceApprovalJpy} onChange={(e) => setPriceApprovalJpy(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 pr-12 text-base font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        placeholder="Ví dụ: 5000" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">¥</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Nhập số nguyên, tối thiểu 100 ¥.</p>
                  </div>
                  <div>
                    <label htmlFor="approval-weight" className="block text-sm font-bold text-slate-700 mb-1.5">Cân nặng dự kiến (kg)</label>
                    <div className="relative">
                      <input id="approval-weight" type="number" min="0" max="100" step="0.01" required
                        value={priceApprovalWeight} onChange={(e) => setPriceApprovalWeight(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 pr-12 text-base font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        placeholder="0" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">kg</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Nhập 0 nếu sẽ cân tại kho (phí ship chưa tính).</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <h4 className="font-bold text-slate-800">Tạm tính cho khách</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Tỷ giá đơn hàng: {priceApprovalOrder.exchangeRate.toLocaleString("vi-VN")} đ/¥</p>
                    </div>
                    {priceApprovalOrder.isGroupBuy && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">Đơn gom</span>}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div className="flex justify-between gap-3 text-slate-600"><span>Tiền hàng</span><strong className="text-slate-800">{approvalProductVnd.toLocaleString("vi-VN")} đ</strong></div>
                    <div className="flex justify-between gap-3 text-slate-600"><span>Phí dịch vụ</span><strong className="text-slate-800">{approvalServiceVnd.toLocaleString("vi-VN")} đ</strong></div>
                    <div className="flex justify-between gap-3 text-slate-600"><span>Vận chuyển{approvalWeight === 0 ? " (chưa cân)" : ""}</span><strong className="text-slate-800">{approvalShippingVnd.toLocaleString("vi-VN")} đ</strong></div>
                    <div className="flex justify-between gap-3 font-bold text-slate-900"><span>Tổng tạm tính</span><span>{approvalTotalVnd.toLocaleString("vi-VN")} đ</span></div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-amber-800">{priceApprovalOrder.depositPercent === 100 ? "Thanh toán ngay (100% tiền hàng + phí dịch vụ)" : "Tiền cọc (50% tiền hàng + phí dịch vụ)"}</span>
                    <strong className="text-lg text-amber-700">{(priceApprovalOrder.depositPercent === 100 ? approvalProductVnd + approvalServiceVnd : Math.round((approvalProductVnd + approvalServiceVnd) * 0.5)).toLocaleString("vi-VN")} đ</strong>
                  </div>
                </div>

                <div className={`rounded-xl border p-3 flex gap-2.5 text-sm ${priceApprovalOrder.customerEmail ? "border-sky-200 bg-sky-50 text-sky-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                  <Mail className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">{priceApprovalOrder.customerEmail ? "Email xác nhận báo giá" : "Đơn chưa có email khách hàng"}</p>
                    <p className="text-xs mt-0.5 break-all">{priceApprovalOrder.customerEmail || "Khách sẽ không nhận được email. Bạn vẫn có thể duyệt và thông báo qua kênh khác."}</p>
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                  <button type="button" disabled={isApprovingPrice} onClick={() => setPriceApprovalOrder(null)}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold disabled:opacity-50">Để sau</button>
                  <button
                    type="submit"
                    disabled={
                      isApprovingPrice ||
                      !Number.isSafeInteger(approvalJpy) ||
                      approvalJpy < 100 ||
                      !Number.isFinite(approvalWeight) ||
                      approvalWeight < 0 ||
                      approvalWeight > 100 ||
                      (hasExternalWithoutLink && !hasManualVerifiedNoLink)
                    }
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />{isApprovingPrice ? "Đang duyệt và gửi email..." : "Duyệt giá & gửi xác nhận"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {paymentRecordOrder && (
        <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-700 to-teal-600 px-6 py-5 text-white">
              <button type="button" onClick={() => setPaymentRecordOrder(null)} disabled={isRecordingPayment} aria-label="Đóng" className="float-right text-white/80 hover:text-white disabled:opacity-50"><X className="w-5 h-5" /></button>
              <h3 className="text-xl font-bold">Ghi nhận chuyển khoản</h3>
              <p className="text-sm text-white/80 mt-1">Đơn #{paymentRecordOrder.orderCode} · {paymentRecordOrder.customerName}</p>
            </div>
            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-950">
                Đối chiếu giao dịch ngân hàng trước khi xác nhận. Số tiền cần nhận: <strong>{paymentRecordOrder.depositAmountVnd.toLocaleString("vi-VN")} đ</strong> ({paymentRecordOrder.depositPercent}%).
              </div>
              <div>
                <label htmlFor="manual-payment-amount" className="block text-sm font-bold text-slate-700 mb-1">Số tiền đã nhận (VND)</label>
                <input id="manual-payment-amount" type="number" min="1" step="1" required value={paymentAmountVnd} onChange={(e) => setPaymentAmountVnd(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
              </div>
              <div>
                <label htmlFor="manual-payment-reference" className="block text-sm font-bold text-slate-700 mb-1">Mã tham chiếu / mã giao dịch ngân hàng</label>
                <input id="manual-payment-reference" type="text" minLength={4} maxLength={120} required value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="Ví dụ: FT26123456789" />
              </div>
              <p className="text-xs text-slate-500">Sau khi ghi nhận, trạng thái mua hàng chưa tự chuyển. Nhân viên có thể kiểm tra lần cuối rồi bấm “Bắt đầu mua hàng”.</p>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" disabled={isRecordingPayment} onClick={() => setPaymentRecordOrder(null)} className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold disabled:opacity-50">Để sau</button>
                <button type="submit" disabled={isRecordingPayment || Number(paymentAmountVnd) !== paymentRecordOrder.depositAmountVnd || paymentReference.trim().length < 4} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50">{isRecordingPayment ? "Đang ghi nhận..." : "Xác nhận đã nhận tiền"}</button>
              </div>
            </form>
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
                  {editableStatuses.map((status) => (
                    <option key={status} value={status}>{ORDER_STATUS_LABELS[status]}</option>
                  ))}
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

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Cân nặng thực tế (kg) {newStatus === "IN_TRANSIT_AIR" && <span className="text-rose-500 font-semibold">* (Bắt buộc &gt; 0 khi chuyển sang Bay quốc tế)</span>}
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="100"
                  value={updateWeightKg}
                  onChange={(e) => setUpdateWeightKg(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  placeholder="VD: 0.8"
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
                    <span>Đơn hàng đã nhận thanh toán ({cancelModalOrder.depositAmountVnd.toLocaleString("vi-VN")} đ)</span>
                  </div>
                  <label className="flex items-center space-x-2 text-slate-700 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={refundDeposit}
                      onChange={(e) => setRefundDeposit(e.target.checked)}
                      className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                    />
                    <span className="font-semibold text-xs">
                      Xác nhận đã hoàn trả khoản tiền đã nhận cho khách hàng (ghi nhận trạng thái Đã hoàn tiền)
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
                <p className="text-slate-600 text-[11px]">Hotline: 1900 6868</p>
              </div>

              <div>
                <span className="font-bold text-[10px] uppercase text-slate-400 block mb-1">Người nhận:</span>
                <p className="font-bold text-navy-950">{packingSlipOrder.customerName}</p>
                <p className="font-mono text-slate-800 text-[11px]">📞 {packingSlipOrder.customerPhone}</p>
                <p className="text-slate-600 text-[11px] leading-tight mt-0.5">{packingSlipOrder.customerAddress}</p>
              </div>
            </div>

            {/* Product Table */}
            <div className="border border-slate-200 rounded-xl overflow-x-auto mb-4 text-xs">
              <table className="w-full min-w-[1000px] text-left whitespace-nowrap">
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
                  - {packingSlipOrder.depositAmountVnd?.toLocaleString()} đ ({packingSlipOrder.paymentStatus === "PAID_100" ? "Đã trả 100%" : packingSlipOrder.paymentStatus === "DEPOSITED_50" ? "Đã cọc 50%" : "Chưa thanh toán"})
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
