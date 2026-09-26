"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  PackageSearch, 
  Search, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Truck, 
  Building2, 
  ExternalLink, 
  Users, 
  QrCode,
  Ban,
  X,
  FileText,
  ChevronRight,
  ShoppingBag,
  RefreshCw
} from "lucide-react";
import TrackingStepper from "@/components/TrackingStepper";
import { StoredOrder } from "@/lib/order-store";
import { useAuth } from "@/context/AuthContext";

function TrackingContent() {
  const searchParams = useSearchParams();
  const { customer } = useAuth();

  const [searchCode, setSearchCode] = useState("");
  const [order, setOrder] = useState<StoredOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Quản lý tab hiển thị: "search" (Tra cứu mã) | "my_orders" (Đơn hàng của tôi)
  const [activeTab, setActiveTab] = useState<"search" | "my_orders">("search");
  const [myOrders, setMyOrders] = useState<StoredOrder[]>([]);
  const [loadingMyOrders, setLoadingMyOrders] = useState(false);

  // Modal Hủy Đơn Hàng (Phía Khách Hàng)
  const [cancelTargetOrder, setCancelTargetOrder] = useState<StoredOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("Tôi đổi ý, không có nhu cầu mua nữa");
  const [cancelCustomReason, setCancelCustomReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  // Trạng thái thanh toán VNPAY trả về
  const [paymentStatus, setPaymentStatus] = useState<"success" | "failed" | "invalid" | null>(null);

  useEffect(() => {
    const code = searchParams.get("orderCode");
    const payment = searchParams.get("payment") as "success" | "failed" | "invalid" | null;
    if (code) {
      setSearchCode(code);
      fetchOrder(code);
    }
    if (payment) {
      setPaymentStatus(payment);
    }
  }, [searchParams]);

  const fetchOrder = async (code: string) => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(code.trim())}`);
      const data = await res.json();
      if (res.ok && data.success && data.order) {
        setOrder(data.order);
      } else {
        setError(data.error || "Không tìm thấy đơn hàng. Vui lòng kiểm tra lại mã đơn.");
        setOrder(null);
      }
    } catch (err) {
      setError("Lỗi kết nối máy chủ. Vui lòng thử lại!");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyOrders = async () => {
    if (!customer?.email && !customer?.phone) return;
    setLoadingMyOrders(true);
    try {
      const q = customer.email 
        ? `email=${encodeURIComponent(customer.email)}` 
        : `phone=${encodeURIComponent(customer.phone!)}`;
      const res = await fetch(`/api/orders?${q}`);
      const data = await res.json();
      if (res.ok && data.orders) {
        setMyOrders(data.orders);
      }
    } catch (err) {
      console.warn("Lỗi tải đơn hàng cá nhân:", err);
    } finally {
      setLoadingMyOrders(false);
    }
  };

  useEffect(() => {
    const codeParam = searchParams.get("code") || searchParams.get("orderCode");
    if (codeParam) {
      setSearchCode(codeParam);
      fetchOrder(codeParam);
      setActiveTab("search");
    } else if (customer) {
      // Nếu khách đã đăng nhập và không có param tra cứu thì mở Đơn hàng của tôi
      setActiveTab("my_orders");
    }
  }, [searchParams, customer]);

  useEffect(() => {
    if (customer?.email || customer?.phone) {
      fetchMyOrders();
    }
  }, [customer]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrder(searchCode);
  };

  const openCustomerCancelModal = (target: StoredOrder) => {
    setCancelTargetOrder(target);
    setCancelReason("Tôi đổi ý, không có nhu cầu mua nữa");
    setCancelCustomReason("");
  };

  const handleCustomerCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTargetOrder) return;
    setIsCancelling(true);

    const finalReason =
      cancelReason === "Khác" && cancelCustomReason.trim()
        ? cancelCustomReason.trim()
        : cancelReason;

    try {
      const res = await fetch(`/api/orders/${cancelTargetOrder.orderCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          by: "CUSTOMER",
          reason: finalReason,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert(
          cancelTargetOrder.status === "PENDING_DEPOSIT"
            ? `Đã hủy đơn hàng #${cancelTargetOrder.orderCode} thành công!`
            : `Đã gửi yêu cầu hủy đơn #${cancelTargetOrder.orderCode} đến bộ phận chăm sóc khách hàng!`
        );
        setCancelTargetOrder(null);
        if (order && order.orderCode === cancelTargetOrder.orderCode) {
          fetchOrder(order.orderCode);
        }
        if (customer) {
          fetchMyOrders();
        }
      } else {
        alert("Lỗi khi hủy đơn: " + (data.error || "Vui lòng thử lại sau."));
      }
    } catch {
      alert("Lỗi kết nối máy chủ");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Banner kết quả thanh toán VNPAY */}
      {paymentStatus === "success" && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-sm text-emerald-900 shadow">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          <div>
            <p className="font-bold">Thanh toán thành công qua VNPAY! 🎉</p>
            <p className="text-xs text-emerald-700">Cọc 50% của bạn đã được xác nhận. Đội ngũ Tokyo sẽ tiến hành mua hàng ngay!</p>
          </div>
          <button onClick={() => setPaymentStatus(null)} className="ml-auto text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {paymentStatus === "failed" && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-300 rounded-2xl text-sm text-rose-900 shadow">
          <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
          <div>
            <p className="font-bold">Thanh toán chưa hoàn tất</p>
            <p className="text-xs text-rose-700">Giao dịch bị hủy hoặc thất bại. Đơn hàng của bạn vẫn còn đó — bạn có thể thử thanh toán lại.</p>
          </div>
          <button onClick={() => setPaymentStatus(null)} className="ml-auto text-rose-600 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {paymentStatus === "invalid" && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-300 rounded-2xl text-sm text-amber-900 shadow">
          <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
          <div>
            <p className="font-bold">Phản hồi thanh toán không hợp lệ</p>
            <p className="text-xs text-amber-700">Chữ ký xác thực từ VNPAY không khớp. Vui lòng liên hệ bộ phận hỗ trợ.</p>
          </div>
          <button onClick={() => setPaymentStatus(null)} className="ml-auto text-amber-600 hover:text-amber-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Tabs Switcher (Khi khách hàng đã đăng nhập) */}
      {customer && (
        <div className="flex justify-center">
          <div className="inline-flex p-1 bg-slate-200/80 rounded-2xl border border-slate-300 shadow-inner">
            <button
              onClick={() => setActiveTab("my_orders")}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                activeTab === "my_orders"
                  ? "bg-white text-navy-950 shadow-sm"
                  : "text-slate-600 hover:text-navy-950"
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5 text-banana-600" />
              <span>Đơn Hàng Của Tôi ({myOrders.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("search")}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                activeTab === "search"
                  ? "bg-white text-navy-950 shadow-sm"
                  : "text-slate-600 hover:text-navy-950"
              }`}
            >
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <span>Tra Cứu Mã Đơn Khác</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 1: ĐƠN HÀNG CỦA TÔI (MY ORDERS CRM FOR CUSTOMERS) */}
      {/* ========================================================== */}
      {customer && activeTab === "my_orders" && (
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold font-serif text-navy-900 flex items-center space-x-2">
                <span>Quản Lý Đơn Hàng Của {customer.name}</span>
                <span className="text-xs bg-banana-100 text-banana-900 px-2.5 py-0.5 rounded-full font-sans font-bold">
                  Thành viên
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Theo dõi toàn bộ đơn mua hộ từ Nhật Bản, kiểm tra tiến độ giao vận và chủ động hủy đơn khi cần.
              </p>
            </div>
            <button
              onClick={fetchMyOrders}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingMyOrders ? "animate-spin" : ""}`} />
              <span>Làm mới</span>
            </button>
          </div>

          {loadingMyOrders ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-banana-500 mb-2" />
              Đang tải danh sách đơn hàng của bạn...
            </div>
          ) : myOrders.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center shadow-sm space-y-3">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-2xl">
                🛍️
              </div>
              <h3 className="font-bold text-navy-900 text-sm">Bạn chưa có đơn hàng nào</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Dán link sản phẩm từ Mercari, Amazon JP hoặc Rakuten vào công cụ tính giá để tạo đơn mua hộ đầu tiên!
              </p>
              <div className="pt-2">
                <Link
                  href="/#calculator"
                  className="inline-flex items-center space-x-2 px-5 py-2.5 bg-banana-500 hover:bg-banana-600 text-navy-950 font-bold text-xs rounded-xl shadow-sm transition-all"
                >
                  <span>Tạo Đơn Hàng Ngay</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {myOrders.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-navy-900 text-sm">
                        #{item.orderCode}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(item.createdAt).toLocaleDateString("vi-VN")}
                      </span>
                      
                      {/* Trạng thái đơn */}
                      {item.status === "CANCELLED" ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                          ✕ Đã Hủy
                        </span>
                      ) : item.status === "COMPLETED" ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          ✓ Hoàn Tất
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-banana-100 text-banana-900 border border-banana-200">
                          {item.status}
                        </span>
                      )}

                      {/* Thanh toán */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.paymentStatus === "UNPAID"
                            ? "bg-slate-100 text-slate-600"
                            : item.paymentStatus === "DEPOSITED_50"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {item.paymentStatus === "UNPAID"
                          ? "Chờ cọc"
                          : item.paymentStatus === "DEPOSITED_50"
                          ? "Đã cọc 50%"
                          : "Đã TT 100%"}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{item.productName}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Tổng tiền: <strong className="text-navy-900 font-mono">{item.totalVnd.toLocaleString("vi-VN")} đ</strong> 
                        {" "}(Tiền cọc: {item.depositAmountVnd.toLocaleString("vi-VN")} đ)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                      onClick={() => {
                        setOrder(item);
                        setSearchCode(item.orderCode);
                        setActiveTab("search");
                      }}
                      className="px-4 py-2 bg-navy-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center space-x-1.5"
                    >
                      <PackageSearch className="w-3.5 h-3.5" />
                      <span>Xem Hành Trình</span>
                    </button>

                    {item.status !== "CANCELLED" && item.status !== "COMPLETED" && (
                      <button
                        onClick={() => openCustomerCancelModal(item)}
                        className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-all flex items-center space-x-1"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Hủy Đơn</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 2: TRA CỨU THEO MÃ ĐƠN HÀNG (SEARCH VIEW) */}
      {/* ========================================================== */}
      {(!customer || activeTab === "search") && (
        <>
          {/* Search Bar */}
          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  placeholder="Nhập mã đơn hàng (Ví dụ: CB-2026-8921)"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-banana-500 shadow-sm uppercase"
                />
                <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-navy-900 hover:bg-slate-800 text-white font-bold text-sm rounded-2xl shadow transition-all shrink-0 flex items-center space-x-1.5"
              >
                {loading ? <span>Đang tìm...</span> : <span>Tra Cứu</span>}
              </button>
            </form>

            <p className="text-[11px] text-slate-400 text-center mt-2">
              Mã đơn hàng có dạng <strong className="font-mono text-navy-900">CB-2026-XXXX</strong> được tạo tự động khi bạn đặt hàng trên trang chủ.
            </p>
          </div>

          {/* Error display */}
          {error && (
            <div className="max-w-2xl mx-auto p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Welcoming Guidance State */}
          {!order && !loading && !error && (
            <div className="max-w-2xl mx-auto text-center py-12 px-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-banana-100 text-banana-700 flex items-center justify-center mx-auto text-2xl font-bold">
                📦
              </div>
              <h3 className="text-lg font-serif font-bold text-navy-900">
                Hệ Thống Theo Dõi Vận Tải Thời Gian Thực
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Vui lòng nhập mã đơn hàng thực tế của bạn vào thanh tra cứu để theo dõi từng bước di chuyển của kiện hàng từ Nhật về Việt Nam.
              </p>
              <div className="pt-2">
                <Link
                  href="/#calculator"
                  className="inline-flex items-center space-x-2 px-5 py-2.5 bg-banana-500 hover:bg-banana-600 text-navy-950 font-bold text-xs rounded-xl shadow-sm transition-all"
                >
                  <span>Đặt Hàng Thực Tế Tại Trang Chủ</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}

          {/* Order Detail & Timeline */}
          {order && (
            <div className="space-y-8 animate-in fade-in duration-300">
              {/* Main Info Card & 7 Steps Stepper */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
                
                {/* Top Bar: Order Code & Badges */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-banana-900 bg-banana-100 px-2.5 py-0.5 rounded-md border border-banana-200">
                        Mã Đơn ChillBanana
                      </span>
                      <h2 className="text-xl sm:text-2xl font-bold font-serif text-navy-900">
                        {order.orderCode}
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Khởi tạo lúc: {new Date(order.createdAt).toLocaleString("vi-VN")}
                    </p>
                  </div>

                  {/* Status Tags & Cancel Action */}
                  <div className="flex flex-wrap items-center gap-2">
                    {order.isGroupBuy && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-banana-100 text-banana-900 border border-banana-300">
                        <Users className="w-3.5 h-3.5 mr-1" />
                        Đơn Ghép Gộp (Group Buy)
                      </span>
                    )}

                    {order.status === "CANCELLED" ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        <Ban className="w-3.5 h-3.5 mr-1" />
                        Đơn Hàng Đã Hủy
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        {order.paymentStatus === "PAID_100"
                          ? "Đã thanh toán 100%"
                          : order.paymentStatus === "DEPOSITED_50"
                          ? "Đã cọc 50%"
                          : "Chờ đặt cọc"}
                      </span>
                    )}

                    {/* Nút Hủy Đơn Hàng Dành Cho Khách */}
                    {order.status !== "CANCELLED" && order.status !== "COMPLETED" && (
                      <button
                        onClick={() => openCustomerCancelModal(order)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-full transition-colors"
                      >
                        <Ban className="w-3.5 h-3.5 text-rose-600" />
                        <span>{order.status === "PENDING_DEPOSIT" ? "Hủy Đơn Hàng" : "Yêu Cầu Hủy & Hoàn Cọc"}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Stepper 7 Bước */}
                <div className="pt-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                    Tiến Độ Xử Lý &amp; Giao Vận Đa Chặng (7 Bước)
                  </h3>
                  <TrackingStepper currentStatus={order.status} />
                </div>

                {/* Thông Tin Đối Tác Vận Chuyển */}
                {(order.jpDomesticTrack || order.vnDomesticTrack) && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    {order.jpDomesticTrack && (
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-navy-900 shadow-sm border">
                          🇯🇵
                        </div>
                        <div>
                          <p className="text-slate-500 font-medium">Vận đơn nội địa Nhật:</p>
                          <p className="font-bold text-navy-900">{order.jpDomesticTrack}</p>
                        </div>
                      </div>
                    )}
                    {order.vnDomesticTrack && (
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-navy-900 shadow-sm border">
                          🇻🇳
                        </div>
                        <div>
                          <p className="text-slate-500 font-medium">Vận đơn giao hàng tại Việt Nam:</p>
                          <p className="font-bold text-emerald-700">{order.vnDomesticTrack}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2 Columns: Financial/Product Details + Realtime Activity Logs */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left: Product & Financial Summary (5 cols) */}
                <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                  <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider font-serif pb-3 border-b">
                    Thông Tin Hàng Hóa &amp; Chi Phí
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-slate-400">Tên món hàng:</span>
                      <p className="font-bold text-slate-800 text-sm mt-0.5">{order.productName}</p>
                      {order.originalUrl && (
                        <a
                          href={order.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-blue-600 hover:underline text-[11px] mt-1"
                        >
                          <span>Xem link gốc tại Nhật</span>
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <span className="text-slate-400">Trọng lượng:</span>
                        <p className="font-bold text-slate-800">{order.weightKg} kg</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Giá gốc Yên:</span>
                        <p className="font-bold text-slate-800">{order.priceJpy.toLocaleString()} ¥</p>
                      </div>
                    </div>

                    <div className="pt-3 border-t space-y-2 text-slate-600">
                      <div className="flex justify-between">
                        <span>Quy đổi tiền hàng (VND):</span>
                        <span className="font-medium text-slate-900">{order.productPriceVnd.toLocaleString("vi-VN")} đ</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Phí mua hộ:</span>
                        <span className="font-medium text-slate-900">{order.serviceFeeVnd.toLocaleString("vi-VN")} đ</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cước bay quốc tế:</span>
                        <span className="font-medium text-slate-900">{order.shippingFeeVnd.toLocaleString("vi-VN")} đ</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t font-bold text-sm text-navy-900">
                        <span>Tổng Đơn Trọn Gói:</span>
                        <span className="text-banana-600 text-base">{order.totalVnd.toLocaleString("vi-VN")} đ</span>
                      </div>
                      <div className="flex justify-between text-xs bg-slate-50 p-2.5 rounded-xl border">
                        <span>Đã đặt cọc:</span>
                        <span className="font-bold text-emerald-700">{order.depositAmountVnd.toLocaleString("vi-VN")} đ</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t space-y-1">
                      <span className="text-slate-400">Người nhận & Địa chỉ:</span>
                      <p className="font-bold text-slate-800">{order.customerName} - {order.customerPhone}</p>
                      <p className="text-slate-600">{order.customerAddress}</p>
                    </div>
                  </div>
                </div>

                {/* Right: Detailed Historical Log Stepper (7 cols) */}
                <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                  <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider font-serif pb-3 border-b flex items-center justify-between">
                    <span>Nhật Ký Hành Trình Thực Tế (Logs)</span>
                    <span className="text-[11px] font-normal text-slate-400 lowercase">
                      {order.trackingLogs.length} mốc ghi nhận
                    </span>
                  </h3>

                  <div className="space-y-6 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
                    {order.trackingLogs.map((log, idx) => (
                      <div key={log.id || idx} className="relative flex items-start space-x-4">
                        {/* Dot */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 shadow-sm z-10 ring-4 ring-white ${
                          log.status === "CANCELLED"
                            ? "bg-rose-500 text-white"
                            : "bg-banana-500 text-navy-950"
                        }`}>
                          {log.status === "CANCELLED" ? "✕" : "✓"}
                        </div>
                        {/* Content */}
                        <div className="flex-1 bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <h4 className="text-xs sm:text-sm font-bold text-navy-900">
                              {log.title}
                            </h4>
                            <span className="text-[10px] text-slate-400 flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {log.createdAt}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {log.description}
                          </p>
                          <div className="pt-1 flex items-center text-[11px] text-slate-500 font-medium">
                            <MapPin className="w-3 h-3 text-banana-600 mr-1" />
                            <span>Vị trí: {log.location}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================== */}
      {/* MODAL HỦY ĐƠN HÀNG (CUSTOMER SIDE) */}
      {/* ========================================================== */}
      {cancelTargetOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative my-8">
            <button
              onClick={() => setCancelTargetOrder(null)}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex items-center space-x-2 text-rose-600 mb-1">
              <Ban className="w-5 h-5" />
              <h3 className="text-lg font-bold text-navy-900">
                {cancelTargetOrder.status === "PENDING_DEPOSIT"
                  ? `Xác Nhận Hủy Đơn #${cancelTargetOrder.orderCode}`
                  : `Yêu Cầu Hủy Đơn & Hoàn Cọc #${cancelTargetOrder.orderCode}`}
              </h3>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Sản phẩm: <strong>{cancelTargetOrder.productName}</strong>
            </p>

            <form onSubmit={handleCustomerCancelSubmit} className="space-y-4 text-xs">
              {cancelTargetOrder.status === "PENDING_DEPOSIT" ? (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800">
                  💡 <strong>Đơn hàng đang chờ cọc:</strong> Bạn có thể hủy đơn ngay lập tức hoàn toàn miễn phí.
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
                  ⚠️ <strong>Đơn hàng đã được tiếp nhận / đặt cọc:</strong> Yêu cầu của bạn sẽ được gửi đến bộ phận quản trị viên để liên hệ đối soát hoàn tiền từ người bán Nhật Bản.
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Vui lòng chọn lý do hủy đơn: <span className="text-rose-500">*</span>
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-rose-500"
                >
                  <option value="Tôi đổi ý, không có nhu cầu mua nữa">
                    1. Tôi đổi ý, không có nhu cầu mua nữa
                  </option>
                  <option value="Tôi tìm thấy link sản phẩm khác rẻ hơn">
                    2. Tôi tìm thấy link sản phẩm khác rẻ hơn
                  </option>
                  <option value="Tôi nhập nhầm thông tin sản phẩm / ghi chú">
                    3. Tôi nhập nhầm thông tin sản phẩm / ghi chú
                  </option>
                  <option value="Thời gian giao hàng dự kiến chưa phù hợp">
                    4. Thời gian giao hàng dự kiến chưa phù hợp
                  </option>
                  <option value="Khác">5. Lý do khác (Nhập chi tiết bên dưới)</option>
                </select>
              </div>

              {cancelReason === "Khác" && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nhập chi tiết lý do
                  </label>
                  <textarea
                    rows={2}
                    value={cancelCustomReason}
                    onChange={(e) => setCancelCustomReason(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500"
                    placeholder="Vui lòng chia sẻ thêm lý do bạn muốn hủy đơn..."
                    required
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setCancelTargetOrder(null)}
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
                  <span>
                    {isCancelling
                      ? "Đang gửi..."
                      : cancelTargetOrder.status === "PENDING_DEPOSIT"
                      ? "Xác Nhận Hủy Đơn"
                      : "Gửi Yêu Cầu Hủy"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackingPage() {
  return (
    <div className="py-10 max-w-[1600px] w-[95%] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-banana-900 bg-banana-100 border border-banana-200 px-3 py-1 rounded-full uppercase tracking-wider mb-2">
          <PackageSearch className="w-3.5 h-3.5 text-banana-700" />
          <span>Hệ Thống Theo Dõi Vận Tải ChillBanana</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-navy-900">
          Tra Cứu &amp; Quản Lý Đơn Hàng Mua Hộ
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
          Theo dõi chi tiết 7 chặng vận chuyển từ Tokyo về tận tay khách hàng tại Việt Nam, quản lý danh sách đơn hàng và hỗ trợ hủy đơn linh hoạt.
        </p>
      </div>

      <Suspense fallback={
        <div className="py-12 text-center text-slate-400 text-xs">
          Đang tải dữ liệu tra cứu đơn hàng...
        </div>
      }>
        <TrackingContent />
      </Suspense>
    </div>
  );
}
