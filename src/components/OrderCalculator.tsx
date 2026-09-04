"use client";

import React, { useState, useEffect } from "react";
import { 
  Calculator, 
  ArrowRight, 
  ExternalLink, 
  Package, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Users, 
  Plane, 
  ShieldCheck,
  Zap,
  Info,
  RefreshCw,
  Search
} from "lucide-react";
import { 
  DEFAULT_EXCHANGE_RATE, 
  AIR_SHIPPING_PER_KG, 
  MIN_ORDER_THRESHOLD_VND, 
  calculateOrderPrice 
} from "@/lib/data";

export default function OrderCalculator() {
  const [direction, setDirection] = useState<"JP_TO_VN" | "VN_TO_JP">("JP_TO_VN");
  const [productUrl, setProductUrl] = useState("");
  const [productName, setProductName] = useState("");
  const [productImage, setProductImage] = useState("");
  const [detectedStore, setDetectedStore] = useState("");
  const [category, setCategory] = useState("cosmetics");
  const [priceJpy, setPriceJpy] = useState<number>(3500);
  const [weightKg, setWeightKg] = useState<number>(0.5);
  const [isGroupBuy, setIsGroupBuy] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeSuccess, setScrapeSuccess] = useState(false);
  
  // Trạng thái modal đặt hàng nhanh
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [depositChoice, setDepositChoice] = useState<"50" | "100">("50");
  const [customerNote, setCustomerNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccessData, setOrderSuccessData] = useState<any>(null);

  // Hàm tự động cào dữ liệu từ URL thật
  const handleAutoScrape = async () => {
    if (!productUrl || !productUrl.startsWith("http")) {
      alert("Vui lòng nhập đường dẫn URL đầy đủ (ví dụ: https://www.amazon.co.jp/... hoặc https://jp.mercari.com/...)");
      return;
    }

    setIsScraping(true);
    setScrapeSuccess(false);

    try {
      const res = await fetch("/api/scrape-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: productUrl }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.data) {
        if (data.data.title) setProductName(data.data.title);
        if (data.data.priceJpy && data.data.priceJpy > 0) setPriceJpy(data.data.priceJpy);
        if (data.data.imageUrl) setProductImage(data.data.imageUrl);
        if (data.data.storeName) setDetectedStore(data.data.storeName);
        setScrapeSuccess(true);
      } else {
        alert("Không thể bóc tách tự động link này. Bạn có thể tự nhập tên và giá Yên thủ công nhé!");
      }
    } catch (err) {
      console.warn(err);
      alert("Lỗi kết nối khi quét link. Bạn vui lòng nhập thông tin sản phẩm thủ công.");
    } finally {
      setIsScraping(false);
    }
  };

  const calc = calculateOrderPrice(priceJpy, weightKg, DEFAULT_EXCHANGE_RATE, isGroupBuy);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !customerAddress) {
      alert("Vui lòng điền đầy đủ Họ tên, Số điện thoại và Địa chỉ nhận hàng!");
      return;
    }

    setIsSubmitting(true);
    try {
      const orderPayload = {
        customerName,
        customerEmail: customerEmail || "khachhang@chillbanana.vn",
        customerPhone,
        customerAddress,
        originalUrl: productUrl || "https://amazon.co.jp",
        productName: productName || "Đơn mua hộ tự do từ Nhật",
        category,
        priceJpy,
        weightKg,
        exchangeRate: DEFAULT_EXCHANGE_RATE,
        productPriceVnd: calc.productPriceVnd,
        serviceFeeVnd: calc.serviceFeeVnd,
        shippingFeeVnd: calc.shippingFeeVnd,
        totalVnd: calc.totalVnd,
        depositAmountVnd: depositChoice === "50" ? calc.deposit50Vnd : calc.totalVnd,
        paymentMethod: "VIETQR",
        isGroupBuy,
        customerNote,
        direction,
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setOrderSuccessData(data.order);
      } else {
        alert("Có lỗi khi tạo đơn: " + (data.error || "Vui lòng thử lại"));
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối máy chủ. Vui lòng thử lại!");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="calculator" className="relative py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-gradient-to-b from-banana-50/50 to-white -z-10 rounded-3xl border border-banana-200 shadow-sm" />

      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center space-x-2 bg-banana-100 text-banana-900 border border-banana-300 px-3.5 py-1 rounded-full text-xs font-bold mb-3">
          <Calculator className="w-3.5 h-3.5 text-banana-600" />
          <span>Công Cụ Tự Động Bóc Tách Link & Báo Giá Trọn Gói</span>
        </div>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-navy-900">
          Dán Link Nhật - ChillBanana Báo Giá Trong 3 Giây
        </h2>
        <p className="mt-2 text-sm sm:text-base text-slate-600">
          Hỗ trợ bóc tách tự động link từ Amazon JP, Mercari, Rakuten, Yahoo Auctions... Tỷ giá Yên chuẩn xác, cước bay cố định, bảo hiểm 100%.
        </p>

        {/* Chuyển đổi chiều mua: Nhật -> Việt hoặc Việt -> Nhật */}
        <div className="mt-5 inline-flex p-1 bg-slate-200/80 rounded-2xl">
          <button
            onClick={() => setDirection("JP_TO_VN")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center ${
              direction === "JP_TO_VN"
                ? "bg-navy-900 text-white shadow-sm"
                : "text-slate-700 hover:text-navy-900"
            }`}
          >
            <span className="mr-1.5">🇯🇵 ➔ 🇻🇳</span> Mua Hàng Từ Nhật Về Việt Nam
          </button>
          <button
            onClick={() => setDirection("VN_TO_JP")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center ${
              direction === "VN_TO_JP"
                ? "bg-navy-900 text-white shadow-sm"
                : "text-slate-700 hover:text-navy-900"
            }`}
          >
            <span className="mr-1.5">🇻🇳 ➔ 🇯🇵</span> Gửi Quà / Hàng Sang Nhật Bản
          </button>
        </div>
      </div>

      {/* Main Calculator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form: Input link & params (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-5">
          {/* Link Input with Live Scrape Button */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                1. Dán Đường Dẫn Link Sản Phẩm Nhật Bản
              </label>
              <span className="text-[11px] text-banana-700 font-semibold flex items-center">
                <Sparkles className="w-3 h-3 mr-1" />
                Tự động lấy Tên, Ảnh & Giá Yên
              </span>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="url"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  placeholder="https://www.amazon.co.jp/... hoặc https://jp.mercari.com/..."
                  className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-banana-500 focus:bg-white transition-all"
                />
                <ExternalLink className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-400" />
              </div>
              <button
                type="button"
                onClick={handleAutoScrape}
                disabled={isScraping || !productUrl}
                className="px-4 py-3 bg-banana-500 hover:bg-banana-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center space-x-1.5 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScraping ? "animate-spin" : ""}`} />
                <span>{isScraping ? "Đang quét..." : "Quét Link Tự Động"}</span>
              </button>
            </div>

            {/* Preview ảnh & tên nếu quét thành công */}
            {scrapeSuccess && (
              <div className="mt-3 p-3 bg-banana-50/70 border border-banana-200 rounded-2xl flex items-center space-x-3 animate-in fade-in duration-200">
                {productImage && (
                  <img
                    src={productImage}
                    alt="Preview"
                    className="w-14 h-14 object-cover rounded-xl border border-banana-200 shrink-0 bg-white"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-banana-800 bg-banana-200/80 px-2 py-0.5 rounded">
                    {detectedStore || "Website Nhật"}
                  </span>
                  <p className="text-xs font-bold text-navy-900 truncate mt-0.5">
                    {productName}
                  </p>
                  <p className="text-[11px] text-emerald-700 font-semibold">
                    ✓ Đã tự động cập nhật giá gốc: {priceJpy.toLocaleString()} ¥
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Tên sản phẩm & Danh mục */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                2. Tên Sản Phẩm (Hiển thị trên đơn)
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="VD: Kem chống nắng Anessa / Nồi cơm Zojirushi"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-banana-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                3. Danh Mục Hàng Hóa
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-banana-500 focus:bg-white"
              >
                <option value="cosmetics">🌸 Mỹ Phẩm & Chăm Sóc Da</option>
                <option value="health">🌿 Thực Phẩm Chức Năng & Sức Khỏe</option>
                <option value="gadgets">⚡ Gia Dụng & Điện Tử Mini (100V)</option>
                <option value="anime">🎎 Anime, Manga & Figure Chính Hãng</option>
                <option value="other">📦 Danh Mục Khác</option>
              </select>
            </div>
          </div>

          {/* Giá Yên & Cân Nặng */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  4. Giá Gốc Tại Nhật (¥ Yên)
                </label>
                <span className="text-xs text-banana-700 font-bold">
                  ≈ {(priceJpy * DEFAULT_EXCHANGE_RATE).toLocaleString("vi-VN")} đ
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min={100}
                  step={100}
                  value={priceJpy}
                  onChange={(e) => setPriceJpy(Math.max(0, Number(e.target.value)))}
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-banana-500 focus:bg-white"
                />
                <span className="absolute left-3 top-2.5 text-slate-500 font-bold">¥</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  5. Trọng Lượng Ước Tính
                </label>
                <span className="text-xs text-blue-700 font-bold">{weightKg} kg</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-banana-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>0.1 kg (Son/Mỹ phẩm)</span>
                <span>1.0 kg (Quần áo/Giày)</span>
                <span>5.0 kg+ (Đồ gia dụng)</span>
              </div>
            </div>
          </div>

          {/* Hạn mức tối thiểu & Gộp đơn */}
          <div className="pt-3 border-t border-slate-100">
            <div className={`p-4 rounded-2xl border transition-all ${
              calc.isUnderMinOrder 
                ? "bg-amber-50 border-amber-300" 
                : "bg-emerald-50/70 border-emerald-300"
            }`}>
              <div className="flex items-start space-x-3">
                {calc.isUnderMinOrder ? (
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                )}
                <div className="text-xs text-slate-700 space-y-1">
                  {calc.isUnderMinOrder ? (
                    <>
                      <p className="font-bold text-amber-900">
                        Đơn hàng hiện tại ({calc.totalVnd.toLocaleString("vi-VN")} đ) chưa đạt hạn mức tối thiểu ({MIN_ORDER_THRESHOLD_VND.toLocaleString("vi-VN")} đ)
                      </p>
                      <p className="text-slate-600">
                        👉 <strong>Giải pháp Chill:</strong> Hãy tích chọn <strong>"Gộp Đơn (Group Buy)"</strong> để ghép chung chuyến bay thứ 5 và chủ nhật, nhận ưu đãi giảm 25% cước bay!
                      </p>
                    </>
                  ) : (
                    <p className="font-bold text-emerald-900">
                      Đơn hàng đã đạt hạn mức tối thiểu và đủ điều kiện bay thẳng hỏa tốc!
                    </p>
                  )}

                  {/* Toggle Gộp Đơn */}
                  <label className="flex items-center space-x-2.5 mt-2 cursor-pointer select-none pt-1">
                    <input
                      type="checkbox"
                      checked={isGroupBuy}
                      onChange={(e) => setIsGroupBuy(e.target.checked)}
                      className="w-4 h-4 text-banana-500 rounded border-slate-300 focus:ring-banana-500 cursor-pointer"
                    />
                    <span className="font-bold text-navy-900 flex items-center">
                      <Users className="w-3.5 h-3.5 mr-1 text-banana-600" />
                      Bật Chế Độ Gộp Đơn (Tiết kiệm 25% cước bay cho kiện &lt; 0.5kg)
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Realtime Price Breakdown & CTA (5 cols) */}
        <div className="lg:col-span-5 bg-navy-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between border border-slate-800">
          <div>
            <div className="flex justify-between items-center pb-4 border-b border-white/15">
              <span className="text-xs font-bold text-banana-400 uppercase tracking-wider flex items-center">
                <ShieldCheck className="w-4 h-4 mr-1 text-banana-400" />
                Chi Phí Trọn Gói ChillBanana
              </span>
              <span className="text-[11px] bg-white/10 px-2.5 py-0.5 rounded-full text-slate-300">
                1 JPY = {DEFAULT_EXCHANGE_RATE} đ
              </span>
            </div>

            {/* Chi tiết từng khoản phí */}
            <div className="mt-5 space-y-3.5 text-xs sm:text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Tiền hàng gốc ({priceJpy.toLocaleString()} ¥):</span>
                <span className="font-medium text-white">{calc.productPriceVnd.toLocaleString("vi-VN")} đ</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center">
                  Phí mua hộ & bảo hiểm (4%):
                  <Info className="w-3 h-3 ml-1 text-slate-400" />
                </span>
                <span className="font-medium text-white">{calc.serviceFeeVnd.toLocaleString("vi-VN")} đ</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center">
                  Cước bay JP ✈ VN ({weightKg} kg):
                  {isGroupBuy && <span className="ml-1 text-[10px] text-banana-300 bg-banana-900/60 px-1.5 rounded">-25% Gộp</span>}
                </span>
                <span className="font-medium text-white">{calc.shippingFeeVnd.toLocaleString("vi-VN")} đ</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Phụ phí hải quan & đóng gói:</span>
                <span className="font-medium text-emerald-400">0 đ (Miễn phí)</span>
              </div>
            </div>

            {/* Tổng tiền & Đặt cọc 50% */}
            <div className="mt-6 pt-5 border-t border-white/15">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold text-slate-200">Tổng Trọn Gói (VND):</span>
                <div className="text-right">
                  <span className="text-2xl sm:text-3xl font-bold font-serif text-banana-400">
                    {calc.totalVnd.toLocaleString("vi-VN")} <span className="text-base font-normal">đ</span>
                  </span>
                </div>
              </div>

              <div className="mt-2.5 flex justify-between items-center text-xs bg-white/10 p-3 rounded-2xl">
                <span className="text-slate-300">Tiền đặt cọc trước (50%):</span>
                <strong className="text-banana-300 text-sm">
                  {calc.deposit50Vnd.toLocaleString("vi-VN")} đ
                </strong>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="mt-8 space-y-3">
            <button
              onClick={() => setShowOrderModal(true)}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-banana-500 to-banana-600 hover:from-banana-600 hover:to-banana-700 text-navy-950 font-extrabold text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2 group"
            >
              <span>Tiến Hành Đặt Mua Hộ Ngay</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => {
                const chatToggle = document.getElementById("ai-chat-toggle-btn");
                if (chatToggle) chatToggle.click();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-banana-400" />
              <span>Hỏi Gemini AI tư vấn về sản phẩm này</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Điền Thông Tin Đặt Hàng & Thanh Toán VietQR */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative my-8">
            <button
              onClick={() => {
                setShowOrderModal(false);
                setOrderSuccessData(null);
              }}
              className="absolute right-5 top-5 text-slate-400 hover:text-slate-700 text-lg font-bold"
            >
              ✕
            </button>

            {!orderSuccessData ? (
              <form onSubmit={handleCreateOrder} className="space-y-4">
                <div className="border-b pb-3">
                  <span className="text-xs font-bold text-banana-700 uppercase tracking-wider">
                    Xác Nhận Đơn Hàng ChillBanana
                  </span>
                  <h3 className="text-xl font-bold font-serif text-navy-900">
                    Điền Thông Tin Nhận Hàng & Nhận Mã VietQR
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Đơn hàng: <strong>{productName || "Đơn hàng Nhật Bản"}</strong> — Tổng tiền: <strong>{calc.totalVnd.toLocaleString("vi-VN")} đ</strong>
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Họ và Tên Người Nhận *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="VD: Nguyễn Văn An"
                      className="w-full px-3.5 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-banana-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Số Điện Thoại Nhận Hàng *
                      </label>
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="VD: 0912345678"
                        className="w-full px-3.5 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-banana-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Email Nhận Thông Báo & Vận Đơn
                      </label>
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="email@example.com"
                        className="w-full px-3.5 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-banana-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Địa Chỉ Nhận Hàng Tại Việt Nam *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      placeholder="Số nhà, tên đường, Phường/Xã, Quận/Huyện, Tỉnh/TP"
                      className="w-full px-3.5 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-banana-500"
                    />
                  </div>

                  {/* Lựa chọn mức cọc */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Lựa Chọn Mức Thanh Toán / Đặt Cọc
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className={`flex items-center p-3 rounded-2xl border cursor-pointer ${
                        depositChoice === "50" ? "border-banana-500 bg-banana-50/70" : "border-slate-200"
                      }`}>
                        <input
                          type="radio"
                          name="deposit"
                          value="50"
                          checked={depositChoice === "50"}
                          onChange={() => setDepositChoice("50")}
                          className="mr-2 text-banana-600"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-800">Đặt cọc 50%</p>
                          <p className="text-[11px] text-banana-800 font-bold">
                            {calc.deposit50Vnd.toLocaleString("vi-VN")} đ
                          </p>
                        </div>
                      </label>

                      <label className={`flex items-center p-3 rounded-2xl border cursor-pointer ${
                        depositChoice === "100" ? "border-banana-500 bg-banana-50/70" : "border-slate-200"
                      }`}>
                        <input
                          type="radio"
                          name="deposit"
                          value="100"
                          checked={depositChoice === "100"}
                          onChange={() => setDepositChoice("100")}
                          className="mr-2 text-banana-600"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-800">Thanh toán 100%</p>
                          <p className="text-[11px] text-banana-800 font-bold">
                            {calc.totalVnd.toLocaleString("vi-VN")} đ
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Ghi Chú Cho Nhân Viên ChillBanana Tại Nhật
                    </label>
                    <textarea
                      rows={2}
                      value={customerNote}
                      onChange={(e) => setCustomerNote(e.target.value)}
                      placeholder="VD: Kiểm tra kỹ đúng màu, date xa giúp mình..."
                      className="w-full px-3.5 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-banana-500"
                    />
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-navy-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-sm shadow-md transition-all flex items-center justify-center space-x-2"
                  >
                    {isSubmitting ? (
                      <span>Đang khởi tạo đơn hàng...</span>
                    ) : (
                      <>
                        <span>Xác Nhận Đặt Mua & Sinh Mã VietQR Napas</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Màn hình hiển thị mã VietQR thanh toán thật */
              <div className="text-center space-y-4">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-serif text-navy-900">
                    Tạo Đơn Hàng Thành Công!
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Mã đơn hàng ChillBanana của bạn: <strong className="text-banana-600 text-sm">{orderSuccessData.orderCode}</strong>
                  </p>
                </div>

                {/* Khung VietQR Code Chuẩn Napas 247 */}
                <div className="p-4 bg-slate-50 rounded-3xl border border-slate-200 max-w-sm mx-auto">
                  <p className="text-xs font-bold text-slate-700 mb-2">
                    Quét mã VietQR chuyển khoản (Mở mọi App Ngân Hàng):
                  </p>
                  <img
                    src={`https://api.vietqr.io/image/970422-0988889999-compact.png?amount=${orderSuccessData.depositAmountVnd}&addInfo=${encodeURIComponent(orderSuccessData.orderCode)}&accountName=CHILLBANANA%20ORDER%20VIETNAM`}
                    alt="VietQR Napas 247"
                    className="w-56 h-auto mx-auto rounded-2xl shadow-sm border border-slate-200"
                  />
                  <div className="mt-3 text-xs space-y-1 text-slate-600 text-left bg-white p-3 rounded-xl border">
                    <p>🏦 Ngân hàng: <strong>MB Bank (Ngân Hàng Quân Đội)</strong></p>
                    <p>💳 Số tài khoản: <strong>0988 889 999</strong></p>
                    <p>👤 Chủ tài khoản: <strong>CHILLBANANA ORDER VIETNAM</strong></p>
                    <p>💰 Số tiền cần cọc: <strong className="text-banana-700 font-bold">{orderSuccessData.depositAmountVnd.toLocaleString("vi-VN")} đ</strong></p>
                    <p>📝 Nội dung CK: <strong className="text-blue-700">{orderSuccessData.orderCode}</strong></p>
                  </div>
                </div>

                <div className="flex space-x-3 pt-2">
                  <a
                    href={`/tracking?code=${orderSuccessData.orderCode}`}
                    className="flex-1 py-3 bg-navy-900 hover:bg-slate-800 text-white text-xs font-bold rounded-2xl transition-colors text-center"
                  >
                    Tra Cứu Tiến Độ Đơn Hàng (7 Bước)
                  </a>
                  <button
                    onClick={() => {
                      setShowOrderModal(false);
                      setOrderSuccessData(null);
                    }}
                    className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
