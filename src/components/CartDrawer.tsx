"use client";

import React, { useState, useEffect } from "react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  ArrowRight, 
  ShieldCheck, 
  Plane, 
  AlertCircle,
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
    totalItems,
    totalPriceJpy,
    totalProductPriceVnd,
    totalWeightKg,
    shippingFeeVnd,
    serviceFeeVnd,
    totalVnd,
    deposit50Vnd
  } = useCart();

  const { customer, openAuthModal } = useAuth();

  // Checkout form fields
  const [showCheckout, setShowCheckout] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<any>(null);

  // Auto-fill from customer account if available
  useEffect(() => {
    if (customer) {
      if (customer.name && !customerName) setCustomerName(customer.name);
      if (customer.email && !customerEmail) setCustomerEmail(customer.email);
      if (customer.phone && !customerPhone) setCustomerPhone(customer.phone);
      if (customer.address && !customerAddress) setCustomerAddress(customer.address);
    }
  }, [customer]);

  if (!isCartOpen) return null;

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    if (!customerName || !customerPhone || !customerAddress) {
      alert("Vui lòng điền đầy đủ Họ tên, Số điện thoại và Địa chỉ giao hàng.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Gộp các tên sản phẩm thành chuỗi mô tả
      const combinedProductName = items
        .map((it) => `${it.name} (x${it.quantity})`)
        .join(", ");

      const primaryUrl = items[0]?.originalUrl || "https://chillbanana.vn/cart";

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerEmail: customerEmail || "khachhang@chillbanana.vn",
          customerPhone,
          customerAddress,
          customerNote: customerNote ? `[Đơn Giỏ Hàng]: ${customerNote}` : `[Đơn Giỏ Hàng: ${items.length} món]`,
          productName: combinedProductName,
          originalUrl: primaryUrl,
          category: items[0]?.category || "other",
          priceJpy: totalPriceJpy,
          weightKg: totalWeightKg,
          depositPercent: 50,
          paymentMethod: "VIETQR",
          isGroupBuy: false,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setOrderResult(data.data);
        clearCart();
        setShowCheckout(false);
      } else {
        alert(data.error || "Không thể khởi tạo đơn hàng. Vui lòng thử lại.");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối máy chủ khi tạo đơn hàng.");
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
                Đặt Hàng Thành Công!
              </h4>
              <p className="text-xs text-emerald-800 mt-1">
                Mã vận đơn của bạn là: <strong className="text-navy-900 bg-white px-2 py-0.5 rounded border border-emerald-300 font-mono text-sm">{orderResult.orderCode}</strong>
              </p>
              
              {/* VietQR Quick Box */}
              <div className="mt-4 p-3 bg-white rounded-2xl border border-emerald-200 shadow-sm text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Số tiền cọc 50%:</span>
                  <strong className="text-banana-600 text-sm">{orderResult.depositAmountVnd?.toLocaleString()} đ</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Trạng thái:</span>
                  <span className="font-semibold text-amber-600">Chờ chuyển cọc</span>
                </div>
                <p className="text-[11px] text-slate-500 italic">
                  * Chuyên viên Tokyo sẽ liên hệ Zalo/SĐT để xác nhận và tiến hành mua hàng ngay khi nhận được cọc.
                </p>
              </div>

              <div className="mt-5 flex gap-2">
                <a
                  href={`/tracking?orderCode=${orderResult.orderCode}`}
                  className="flex-1 py-2.5 bg-navy-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors inline-block"
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
                    Email nhận vận đơn
                  </label>
                  <input
                    type="email"
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

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between font-bold text-navy-900">
                  <span>Tổng tiền thanh toán:</span>
                  <span className="text-banana-600">{totalVnd.toLocaleString()} đ</span>
                </div>
                <div className="flex justify-between font-semibold text-emerald-700">
                  <span>Số tiền cọc trước (50%):</span>
                  <span>{deposit50Vnd.toLocaleString()} đ</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-banana-500 to-banana-600 hover:from-banana-600 hover:to-banana-700 text-navy-950 font-extrabold text-xs sm:text-sm rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2"
              >
                <span>{isSubmitting ? "Đang tạo đơn hàng..." : "Chốt Đơn Cọc 50% Ngay"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* Item list */
            <div className="space-y-3">
              {items.map((item) => (
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
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-banana-800 bg-banana-100 px-1.5 py-0.5 rounded border border-banana-200">
                        {item.originalStore}
                      </span>
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
                        {item.priceVnd.toLocaleString()} đ
                      </span>
                      <span className="text-[10px] text-slate-500">
                        ({item.priceJpy.toLocaleString()} ¥ • {item.weightKg}kg)
                      </span>
                    </div>

                    {/* Quantity counter */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60">
                      <span className="text-[10px] text-slate-500">Số lượng:</span>
                      <div className="flex items-center space-x-1.5 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="text-slate-500 hover:text-navy-900 p-0.5"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold px-1.5 text-navy-950">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="text-slate-500 hover:text-navy-900 p-0.5"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drawer Footer Summary (if not empty and not in result view) */}
        {!orderResult && items.length > 0 && !showCheckout && (
          <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 space-y-3">
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Tiền hàng gốc ({totalPriceJpy.toLocaleString()} ¥):</span>
                <span className="font-semibold text-navy-900">{totalProductPriceVnd.toLocaleString()} đ</span>
              </div>
              <div className="flex justify-between">
                <span>Phí mua hộ trọn gói (4%):</span>
                <span className="font-semibold text-navy-900">{serviceFeeVnd.toLocaleString()} đ</span>
              </div>
              <div className="flex justify-between">
                <span>Cước bay Tokyo ⇄ VN ({totalWeightKg}kg):</span>
                <span className="font-semibold text-navy-900">{shippingFeeVnd.toLocaleString()} đ</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline font-bold text-sm">
                <span className="text-navy-900">Tổng Trọn Gói Về Tay:</span>
                <span className="text-base text-banana-600 font-serif font-extrabold">{totalVnd.toLocaleString()} đ</span>
              </div>
              <div className="flex justify-between items-center text-xs bg-banana-50 px-3 py-1.5 rounded-xl border border-banana-200">
                <span className="text-banana-900 font-medium">Chỉ cần đặt cọc trước (50%):</span>
                <strong className="text-banana-700 font-bold">{deposit50Vnd.toLocaleString()} đ</strong>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowCheckout(true)}
                className="flex-1 py-3 bg-gradient-to-r from-banana-500 to-banana-600 hover:from-banana-600 hover:to-banana-700 text-navy-950 font-extrabold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2"
              >
                <span>Tiến Hành Đặt Hàng</span>
                <ArrowRight className="w-4 h-4" />
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
