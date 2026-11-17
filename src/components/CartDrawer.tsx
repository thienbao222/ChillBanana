"use client";

import React, { useState, useEffect } from "react";
import { useCart, isSingleItemStore } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  X,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  CheckCircle2,
  ExternalLink
} from "lucide-react";

export default function CartDrawer() {
  const { 
    items, 
    isCartOpen, 
    closeCart, 
    removeFromCart, 
    updateQuantity, 
    clearCart,
    exchangeRate,
    isRateStale,
    totalItems,
    totalPriceJpy,
    totalProductPriceVnd,
    totalWeightKg,
    shippingFeeVnd,
    serviceFeeVnd,
    isMinServiceFeeApplied,
    baseOrderCostVnd,
    pricingConfig,
    totalVnd,
    depositOption,
    setDepositOption,
    allowedDepositOptions,
    deposit50Vnd,
    deposit70Vnd,
    depositAmountVnd,
    remainingAmountVnd,
    hasVnItems,
    hasJpItems,
    hasOnlyVnItems,
    jpItemsWeightKg,
  } = useCart();

  const { customer, openAuthModal } = useAuth();
  const { toast } = useToast();

  // Checkout form fields
  const [showCheckout, setShowCheckout] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [orderResult, setOrderResult] = useState<any>(null);

  // Auto-fill from customer account if available
  useEffect(() => {
    if (customer) {
      if (customer.name) setCustomerName((prev) => prev || customer.name || "");
      if (customer.email) setCustomerEmail((prev) => prev || customer.email || "");
      if (customer.phone) setCustomerPhone((prev) => prev || customer.phone || "");
      if (customer.address) setCustomerAddress((prev) => prev || customer.address || "");
    }
  }, [customer]);

  if (!isCartOpen) return null;

  // ---- VNPAY: Chuyển hướng đến trang thanh toán ----
  const handleVnpayPayment = async (order: any) => {
    setIsRedirecting(true);
    try {
      const res = await fetch("/api/payment/vnpay-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode: order.orderCode,
          amount: order.depositAmountVnd,
          orderInfo: `Thanh toan ${order.depositPercent || 50}% don hang ${order.orderCode} - ChillBanana`,
          accessToken: order.accessToken,
          phone: customerPhone.trim(),
        }),
      });
      const data = await res.json();
      if (data.success && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        toast.error(data.error || "Không thể tạo link thanh toán VNPAY. Vui lòng thử lại.");
        setIsRedirecting(false);
      }
    } catch (err) {
      console.error("[VNPAY REDIRECT]", err);
      toast.error("Lỗi kết nối. Vui lòng thử lại.");
      setIsRedirecting(false);
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (items.length === 0) return;

    if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim()) {
      toast.warning("Vui lòng điền đầy đủ họ tên, số điện thoại và địa chỉ giao hàng.");
      return;
    }
    const cleanPhone = customerPhone.replace(/\s+/g, "");
    if (!/^(03|05|07|08|09)\d{8}$/.test(cleanPhone)) {
      toast.warning("Số điện thoại không hợp lệ (cần đúng 10 số, đầu 03, 05, 07, 08, 09).");
      return;
    }
    if (!customerEmail.trim()) {
      toast.warning("Vui lòng nhập địa chỉ email để nhận vận đơn và bảo mật tra cứu.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      toast.warning("Định dạng email không hợp lệ.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Gộp các tên sản phẩm thành chuỗi mô tả
      const combinedProductName = items
        .map((it) => `${it.name} (x${it.quantity})`)
        .join(", ");

      let primaryUrl = "";
      const hasMissingUrl = items.some(it => {
        const isExternal = !it.id || it.id.startsWith("calc-");
        if (isExternal && !it.originalUrl?.trim()) {
          return true; // Missing URL for external item
        }
        if (isExternal && !primaryUrl && it.originalUrl) {
          primaryUrl = it.originalUrl.trim(); // Grab the first external URL for the payload
        }
        return false;
      });

      if (hasMissingUrl) {
        toast.warning("Có sản phẩm mua hộ chưa có đường dẫn. Vui lòng kiểm tra lại giỏ hàng.");
        setIsSubmitting(false);
        return;
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerEmail,
          customerPhone,
          customerAddress,
          customerNote: customerNote ? `[Đơn Giỏ Hàng]: ${customerNote}` : `[Đơn Giỏ Hàng: ${items.length} món]`,
          productName: combinedProductName,
          originalUrl: primaryUrl,
          category: items[0]?.category || "other",
          priceJpy: totalPriceJpy,
          weightKg: totalWeightKg,
          exchangeRate,
          productPriceVnd: totalProductPriceVnd,
          serviceFeeVnd,
          shippingFeeVnd,
          totalVnd,
          depositPercent: depositOption,
          paymentMethod: "VNPAY",
          isGroupBuy: false,
          fulfillmentOrigin: hasOnlyVnItems ? "VN" : "JP",
          items: items.map(it => ({
            id: it.id,
            name: it.name,
            quantity: it.quantity,
            priceJpy: it.priceJpy,
            weightKg: it.weightKg,
            originalUrl: it.originalUrl || "",
            fulfillmentOrigin: it.fulfillmentOrigin || "JP",
          })),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setOrderResult({ ...data.order, accessToken: data.accessToken });
        clearCart();
        setShowCheckout(false);
      } else {
        toast.error(data.error || "Không thể khởi tạo đơn hàng. Vui lòng thử lại.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối máy chủ khi tạo đơn hàng.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-300 border-l border-slate-200"
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-navy-900 text-white">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-banana-500 text-navy-950 flex items-center justify-center font-bold text-lg shadow">
              🛒
            </div>
            <div>
              <h3 className="font-serif font-bold text-base flex items-center">
                Giỏ Hàng Mua Hộ
                <span className="ml-2 text-xs bg-banana-400/20 text-banana-300 font-sans px-2 py-0.5 rounded-full border border-banana-400/30">
                  {totalItems} món
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Narita Tokyo ⇄ Việt Nam hỏa tốc</p>
            </div>
          </div>
          <button
            onClick={closeCart}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Order Success Modal view if just placed */}
          {orderResult ? (
            <div className="text-center py-6 px-4 bg-emerald-50 border border-emerald-200 rounded-3xl animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold font-serif text-emerald-950">
                Đơn Hàng Đã Tạo!
              </h4>
              <p className="text-xs text-emerald-800 mt-1">
                Mã đơn hàng:{" "}
                <strong className="text-navy-900 bg-white px-2 py-0.5 rounded border border-emerald-300 font-mono text-sm">
                  {orderResult.orderCode}
                </strong>
              </p>

              {/* Thông tin thanh toán */}
              <div className="mt-4 p-3 bg-white rounded-2xl border border-emerald-200 shadow-sm text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    {orderResult.isPriceVerified
                      ? `Số tiền cần thanh toán (${orderResult.depositPercent || depositOption}%):`
                      : "Mức thanh toán tạm tính:"}
                  </span>
                  <strong className="text-banana-600 text-sm">
                    {orderResult.depositAmountVnd?.toLocaleString()} đ
                  </strong>
                </div>
                {orderResult.depositPercent < 100 && (
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>Số tiền còn lại khi hàng về VN:</span>
                    <span className="font-semibold text-slate-700">
                      {((orderResult.totalVnd || totalVnd) - (orderResult.depositAmountVnd || 0)).toLocaleString()} đ
                    </span>
                  </div>
                )}
                {orderResult.isPriceVerified ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Phương thức:</span>
                      <span className="font-semibold text-blue-700">VNPAY / VietQR</span>
                    </div>
                    <p className="text-[11px] text-slate-500 italic">Thanh toán qua VNPAY để hệ thống tự xác nhận; chuyển khoản VietQR sẽ được nhân viên đối chiếu.</p>
                  </>
                ) : (
                  <p className="text-[11px] text-amber-700 italic">ChillBanana cần duyệt báo giá trước. Vui lòng chưa thanh toán; trạng thái và số tiền cuối cùng sẽ được cập nhật trong trang theo dõi đơn.</p>
                )}
              </div>

              {orderResult.isPriceVerified && (
                <button
                  onClick={() => handleVnpayPayment(orderResult)}
                  disabled={isRedirecting}
                  className="mt-4 w-full py-3 bg-[#0066CC] hover:bg-[#0052a3] text-white font-extrabold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isRedirecting ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Đang chuyển đến VNPAY...</> : <><ExternalLink className="w-4 h-4" />Thanh Toán Qua VNPAY</>}
                </button>
              )}

              <div className="mt-3 flex gap-2">
                <a
                  href={`/tracking?orderCode=${orderResult.orderCode}`}
                  className="flex-1 py-2.5 bg-navy-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors inline-block text-center"
                >
                  Theo Dõi Đơn Hàng
                </a>
                <button
                  onClick={() => {
                    setOrderResult(null);
                    closeCart();
                  }}
                  className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-300"
                >
                  Đóng
                </button>
              </div>
            </div>

          ) : items.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto text-3xl mb-3 shadow-inner">
                🍌
              </div>
              <h4 className="font-serif font-bold text-navy-900 text-base">
                Giỏ hàng của bạn đang trống
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Hãy dán link từ Amazon JP, Mercari hoặc chọn các sản phẩm hot để thêm vào giỏ hàng nhé!
              </p>
              <button
                onClick={closeCart}
                className="mt-5 px-5 py-2.5 bg-banana-500 hover:bg-banana-600 text-navy-950 font-bold text-xs rounded-xl shadow transition-all"
              >
                Khám Phá Hàng Nhật Ngay
              </button>
            </div>
          ) : showCheckout ? (
            /* Checkout Form */
            <form onSubmit={handleCheckoutSubmit} className="space-y-3.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-navy-900 uppercase tracking-wider">
                  Thông Tin Giao Hàng & Đặt Cọc
                </span>
                <button
                  type="button"
                  onClick={() => setShowCheckout(false)}
                  className="text-xs text-banana-700 hover:underline font-semibold"
                >
                  ← Xem lại giỏ hàng
                </button>
              </div>

              {!customer && (
                <div className="p-3 bg-banana-50 rounded-2xl border border-banana-200 flex items-center justify-between text-xs">
                  <span className="text-banana-900">Đã có tài khoản ChillBanana?</span>
                  <button
                    type="button"
                    onClick={() => openAuthModal("login")}
                    className="font-bold text-banana-800 underline hover:text-navy-900"
                  >
                    Đăng nhập
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Họ và tên người nhận <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-banana-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Số điện thoại / Zalo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="0912 345 678"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-banana-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email nhận vận đơn <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="email@domain.com"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-banana-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Địa chỉ giao hàng tận nơi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Số nhà, đường, Phường/Xã, Quận/Huyện, Tỉnh/TP"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-banana-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ghi chú cho nhân viên mua hàng
                </label>
                <textarea
                  rows={2}
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="Ví dụ: Chọn phiên bản màu đen, kiểm tra kỹ seal hộp..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-banana-500 focus:bg-white"
                />
              </div>

              {/* Interactive Deposit Selector trong Checkout */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Phương thức đặt cọc / Thanh toán
                </label>
                <div className={`grid gap-2 ${
                  allowedDepositOptions.length === 1
                    ? "grid-cols-1"
                    : allowedDepositOptions.length === 2
                    ? "grid-cols-2"
                    : "grid-cols-3"
                }`}>
                  {allowedDepositOptions.includes(50) && (
                    <button
                      type="button"
                      onClick={() => setDepositOption(50)}
                      className={`p-2.5 rounded-xl border text-left transition-all relative ${
                        depositOption === 50
                          ? "border-banana-500 bg-banana-50/80 ring-2 ring-banana-200"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-navy-950">Đặt cọc 50%</span>
                        <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] ${
                          depositOption === 50 ? "border-banana-600 bg-banana-500 text-navy-950 font-bold" : "border-slate-300"
                        }`}>
                          {depositOption === 50 ? "✓" : ""}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                        Mua hàng ngay, trả 50% còn lại khi hàng về VN
                      </p>
                      <div className="mt-1 text-xs font-bold text-banana-700">
                        {deposit50Vnd.toLocaleString()} đ
                      </div>
                    </button>
                  )}

                  {allowedDepositOptions.includes(70) && (
                    <button
                      type="button"
                      onClick={() => setDepositOption(70)}
                      className={`p-2.5 rounded-xl border text-left transition-all relative ${
                        depositOption === 70
                          ? "border-banana-500 bg-banana-50/80 ring-2 ring-banana-200"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-navy-950">Đặt cọc 70%</span>
                        <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] ${
                          depositOption === 70 ? "border-banana-600 bg-banana-500 text-navy-950 font-bold" : "border-slate-300"
                        }`}>
                          {depositOption === 70 ? "✓" : ""}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                        Mức cọc tiêu chuẩn cho đơn 1tr - 10tr
                      </p>
                      <div className="mt-1 text-xs font-bold text-banana-700">
                        {deposit70Vnd.toLocaleString()} đ
                      </div>
                    </button>
                  )}

                  {allowedDepositOptions.includes(100) && (
                    <button
                      type="button"
                      onClick={() => setDepositOption(100)}
                      className={`p-2.5 rounded-xl border text-left transition-all relative ${
                        depositOption === 100
                          ? "border-banana-500 bg-banana-50/80 ring-2 ring-banana-200"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-navy-950">Thanh toán 100%</span>
                        <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] ${
                          depositOption === 100 ? "border-banana-600 bg-banana-500 text-navy-950 font-bold" : "border-slate-300"
                        }`}>
                          {depositOption === 100 ? "✓" : ""}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                        Tất toán trước, ưu tiên chốt đơn sàn Nhật
                      </p>
                      <div className="mt-1 text-xs font-bold text-emerald-700">
                        {baseOrderCostVnd.toLocaleString()} đ
                      </div>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between font-bold text-navy-900">
                  <span>Tổng tiền đơn hàng:</span>
                  <span className="text-banana-600">
                    {(totalWeightKg > 0 ? totalVnd : baseOrderCostVnd).toLocaleString()} đ
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-emerald-700">
                  <span>Cần thanh toán ngay ({depositOption}%):</span>
                  <span>{depositAmountVnd.toLocaleString()} đ</span>
                </div>
                {remainingAmountVnd > 0 ? (
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>
                      {depositOption === 100
                        ? "Còn lại (cước bay khi nhận hàng):"
                        : "Còn lại thanh toán khi nhận hàng:"}
                    </span>
                    <span className="font-semibold text-navy-900">{remainingAmountVnd.toLocaleString()} đ</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-emerald-700 text-[11px]">
                    <span>Còn lại khi nhận hàng:</span>
                    <span className="font-semibold">0 đ (Đã tất toán 100%)</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-banana-500 to-banana-600 hover:from-banana-600 hover:to-banana-700 text-navy-950 font-extrabold text-xs sm:text-sm rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2"
              >
                <span>
                  {isSubmitting
                    ? "Đang tạo đơn hàng..."
                    : depositOption === 100
                      ? `Chốt Đơn Thanh Toán 100% (${depositAmountVnd.toLocaleString()} đ) Ngay`
                      : `Chốt Đơn Đặt Cọc ${depositOption}% (${depositAmountVnd.toLocaleString()} đ) Ngay`}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* Item list */
            <div className="space-y-3">
              {items.map((item) => {
                const isSingle = isSingleItemStore(item.originalStore);
                return (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-200 rounded-2xl flex gap-3 items-center"
                  >
                    <img
                      src={item.imageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=150&q=80"}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded-xl border border-slate-200 bg-white shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=150&q=80";
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-banana-800 bg-banana-100 px-1.5 py-0.5 rounded border border-banana-200">
                            {item.originalStore}
                          </span>
                          {isSingle && (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                              📦 Độc bản 1 món
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                          title="Xóa món này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs font-bold text-navy-900 truncate mt-1">
                        {item.name}
                      </p>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-xs font-bold text-banana-700">
                          {Math.round(item.priceJpy * exchangeRate).toLocaleString()} đ
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-500">
                            ({item.priceJpy.toLocaleString()} ¥ • {item.weightKg > 0 ? `${item.weightKg}kg` : "chờ cân"})
                          </span>
                          {item.fulfillmentOrigin === "VN" && (
                            <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-200">
                              🇻🇳 Kho VN (0đ bay)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quantity counter */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60">
                        <span className="text-[10px] text-slate-500">
                          {isSingle ? "Số lượng (Độc bản):" : "Số lượng:"}
                        </span>
                        <div className="flex items-center space-x-1.5 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="text-slate-500 hover:text-navy-900 p-0.5"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            disabled={isSingle}
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.id, isSingle ? 1 : (parseInt(e.target.value) || 0))}
                            className={`w-8 text-center text-xs font-bold px-0 py-0.5 text-navy-950 bg-transparent border-none focus:outline-none focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none ${isSingle ? "cursor-not-allowed text-slate-500" : ""}`}
                          />
                          <button
                            disabled={isSingle}
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className={`p-0.5 transition-colors ${
                              isSingle
                                ? "text-slate-300 cursor-not-allowed"
                                : "text-slate-500 hover:text-navy-900"
                            }`}
                            title={isSingle ? "Hàng Mercari Nhật là sản phẩm độc bản 1 món duy nhất" : "Tăng số lượng"}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Drawer Footer Summary (if not empty and not in result view) */}
        {!orderResult && items.length > 0 && !showCheckout && (
          <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 space-y-3">
            {/* Ghi chú nhanh trong giỏ */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Ghi chú mua hộ (Size / Màu / Yêu cầu kiểm hàng)
              </label>
              <input
                type="text"
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="VD: Lấy size M, màu xanh navy, giữ nguyên seal hộp..."
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-banana-500 focus:bg-white"
              />
            </div>

            {/* Interactive Deposit Selector */}
            <div className="space-y-1.5 pt-1 border-t border-slate-200/80">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Phương thức thanh toán / Đặt cọc
              </label>
              <div className={`grid gap-2 ${
                allowedDepositOptions.length === 1
                  ? "grid-cols-1"
                  : allowedDepositOptions.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-3"
              }`}>
                {allowedDepositOptions.includes(50) && (
                  <button
                    type="button"
                    onClick={() => setDepositOption(50)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      depositOption === 50
                        ? "border-banana-500 bg-banana-50/90 ring-2 ring-banana-200 shadow-xs"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-navy-950">Đặt cọc 50%</span>
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] ${
                        depositOption === 50 ? "border-banana-600 bg-banana-500 text-navy-950 font-bold" : "border-slate-300"
                      }`}>
                        {depositOption === 50 ? "✓" : ""}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                      Mua hàng ngay, trả 50% còn lại khi hàng về VN
                    </p>
                    <div className="mt-1 text-xs font-bold text-banana-700">
                      {deposit50Vnd.toLocaleString()} đ
                    </div>
                  </button>
                )}

                {allowedDepositOptions.includes(70) && (
                  <button
                    type="button"
                    onClick={() => setDepositOption(70)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      depositOption === 70
                        ? "border-banana-500 bg-banana-50/90 ring-2 ring-banana-200 shadow-xs"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-navy-950">Đặt cọc 70%</span>
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] ${
                        depositOption === 70 ? "border-banana-600 bg-banana-500 text-navy-950 font-bold" : "border-slate-300"
                      }`}>
                        {depositOption === 70 ? "✓" : ""}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                      Mức cọc tiêu chuẩn cho đơn 1tr - 10tr
                    </p>
                    <div className="mt-1 text-xs font-bold text-banana-700">
                      {deposit70Vnd.toLocaleString()} đ
                    </div>
                  </button>
                )}

                {allowedDepositOptions.includes(100) && (
                  <button
                    type="button"
                    onClick={() => setDepositOption(100)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      depositOption === 100
                        ? "border-banana-500 bg-banana-50/90 ring-2 ring-banana-200 shadow-xs"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-navy-950">Thanh toán 100%</span>
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] ${
                        depositOption === 100 ? "border-banana-600 bg-banana-500 text-navy-950 font-bold" : "border-slate-300"
                      }`}>
                        {depositOption === 100 ? "✓" : ""}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                      Tất toán trước, ưu tiên chốt đơn sàn Nhật
                    </p>
                    <div className="mt-1 text-xs font-bold text-emerald-700">
                      {baseOrderCostVnd.toLocaleString()} đ
                    </div>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-slate-600 pt-1 border-t border-slate-200/80">
              <div className="flex justify-between items-center text-[11px] text-slate-500 pb-1 mb-1 border-b border-slate-200/60">
                <span>Tỷ giá áp dụng (Live):</span>
                <span className="font-bold text-banana-800 bg-banana-100/80 px-2 py-0.5 rounded border border-banana-200">
                  1 JPY = {exchangeRate} đ
                </span>
              </div>
              <div className="flex justify-between">
                <span>Tiền hàng gốc ({totalPriceJpy.toLocaleString()} ¥):</span>
                <span className="font-semibold text-navy-900">{totalProductPriceVnd.toLocaleString()} đ</span>
              </div>
              <div className="flex justify-between">
                <span>
                  {isMinServiceFeeApplied
                    ? `Phí dịch vụ (${pricingConfig.serviceFeePercent}% • Tối thiểu ${pricingConfig.serviceFeeMinimumVnd.toLocaleString()}đ):`
                    : `Phí dịch vụ (${pricingConfig.serviceFeePercent}%):`}
                </span>
                <span className="font-semibold text-navy-900">{serviceFeeVnd.toLocaleString()} đ</span>
              </div>
              <div className="flex justify-between items-center">
                <span>
                  {hasOnlyVnItems
                    ? "Cước vận chuyển:"
                    : hasVnItems
                    ? `Cước bay Tokyo ⇄ VN (${jpItemsWeightKg}kg hàng Nhật):`
                    : "Cước bay Tokyo ⇄ VN:"}
                </span>
                {hasOnlyVnItems ? (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    0 đ (Sẵn tại kho VN - Miễn cước bay)
                  </span>
                ) : jpItemsWeightKg > 0 ? (
                  <span className="font-semibold text-navy-900">{shippingFeeVnd.toLocaleString()} đ ({jpItemsWeightKg}kg)</span>
                ) : (
                  <span className="text-[10px] font-medium text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    Tạm tính khi cân tại kho JP ({pricingConfig.airShippingPerKgVnd.toLocaleString()}đ/kg)
                  </span>
                )}
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline font-bold text-sm">
                <span className="text-navy-900">
                  {totalWeightKg > 0 ? "Tổng Trọn Gói Về Tay:" : "Tổng Tạm Tính (Chưa gồm cước cân JP→VN):"}
                </span>
                <span className="text-base text-banana-600 font-serif font-extrabold">
                  {(totalWeightKg > 0 ? totalVnd : baseOrderCostVnd).toLocaleString()} đ
                </span>
              </div>

              {/* Tóm tắt số tiền cọc & còn lại */}
              <div className="space-y-1 bg-banana-50/80 p-2.5 rounded-xl border border-banana-200 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-banana-950 font-medium">Cần thanh toán ngay ({depositOption}%):</span>
                  <strong className="text-banana-700 font-bold text-sm">{depositAmountVnd.toLocaleString()} đ</strong>
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-600">
                  <span>Còn lại thanh toán khi nhận hàng:</span>
                  <span className="font-semibold text-navy-900">{remainingAmountVnd.toLocaleString()} đ</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowCheckout(true)}
                className="flex-1 py-3 bg-gradient-to-r from-banana-500 to-banana-600 hover:from-banana-600 hover:to-banana-700 text-navy-950 font-extrabold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2"
              >
                <span>
                  {depositOption === 100
                    ? `Tiến Hành Thanh Toán 100% (${depositAmountVnd.toLocaleString()} đ) →`
                    : `Tiến Hành Đặt Cọc ${depositOption}% (${depositAmountVnd.toLocaleString()} đ) →`}
                </span>
              </button>
              <button
                onClick={clearCart}
                className="p-3 text-slate-400 hover:text-rose-600 hover:bg-slate-200 rounded-xl transition-colors"
                title="Xóa toàn bộ giỏ hàng"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}