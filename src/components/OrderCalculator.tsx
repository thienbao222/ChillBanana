"use client";

import React, { useState, useEffect } from "react";
import {
  Calculator,
  ArrowRight,
  ExternalLink,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Users,
  ShieldCheck,
  Info,
  RefreshCw,
  Activity
} from "lucide-react";
import {
  AIR_SHIPPING_PER_KG,
  MIN_ORDER_THRESHOLD_VND,
  calculateOrderPrice
} from "@/lib/data";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

export default function OrderCalculator() {
  const { addToCart, items, clearCart } = useCart();
  const { customer } = useAuth();
  const { toast } = useToast();

  const [direction, setDirectionState] = useState<"JP_TO_VN" | "VN_TO_JP">("JP_TO_VN");

  const setDirection = (newDirection: "JP_TO_VN" | "VN_TO_JP") => {
    if (newDirection === "VN_TO_JP" && items.length > 0) {
      if (window.confirm("Chuyển sang gửi hàng đi Nhật sẽ xóa các sản phẩm mua hộ đang có trong giỏ hàng. Bạn có chắc chắn?")) {
        clearCart();
        setDirectionState(newDirection);
      }
    } else {
      setDirectionState(newDirection);
    }
  };

  const [productUrl, setProductUrl] = useState("");
  const [productId, setProductId] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [productImage, setProductImage] = useState("");
  const [detectedStore, setDetectedStore] = useState("");
  const [category, setCategory] = useState("cosmetics");
  const [priceJpy, setPriceJpy] = useState<number>(3500);
  const [weightKg, setWeightKg] = useState<number>(0);
  const [showWeightPreview, setShowWeightPreview] = useState(false);
  const [isGroupBuy, setIsGroupBuy] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeSuccess, setScrapeSuccess] = useState(false);
  const [isPriceLocked, setIsPriceLocked] = useState(false);

  // Tỷ giá thời gian thực tế
  const [exchangeRate, setExchangeRate] = useState<number>(172);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateSource, setRateSource] = useState("Tỷ giá liên ngân hàng");

  // Trạng thái modal đặt hàng nhanh
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [depositChoice, setDepositChoice] = useState<"50" | "100">("50");
  const [customerNote, setCustomerNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [orderSuccessData, setOrderSuccessData] = useState<any>(null);

  // Lắng nghe URL param để tự động dán và cào dữ liệu khi từ chat qua
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const urlToScrape = urlParams.get("url");
      if (urlToScrape) {
        setProductUrl(urlToScrape);
        setProductId(null);
        // Tự động cuộn xuống phần calculator
        const el = document.getElementById("calculator");
        if (el) el.scrollIntoView({ behavior: "smooth" });
        // Chạy scrape luôn
        handleAutoScrape(urlToScrape);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill from customer account if logged in
  useEffect(() => {
    if (customer) {
      if (customer.name && !customerName) setCustomerName(customer.name);
      if (customer.email && !customerEmail) setCustomerEmail(customer.email);
      if (customer.phone && !customerPhone) setCustomerPhone(customer.phone);
      if (customer.address && !customerAddress) setCustomerAddress(customer.address);
    }
  }, [customer]);

  // Tải tỷ giá live từ API
  const loadLiveRate = async () => {
    setRateLoading(true);
    try {
      const res = await fetch("/api/exchange-rate");
      const json = await res.json();
      if (json.success && json.data?.roundedRate) {
        setExchangeRate(json.data.roundedRate);
        if (json.data.source) setRateSource(json.data.source);
      }
    } catch (err) {
      console.warn("Could not fetch live rate:", err);
    } finally {
      setRateLoading(false);
    }
  };

  useEffect(() => {
    loadLiveRate();

    const handleSelectProduct = (e: any) => {
      if (e.detail) {
        if (e.detail.id) setProductId(e.detail.id);
        if (e.detail.name) setProductName(e.detail.name);
        if (e.detail.priceJpy) {
          setPriceJpy(e.detail.priceJpy);
          setIsPriceLocked(true);
        }
        if (e.detail.weightKg) setWeightKg(e.detail.weightKg);
        if (e.detail.imageUrl) setProductImage(e.detail.imageUrl);
        if (e.detail.originalStore) setDetectedStore(e.detail.originalStore);
        setScrapeSuccess(true);
      }
    };

    window.addEventListener("chillbanana:select_product", handleSelectProduct);
    return () => {
      window.removeEventListener("chillbanana:select_product", handleSelectProduct);
    };
  }, []);

  // Hàm tự động cào dữ liệu từ URL thật
  const handleAutoScrape = async (overrideUrl?: string) => {
    const targetUrl = overrideUrl || productUrl;
    if (!targetUrl || !targetUrl.startsWith("http")) {
      toast.warning("Vui lòng nhập đường dẫn đầy đủ bắt đầu bằng https://.");
      return;
    }

    setIsScraping(true);
    setScrapeSuccess(false);
    setProductId(null);

    try {
      const res = await fetch("/api/scrape-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.data) {
        if (data.data.title) setProductName(data.data.title);
        if (data.data.priceJpy && data.data.priceJpy > 0) {
          setPriceJpy(data.data.priceJpy);
          setIsPriceLocked(true);
        } else {
          setIsPriceLocked(false);
        }
        if (data.data.imageUrl) setProductImage(data.data.imageUrl);
        if (data.data.storeName) setDetectedStore(data.data.storeName);
        if (data.data.category) setCategory(data.data.category);
        // Trọng lượng để 0 để chờ cân đo thực tế tại kho Tokyo/VN, không tự động gán
        setWeightKg(0);
        setShowWeightPreview(false);
        setScrapeSuccess(true);
      } else {
        toast.info("Chưa đọc được thông tin từ link này. Bạn có thể nhập tên và giá Yên thủ công.");
      }
    } catch (err) {
      console.warn(err);
      toast.error("Không kết nối được để đọc link. Bạn có thể nhập thông tin sản phẩm thủ công.");
    } finally {
      setIsScraping(false);
    }
  };

  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
  };

  const calc = calculateOrderPrice(priceJpy, weightKg, exchangeRate, isGroupBuy);

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

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if ((!productUrl || productUrl.trim() === "") && !productId) {
      toast.warning("Vui lòng dán link sản phẩm trước.");
      return;
    }
    if (!productName || productName.trim() === "") {
      toast.warning("Vui lòng nhập tên sản phẩm.");
      return;
    }
    if (!customerName || !customerPhone || !customerAddress) {
      toast.warning("Vui lòng điền đầy đủ họ tên, số điện thoại và địa chỉ giao hàng.");
      return;
    }

    setIsSubmitting(true);
    try {
      const orderPayload = {
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        originalUrl: productUrl || "",
        productName: productName,
        category,
        priceJpy,
        weightKg,
        exchangeRate,
        productPriceVnd: calc.productPriceVnd,
        serviceFeeVnd: calc.serviceFeeVnd,
        shippingFeeVnd: calc.shippingFeeVnd,
        totalVnd: calc.totalVnd,
        depositPercent: Number(depositChoice),
        paymentMethod: "VNPAY",
        isGroupBuy,
        customerNote,
        direction,
        items: productId
          ? [{ id: productId, name: productName, quantity: 1, priceJpy, weightKg }]
          : [{ id: "calc-" + Date.now(), name: productName, quantity: 1, priceJpy, weightKg }],
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
        toast.error(data.error || "Có lỗi khi tạo đơn. Vui lòng thử lại.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="calculator" className="relative py-12 px-4 sm:px-6 lg:px-8 max-w-[1600px] w-[95%] mx-auto">
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
          Hỗ trợ bóc tách tự động link từ Amazon JP, Mercari, Rakuten, Yahoo Auctions... Tỷ giá cập nhật liên tục, cước vận chuyển minh bạch, bảo hiểm 100%.
        </p>

        {/* Chuyển đổi chiều mua */}
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
                onClick={() => handleAutoScrape()}
                disabled={isScraping || !productUrl}
                className="px-4 py-3 bg-banana-500 hover:bg-banana-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center space-x-1.5 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScraping ? "animate-spin" : ""}`} />
                <span>{isScraping ? "Đang quét..." : "Quét Link Tự Động"}</span>
              </button>
            </div>

            {/* Preview ảnh & tên hoặc Loading Skeleton */}
            {isScraping ? (
              <div className="mt-3 p-3 bg-white border border-slate-200 rounded-2xl flex items-center space-x-3">
                <div className="w-14 h-14 rounded-xl bg-slate-200 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-200 rounded w-24 animate-pulse" />
                  <div className="h-4 bg-slate-200 rounded w-full animate-pulse" />
                  <div className="h-3 bg-slate-200 rounded w-1/2 animate-pulse" />
                </div>
              </div>
            ) : scrapeSuccess && (
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
                    ✓ Đã cập nhật giá gốc: {priceJpy.toLocaleString()} ¥
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
                placeholder="VD: Kem chống nắng Anessa / Mô hình Gundam"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-banana-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                3. Danh Mục Hàng Hóa
              </label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-banana-500 focus:bg-white cursor-pointer"
              >
                <option value="cosmetics">🌸 Mỹ Phẩm & Chăm Sóc Da</option>
                <option value="health">🌿 Thực Phẩm Chức Năng & Sức Khỏe</option>
                <option value="gadgets">⚡ Gia Dụng & Điện Tử Mini</option>
                <option value="anime">🎎 Anime, Manga & Figure Chính Hãng</option>
                <option value="other">📦 Danh Mục Khác</option>
              </select>
            </div>
          </div>

          {/* Giá Yên & Cân Nặng */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex flex-wrap justify-between items-center gap-1 mb-2">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    4. Giá Gốc Tại Nhật (¥ Yên)
                  </label>
                  {isPriceLocked && (
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                      <span>🔒</span> Đã khóa giá sàn
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isPriceLocked && (
                    <button
                      type="button"
                      onClick={() => setIsPriceLocked(false)}
                      className="text-[11px] text-amber-600 hover:text-amber-700 hover:underline font-medium"
                      title="Bấm để mở khóa sửa nếu có coupon hoặc giá khác"
                    >
                      ✏️ Mở khóa sửa
                    </button>
                  )}
                  <span className="text-xs text-banana-700 font-bold">
                    ≈ {(priceJpy * exchangeRate).toLocaleString("vi-VN")} đ
                  </span>
                </div>
              </div>

              <div className="relative">
                <input
                  type="number"
                  min={100}
                  step={100}
                  value={priceJpy}
                  readOnly={isPriceLocked}
                  onChange={(e) => setPriceJpy(Math.max(0, Number(e.target.value)))}
                  className={`w-full pl-8 pr-9 py-2.5 rounded-xl text-sm font-bold focus:outline-none transition-all ${
                    isPriceLocked
                      ? "bg-slate-100 border border-slate-300 text-slate-700 cursor-not-allowed select-none"
                      : "bg-slate-50 border border-amber-400 text-slate-900 focus:ring-2 focus:ring-banana-500 focus:bg-white"
                  }`}
                />
                <span className="absolute left-3 top-2.5 text-slate-500 font-bold">¥</span>
                {isPriceLocked && (
                  <span className="absolute right-3 top-2.5 text-slate-400 text-xs" title="Giá đã khóa tự động từ website sàn Nhật">
                    🔒
                  </span>
                )}
              </div>

              {/* Cảnh báo khi người dùng tự mở khóa sửa giá thủ công */}
              {!isPriceLocked && scrapeSuccess && (
                <div className="mt-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-1.5 leading-snug">
                  <span className="shrink-0 text-amber-600 font-bold">⚠️</span>
                  <span>
                    <strong>Cảnh báo đối soát:</strong> Bạn đang tự sửa giá thủ công. Nhân viên văn phòng Tokyo sẽ kiểm tra lại giá niêm yết trên web gốc trước khi tiến hành thanh toán cho người bán.
                  </span>
                </div>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  5. Trọng Lượng Kiện Hàng
                </label>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  {weightKg > 0 ? `${weightKg} kg (Ước tính)` : "Cân đo thực tế tại kho"}
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                <div className="flex items-start space-x-2 text-slate-600">
                  <span className="text-blue-600 font-bold mt-0.5">ℹ️</span>
                  <span className="text-[11px] leading-relaxed">
                    Hệ thống <strong>không áp đặt số kg mặc định</strong> vào tiền cọc. Kiện hàng về kho Tokyo sẽ được cân đo chính xác theo gram để bảo đảm công bằng nhất.
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setShowWeightPreview(!showWeightPreview)}
                    className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center space-x-1 cursor-pointer"
                  >
                    <span>{showWeightPreview ? "▼ Thu gọn ước tính cước bay" : "▶ Bạn muốn ước tính thử cước bay trước? (Tùy chọn)"}</span>
                  </button>

                  {showWeightPreview && (
                    <div className="mt-2.5 pt-1 space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <label className="text-[11px] font-semibold text-slate-600">Nhập số kg bạn dự tính:</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={weightKg === 0 ? "" : weightKg}
                          onChange={(e) => setWeightKg(Math.max(0, parseFloat(e.target.value) || 0))}
                          placeholder="VD: 3.5"
                          className="w-24 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold font-mono focus:ring-2 focus:ring-banana-500 focus:outline-none"
                        />
                        <span className="text-xs font-bold text-slate-700">kg</span>
                        {weightKg > 0 && (
                          <button
                            type="button"
                            onClick={() => setWeightKg(0)}
                            className="text-[10px] text-rose-600 hover:underline ml-auto"
                          >
                            Xóa ước tính
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        * Chỉ để xem cước bay tham khảo. Tiền cọc mua hàng đợt 1 chỉ tính trên tiền hàng gốc.
                      </p>
                    </div>
                  )}
                </div>
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
                        Giá trị tiền hàng và phí dịch vụ ({calc.baseOrderCostVnd.toLocaleString("vi-VN")} đ, chưa gồm vận chuyển) chưa đạt mức tối thiểu ({MIN_ORDER_THRESHOLD_VND.toLocaleString("vi-VN")} đ)
                      </p>
                      <p className="text-slate-600">
                        👉 <strong>Giải pháp Chill:</strong> Hãy tích chọn <strong>"Gộp Đơn (Group Buy)"</strong> để ghép chung chuyến vận chuyển, nhận ưu đãi giảm 25% cước vận chuyển quốc tế!
                      </p>
                    </>
                  ) : (
                    <p className="font-bold text-emerald-900">
                      Đơn hàng đã đạt hạn mức tối thiểu và đủ điều kiện vận chuyển chuyên biệt!
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
                      Bật Chế Độ Gộp Đơn (Tiết kiệm 25% cước vận chuyển cho kiện &lt; 0.5kg)
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Realtime Price Breakdown with Live Rate */}
        <div className="lg:col-span-5 bg-navy-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between border border-slate-800">
          <div>
            <div className="flex justify-between items-center pb-4 border-b border-white/15">
              <span className="text-xs font-bold text-banana-400 uppercase tracking-wider flex items-center">
                <ShieldCheck className="w-4 h-4 mr-1 text-banana-400" />
                Bảng Kê Chi Phí Trọn Gói
              </span>
              <div className="flex items-center space-x-1.5 bg-white/10 px-2.5 py-1 rounded-full text-[11px] text-slate-300">
                <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
                <span>1 JPY = {exchangeRate} đ</span>
                <button onClick={loadLiveRate} title="Cập nhật tỷ giá live">
                  <RefreshCw className={`w-2.5 h-2.5 text-banana-300 ${rateLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
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
                  Cước bay quốc tế:
                  {isGroupBuy && <span className="ml-1 text-[10px] text-banana-300 bg-banana-900/60 px-1.5 rounded">-25% Gộp</span>}
                </span>
                <span className="font-medium text-emerald-400">
                  {weightKg > 0 ? `${calc.shippingFeeVnd.toLocaleString("vi-VN")} đ (${weightKg}kg tham khảo)` : "Cân đo thực tế khi về kho (0 đ)"}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Phụ phí hải quan & đóng gói:</span>
                <span className="font-medium text-emerald-400">0 đ (Miễn phí)</span>
              </div>
            </div>

            {/* Tổng tiền & Mức thanh toán đã chọn */}
            <div className="mt-6 pt-5 border-t border-white/15">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold text-slate-200">Tiền Hàng &amp; Phí Mua Hộ:</span>
                <div className="text-right">
                  <span className="text-2xl sm:text-3xl font-bold font-serif text-banana-400">
                    {calc.baseOrderCostVnd.toLocaleString("vi-VN")} <span className="text-base font-normal">đ</span>
                  </span>
                </div>
              </div>

              <div className="mt-2.5 flex justify-between items-center text-xs bg-white/10 p-3 rounded-2xl">
                <div>
                  <span className="text-slate-200 font-bold block">{depositChoice === "100" ? "Thanh toán 100%:" : "Đặt cọc 50%:"}</span>
                  <span className="text-[10px] text-emerald-400 font-medium">{depositChoice}% tiền hàng + phí mua hộ</span>
                </div>
                <strong className="text-banana-300 text-sm sm:text-base font-mono">
                  {(depositChoice === "50" ? calc.deposit50Vnd : calc.baseOrderCostVnd).toLocaleString("vi-VN")} đ
                </strong>
              </div>

              {/* Ghi chú minh bạch về cân nặng & cước bay */}
              <div className="mt-3 p-2.5 rounded-xl bg-banana-500/10 border border-banana-500/20 text-[11px] text-banana-200 flex items-start space-x-2">
                <Info className="w-4 h-4 text-banana-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  <strong>Chuẩn quốc tế:</strong> Bạn chỉ cần cọc tiền mua hàng. Cước bay quốc tế sẽ được cân đo chính xác khi kiện hàng về tới kho Tokyo/VN và thanh toán khi nhận hàng!
                </span>
              </div>

              {/* Chính sách bảo vệ rủi ro biến động giá */}
              <div className="mt-2 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-[11px] text-slate-300 flex items-start space-x-2">
                <span className="text-emerald-400 font-bold shrink-0 mt-0.5">🛡️</span>
                <span className="leading-relaxed">
                  <strong>Bảo vệ rủi ro giá:</strong> Nếu người bán Nhật đổi giá hoặc hết hàng sau khi cọc, ChillBanana sẽ liên hệ xác nhận ngay hoặc <strong>hoàn 100% tiền cọc</strong> trong 24h.
                </span>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="mt-8 space-y-2.5">
            {direction === "VN_TO_JP" ? (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-center space-y-2">
                <p className="text-sm font-bold text-amber-900">🇻🇳 ➔ 🇯🇵 Dịch Vụ Gửi Hàng Sang Nhật</p>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Dịch vụ gửi hàng từ Việt Nam sang Nhật cần nhân viên tư vấn trực tiếp. Vui lòng liên hệ qua Facebook hoặc Zalo để được hỗ trợ báo giá.
                </p>
                <a
                  href="https://m.me/chillbanana.vn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-1 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-all"
                >
                  💬 Nhắn Tin Tư Vấn Ngay
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    addToCart({
                      id: "calc-" + Date.now(),
                      name: productName || "Sản phẩm mua hộ Nhật Bản",
                      priceJpy,
                      priceVnd: calc.productPriceVnd,
                      weightKg,
                      imageUrl: productImage || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80",
                      originalStore: detectedStore || "Sàn thương mại Nhật Bản",
                      originalUrl: productUrl || undefined,
                      category,
                    });
                  }}
                  className="py-3.5 px-4 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs sm:text-sm border border-white/20 transition-all flex items-center justify-center space-x-1.5 hover:border-banana-400"
                >
                  <ShoppingCart className="w-4 h-4 text-banana-400" />
                  <span>Thêm Vào Giỏ Hàng</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowOrderModal(true)}
                  className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-banana-500 to-banana-600 hover:from-banana-600 hover:to-banana-700 text-navy-950 font-extrabold text-xs sm:text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-1.5 group"
                >
                  <span>Đặt Cọc & Mua Ngay</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                const chatToggle = document.getElementById("ai-chat-toggle-btn");
                if (chatToggle) chatToggle.click();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-banana-400" />
              <span>Hỏi ChillBanana AI tư vấn về sản phẩm này</span>
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
                    Đơn hàng: <strong>{productName || "Đơn hàng Nhật Bản"}</strong> — Tiền hàng &amp; phí: <strong>{calc.baseOrderCostVnd.toLocaleString("vi-VN")} đ</strong> (Cước bay cân thực tế khi về kho)
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
                          <p className="text-xs font-bold text-slate-800">Thanh toán 100% tiền hàng + phí mua hộ</p>
                          <p className="text-[11px] text-banana-800 font-bold">
                            {calc.baseOrderCostVnd.toLocaleString("vi-VN")} đ
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
              /* Màn hình hiển thị kết quả đặt hàng và nút VNPAY */
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

                {/* Thông tin thanh toán */}
                <div className="p-4 bg-slate-50 rounded-3xl border border-slate-200 max-w-sm mx-auto">
                  <div className="mt-3 text-xs space-y-2 text-slate-600 text-left bg-white p-3 rounded-xl border border-emerald-100 shadow-sm">
                    <div className="flex justify-between items-center">
                      <span>{orderSuccessData.isPriceVerified ? `Số tiền cần thanh toán (${orderSuccessData.depositPercent}%):` : "Mức thanh toán tạm tính:"}</span>
                      <strong className="text-banana-700 font-bold text-sm">{orderSuccessData.depositAmountVnd.toLocaleString("vi-VN")} đ</strong>
                    </div>
                    {orderSuccessData.isPriceVerified ? <p className="text-[11px] text-slate-500 italic mt-2 border-t pt-2 border-slate-100">Thanh toán qua VNPAY để hệ thống tự xác nhận. Nếu chuyển khoản VietQR, nhân viên sẽ đối chiếu giao dịch.</p> : <p className="text-[11px] text-amber-700 italic mt-2 border-t pt-2 border-slate-100">Đơn hàng cần được duyệt báo giá trước. Vui lòng chưa thanh toán; số tiền cuối cùng sẽ được cập nhật trên trang theo dõi.</p>}
                  </div>

                  {orderSuccessData.isPriceVerified && <button onClick={() => handleVnpayPayment(orderSuccessData)} disabled={isRedirecting} className="mt-4 w-full py-3 bg-[#0066CC] hover:bg-[#0052a3] text-white font-extrabold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60">{isRedirecting ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Đang chuyển đến VNPAY...</> : <><ExternalLink className="w-4 h-4" />Thanh Toán Qua VNPAY</>}</button>}
                </div>

                <div className="flex space-x-3 pt-2">
                  <a
                    href={`/tracking?orderCode=${orderSuccessData.orderCode}`}
                    className="flex-1 py-3 bg-navy-900 hover:bg-slate-800 text-white text-xs font-bold rounded-2xl transition-colors text-center flex items-center justify-center"
                  >
                    Tra Cứu Đơn Hàng (7 Bước)
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
