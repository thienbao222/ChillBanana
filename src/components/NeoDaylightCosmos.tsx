"use client";

import React, { useState, useEffect, useRef } from "react";
import { MotionConfig } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, ExternalLink, CreditCard, ShoppingCart } from "lucide-react";
import "@/styles/NeoDaylightCosmos.css";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import CuratedProducts from "@/components/CuratedProducts";
import WhyChooseUs from "@/components/WhyChooseUs";
import NewsCorner from "@/components/NewsCorner";
import { WebsitePreferencesTrigger } from "@/components/WebsitePreferencesPanel";
import { useWebsitePreferences, useWebsiteText } from "@/context/WebsitePreferencesContext";
import { DEFAULT_EXCHANGE_RATE } from "@/features/pricing/calculator";

// Bảng cấu hình danh mục hàng hóa & phụ phí thông quan
const CATEGORY_MAP: Record<string, { label: string; surchargePercent: number; suggestedWeight: number; note: string }> = {
  cosmetics: { label: "Mỹ Phẩm & Chăm Sóc Da", surchargePercent: 3, suggestedWeight: 0.3, note: "Phụ thu kiểm định mỹ phẩm 3%" },
  health: { label: "Thực Phẩm Chức Năng", surchargePercent: 3, suggestedWeight: 0.4, note: "Phụ thu kiểm định BYT 3%" },
  gadgets: { label: "Gia Dụng & Điện Tử Mini", surchargePercent: 5, suggestedWeight: 0.8, note: "Phụ thu kiểm định linh kiện/pin 5%" },
  anime: { label: "Anime, Figure & Sưu Tầm", surchargePercent: 0, suggestedWeight: 0.5, note: "Miễn phụ phí thông quan" },
};

export default function NeoDaylightCosmos() {
  const { totalItems, openCart, addToCart, pricingConfig } = useCart();
  const { customer, openAuthModal } = useAuth();
  const [showMini, setShowMini] = useState(false);
  const { preferences } = useWebsitePreferences();
  const t = useWebsiteText();
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  // Form quote state
  const [inputUrl, setInputUrl] = useState("");
  const [productName, setProductName] = useState("");
  const [productImage, setProductImage] = useState("");
  const [detectedStore, setDetectedStore] = useState("");
  const [category, setCategory] = useState("cosmetics");
  const [priceJpy, setPriceJpy] = useState<number>(3500);
  const [weightKg, setWeightKg] = useState<number>(0);
  const [isGroupBuy, setIsGroupBuy] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<"JP_VN" | "VN_JP">("JP_VN");

  // VN -> JP Form state
  const [vnJpSenderName, setVnJpSenderName] = useState("");
  const [vnJpSenderPhone, setVnJpSenderPhone] = useState("");
  const [vnJpCargoType, setVnJpCargoType] = useState("gift");
  const [vnJpWeightKg, setVnJpWeightKg] = useState<number>(2);
  const [vnJpCity, setVnJpCity] = useState("Tokyo");
  const [vnJpSubmitted, setVnJpSubmitted] = useState(false);

  // Order form state
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custNote, setCustNote] = useState("");
  const [depositChoice, setDepositChoice] = useState<"50" | "100">("50");
  const [policyAgreed, setPolicyAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirectingVnpay, setIsRedirectingVnpay] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Record<string, any> | null>(null);

  // Exchange rate state (live from API)
  const [exchangeRate, setExchangeRate] = useState<number>(DEFAULT_EXCHANGE_RATE);
  const [rateLabel, setRateLabel] = useState<string>(`${DEFAULT_EXCHANGE_RATE.toLocaleString("vi-VN")} đ`);

  // Parallax pointermove & scroll listeners
  useEffect(() => {
    if (!preferences.effectsEnabled) {
      document.documentElement.style.setProperty("--px", "0");
      document.documentElement.style.setProperty("--py", "0");
      return;
    }

    const handleMove = (e: MouseEvent) => {
      document.documentElement.style.setProperty("--px", (e.clientX / window.innerWidth - 0.5).toString());
      document.documentElement.style.setProperty("--py", (e.clientY / window.innerHeight - 0.5).toString());
    };

    const handleScroll = () => {
      setShowMini(window.scrollY > 320);
    };

    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [preferences.effectsEnabled]);

  // Fetch tỷ giá live từ API
  useEffect(() => {
    fetch("/api/exchange-rate")
      .then((r) => r.json())
      .then((data) => {
        if (data?.data?.roundedRate) {
          const rate = Number(data.data.roundedRate);
          setExchangeRate(rate);
          setRateLabel(`${rate.toLocaleString("vi-VN")} đ`);
        }
      })
      .catch(() => {/* fallback */});
  }, []);

  // Auto-fill customer info if logged in (dùng functional update để tránh thiếu deps)
  useEffect(() => {
    if (customer) {
      setCustName((prev) => prev || customer.name || "");
      setCustPhone((prev) => prev || customer.phone || "");
      setCustAddress((prev) => prev || customer.address || "");
      setCustEmail((prev) => prev || customer.email || "");
    }
  }, [customer]);

  useEffect(() => {
    const handleSelectProduct = (event: Event) => {
      const product = (event as CustomEvent<{
        name?: string;
        priceJpy?: number;
        imageUrl?: string;
        originalStore?: string;
        category?: string;
      }>).detail;

      if (!product) return;
      if (product.name) setProductName(product.name);
      if (typeof product.priceJpy === "number" && product.priceJpy > 0) setPriceJpy(Math.floor(product.priceJpy));
      if (product.imageUrl) setProductImage(product.imageUrl);
      if (product.originalStore) setDetectedStore(product.originalStore);
      if (product.category) setCategory(product.category);

      // A catalog item has no order URL, so do not reuse an unrelated old link.
      setInputUrl("");
      setShowOrderForm(false);
      setCreatedOrder(null);
    };

    window.addEventListener("chillbanana:select_product", handleSelectProduct);
    return () => window.removeEventListener("chillbanana:select_product", handleSelectProduct);
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToastMsg(null);
    }, 2800);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: preferences.effectsEnabled ? "smooth" : "auto", block: "start" });
    }
  };

  const handleOpenAIChat = () => {
    window.dispatchEvent(new CustomEvent("open-ai-chat"));
  };

  // Quét link tự động (kiểm tra client-side và fallback thân thiện)
  const handleScanLink = async () => {
    const trimmed = inputUrl.trim();
    if (!trimmed) {
      showToast("Vui lòng dán link sản phẩm (Amazon JP, Mercari, Rakuten...)");
      return;
    }
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      showToast("Đường dẫn không hợp lệ. Vui lòng nhập link đầy đủ (bắt đầu bằng https://).");
      return;
    }

    const isKnownJapanPlatform = /amazon\.(co\.jp|com)|mercari\.com|rakuten\.co\.jp|yahoo\.co\.jp|suruga-ya\.jp|uniqlo\.com|biccamera\.com|yodobashi\.com/i.test(trimmed);
    if (!isKnownJapanPlatform) {
      showToast("Hệ thống tối ưu cho các sàn Nhật. Bạn có thể thử quét hoặc nhập tay thông tin.");
    }

    setIsScanning(true);
    showToast("Đang bóc tách dữ liệu từ link...");
    try {
      const res = await fetch("/api/scrape-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        if (data.data.title) setProductName(data.data.title);
        if (data.data.priceJpy && data.data.priceJpy > 0) {
          setPriceJpy(Math.floor(Number(data.data.priceJpy)));
          showToast("Đã trích xuất thông tin sản phẩm và giá Yên!");
        } else {
          showToast("Đã nhận diện sản phẩm! Do sàn bảo mật giá, vui lòng nhập giá Yên (¥) vào ô bên dưới.");
        }
        if (data.data.imageUrl) setProductImage(data.data.imageUrl);
        if (data.data.storeName) setDetectedStore(data.data.storeName);
        if (data.data.category) setCategory(data.data.category);
      } else {
        showToast(data.error || "Không thể tự động bóc tách link này (do tường lửa bảo mật). Vui lòng nhập thông tin thủ công.");
      }
    } catch {
      showToast("Lỗi kết nối khi quét link. Bạn có thể nhập giá thủ công.");
    } finally {
      setIsScanning(false);
    }
  };

  // Tính toán chi phí theo tỷ giá live và danh mục
  const currentCategory = CATEGORY_MAP[category] || CATEGORY_MAP.cosmetics;
  const productPriceVnd = Math.round(priceJpy * exchangeRate);
  const serviceFeeVnd = Math.max(pricingConfig.serviceFeeMinimumVnd, Math.round(productPriceVnd * pricingConfig.serviceFeePercent / 100));
  const customsFeeVnd = Math.round(productPriceVnd * (currentCategory.surchargePercent / 100));
  const baseOrderCost = productPriceVnd + serviceFeeVnd + customsFeeVnd;

  // Cước bay quốc tế ước tính & tiết kiệm gộp đơn
  const standardShippingVnd = weightKg > 0 ? Math.round(weightKg * pricingConfig.airShippingPerKgVnd) : 0;
  const isGroupBuyEligible = isGroupBuy && weightKg > 0 && weightKg <= pricingConfig.groupBuyMaxWeightKg;
  const groupBuySavingsVnd = isGroupBuyEligible
    ? Math.round(weightKg * pricingConfig.airShippingPerKgVnd * (pricingConfig.groupBuyShippingDiscountPercent / 100))
    : 0;
  const estimatedShippingVnd = standardShippingVnd - groupBuySavingsVnd;
  const depositVnd = depositChoice === "100" ? baseOrderCost : Math.round(baseOrderCost * 0.5);

  // Thêm vào giỏ hàng
  const handleAddToCart = () => {
    if (!productName.trim() && !inputUrl.trim()) {
      showToast("Vui lòng dán link hoặc nhập tên món hàng.");
      return;
    }
    const added = addToCart({
      id: "calc-" + Date.now(),
      name: productName.trim() || "Sản phẩm mua hộ từ Nhật Bản",
      priceJpy,
      priceVnd: productPriceVnd,
      weightKg,
      imageUrl: productImage || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80",
      originalStore: detectedStore || "Sàn thương mại Nhật Bản",
      originalUrl: inputUrl.trim() || undefined,
      category,
    });
    if (added) {
      showToast("Đã thêm món hàng vào giỏ!");
      openCart();
    }
  };

  // Submit đặt cọc tạo đơn thật vào database
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custPhone.trim() || !custAddress.trim()) {
      showToast("Vui lòng điền đầy đủ Họ tên, Số điện thoại và Địa chỉ giao hàng.");
      return;
    }
    const phoneClean = custPhone.replace(/\s+/g, "");
    if (!/^(03|05|07|08|09)\d{8}$/.test(phoneClean)) {
      showToast("Số điện thoại không hợp lệ (cần đúng 10 số, đầu số 03, 05, 07, 08, 09).");
      return;
    }
    if (custEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(custEmail.trim())) {
      showToast("Định dạng email không hợp lệ. Vui lòng kiểm tra lại.");
      return;
    }
    if (!policyAgreed) {
      showToast("Vui lòng tích chọn đồng ý với Chính sách mua hộ & đặt cọc.");
      return;
    }
    if (!inputUrl.trim()) {
      showToast("Vui lòng dán link sản phẩm trước khi tạo đơn đặt cọc.");
      return;
    }
    if (priceJpy < 100 || !Number.isInteger(priceJpy)) {
      showToast("Giá sản phẩm tối thiểu là 100 JPY và phải là số nguyên (đồng Yên không có số thập phân).");
      return;
    }
    if (baseOrderCost < pricingConfig.minimumBaseOrderVnd) {
      showToast(`Giá trị đơn hàng tối thiểu là ${pricingConfig.minimumBaseOrderVnd.toLocaleString("vi-VN")} đ để đủ điều kiện mua hộ.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: custName.trim(),
          customerPhone: phoneClean,
          customerAddress: custAddress.trim(),
          customerEmail: custEmail.trim() || undefined,
          customerNote: custNote.trim() || undefined,
          productName: productName.trim() || "Đơn mua hộ từ Nhật Bản",
          originalUrl: inputUrl.trim(),
          priceJpy,
          weightKg,
          category,
          isGroupBuy,
          depositPercent: Number(depositChoice),
          items: [],
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.order) {
        setCreatedOrder(data.order);
        showToast(data.order.isPriceVerified ? "Tạo đơn thành công. Bạn có thể thanh toán ngay." : "Đơn đã được tạo và đang chờ xác nhận báo giá trước khi thanh toán.");
      } else {
        showToast(data.error || "Đặt cọc thất bại. Vui lòng kiểm tra lại thông tin.");
      }
    } catch {
      showToast("Lỗi kết nối máy chủ. Vui lòng thử lại sau.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Thanh toán VNPAY trực tuyến
  const handlePayVnpay = async () => {
    if (!createdOrder) return;
    setIsRedirectingVnpay(true);
    showToast("Đang kết nối cổng thanh toán VNPAY...");
    try {
      const res = await fetch("/api/payment/vnpay-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode: createdOrder.orderCode,
          amount: createdOrder.depositAmountVnd || depositVnd,
          orderInfo: `Thanh toan ${createdOrder.depositPercent || 50}% don hang ${createdOrder.orderCode} - ChillBanana`,
        }),
      });
      const data = await res.json();
      if (data.success && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        showToast(data.error || "Không thể tạo liên kết thanh toán VNPAY.");
        setIsRedirectingVnpay(false);
      }
    } catch {
      showToast("Lỗi kết nối cổng VNPAY. Vui lòng chuyển khoản VietQR.");
      setIsRedirectingVnpay(false);
    }
  };

  return (
  <MotionConfig reducedMotion={preferences.effectsEnabled ? "never" : "always"}>
    <div className={`cosmos-root cosmos-home ${preferences.effectsEnabled ? "" : "calm"}`}>
      {/* Nền trời vũ trụ ban ngày */}
      <div className="sky" aria-hidden="true">
        <div className="sun par" style={{ "--k": 6 } as any} />
        <div className="cloud cloud--cyan par" style={{ "--k": 12, left: "-5vw", top: "12vh" } as any} />
        <div className="cloud cloud--violet par" style={{ "--k": 18, left: "28vw", top: "35vh", animationDuration: "74s" } as any} />
        <div className="cloud cloud--rose par" style={{ "--k": 10, left: "69vw", top: "18vh", animationDuration: "68s" } as any} />
        <div className="cloud cloud--mint par" style={{ "--k": 16, left: "58vw", top: "61vh", animationDuration: "82s" } as any} />
        <div className="cloud cloud--blue par" style={{ "--k": 14, left: "4vw", top: "72vh", animationDuration: "76s" } as any} />
        <div className="cloud cloud--peach par" style={{ "--k": 20, left: "37vw", top: "83vh", animationDuration: "88s" } as any} />
        <div className="cloud cloud--banana par" style={{ "--k": 9, left: "23vw", top: "54vh", animationDuration: "96s" } as any} />
        <div className="cloud cloud--coral par" style={{ "--k": 17, left: "81vw", top: "82vh", animationDuration: "84s" } as any} />
        <div id="sparks">
          {Array.from({ length: 72 }).map((_, i) => (
            <div
              key={i}
              className="sp"
              style={{
                left: `${((i * 61.8034) + 11) % 100}%`,
                top: `${((i * 37.211) + ((i % 5) * 7.3) + 7) % 96}%`,
                width: `${2 + ((i * 7) % 6)}px`,
                height: `${2 + ((i * 7) % 6)}px`,
                animationDelay: `-${(i * 0.27).toFixed(1)}s`,
                animationDuration: `${2.5 + (i % 4)}s`,
                background: ["#fff9df", "#9ce8ff", "#ffc4e0", "#d5c5ff", "#ffe58a", "#a5f4de", "#ffffff"][i % 7],
              }}
            />
          ))}
        </div>
        <div className="comet comet--banana" />
        <div className="comet comet--cyan" />
      </div>

      {/* SVG Icon Definitions */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <symbol id="i-link" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" /></symbol>
          <symbol id="i-bag" viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2" /></symbol>
          <symbol id="i-box" viewBox="0 0 24 24"><path d="M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10" /></symbol>
          <symbol id="i-book" viewBox="0 0 24 24"><path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v13c-3-1-6-1-8 1-2-2-5-2-8-1zM12 6v13" /></symbol>
          <symbol id="i-ok" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" /></symbol>
          <symbol id="i-ai" viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></symbol>
          <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></symbol>
        </defs>
      </svg>

      {/* HEADER: Logo cụm hành tinh & quỹ đạo */}
      <header id="hd">
        <div className="top">
          {/* Cụm Quỹ Đạo Hành Tinh (Cluster Nav) */}
          <nav className="card cluster" aria-label={t("Danh mục chính")}>
            <Link className="logo" href="/" aria-label="ChillBanana - trang chủ">
              <svg viewBox="0 0 64 64" aria-hidden="true">
                <path d="M17 43c2-17 15-27 33-27-9 5-14 12-15 24-5 5-13 6-18 3z" fill="#fff3a8" stroke="#c98a00" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M50 16l3-3" stroke="#8a5a00" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </Link>

            {/* Quỹ đạo 1: Dán link */}
            <div className="ring r1" style={{ "--c": "#f2c21b", "--n": 0 } as any}>
              <div className="spin">
                <a className="pl" href="#quote" onClick={(e) => { e.preventDefault(); scrollToSection("quote"); }}>
                  <i><svg><use href="#i-link" /></svg></i>{t("Dán Link Tính Giá")}
                </a>
              </div>
            </div>

            {/* Quỹ đạo 2: Sản phẩm có sẵn */}
            <div className="ring r2" style={{ "--c": "#4aaee0", "--n": 1 } as any}>
              <div className="spin">
                <a className="pl" href="#stock" onClick={(e) => { e.preventDefault(); scrollToSection("stock"); }}>
                  <i><svg><use href="#i-bag" /></svg></i>{t("Sản Phẩm Có Sẵn")}
                </a>
              </div>
            </div>

            {/* Quỹ đạo 3: Tra cứu */}
            <div className="ring r3" style={{ "--c": "#a58bff", "--n": 2 } as any}>
              <div className="spin">
                <Link className="pl" href="/tracking">
                  <i><svg><use href="#i-box" /></svg></i>{t("Tra Cứu Đơn Hàng")}
                </Link>
              </div>
            </div>

            {/* Quỹ đạo 4: Cẩm nang */}
            <div className="ring r4" style={{ "--c": "#4fcf9b", "--n": 3 } as any}>
              <div className="spin">
                <a className="pl" href="#news" onClick={(e) => { e.preventDefault(); scrollToSection("news"); }}>
                  <i><svg><use href="#i-book" /></svg></i>{t("Cẩm Nang Hàng Nhật")}
                </a>
              </div>
            </div>

            {/* Quỹ đạo 5: AI Agent */}
            <div className="ring r5" style={{ "--c": "#ff8fb8", "--n": 4 } as any}>
              <div className="spin">
                <a className="pl" href="#" onClick={(e) => { e.preventDefault(); handleOpenAIChat(); }}>
                  <i><svg><use href="#i-ai" /></svg></i>ChillBanana AI
                </a>
              </div>
            </div>
          </nav>

          {/* Cụm thông tin tài khoản & thống kê */}
          <div className="card side">
            <div className="sidehead">
              <div className="brand">
                <b>Chill<i>Banana</i></b>
                <span className="jp">JP ⇄ VN</span>
                <small>Mua hàng Nhật chuẩn – Thư thái &amp; Thảnh thơi</small>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <Link className="admin" href="/admin/login">
                  {t("Admin Portal")}
                </Link>
                <Link
                  href="/classic"
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/75 px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-white hover:text-slate-900"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>{t("Về giao diện cũ")}</span>
                </Link>
              </div>
            </div>

            <div className="acct">
              <button className="chip" onClick={openCart}>
                {t("Giỏ hàng")}
                <span className="badge">{totalItems}</span>
              </button>
              {customer ? (
                <Link href="/profile" className="chip" title={customer.email}>
                  👤 {customer.name || t("Tài khoản")}
                </Link>
              ) : (
                <button className="chip" onClick={() => openAuthModal("login")}>
                {t("Đăng nhập ▾")}
                </button>
              )}
              <WebsitePreferencesTrigger />
              <button className="cta" onClick={() => scrollToSection("quote")}>
                {t("Đặt Mua Hộ Ngay")}
              </button>
            </div>

            <div className="stats">
              <div className="stat">
                <b>{rateLabel}</b>
                {t("1 JPY · Tỷ giá live")}
              </div>
              <div className="stat">
                <b>100%</b>
                Bảo hiểm hàng hóa
              </div>
              <div className="stat">
                <b>1900 6868</b>
                Hotline 8h–22h
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Thanh Mini Header khi cuộn chuột xuống */}
      <nav className={`mini ${showMini ? "on" : ""}`} id="mini" aria-label={t("Điều hướng nhanh")}>
        <Link className="mlogo" href="/" aria-label="ChillBanana" />
        <a className="mp" href="#quote" onClick={(e) => { e.preventDefault(); scrollToSection("quote"); }} title={t("Dán Link Tính Giá")} style={{ "--c": "#f2c21b" } as any}>
          <i><svg><use href="#i-link" /></svg></i>
        </a>
        <a className="mp" href="#stock" onClick={(e) => { e.preventDefault(); scrollToSection("stock"); }} title="Sản Phẩm Có Sẵn" style={{ "--c": "#4aaee0" } as any}>
          <i><svg><use href="#i-bag" /></svg></i>
        </a>
        <Link className="mp" href="/tracking" title={t("Tra Cứu Đơn Hàng")} style={{ "--c": "#a58bff" } as any}>
          <i><svg><use href="#i-box" /></svg></i>
        </Link>
        <a className="mp" href="#news" onClick={(e) => { e.preventDefault(); scrollToSection("news"); }} title={t("Cẩm Nang Hàng Nhật")} style={{ "--c": "#4fcf9b" } as any}>
          <i><svg><use href="#i-book" /></svg></i>
        </a>
        <button className="cta" onClick={() => scrollToSection("quote")}>
          {t("Đặt Mua Hộ Ngay")}
        </button>
      </nav>

      {/* NỘI DUNG CHÍNH (MAIN) */}
      <main>
        {/* HERO SECTION */}
        <section className="hero">
          <div>
            <span className="tag">{t("Mua Hàng Nhật Chuẩn – Thư Thái Cùng ChillBanana · JP")}</span>
            <h1>{t("Ủy Thác Mua Hộ Hàng Nhật ")}<u>{t("Tự Động Bóc Tách Link")}</u> &amp; <em>{t("ChillBanana AI")}</em></h1>
            <p className="lead">
              {preferences.language === "ja"
                ? "Amazon JP、Mercari、Rakuten、Yahoo Auctionsの商品リンクを貼り付けると、実際の円価格と銀行為替レートに基づく費用を自動で計算します。ChillBanana AIが24時間サポートし、まとめ買いで送料を節約できます。"
                : <>Dán link từ <b>Amazon JP, Mercari, Rakuten, Yahoo Auctions</b> — hệ thống hỗ trợ ước tính chi phí theo tỷ giá hiện hành, tích hợp <b>Trợ lý ChillBanana AI Agent</b> tư vấn và giải pháp <b>Gộp đơn tiết kiệm {pricingConfig.groupBuyShippingDiscountPercent}% cước</b>.</>}
            </p>
            <div className="trust">
              <span><svg><use href="#i-ok" /></svg>{preferences.language === "ja" ? "日本国内正規品をお届け" : "Cam kết 100% chính hãng nội địa Nhật"}</span>
              <span><svg><use href="#i-ok" /></svg>{preferences.language === "ja" ? "為替レートを随時更新" : "Tỷ giá cập nhật liên tục theo thời gian thực"}</span>
              <span><svg><use href="#i-ok" /></svg>{preferences.language === "ja" ? "紛失・破損時は補償" : "Bảo hiểm đền bù 100% khi mất mát, bể vỡ"}</span>
            </div>
            <a className="cta lg" href="#quote" onClick={(e) => { e.preventDefault(); scrollToSection("quote"); }}>
              {t("Dán Link Tính Giá Tự Động")} <svg><use href="#i-arrow" /></svg>
            </a>
          </div>

          <div className="card agent">
            <div className="ah">
              <span className="mlogo" />
              <div>
                <b>ChillBanana Gemini AI Agent</b>
                <small>● Google AI Studio Connected</small>
              </div>
              <button
                className="chip ai"
                onClick={handleOpenAIChat}
                title="Bấm để chat trực tiếp"
              >
                Hỏi Neo AI 💬
              </button>
            </div>
            <div className="q">
              <b>Khách hàng hỏi:</b>
              &quot;Mình muốn mua mô hình Gundam RG RX-78-2 Ver 2.0 trên Amazon Nhật, bên bạn có nhận mua hộ không và bảo quản hộp seal thế nào?&quot;
            </div>
            <div className="a">
              <b>ChillBanana AI:</b>
              &quot;Dạ chào bạn! ChillBanana chuyên săn deal Gunpla Bandai và Figure chính hãng từ Amazon JP/Surugaya. Mọi kiện hàng đều được bọc xốp bóng khí 4 lớp, bảo vệ hộp nguyên seal. Bạn chỉ cần dán link vào ô tính giá là hệ thống tự động bóc tách giá Yên và tính chi phí trọn gói ngay ạ!&quot;
            </div>
            <div className="af">
              <b>Guardrail chuyên sâu mua sắm Nhật – Việt</b>
              <button
                style={{ background: "none", border: "none", color: "var(--blue-d)", cursor: "pointer", fontWeight: 800 }}
                onClick={handleOpenAIChat}
              >
                Mở khung tư vấn 24/7 ↗
              </button>
            </div>
          </div>
        </section>

        {/* QUOTE SECTION (DÁN LINK & TÍNH GIÁ) */}
        <section className="sec" id="quote">
          <div className="center">
            <span className="tag">{t("Công Cụ Tự Động Bóc Tách Link & Báo Giá Trọn Gói")}</span>
            <h2>{t("Dán Link Nhật - ChillBanana Báo Giá Trong 3 Giây")}</h2>
            <p className="sub">
              Hỗ trợ bóc tách tự động link từ Amazon JP, Mercari, Rakuten, Yahoo Auctions... Tỷ giá cập nhật liên tục, cước vận chuyển minh bạch, bảo hiểm 100%.
            </p>
          </div>

          <div className="tabs" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === "JP_VN"}
              onClick={() => setActiveTab("JP_VN")}
            >
              {t("JP → VN · Mua Hàng Từ Nhật Về Việt Nam")}
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "VN_JP"}
              onClick={() => setActiveTab("VN_JP")}
            >
              {t("VN → JP · Gửi Quà / Hàng Sang Nhật Bản")}
            </button>
          </div>

          {activeTab === "VN_JP" ? (
            <div className="card" style={{ maxWidth: "880px", margin: "0 auto", padding: "32px", background: "rgba(255,255,255,0.95)" }}>
              {/* Header tuyến VN -> JP */}
              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "1.5rem" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem" }}>
                  🇻🇳➔🇯🇵
                </div>
                <div>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0 }}>
                    Tuyến Vận Chuyển Hàng & Quà Tặng Từ Việt Nam Sang Nhật Bản
                  </h3>
                  <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
                    Bay thẳng hàng không Tân Sơn Nhất / Nội Bài ➔ Sân bay Tokyo (Haneda/Narita), Osaka (KIX). Thời gian giao tận tay người nhận: 2 – 4 ngày làm việc.
                  </p>
                </div>
              </div>

              {/* Bảng biểu phí VN -> JP */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "2rem" }}>
                <div style={{ padding: "16px", borderRadius: "16px", border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                  <b style={{ display: "block", color: "var(--blue-d)", fontSize: "0.9rem" }}>📦 Kiện Quà / Đồ Khô / Quần Áo</b>
                  <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--ink)", margin: "6px 0" }}>
                    180.000 <small style={{ fontSize: "0.8rem" }}>đ / kg</small>
                  </div>
                  <small style={{ color: "var(--muted)", display: "block" }}>Từ 1kg trở lên · Miễn phí đóng thùng carton đạt chuẩn bay</small>
                </div>
                <div style={{ padding: "16px", borderRadius: "16px", border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                  <b style={{ display: "#d97706", color: "#d97706", fontSize: "0.9rem" }}>⚡ Chuyển Phát Hỏa Tốc EMS</b>
                  <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--ink)", margin: "6px 0" }}>
                    210.000 <small style={{ fontSize: "0.8rem" }}>đ / kg</small>
                  </div>
                  <small style={{ color: "var(--muted)", display: "block" }}>Hồ sơ du học, giấy tờ, hợp đồng · Giao trong 48h tại Tokyo/Osaka</small>
                </div>
                <div style={{ padding: "16px", borderRadius: "16px", border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                  <b style={{ display: "block", color: "#16a34a", fontSize: "0.9rem" }}>🍲 Thực Phẩm & Đặc Sản Quê</b>
                  <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--ink)", margin: "6px 0" }}>
                    220.000 <small style={{ fontSize: "0.8rem" }}>đ / kg</small>
                  </div>
                  <small style={{ color: "var(--muted)", display: "block" }}>Cà phê, trà, bánh pía, đồ khô có tem nhãn · Hỗ trợ thủ tục kiểm dịch</small>
                </div>
              </div>

              {/* Form nhận báo giá VN -> JP */}
              {!vnJpSubmitted ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!vnJpSenderName.trim() || !vnJpSenderPhone.trim()) {
                      showToast("Vui lòng điền họ tên và số điện thoại liên hệ.");
                      return;
                    }
                    if (!/^(03|05|07|08|09)\d{8}$/.test(vnJpSenderPhone.replace(/\s+/g, ""))) {
                      showToast("Số điện thoại không hợp lệ (10 số, đầu 03, 05, 07, 08, 09).");
                      return;
                    }
                    setVnJpSubmitted(true);
                    showToast("Đã tiếp nhận yêu cầu gửi hàng sang Nhật! Điều phối viên ChillBanana sẽ gọi bạn trong 15 phút.");
                  }}
                  style={{ borderTop: "1px dashed #cbd5e1", paddingTop: "1.5rem" }}
                >
                  <h4 style={{ fontWeight: 800, fontSize: "1.05rem", marginBottom: "1rem" }}>
                    Đăng Ký Nhận Báo Giá Tuyến VN ➔ JP & Điều Phối Lấy Hàng Tận Nơi
                  </h4>
                  <div className="fg" style={{ marginBottom: "12px" }}>
                    <div className="f">
                      <label>Họ tên người gửi tại Việt Nam *</label>
                      <input
                        placeholder="VD: Trần Hoàng Long"
                        value={vnJpSenderName}
                        onChange={(e) => setVnJpSenderName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="f">
                      <label>Số điện thoại / Zalo người gửi *</label>
                      <input
                        placeholder="0912 345 678"
                        value={vnJpSenderPhone}
                        onChange={(e) => setVnJpSenderPhone(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="fg" style={{ marginBottom: "12px" }}>
                    <div className="f">
                      <label>Loại mặt hàng gửi sang Nhật</label>
                      <select value={vnJpCargoType} onChange={(e) => setVnJpCargoType(e.target.value)}>
                        <option value="gift">Quà biếu / Quần áo / Đồ dùng cá nhân</option>
                        <option value="food">Thực phẩm khô / Bánh kẹo / Cà phê / Trà</option>
                        <option value="doc">Tài liệu / Hồ sơ du học / Bằng cấp</option>
                        <option value="other">Hàng mẫu kinh doanh / Mặt hàng khác</option>
                      </select>
                    </div>
                    <div className="f">
                      <label>Trọng lượng ước tính (kg)</label>
                      <input
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={vnJpWeightKg}
                        onChange={(e) => setVnJpWeightKg(Math.max(0.5, Number(e.target.value) || 0.5))}
                      />
                    </div>
                    <div className="f">
                      <label>Tỉnh/Thành người nhận tại Nhật Bản</label>
                      <select value={vnJpCity} onChange={(e) => setVnJpCity(e.target.value)}>
                        <option value="Tokyo">Tokyo (東京都)</option>
                        <option value="Osaka">Osaka (大阪府)</option>
                        <option value="Kanagawa">Kanagawa (神奈川県 - Yokohama)</option>
                        <option value="Aichi">Aichi (愛知県 - Nagoya)</option>
                        <option value="Saitama">Saitama (埼玉県)</option>
                        <option value="Chiba">Chiba (千葉県)</option>
                        <option value="Fukuoka">Fukuoka (福岡県)</option>
                        <option value="Other">Tỉnh thành khác tại Nhật</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "1.2rem", flexWrap: "wrap" }}>
                    <button className="cta" type="submit">
                      Gửi Yêu Cầu Báo Giá & Đón Hàng <svg><use href="#i-arrow" /></svg>
                    </button>
                    <a
                      href="tel:19006868"
                      className="btn2"
                      style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      📞 Hotline 1900 6868 (Miễn cước)
                    </a>
                  </div>
                </form>
              ) : (
                <div style={{ padding: "20px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "16px", textAlign: "center", marginTop: "1.5rem" }}>
                  <div style={{ fontSize: "1.8rem", marginBottom: "8px" }}>✅</div>
                  <h4 style={{ fontWeight: 800, color: "#166534", margin: "0 0 6px" }}>
                    Đã Ghi Nhận Yêu Cầu Gửi Hàng Tuyến VN ➔ JP!
                  </h4>
                  <p style={{ color: "#15803d", fontSize: "0.85rem", margin: "0 0 12px" }}>
                    Nhân viên điều phối ChillBanana sẽ gọi điện tới số <b>{vnJpSenderPhone}</b> trong ít phút để xác nhận điểm lấy hàng và quy cách đóng gói cho bạn.
                  </p>
                  <button
                    type="button"
                    className="btn2"
                    onClick={() => {
                      setVnJpSubmitted(false);
                      setVnJpSenderName("");
                      setVnJpSenderPhone("");
                    }}
                  >
                    Gửi yêu cầu kiện khác
                  </button>
                </div>
              )}
            </div>
          ) : (
          <div className="qgrid">
            {/* Form nhập liệu */}
            <form className="card form" onSubmit={(e) => e.preventDefault()}>
              <div className="f">
                <label htmlFor="u">
                  {t("1. Dán đường dẫn link sản phẩm Nhật Bản")} <em>{t("Tự động lấy Tên, Ảnh & Giá Yên")}</em>
                </label>
                <div className="in">
                  <input
                    id="u"
                    inputMode="url"
                    placeholder={t("https://www.amazon.co.jp/... hoặc https://jp.mercari.com/...")}
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                  />
                  <button
                    className="scan"
                    type="button"
                    disabled={isScanning}
                    onClick={handleScanLink}
                  >
                    {isScanning ? t("Đang quét...") : t("Quét Link Tự Động")}
                  </button>
                </div>
              </div>

              {/* Preview sản phẩm cào được nếu có */}
              {productImage && (
                <div style={{ display: "flex", gap: "12px", alignItems: "center", padding: "10px", background: "rgba(255,255,255,0.7)", borderRadius: "16px", border: "1px solid rgba(0,0,0,0.06)" }}>
                  <img
                    src={productImage}
                    alt={productName}
                    style={{ width: "54px", height: "54px", objectFit: "contain", borderRadius: "10px", background: "#fff" }}
                  />
                  <div style={{ flex: 1, minWidth: 0, fontSize: "0.82rem" }}>
                    <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {productName}
                    </b>
                    <small style={{ color: "var(--muted)" }}>
                      Nguồn: <b>{detectedStore || "Sàn Nhật"}</b> · Giá web: <b>{priceJpy.toLocaleString("vi-VN")} ¥</b>
                    </small>
                  </div>
                </div>
              )}

              <div className="fg">
                <div className="f">
                  <label htmlFor="n">{t("2. Tên sản phẩm (hiển thị trên đơn)")}</label>
                  <input
                    id="n"
                    placeholder={t("VD: Kem chống nắng Anessa / Mô hình Gundam")}
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                  />
                </div>
                <div className="f">
                  <label htmlFor="c">
                    {t("3. Danh mục hàng hóa")} <em>({currentCategory.note})</em>
                  </label>
                  <select id="c" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="cosmetics">{t("Mỹ Phẩm & Chăm Sóc Da (+3% phụ thu HQ)")}</option>
                    <option value="health">{t("Thực Phẩm Chức Năng (+3% kiểm dịch)")}</option>
                    <option value="gadgets">{t("Gia Dụng & Điện Tử Mini (+5% an toàn pin)")}</option>
                    <option value="anime">{t("Anime, Figure & Sưu Tầm (0% Miễn phí HQ)")}</option>
                  </select>
                </div>
              </div>

              <div className="fg">
                <div className="f">
                  <label htmlFor="y">
                    {t("4. Giá gốc tại Nhật (¥ Yên)")} <em>≈ {productPriceVnd.toLocaleString("vi-VN")} đ (Tối thiểu 100 ¥)</em>
                  </label>
                  <input
                    id="y"
                    type="number"
                    min={100}
                    step={1}
                    value={priceJpy}
                    onChange={(e) => {
                      const v = parseInt(e.target.value.replace(/\D/g, ""), 10) || 0;
                      setPriceJpy(Math.max(0, v));
                    }}
                  />
                </div>
                <div className="f">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label>{t("5. Trọng lượng kiện hàng (kg)")}</label>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      {weightKg > 0 ? `${weightKg} kg (Ước tính)` : "0 kg (Chờ cân kho)"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                    {[
                      { label: "0 kg (Kho cân)", w: 0 },
                      { label: "0.3 kg (Mỹ phẩm)", w: 0.3 },
                      { label: "0.5 kg (Figure/Giày)", w: 0.5 },
                      { label: "1.0 kg (Điện tử)", w: 1.0 },
                    ].map((chip) => (
                      <button
                        key={chip.w}
                        type="button"
                        onClick={() => setWeightKg(chip.w)}
                        style={{
                          fontSize: "0.75rem",
                          padding: "4px 8px",
                          borderRadius: "8px",
                          border: weightKg === chip.w ? "1.5px solid var(--blue-d)" : "1px solid #cbd5e1",
                          background: weightKg === chip.w ? "rgba(74, 174, 224, 0.15)" : "#fff",
                          color: weightKg === chip.w ? "var(--blue-d)" : "var(--ink)",
                          fontWeight: weightKg === chip.w ? 700 : 500,
                          cursor: "pointer",
                        }}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="merge">
                <input
                  type="checkbox"
                  checked={isGroupBuy}
                  onChange={(e) => setIsGroupBuy(e.target.checked)}
                />
                <span>
                  <b>{t("Đơn hàng đã đạt hạn mức tối thiểu và đủ điều kiện vận chuyển chuyên biệt!")}</b><br />
                  {`Bật Chế Độ Gộp Đơn (Tiết kiệm ${pricingConfig.groupBuyShippingDiscountPercent}% cước vận chuyển cho kiện ≤ ${pricingConfig.groupBuyMaxWeightKg}kg)`}
                </span>
              </label>
            </form>

            {/* Bảng kê chi phí trọn gói */}
            <aside className="sheet" aria-label="Bảng kê chi phí">
              <div className="sh">
                <h3>{t("Bảng kê chi phí trọn gói")}</h3>
                <span>1 JPY = {exchangeRate} đ</span>
              </div>
              <div className="row">
                <span>{t("Tiền hàng gốc")} ({priceJpy.toLocaleString("vi-VN")} ¥):</span>
                <b>{productPriceVnd.toLocaleString("vi-VN")} đ</b>
              </div>
              <div className="row">
                <span>{`Phí mua hộ & bảo hiểm (${pricingConfig.serviceFeePercent}%):`}</span>
                <b>{serviceFeeVnd.toLocaleString("vi-VN")} đ</b>
              </div>
              <div className="row">
                <span>{`Phụ phí hải quan (${currentCategory.label}):`}</span>
                <b className={customsFeeVnd > 0 ? "" : "ok"}>
                  {customsFeeVnd > 0 ? `${customsFeeVnd.toLocaleString("vi-VN")} đ (+${currentCategory.surchargePercent}%)` : "0 đ (Miễn phí)"}
                </b>
              </div>
              <div className="row">
                <span>{t("Cước bay quốc tế (ước tính):")}</span>
                <b className="ok">
                  {weightKg > 0
                    ? (isGroupBuyEligible
                        ? `${estimatedShippingVnd.toLocaleString("vi-VN")} đ (-${pricingConfig.groupBuyShippingDiscountPercent}% Gộp)`
                        : `${standardShippingVnd.toLocaleString("vi-VN")} đ`)
                    : "0 đ (Cân đo thực tế khi về kho)"}
                </b>
              </div>
              {isGroupBuyEligible && (
                <div className="row" style={{ color: "#16a34a", fontSize: "0.8rem", fontWeight: 700 }}>
                  <span>🎉 Tiết kiệm từ Gộp Đơn:</span>
                  <b>-{groupBuySavingsVnd.toLocaleString("vi-VN")} đ</b>
                </div>
              )}
              <div className="total">
                <span>{t("Tiền Hàng & Phí Mua Hộ:")}</span>
                <b>{baseOrderCost.toLocaleString("vi-VN")} <small>đ</small></b>
              </div>
              <div className="dep">
                <span>{preferences.language === "ja" ? `お支払い予定額（${depositChoice}%）：` : `Ước tính thanh toán (${depositChoice}%):`}<small>{t("Chờ ChillBanana duyệt giá trước khi thanh toán")}</small></span>
                <b>{depositVnd.toLocaleString("vi-VN")} đ</b>
              </div>
              <p className="n1">
                <b>{t("Chuẩn quốc tế:")}</b> {t("Bạn chỉ cần cọc tiền mua hàng. Cước bay quốc tế sẽ được cân đo chính xác khi kiện hàng về tới kho Tokyo/VN và thanh toán khi nhận hàng!")}
              </p>

              {!showOrderForm && !createdOrder && (
                <div className="bt">
                  <button
                    className="btn2"
                    type="button"
                    onClick={handleAddToCart}
                    title={t("Gom vào giỏ hàng để đặt nhiều món cùng lúc")}
                  >
                    <ShoppingCart className="w-4 h-4 inline mr-1" />
                    {t("Thêm Vào Giỏ Hàng")}
                  </button>
                  <button
                    className="cta"
                    type="button"
                    onClick={() => {
                      if (!inputUrl.trim()) {
                        showToast(t("Vui lòng dán link sản phẩm trước."));
                        scrollToSection("quote");
                        return;
                      }
                      setShowOrderForm(true);
                      setTimeout(() => scrollToSection("order-form"), 150);
                    }}
                  >
                    {t("Đặt Cọc & Mua Ngay")} <svg><use href="#i-arrow" /></svg>
                  </button>
                </div>
              )}
            </aside>
          </div>
          )}

          {/* Form đặt cọc mở rộng */}
          {showOrderForm && !createdOrder && (
            <div id="order-form" style={{ marginTop: "2.5rem" }}>
              <form
                className="card form"
                style={{ maxWidth: "680px", margin: "0 auto", padding: "28px" }}
                onSubmit={handleSubmitOrder}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 800 }}>
                    {t("Thông tin giao nhận & Đặt cọc")}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowOrderForm(false)}
                    style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "0.85rem" }}
                  >
                    {t("✕ Đóng form")}
                  </button>
                </div>

                <div className="fg">
                  <div className="f">
                    <label>{t("Họ và tên người nhận *")}</label>
                    <input
                      placeholder={t("Nguyễn Văn A")}
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="f">
                    <label>{t("Số điện thoại nhận hàng *")} <small style={{ color: "var(--muted)", fontWeight: "normal" }}>(10 số, đầu 03/05/07/08/09)</small></label>
                    <input
                      placeholder="0901 234 567"
                      value={custPhone}
                      onChange={(e) => setCustPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="f">
                  <label>{t("Địa chỉ nhận hàng tại Việt Nam *")}</label>
                  <input
                    placeholder={t("Số nhà, tên đường, Phường/Xã, Quận/Huyện, Tỉnh/TP")}
                    value={custAddress}
                    onChange={(e) => setCustAddress(e.target.value)}
                    required
                  />
                </div>

                <div className="fg">
                  <div className="f">
                    <label>Email (nhận xác nhận &amp; hóa đơn điện tử)</label>
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={custEmail}
                      onChange={(e) => setCustEmail(e.target.value)}
                    />
                  </div>
                  <div className="f">
                    <label>Tùy chọn mức đặt cọc</label>
                    <select
                      value={depositChoice}
                      onChange={(e) => setDepositChoice(e.target.value as "50" | "100")}
                    >
                      <option value="50">Cọc trước 50% ({Math.round(baseOrderCost * 0.5).toLocaleString("vi-VN")} đ)</option>
                      <option value="100">Thanh toán đủ 100% ({baseOrderCost.toLocaleString("vi-VN")} đ)</option>
                    </select>
                  </div>
                </div>

                <div className="f">
                  <label>Ghi chú cho nhân viên mua hàng (nếu có)</label>
                  <input
                    placeholder="Ví dụ: Chọn size M, màu xanh navy, giữ nguyên seal hộp..."
                    value={custNote}
                    onChange={(e) => setCustNote(e.target.value)}
                  />
                </div>

                <div className="dep" style={{ margin: "1.2rem 0" }}>
                  <span>Số tiền cần thanh toán ngay:</span>
                  <b>{depositVnd.toLocaleString("vi-VN")} đ</b>
                </div>

                {/* Điều khoản & Cam kết không hoàn cọc khi đã mua hàng tại Nhật */}
                <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", margin: "1rem 0", fontSize: "0.82rem", color: "var(--ink)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={policyAgreed}
                    onChange={(e) => setPolicyAgreed(e.target.checked)}
                    style={{ marginTop: "3px" }}
                    required
                  />
                  <span>
                    Tôi xác nhận đã đọc và đồng ý với <b>Chính sách mua hộ &amp; đặt cọc của ChillBanana</b> (đơn hàng không hoàn lại cọc nếu tự ý hủy sau khi nhân viên đã mua hàng tại Nhật Bản).
                  </span>
                </label>

                <div className="bt">
                  <button
                    className="btn2"
                    type="button"
                    onClick={() => setShowOrderForm(false)}
                  >
                    Quay Lại
                  </button>
                  <button
                    className="cta"
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Đang xử lý..." : "Xác Nhận & Tạo Đơn"} <svg><use href="#i-arrow" /></svg>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Màn hình sau khi tạo đơn thành công: VNPAY & VietQR */}
          {createdOrder && (
            <div id="order-success" style={{ marginTop: "2.5rem" }}>
              <div
                className="card"
                style={{ maxWidth: "680px", margin: "0 auto", padding: "28px", background: "rgba(255,255,255,0.95)" }}
              >
                <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                  <span style={{ display: "inline-block", padding: "6px 14px", borderRadius: "999px", background: "#e8f8f0", color: "#1a7a55", fontWeight: 800, fontSize: "0.82rem" }}>
                    ✓ KHỞI TẠO ĐƠN HÀNG THÀNH CÔNG
                  </span>
                  <h3 style={{ fontSize: "1.4rem", fontWeight: 800, marginTop: "8px" }}>
                    Mã Đơn: <span style={{ color: "var(--blue-d)" }}>{createdOrder.orderCode}</span>
                  </h3>
                  <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                    {createdOrder.isPriceVerified ? "Số tiền cần thanh toán:" : "Mức thanh toán tạm tính (chưa phải số tiền cần thanh toán):"} <b style={{ color: "#d97706", fontSize: "1.1rem" }}>{(createdOrder.depositAmountVnd || depositVnd).toLocaleString("vi-VN")} đ</b>
                  </p>
                </div>

                {!createdOrder.isPriceVerified ? (
                  <div style={{ padding: "16px", borderRadius: "16px", background: "#fff7ed", border: "1px solid #fed7aa", color: "#7c2d12", textAlign: "center", marginBottom: "1.5rem" }}>
                    Báo giá đang chờ ChillBanana kiểm tra. Vui lòng chưa chuyển khoản. Khi được duyệt, bạn có thể thanh toán an toàn từ trang theo dõi đơn.
                    <Link href={`/tracking?orderCode=${createdOrder.orderCode}`} style={{ display: "block", marginTop: "10px", color: "#075985", fontWeight: 800 }}>Theo dõi trạng thái báo giá →</Link>
                  </div>
                ) : <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "1.5rem" }}>
                  {/* Nút thanh toán VNPAY */}
                  <button
                    type="button"
                    onClick={handlePayVnpay}
                    disabled={isRedirectingVnpay}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      padding: "16px",
                      borderRadius: "18px",
                      border: "2px solid #005baa",
                      background: "rgba(0,91,170,0.06)",
                      color: "#005baa",
                      fontWeight: 800,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    <CreditCard className="w-6 h-6" />
                    <span>Thanh Toán VNPAY</span>
                    <small style={{ fontSize: "0.7rem", fontWeight: 600 }}>Thẻ ATM / Visa / QR Ngân hàng</small>
                  </button>

                  {/* Nút tra cứu đơn */}
                  <Link
                    href={`/tracking?code=${createdOrder.orderCode}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      padding: "16px",
                      borderRadius: "18px",
                      border: "2px solid #5abae6",
                      background: "rgba(90,186,230,0.08)",
                      color: "var(--blue-d)",
                      fontWeight: 800,
                      textDecoration: "none",
                      transition: "all 0.2s",
                    }}
                  >
                    <ExternalLink className="w-6 h-6" />
                    <span>Tra Cứu Đơn Hàng</span>
                    <small style={{ fontSize: "0.7rem", fontWeight: 600 }}>Theo dõi tiến độ bay Tokyo → VN</small>
                  </Link>
                </div>}

                {/* Khối VietQR chuyển khoản */}
                {createdOrder.isPriceVerified && <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: "1.2rem", textAlign: "center" }}>
                  <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)", marginBottom: "8px" }}>
                    Hoặc chuyển khoản trực tiếp qua VietQR Napas 247:
                  </p>
                  <div style={{ display: "inline-block", padding: "10px", background: "#fff", borderRadius: "16px", boxShadow: "0 4px 14px rgba(0,0,0,0.08)", marginBottom: "12px" }}>
                    <img
                      src={`https://img.vietqr.io/image/970422-0901234567-compact2.png?amount=${createdOrder.depositAmountVnd || depositVnd}&addInfo=${encodeURIComponent(createdOrder.orderCode)}&accountName=CHILLBANANA`}
                      alt="Mã VietQR đặt cọc"
                      style={{ width: "220px", height: "auto", display: "block" }}
                    />
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.6 }}>
                    Ngân hàng: <b>MB Bank (Quân Đội)</b> · STK: <b>0901 234 567</b><br />
                    Chủ TK: <b>CHILLBANANA VIETNAM</b><br />
                    Nội dung CK: <b style={{ color: "#d97706" }}>{createdOrder.orderCode}</b>
                  </div>
                </div>}

                <div style={{ textAlign: "center", marginTop: "1.2rem" }}>
                  <button
                    type="button"
                    className="btn2"
                    onClick={() => {
                      setCreatedOrder(null);
                      setShowOrderForm(false);
                      setInputUrl("");
                      setProductName("");
                      setProductImage("");
                    }}
                  >
                    Tạo đơn hàng khác
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* SẢN PHẨM CÓ SẴN TỪ DB NEON */}
        <section className="sec" id="stock" style={{ scrollMarginTop: "90px" }}>
          {/* CuratedProducts tự fetch /api/products và quản lý giỏ hàng */}
          <CuratedProducts quoteSectionId="quote" quoteHref="#quote" />
        </section>

        {/* 4 DANH MỤC HOT */}
        <section className="sec" id="hot">
          <div className="center">
            <span className="tag">Danh mục nổi bật</span>
            <h2>4 Danh Mục Hàng Nhật Bán Chạy</h2>
          </div>
          <div className="hot">
            <a className="card hc" href="#stock" onClick={(e) => { e.preventDefault(); scrollToSection("stock"); }} style={{ "--c": "#ff8fb8" } as any}>
              <i><svg><use href="#i-ai" /></svg></i>
              <h3>Mỹ Phẩm &amp; Chăm Sóc Da</h3>
              <p>Hàng chính hãng Cosme Nhật: DHC, Hada Labo, Anessa, Shiseido</p>
              <b>Xem sản phẩm hot <svg><use href="#i-arrow" /></svg></b>
            </a>
            <a className="card hc" href="#stock" onClick={(e) => { e.preventDefault(); scrollToSection("stock"); }} style={{ "--c": "#4fcf9b" } as any}>
              <i><svg><use href="#i-ok" /></svg></i>
              <h3>Thực Phẩm Chức Năng</h3>
              <p>Bảo vệ sức khỏe gia đình: Tảo xoắn, Nattokinase, Orihiro</p>
              <b>Xem sản phẩm hot <svg><use href="#i-arrow" /></svg></b>
            </a>
            <a className="card hc" href="#stock" onClick={(e) => { e.preventDefault(); scrollToSection("stock"); }} style={{ "--c": "#4aaee0" } as any}>
              <i><svg><use href="#i-box" /></svg></i>
              <h3>Gia Dụng &amp; Điện Tử Mini</h3>
              <p>Bình giữ nhiệt, máy cạo râu, tai nghe (Kèm hướng dẫn điện 100V)</p>
              <b>Xem sản phẩm hot <svg><use href="#i-arrow" /></svg></b>
            </a>
            <a className="card hc" href="#stock" onClick={(e) => { e.preventDefault(); scrollToSection("stock"); }} style={{ "--c": "#a58bff" } as any}>
              <i><svg><use href="#i-book" /></svg></i>
              <h3>Anime, Figure &amp; Sưu Tầm</h3>
              <p>Figure chính hãng Bandai, Good Smile, Nendoroid, Gunpla</p>
              <b>Xem sản phẩm hot <svg><use href="#i-arrow" /></svg></b>
            </a>
          </div>
        </section>

        {/* 4 GIÁ TRỊ CỐT LÕI (CHÍNH SÁCH BẢO HIỂM & VẬN CHUYỂN) */}
        <section className="sec" id="values">
          <WhyChooseUs />
        </section>

        {/* CẨM NANG HÀNG NHẬT & TIN TỨC SĂN DEAL */}
        <section className="sec" id="news" style={{ scrollMarginTop: "90px" }}>
          <NewsCorner />
        </section>
      </main>

      {/* Floating Mascot Button: Mở ChillBanana Gemini AI */}
      <aside className="neo" aria-label="Trợ lý ChillBanana AI">
        <button
          aria-label="Hỏi ChillBanana AI"
          onClick={handleOpenAIChat}
          title="Bấm để trò chuyện cùng trợ lý ChillBanana Gemini AI"
        >
          <svg viewBox="0 0 34 34" aria-hidden="true">
            <circle cx="17" cy="17" r="12" fill="#fff" stroke="#2b7fb0" strokeWidth="2" />
            <rect x="9" y="12" width="16" height="10" rx="5" fill="#5abae6" />
            <circle cx="14" cy="17" r="1.6" fill="#fff" />
            <circle cx="20" cy="17" r="1.6" fill="#fff" />
          </svg>
        </button>
      </aside>

      {/* Toast thông báo popup */}
      <div className={`toast ${toastMsg ? "on" : ""}`} role="status">
        {toastMsg}
      </div>
    </div>
  </MotionConfig>
  );
}
