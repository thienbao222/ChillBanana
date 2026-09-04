"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  QrCode
} from "lucide-react";
import TrackingStepper from "@/components/TrackingStepper";
import { StoredOrder } from "@/lib/order-store";

function TrackingContent() {
  const searchParams = useSearchParams();
  const [searchCode, setSearchCode] = useState("");
  const [order, setOrder] = useState<StoredOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  useEffect(() => {
    const codeParam = searchParams.get("code");
    if (codeParam) {
      setSearchCode(codeParam);
      fetchOrder(codeParam);
    } else {
      // Tải đơn mẫu mặc định
      fetchOrder("CB-2026-8921");
      setSearchCode("CB-2026-8921");
    }
  }, [searchParams]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrder(searchCode);
  };

  return (
    <div className="space-y-8">
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

        {/* Quick Sample Order Chips */}
        <div className="mt-3 flex items-center justify-center flex-wrap gap-2 text-xs text-slate-500">
          <span>Thử nhanh mã mẫu:</span>
          <button
            type="button"
            onClick={() => {
              setSearchCode("CB-2026-8921");
              fetchOrder("CB-2026-8921");
            }}
            className="px-3 py-1 bg-banana-100 hover:bg-banana-200 text-banana-900 rounded-xl border border-banana-300 font-bold"
          >
            CB-2026-8921 (Đang bay quốc tế ✈)
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchCode("CB-2026-5512");
              fetchOrder("CB-2026-5512");
            }}
            className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-xl border border-emerald-300 font-bold"
          >
            CB-2026-5512 (Đang giao hàng 🚚)
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="max-w-2xl mx-auto p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
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

              {/* Status Tags */}
              <div className="flex flex-wrap items-center gap-2">
                {order.isGroupBuy && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-banana-100 text-banana-900 border border-banana-300">
                    <Users className="w-3.5 h-3.5 mr-1" />
                    Đơn Ghép Gộp (Group Buy)
                  </span>
                )}
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  {order.paymentStatus === "PAID_100"
                    ? "Đã thanh toán 100%"
                    : order.paymentStatus === "DEPOSITED_50"
                    ? "Đã cọc 50%"
                    : "Chờ đặt cọc"}
                </span>
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
                    <div className="w-7 h-7 rounded-full bg-banana-500 text-navy-950 flex items-center justify-center text-xs font-extrabold shrink-0 shadow-sm z-10 ring-4 ring-white">
                      ✓
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
    </div>
  );
}

export default function TrackingPage() {
  return (
    <div className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-banana-900 bg-banana-100 border border-banana-200 px-3 py-1 rounded-full uppercase tracking-wider mb-2">
          <PackageSearch className="w-3.5 h-3.5 text-banana-700" />
          <span>Hệ Thống Theo Dõi Vận Tải ChillBanana</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-navy-900">
          Tra Cứu Hành Trình Đơn Hàng (7 Bước)
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
          Nhập mã đơn hàng của bạn để kiểm tra vị trí thực tế của kiện hàng tại kho Tokyo, trên chuyến bay quốc tế hoặc đang giao tại Việt Nam.
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
