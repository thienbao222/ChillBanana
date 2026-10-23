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
import { getVnJpRatePerKg, VN_JP_CARGO_LABELS } from "@/features/pricing/vn-jp-rates";
import {
  JP_VN_CATEGORIES,
  getCategoryCustomsInfo,
  JpVnProductCategory,
} from "@/features/pricing/customs-categories";

export default function NeoDaylightCosmos() {
  const { totalItems, openCart, addToCart, pricingConfig } = useCart();
  const { customer, openAuthModal } = useAuth();
  const [showMini, setShowMini] = useState(false);
  const { preferences } = useWebsitePreferences();
  const t = useWebsiteText();
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  // Cấu hình tài khoản nhận cọc VietQR (ưu tiên biến môi trường)
  const bankBin = process.env.NEXT_PUBLIC_BANK_BIN || "970422";
  const bankAccount = process.env.NEXT_PUBLIC_BANK_ACCOUNT || "0901234567";
  const bankOwner = process.env.NEXT_PUBLIC_BANK_OWNER || "CHILLBANANA VIETNAM";
  const bankName = process.env.NEXT_PUBLIC_BANK_NAME || "MB Bank (Quân Đội)";

  // Form quote state
  const [inputUrl, setInputUrl] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [productImage, setProductImage] = useState("");
  const [detectedStore, setDetectedStore] = useState("");
  const [category, setCategory] = useState("cosmetics");
  const [categoryBreadcrumb, setCategoryBreadcrumb] = useState<string | null>(null);
  const [priceJpy, setPriceJpy] = useState<number>(3500);
  const [weightKg, setWeightKg] = useState<number>(0);
  const [isGroupBuy, setIsGroupBuy] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<"JP_VN" | "VN_JP">("JP_VN");

  // VN -> JP Form state
  const [vnJpSenderName, setVnJpSenderName] = useState("");
  const [vnJpSenderPhone, setVnJpSenderPhone] = useState("");
  const [vnJpSenderAddress, setVnJpSenderAddress] = useState("");
  const [vnJpPickupDate, setVnJpPickupDate] = useState("Sáng mai (8h - 12h)");
  const [vnJpReceiverName, setVnJpReceiverName] = useState("");
  const [vnJpReceiverPhone, setVnJpReceiverPhone] = useState("");
  const [vnJpReceiverPostalCode, setVnJpReceiverPostalCode] = useState("");
  const [vnJpReceiverAddress, setVnJpReceiverAddress] = useState("");
  const [vnJpCargoType, setVnJpCargoType] = useState("gift");
  const [vnJpCargoDetails, setVnJpCargoDetails] = useState("");
  const [vnJpWeightKg, setVnJpWeightKg] = useState<number>(2);
  const [vnJpCity, setVnJpCity] = useState("Tokyo");
  const [vnJpMaffAgreement, setVnJpMaffAgreement] = useState(true);
  const [vnJpSubmitted, setVnJpSubmitted] = useState(false);
  const [vnJpDispatchCode, setVnJpDispatchCode] = useState("");
  const [vnJpLoading, setVnJpLoading] = useState(false);

  

  const getVnJpCargoLabel = (type: string) => VN_JP_CARGO_LABELS[type] || "Kiện quà / Đồ cá nhân";

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
  const [isRateStale, setIsRateStale] = useState<boolean>(false);

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
        const stale = Boolean(data?.data?.isStale || !data?.success);
        setIsRateStale(stale);
        if (data?.data?.roundedRate) {
          const rate = Number(data.data.roundedRate);
          setExchangeRate(rate);
          setRateLabel(stale ? `${rate.toLocaleString("vi-VN")} đ (Tạm gián đoạn)` : `${rate.toLocaleString("vi-VN")} đ`);
        }
      })
      .catch(() => {
        setIsRateStale(true);
      });
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
        id?: string;
        name?: string;
        priceJpy?: number;
        weightKg?: number;
        imageUrl?: string;
        originalStore?: string;
        category?: string;
      }>).detail;

      if (!product) return;
      setSelectedProductId(product.id || `catalog-${Date.now()}`);
      if (product.name) setProductName(product.name);
      if (typeof product.priceJpy === "number" && product.priceJpy > 0) setPriceJpy(Math.floor(product.priceJpy));
      if (typeof product.weightKg === "number" && product.weightKg >= 0) setWeightKg(product.weightKg);
      if (product.imageUrl) setProductImage(product.imageUrl);
      if (product.originalStore) setDetectedStore(product.originalStore);
      if (product.category) setCategory(product.category);

      // A catalog item has no order URL, so do not reuse an unrelated old link.
      setInputUrl("");
      setShowOrderForm(false);
      setCreatedOrder(null);
      showToast("Đã nạp sản phẩm vào bảng báo giá! Bạn có thể bấm Đặt Cọc & Mua Ngay.");
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

  const scrollToSection = (id: string, focusInputId?: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: preferences.effectsEnabled ? "smooth" : "auto", block: "start" });
      if (focusInputId) {
        setTimeout(() => {
          const inputEl = document.getElementById(focusInputId) as HTMLInputElement | null;
          inputEl?.focus();
        }, 350);
      }
    }
  };

  const handleSelectCategoryAndScroll = (catKey: string) => {
    window.dispatchEvent(
      new CustomEvent("chillbanana:filter_products", {
        detail: { category: catKey },
      })
    );
    scrollToSection("stock");
  };

  const handleOpenAIChat = () => {
    window.dispatchEvent(new CustomEvent("open-ai-chat"));
  };

  // Quét link tự động (kiểm tra client-side và fallback thân thiện)
  const handleScanLink = async () => {
    setSelectedProductId(null);
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
        if (data.data.categoryBreadcrumb) setCategoryBreadcrumb(data.data.categoryBreadcrumb);
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
  const currentCategory = getCategoryCustomsInfo(category);
  const productPriceVnd = Math.round(priceJpy * exchangeRate);
  const serviceFeeVnd = Math.max(pricingConfig.serviceFeeMinimumVnd, Math.round(productPriceVnd * pricingConfig.serviceFeePercent / 100));
  const customsFeeVnd = Math.round(productPriceVnd * (currentCategory.surchargePercent / 100));
  const baseOrderCost = productPriceVnd + serviceFeeVnd;

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
    if (isSubmitting) return; // BẢO MẬT (P2-07): Chống double-submit khi nhấn phím Enter
    if (!custName.trim() || !custPhone.trim() || !custAddress.trim() || !custEmail.trim()) {
      showToast("Vui lòng điền đầy đủ Họ tên, Số điện thoại, Địa chỉ và Email.");
      return;
    }
    const phoneClean = custPhone.replace(/\s+/g, "");
    if (!/^(03|05|07|08|09)\d{8}$/.test(phoneClean)) {
      showToast("Số điện thoại không hợp lệ (cần đúng 10 số, đầu số 03, 05, 07, 08, 09).");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(custEmail.trim())) {
      showToast("Định dạng email không hợp lệ. Vui lòng kiểm tra lại.");
      return;
    }
    if (!policyAgreed) {
      showToast("Vui lòng tích chọn đồng ý với Chính sách mua hộ & đặt cọc.");
      return;
    }
    if (isRateStale) {
      showToast("Tỷ giá trực tuyến đang gián đoạn, tạm dừng nhận đơn mới để bảo vệ giá cho khách; các đơn hàng cũ vẫn xử lý bình thường.");
      return;
    }
    if (!inputUrl.trim() && !selectedProductId) {
      showToast("Vui lòng dán link sản phẩm từ sàn Nhật hoặc chọn một sản phẩm có sẵn bên dưới.");
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
          originalUrl: inputUrl.trim() || undefined,
          priceJpy,
          weightKg,
          category,
          isGroupBuy,
          depositPercent: Number(depositChoice),
          items: [
            {
              id: selectedProductId || `calc-${Date.now()}`,
              name: productName.trim() || "Đơn mua hộ từ Nhật Bản",
              quantity: 1,
              priceJpy,
              weightKg,
            },
          ],
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.order) {
        setCreatedOrder({ ...data.order, accessToken: data.accessToken });
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
          accessToken: createdOrder.accessToken,
          phone: custPhone.trim(),
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
        {/* Giảm bớt các vòng tròn màu, chỉ giữ lại ánh sáng mây tinh vân êm dịu */}
        <div className="cloud cloud--cyan par" style={{ "--k": 10, left: "-4vw", top: "18vh", animationDuration: "72s" } as any} />
        <div className="cloud cloud--banana par" style={{ "--k": 8, left: "52vw", top: "45vh", animationDuration: "92s" } as any} />
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
        {/* Hệ thống sao băng rơi vũ trụ phong cách Neo Universe & ChillBanana */}
        <div className="meteor meteor--banana m1" />
        <div className="meteor meteor--cyan m2" />
        <div className="meteor meteor--gold m3" />
        <div className="meteor meteor--violet m4" />
        <div className="meteor meteor--cyan m5" />
        <div className="meteor meteor--banana m6" />
        <div className="meteor meteor--gold m7" />
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

      {/* HEADER: Thanh Đảo Vũ Trụ Liền Mạch (Cosmic Floating Island Dock) */}
      <header id="hd" className="cosmos-island-header">
        <div className="card cosmos-island-nav">
          {/* Cụm 1: Logo Hành Tinh Vàng & Thương Hiệu */}
          <div className="island-brand">
            <Link className="logo-planet-link" href="/" aria-label="ChillBanana - trang chủ">
              <div className="logo-planet">
                <div className="planet-ring" />
                <img src="/logo.png" alt="ChillBanana" className="logo-banana-img" />
              </div>
            </Link>
            <div className="brand-text">
              <div className="brand-title">
                <b>Chill<i>Banana</i></b>
                <span className="jp">JP ⇄ VN</span>
              </div>
              <small className="brand-sub hidden 2xl:block">Mua hàng Nhật chuẩn – Thư thái &amp; Thảnh thơi</small>
            </div>
          </div>

          {/* Cụm 2: 5 Viên Ngọc Điều Hướng Vũ Trụ (Cosmic Navigation Pills) */}
          <nav className="island-pills" aria-label={t("Danh mục chính")}>
            <a
              className="pill-gem pill-gem--muaho"
              href="#quote"
              style={{ "--pill-rgb": "245, 158, 11" } as any}
              onClick={(e) => { e.preventDefault(); setActiveTab("JP_VN"); scrollToSection("quote", "u"); }}
              title={t("Đặt Mua Hộ Hàng Nhật")}
            >
              <i className="gem-icon"><svg><use href="#i-arrow" /></svg></i>
              <span>{t("Đặt Mua Hộ")} <b className="pill-gem-sparkle">✦</b></span>
            </a>

            <a
              className="pill-gem"
              href="#stock"
              style={{ "--pill-rgb": "74, 174, 224" } as any}
              onClick={(e) => { e.preventDefault(); scrollToSection("stock"); }}
            >
              <i className="gem-icon"><svg><use href="#i-bag" /></svg></i>
              <span>{t("Sẵn Hàng")}</span>
            </a>

            <Link
              className="pill-gem"
              href="/tracking"
              style={{ "--pill-rgb": "165, 139, 255" } as any}
            >
              <i className="gem-icon"><svg><use href="#i-box" /></svg></i>
              <span>{t("Tra Cứu")}</span>
            </Link>

            <a
              className="pill-gem"
              href="#news"
              style={{ "--pill-rgb": "79, 207, 155" } as any}
              onClick={(e) => { e.preventDefault(); scrollToSection("news"); }}
            >
              <i className="gem-icon"><svg><use href="#i-book" /></svg></i>
              <span>{t("Cẩm Nang")}</span>
            </a>

            <a
              className="pill-gem pill-gem--ai"
              href="#"
              style={{ "--pill-rgb": "255, 143, 184" } as any}
              onClick={(e) => { e.preventDefault(); handleOpenAIChat(); }}
            >
              <i className="gem-icon"><svg><use href="#i-ai" /></svg></i>
              <span>Neo AI</span>
            </a>
          </nav>

          {/* Cụm 3: Tiện ích tài khoản & Giỏ hàng */}
          <div className="island-actions">
            <button className="chip chip-cart" onClick={openCart} title="Xem giỏ hàng">
              <span className="cart-icon">🛒</span>
              <span className="cart-label">{t("Giỏ hàng")}</span>
              <span className="badge">{totalItems}</span>
            </button>

            {customer ? (
              <Link href="/profile" className="chip chip-user" title={customer.email}>
                <span className="user-icon">👤</span>
                <span className="user-name">{customer.name || t("Tài khoản")}</span>
              </Link>
            ) : (
              <button className="chip chip-user" onClick={() => openAuthModal("login")}>
                <span className="user-icon">👤</span>
                <span className="user-text">{t("Đăng nhập ▾")}</span>
              </button>
            )}

            <WebsitePreferencesTrigger className="island-pref-btn" />
          </div>
        </div>

        {/* Dải Telemetry Vũ Trụ: Tỷ giá Live, Bảo hiểm, Hotline & Liên kết quản trị */}
        <div className="cosmos-telemetry-strip">
          <div className="telemetry-item">
            <span className="telemetry-pulse" />
            <span>1 JPY = <b className="text-amber-500 font-extrabold">{rateLabel}</b> ({t("Tỷ giá live")})</span>
          </div>
          <div className="telemetry-sep">✦</div>
          <div className="telemetry-item">
            <span>🛡️ <b>100%</b> {t("Bảo hiểm hàng hóa nội địa Nhật")}</span>
          </div>
          <div className="telemetry-sep">✦</div>
          <div className="telemetry-item">
            <span>📞 Hotline 8h–22h: <a href="tel:19006868" className="hover:underline font-bold text-slate-800 dark:text-slate-200">1900 6868</a></span>
          </div>
          <div className="telemetry-sep">✦</div>
          <div className="telemetry-item flex items-center gap-2">
            <Link className="hover:text-amber-500 transition font-bold text-slate-700 dark:text-slate-300" href="/admin/login">
              ⚙️ {t("Admin Portal")}
            </Link>
            <span>·</span>
            <Link href="/classic" className="hover:text-slate-900 transition text-slate-500 dark:text-slate-400">
              {t("Về giao diện cũ")}
            </Link>
          </div>
        </div>
      </header>

      {/* Thanh Mini Header khi cuộn chuột xuống */}
      <nav className={`mini ${showMini ? "on" : ""}`} id="mini" aria-label={t("Điều hướng nhanh")}>
        <Link className="mlogo" href="/" aria-label="ChillBanana">
          <img src="/logo.png" alt="ChillBanana" className="mlogo-img" />
        </Link>
        <a className="mp" href="#quote" onClick={(e) => { e.preventDefault(); setActiveTab("JP_VN"); scrollToSection("quote", "u"); }} title={t("Đặt Mua Hộ")} style={{ "--c": "#f59e0b" } as any}>
          <i><svg><use href="#i-arrow" /></svg></i>
          <span>{t("Đặt Mua Hộ")}</span>
        </a>
        <a className="mp" href="#stock" onClick={(e) => { e.preventDefault(); scrollToSection("stock"); }} title={t("Sản Phẩm Có Sẵn")} style={{ "--c": "#4aaee0" } as any}>
          <i><svg><use href="#i-bag" /></svg></i>
          <span>{t("Sẵn Hàng")}</span>
        </a>
        <Link className="mp" href="/tracking" title={t("Tra Cứu Đơn Hàng")} style={{ "--c": "#a58bff" } as any}>
          <i><svg><use href="#i-box" /></svg></i>
          <span>{t("Tra Cứu")}</span>
        </Link>
        <a className="mp" href="#news" onClick={(e) => { e.preventDefault(); scrollToSection("news"); }} title={t("Cẩm Nang Hàng Nhật")} style={{ "--c": "#4fcf9b" } as any}>
          <i><svg><use href="#i-book" /></svg></i>
          <span>{t("Cẩm Nang")}</span>
        </a>
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
                ? "Amazon JP、Mercari、Rakuten、Yahoo! Auctions、Uniqlo、駿河屋 (Surugaya)、Bic Camera、Yodobashiの商品リンクを貼り付けると、実際の円価格と銀行為替レートに基づく費用を自動で計算します。ChillBanana AIが24時間サポートし、まとめ買いで送料を節約できます。"
                : <>Dán link từ <b>Amazon JP, Mercari, Rakuten, Yahoo! Auctions, Uniqlo, Surugaya, Bic Camera, Yodobashi</b> — hệ thống hỗ trợ ước tính chi phí theo tỷ giá hiện hành, tích hợp <b>Trợ lý ChillBanana AI Agent</b> tư vấn và giải pháp <b>Gộp đơn tiết kiệm {pricingConfig.groupBuyShippingDiscountPercent}% cước</b>.</>}
            </p>
            <div className="trust">
              <span><svg><use href="#i-ok" /></svg>{preferences.language === "ja" ? "日本国内正規品をお届け" : "Cam kết 100% chính hãng nội địa Nhật"}</span>
              <span><svg><use href="#i-ok" /></svg>{preferences.language === "ja" ? "為替レートを随時更新" : "Tỷ giá cập nhật liên tục theo thời gian thực"}</span>
              <span><svg><use href="#i-ok" /></svg>{preferences.language === "ja" ? "紛失・破損時は補償" : "Bảo hiểm đền bù 100% khi mất mát, bể vỡ"}</span>
            </div>
            <div style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "6px",
              marginTop: "12px",
              marginBottom: "16px",
              fontSize: "0.75rem",
            }}>
              <span style={{ fontWeight: 700, color: "var(--navy-900, #0f172a)" }}>
                {t("Sàn hỗ trợ bóc tách:")}
              </span>
              {[
                "Amazon JP",
                "Mercari",
                "Rakuten",
                "Yahoo! Auctions",
                "Uniqlo JP",
                "Surugaya (駿河屋)",
                "Bic Camera",
                "Yodobashi",
              ].map((site) => (
                <span
                  key={site}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "8px",
                    background: "rgba(224, 242, 254, 0.7)",
                    border: "1px solid rgba(186, 230, 253, 0.9)",
                    color: "#0369a1",
                    fontWeight: 600,
                    fontSize: "0.72rem",
                  }}
                >
                  {site}
                </span>
              ))}
            </div>
            <a className="cta lg" href="#quote" onClick={(e) => { e.preventDefault(); scrollToSection("quote"); }}>
              {t("Dán Link Tính Giá Tự Động")} <svg><use href="#i-arrow" /></svg>
            </a>
          </div>

          <div className="card agent">
            <div className="ah">
              <span className="mlogo">
                <img src="/logo.png" alt="ChillBanana" className="mlogo-img" />
              </span>
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
              Hỗ trợ bóc tách tự động link từ Amazon JP, Mercari, Rakuten, Yahoo! Auctions, Uniqlo, Surugaya, Bic Camera, Yodobashi... Tỷ giá cập nhật liên tục, cước vận chuyển minh bạch, bảo hiểm 100%.
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
            <div className="card" style={{ maxWidth: "1080px", margin: "0 auto", padding: "32px" }}>
              {/* Header tuyến VN -> JP */}
              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "1.5rem" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "rgba(248, 219, 85, 0.22)", border: "1px solid rgba(248, 219, 85, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", fontWeight: 800, whiteSpace: "nowrap" }}>
                  VN➔JP
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "2rem" }}>
                <div className="tariff-box">
                  <b style={{ display: "block", color: "var(--blue-d)", fontSize: "0.9rem" }}>📦 Kiện Quà / Đồ Khô / Quần Áo</b>
                  <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--ink)", margin: "6px 0" }}>
                    180.000 <small style={{ fontSize: "0.8rem" }}>đ / kg</small>
                  </div>
                  <small style={{ color: "var(--muted)", display: "block" }}>Từ 1kg trở lên · Miễn phí đóng thùng carton đạt chuẩn bay</small>
                </div>
                <div className="tariff-box">
                  <b style={{ display: "block", color: "#f59e0b", fontSize: "0.9rem" }}>⚡ Chuyển Phát Hỏa Tốc EMS</b>
                  <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--ink)", margin: "6px 0" }}>
                    210.000 <small style={{ fontSize: "0.8rem" }}>đ / kg</small>
                  </div>
                  <small style={{ color: "var(--muted)", display: "block" }}>Hồ sơ du học, giấy tờ, hợp đồng · Giao trong 48h tại Tokyo/Osaka</small>
                </div>
                <div className="tariff-box">
                  <b style={{ display: "block", color: "#10b981", fontSize: "0.9rem" }}>🍲 Thực Phẩm & Đặc Sản Quê</b>
                  <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--ink)", margin: "6px 0" }}>
                    220.000 <small style={{ fontSize: "0.8rem" }}>đ / kg</small>
                  </div>
                  <small style={{ color: "var(--muted)", display: "block" }}>Cà phê, trà, bánh pía, đồ khô có tem nhãn · Hỗ trợ thủ tục kiểm dịch</small>
                </div>
              </div>

              {/* Form nhận báo giá & đăng ký gửi hàng VN -> JP */}
              {!vnJpSubmitted ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (vnJpLoading) return; // BẢO MẬT (P2-07): Chống double-submit form VN -> JP khi bấm Enter
                    if (!vnJpSenderName.trim() || !vnJpSenderPhone.trim() || !vnJpSenderAddress.trim()) {
                      showToast("Vui lòng điền đầy đủ họ tên, SĐT và địa chỉ lấy hàng tại Việt Nam.");
                      return;
                    }
                    if (!/^(03|05|07|08|09)\d{8}$/.test(vnJpSenderPhone.replace(/\s+/g, ""))) {
                      showToast("Số điện thoại người gửi không hợp lệ (10 số, đầu 03, 05, 07, 08, 09).");
                      return;
                    }
                    if (!vnJpReceiverName.trim() || !vnJpReceiverPhone.trim() || !vnJpReceiverPostalCode.trim() || !vnJpReceiverAddress.trim()) {
                      showToast("Vui lòng điền đầy đủ thông tin người nhận tại Nhật (Họ tên, SĐT, Mã bưu điện 〒 7 số, Số phòng).");
                      return;
                    }
                    if (!vnJpCargoDetails.trim()) {
                      showToast("Vui lòng mô tả danh mục hàng gửi chi tiết (không ghi chung chung quà tặng).");
                      return;
                    }
                    if (!vnJpMaffAgreement) {
                      showToast("Bạn bắt buộc phải cam kết không gửi hàng cấm kiểm dịch MAFF sang Nhật.");
                      return;
                    }

                    setVnJpLoading(true);
                    try {
                      const res = await fetch("/api/vn-jp-shipments", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          senderName: vnJpSenderName,
                          senderPhone: vnJpSenderPhone,
                          senderAddress: vnJpSenderAddress,
                          senderCity: "Hà Nội",
                          pickupDate: vnJpPickupDate,
                          receiverName: vnJpReceiverName,
                          receiverPhone: vnJpReceiverPhone,
                          receiverPostalCode: vnJpReceiverPostalCode,
                          receiverPrefecture: vnJpCity,
                          receiverAddress: vnJpReceiverAddress,
                          cargoType: vnJpCargoType,
                          cargoDetails: vnJpCargoDetails,
                          estimatedWeightKg: vnJpWeightKg,
                          maffAgreement: vnJpMaffAgreement,
                        }),
                      });
                      const data = await res.json();
                      if (res.ok && data.success) {
                        setVnJpDispatchCode(data.trackingCode);
                        setVnJpSubmitted(true);
                        showToast(`Đã ghi nhận phiếu điều phối #${data.trackingCode}!`);
                      } else {
                        showToast(data.error || "Lỗi ghi nhận phiếu gửi hàng.");
                      }
                    } catch {
                      showToast("Lỗi kết nối máy chủ. Vui lòng thử lại!");
                    } finally {
                      setVnJpLoading(false);
                    }
                  }}
                  style={{ borderTop: "1px dashed #cbd5e1", paddingTop: "1.5rem" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem", flexWrap: "wrap", gap: "8px" }}>
                    <div>
                      <h4 style={{ fontWeight: 800, fontSize: "1.1rem", margin: 0, color: "#0f172a" }}>
                        ✈️ Phiếu Đăng Ký Vận Đơn Tuyến Việt Nam ➔ Nhật Bản
                      </h4>
                      <p style={{ margin: "3px 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                        Khởi tạo mã vận đơn bay AWB, điều phối bưu tá lấy hàng tận nơi và phát tận tay tại Nhật Bản.
                      </p>
                    </div>
                    <span style={{ fontSize: "0.75rem", background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "4px 10px", borderRadius: "999px", fontWeight: 700 }}>
                      ⚡ Chuẩn Bay IATA & Thông Quan Nhanh
                    </span>
                  </div>

                  {/* KHỐI 1: THÔNG TIN NGƯỜI GỬI TẠI VIỆT NAM */}
                  <div style={{ background: "#f8fafc", padding: "14px 16px", borderRadius: "14px", border: "1px solid #e2e8f0", marginBottom: "14px" }}>
                    <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#1e293b", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>🇻🇳 1. Thông Tin Người Gửi & Điểm Lấy Hàng Tại Việt Nam</span>
                    </div>
                    <div className="fg" style={{ marginBottom: "10px" }}>
                      <div className="f">
                        <label>Họ tên người gửi tại VN *</label>
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
                    <div className="fg">
                      <div className="f" style={{ flex: 2 }}>
                        <label>Địa chỉ lấy hàng tận nhà tại VN (Số nhà, Phường/Xã, Quận/Huyện) *</label>
                        <input
                          placeholder="VD: Số 18 Ngõ 45 Cầu Giấy, Dịch Vọng, Hà Nội"
                          value={vnJpSenderAddress}
                          onChange={(e) => setVnJpSenderAddress(e.target.value)}
                          required
                        />
                      </div>
                      <div className="f" style={{ flex: 1 }}>
                        <label>Hẹn thời gian lấy hàng</label>
                        <select value={vnJpPickupDate} onChange={(e) => setVnJpPickupDate(e.target.value)}>
                          <option value="Sáng mai (8h - 12h)">Sáng mai (8h - 12h)</option>
                          <option value="Chiều mai (13h - 18h)">Chiều mai (13h - 18h)</option>
                          <option value="Trong ngày hôm nay (Hỏa tốc)">Trong ngày hôm nay (Hỏa tốc)</option>
                          <option value="Hẹn ngày khác">Hẹn ngày khác (Nhân viên liên hệ)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* KHỐI 2: THÔNG TIN NGƯỜI NHẬN TẠI NHẬT BẢN */}
                  <div style={{ background: "#f8fafc", padding: "14px 16px", borderRadius: "14px", border: "1px solid #e2e8f0", marginBottom: "14px" }}>
                    <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#1e293b", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>🇯🇵 2. Thông Tin Người Nhận Tại Nhật Bản (Bắt buộc để bưu tá Yamato/Sagawa giao tận nơi)</span>
                    </div>
                    <div className="fg" style={{ marginBottom: "10px" }}>
                      <div className="f">
                        <label>Họ tên người nhận (Tên Romaji in hoa) *</label>
                        <input
                          placeholder="VD: NGUYEN VAN A"
                          value={vnJpReceiverName}
                          onChange={(e) => setVnJpReceiverName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="f">
                        <label>Số điện thoại nội địa Nhật *</label>
                        <input
                          placeholder="070-1234-5678 hoặc 080/090"
                          value={vnJpReceiverPhone}
                          onChange={(e) => setVnJpReceiverPhone(e.target.value)}
                          required
                        />
                      </div>
                      <div className="f">
                        <label>Mã bưu điện Nhật Bản (〒 7 chữ số) *</label>
                        <input
                          placeholder="VD: 160-0022"
                          value={vnJpReceiverPostalCode}
                          onChange={(e) => setVnJpReceiverPostalCode(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="fg">
                      <div className="f" style={{ flex: 1 }}>
                        <label>Tỉnh/Thành tại Nhật Bản *</label>
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
                      <div className="f" style={{ flex: 2 }}>
                        <label>Địa chỉ chi tiết (Tên chung cư/Mansion, Số phòng) *</label>
                        <input
                          placeholder="VD: Shinjuku Sky Mansion Room 302, 1-2-3 Shinjuku"
                          value={vnJpReceiverAddress}
                          onChange={(e) => setVnJpReceiverAddress(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* KHỐI 3: HÀNG HÓA & CƯỚC TÍNH IATA */}
                  <div style={{ background: "#f8fafc", padding: "14px 16px", borderRadius: "14px", border: "1px solid #e2e8f0", marginBottom: "14px" }}>
                    <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#1e293b", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>📦 3. Chi Tiết Mặt Hàng & Tạm Tính Cước Phí</span>
                    </div>
                    <div className="fg" style={{ marginBottom: "10px" }}>
                      <div className="f">
                        <label>Loại mặt hàng</label>
                        <select value={vnJpCargoType} onChange={(e) => setVnJpCargoType(e.target.value)}>
                          <option value="gift">Quà biếu / Quần áo / Đồ dùng cá nhân (180.000 đ/kg)</option>
                          <option value="food">Thực phẩm khô / Bánh kẹo / Cà phê / Trà (220.000 đ/kg)</option>
                          <option value="doc">Tài liệu / Hồ sơ du học / Bằng cấp (210.000 đ/kg)</option>
                          <option value="other">Hàng mẫu kinh doanh / Mặt hàng khác (200.000 đ/kg)</option>
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
                    </div>

                    <div className="f" style={{ marginBottom: "12px" }}>
                      <label>Danh mục hàng hóa cụ thể (Bắt buộc để khai báo hải quan) *</label>
                      <input
                        placeholder="VD: 2 hộp bánh đậu xanh (1kg), 1 áo khoác len (0.8kg), 2 gói cà phê hòa tan"
                        value={vnJpCargoDetails}
                        onChange={(e) => setVnJpCargoDetails(e.target.value)}
                        required
                      />
                    </div>

                    {/* Hộp tự động tính Tạm tính cước */}
                    {(() => {
                      const rate = getVnJpRatePerKg(vnJpCargoType);
                      const totalEst = Math.round(rate * vnJpWeightKg);
                      return (
                        <div
                          style={{
                            background: "linear-gradient(135deg, rgba(248, 219, 85, 0.2), rgba(16, 185, 129, 0.1))",
                            border: "1px solid rgba(248, 219, 85, 0.6)",
                            borderRadius: "12px",
                            padding: "12px 16px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "8px",
                          }}
                        >
                          <div>
                            <span style={{ fontSize: "0.82rem", color: "#475569", fontWeight: 700, display: "block" }}>
                              Tạm tính cước vận chuyển VN ➔ JP ({vnJpWeightKg} kg):
                            </span>
                            <span style={{ fontSize: "0.85rem", color: "#1e293b" }}>
                              Đơn giá: <b>{rate.toLocaleString("vi-VN")} đ/kg</b> × {vnJpWeightKg} kg —{" "}
                              <span style={{ color: "#16a34a", fontWeight: 700 }}>Đã gồm đóng thùng carton đạt chuẩn bay</span>
                            </span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: "1.25rem", fontWeight: 900, color: "#0f172a" }}>
                              {totalEst.toLocaleString("vi-VN")} đ
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Checkbox cam kết kiểm dịch MAFF */}
                    <div style={{ marginTop: "12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                      <input
                        type="checkbox"
                        id="maffCheck"
                        checked={vnJpMaffAgreement}
                        onChange={(e) => setVnJpMaffAgreement(e.target.checked)}
                        style={{ marginTop: "3px", width: "16px", height: "16px", accentColor: "#dc2626" }}
                        required
                      />
                      <label htmlFor="maffCheck" style={{ fontSize: "0.78rem", color: "#991b1b", lineHeight: 1.4, cursor: "pointer" }}>
                        <b>CAM KẾT KIỂM DỊCH MAFF:</b> Tôi cam đoan kiện hàng <b>KHÔNG CHỨA</b> các loại thịt động vật (thịt tươi, khô bò, khô gà, xúc xích, giò chả, nem chua, chà bông), hoa quả tươi hay chất cấm/dễ cháy nổ theo quy định kiểm dịch của Bộ Nông Lâm Thủy Sản Nhật Bản. Tôi chịu hoàn toàn trách nhiệm pháp lý nếu vi phạm.
                      </label>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "1.2rem", flexWrap: "wrap" }}>
                    <button className="cta" type="submit" disabled={vnJpLoading}>
                      {vnJpLoading ? "Đang xử lý..." : "Khởi Tạo Vận Đơn & Hẹn Lấy Hàng"} <svg><use href="#i-arrow" /></svg>
                    </button>
                    <a
                      href="tel:19006868"
                      className="btn2"
                      style={{
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        color: "#0f172a",
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        fontWeight: 700,
                      }}
                    >
                      📞 Hotline 1900 6868 (Miễn cước)
                    </a>
                  </div>
                </form>
              ) : (
                <div style={{ padding: "24px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "18px", marginTop: "1.5rem" }}>
                  <div style={{ textAlign: "center", marginBottom: "14px" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "4px" }}>✅</div>
                    <h4 style={{ fontWeight: 800, color: "#166534", margin: "0 0 6px", fontSize: "1.15rem" }}>
                      Đã Ghi Nhận Phiếu Điều Phối Vận Đơn VN ➔ JP Thành Công!
                    </h4>
                    {vnJpDispatchCode && (
                      <div style={{ display: "inline-block", background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0", padding: "4px 14px", borderRadius: "999px", fontWeight: 800, fontSize: "0.95rem", fontFamily: "monospace" }}>
                        Mã vận đơn: {vnJpDispatchCode}
                      </div>
                    )}
                  </div>

                  <div style={{ background: "#ffffff", borderRadius: "14px", padding: "14px 18px", border: "1px solid #bbf7d0", margin: "14px 0", fontSize: "0.85rem", color: "#1e293b", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                    <div>
                      <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700 }}>Người gửi tại VN:</span>
                      <b>{vnJpSenderName}</b> ({vnJpSenderPhone})
                      <div style={{ fontSize: "0.75rem", color: "#475569" }}>📍 {vnJpSenderAddress}</div>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700 }}>Người nhận tại Nhật Bản:</span>
                      <b>{vnJpReceiverName}</b> ({vnJpReceiverPhone})
                      <div style={{ fontSize: "0.75rem", color: "#475569" }}>〒 {vnJpReceiverPostalCode} · {vnJpCity} · {vnJpReceiverAddress}</div>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700 }}>Hàng hóa & Cân nặng:</span>
                      <b>{vnJpWeightKg} kg</b> ({getVnJpCargoLabel(vnJpCargoType)})
                      <div style={{ fontSize: "0.75rem", color: "#475569" }}>📦 {vnJpCargoDetails}</div>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700 }}>Tổng cước tạm tính:</span>
                      <b style={{ color: "#15803d", fontSize: "1.1rem" }}>
                        {Math.round(getVnJpRatePerKg(vnJpCargoType) * vnJpWeightKg).toLocaleString("vi-VN")} đ
                      </b>
                      <div style={{ fontSize: "0.75rem", color: "#16a34a" }}>Đã bao gồm đóng thùng carton chuẩn bay</div>
                    </div>
                  </div>

                  <p style={{ color: "#15803d", fontSize: "0.85rem", textAlign: "center", margin: "0 0 16px" }}>
                    Điều phối viên ChillBanana đang tiếp nhận trên hệ thống và sẽ liên hệ số <b>{vnJpSenderPhone}</b> để xác nhận lịch bưu tá qua lấy hàng tận nơi!
                  </p>
                  <div style={{ textAlign: "center" }}>
                    <button
                      type="button"
                      className="btn2"
                      onClick={() => {
                        setVnJpSubmitted(false);
                        setVnJpSenderName("");
                        setVnJpSenderPhone("");
                        setVnJpSenderAddress("");
                        setVnJpReceiverName("");
                        setVnJpReceiverPhone("");
                        setVnJpReceiverPostalCode("");
                        setVnJpReceiverAddress("");
                        setVnJpCargoDetails("");
                        setVnJpDispatchCode("");
                      }}
                      style={{ fontWeight: 700 }}
                    >
                      Gửi yêu cầu kiện khác
                    </button>
                  </div>
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
                    placeholder={t("Dán link Amazon JP, Mercari, Rakuten, Yahoo, Uniqlo, Surugaya, Bic Camera, Yodobashi...")}
                    value={inputUrl}
                    onChange={(e) => {
                      setInputUrl(e.target.value);
                      if (e.target.value.trim()) setSelectedProductId(null);
                    }}
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
                {/* Sàn hỗ trợ bóc tách link */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginTop: "8px",
                  fontSize: "0.72rem",
                  color: "var(--muted)",
                }}>
                  <span style={{ fontWeight: 700, color: "var(--navy-900, #0f172a)" }}>
                    {t("Sàn hỗ trợ bóc tách:")}
                  </span>
                  {[
                    "Amazon JP",
                    "Mercari",
                    "Rakuten",
                    "Yahoo! Auctions",
                    "Uniqlo JP",
                    "Surugaya (駿河屋)",
                    "Bic Camera",
                    "Yodobashi",
                  ].map((store) => (
                    <span
                      key={store}
                      style={{
                        padding: "2px 7px",
                        borderRadius: "6px",
                        background: "rgba(224, 242, 254, 0.6)",
                        border: "1px solid rgba(186, 230, 253, 0.8)",
                        color: "#0369a1",
                        fontWeight: 600,
                        fontSize: "0.7rem",
                      }}
                    >
                      {store}
                    </span>
                  ))}
                </div>
              </div>

              {/* Preview sản phẩm cào được nếu có */}
              {productImage && (
                <div className="preview-product">
                  <img
                    src={productImage}
                    alt={productName}
                    style={{ width: "54px", height: "54px", objectFit: "contain", borderRadius: "10px", background: "rgba(255,255,255,0.15)" }}
                  />
                  <div style={{ flex: 1, minWidth: 0, fontSize: "0.82rem" }}>
                    <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {productName}
                    </b>
                    <small style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
                      <span>Nguồn: <b>{detectedStore || "Sàn Nhật"}</b></span>
                      <span>·</span>
                      <span>Giá web: <b>{priceJpy.toLocaleString("vi-VN")} ¥</b></span>
                      {categoryBreadcrumb && (
                        <>
                          <span>·</span>
                          <span style={{ color: "#b45309", background: "#fef3c7", padding: "1px 6px", borderRadius: "6px", fontWeight: 600 }}>
                            🔍 Phân loại sàn: {categoryBreadcrumb}
                          </span>
                        </>
                      )}
                    </small>
                  </div>
                </div>
              )}

              <div className="fg">
                <div className="f">
                  <label htmlFor="n">
                    <span>{t("2. Tên sản phẩm (hiển thị trên đơn)")}</span>
                  </label>
                  <input
                    id="n"
                    placeholder={t("VD: Kem chống nắng Anessa / Mô hình Gundam")}
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                  />
                  <div style={{
                    marginTop: "2px",
                    fontSize: "0.72rem",
                    color: "var(--muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {productName ? <span>✓ Tên sản phẩm đã trích xuất từ sàn</span> : <span>Tự động điền khi quét link hoặc nhập tay</span>}
                  </div>
                </div>
                <div className="f">
                  <label htmlFor="c">
                    <span>{t("3. Danh mục hàng hóa")}</span>
                    <em>{currentCategory.surchargePercent > 0 ? `Phụ phí ~${currentCategory.surchargePercent}%` : "0% phụ phí"}</em>
                  </label>
                  <select id="c" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {Object.values(JP_VN_CATEGORIES).map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.selectOptionLabel}
                      </option>
                    ))}
                  </select>
                  {categoryBreadcrumb ? (
                    <div style={{
                      marginTop: "2px",
                      fontSize: "0.72rem",
                      color: "#b45309",
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      borderRadius: "6px",
                      padding: "2px 6px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                    }}>
                      <span style={{ flexShrink: 0 }}>🔍 Khớp từ sàn:</span>
                      <strong style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        {categoryBreadcrumb}
                      </strong>
                    </div>
                  ) : (
                    <div style={{
                      marginTop: "2px",
                      fontSize: "0.72rem",
                      color: "var(--muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      <span>{currentCategory.customsRuleNote}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="fg">
                <div className="f">
                  <label htmlFor="y">
                    <span>{t("4. Giá gốc tại Nhật (¥ Yên)")}</span> <em>≈ {productPriceVnd.toLocaleString("vi-VN")} đ (Tối thiểu 100 ¥)</em>
                  </label>
                  <input
                    id="y"
                    type="number"
                    min={100}
                    step={1}
                    value={priceJpy}
                    onChange={(e) => {
                      const v = Math.max(0, Math.round(Number(e.target.value) || 0));
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
                        className={`weight-chip ${weightKg === chip.w ? "is-active" : ""}`}
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
                <span>{`Phụ phí hải quan (Đối chiếu: ${currentCategory.shortLabel}):`}</span>
                <b className="ok" style={{ color: currentCategory.surchargePercent > 0 ? "#fbbf24" : "#34d399" }}>
                  {currentCategory.surchargePercent > 0
                    ? `Tính sau khi qua hải quan (~${customsFeeVnd.toLocaleString("vi-VN")} đ · ${currentCategory.surchargePercent}% theo danh mục)`
                    : "Tính sau khi qua hải quan (0% phụ phí danh mục)"}
                </b>
              </div>
              <div className="row">
                <span>{t("Cước bay quốc tế (185.000 đ/kg):")}</span>
                <b className="ok">
                  {weightKg > 0
                    ? (isGroupBuyEligible
                        ? `~${estimatedShippingVnd.toLocaleString("vi-VN")} đ (${weightKg}kg · Tính sau khi qua hải quan · -${pricingConfig.groupBuyShippingDiscountPercent}% Gộp)`
                        : `~${standardShippingVnd.toLocaleString("vi-VN")} đ (${weightKg}kg · Tính sau khi qua hải quan)`)
                    : "Tính sau khi qua hải quan & cân đo tại kho"}
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", margin: "10px 0" }}>
                <button
                  type="button"
                  onClick={() => setDepositChoice("50")}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "10px",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: depositChoice === "50" ? "2px solid #eab308" : "1px solid #cbd5e1",
                    background: depositChoice === "50" ? "#fef9c3" : "#ffffff",
                    color: depositChoice === "50" ? "#713f12" : "#475569",
                    transition: "all 0.2s ease",
                  }}
                >
                  {preferences.language === "ja" ? "50% 予約金" : "Cọc 50%"}
                  {depositChoice === "50" ? " ✓" : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setDepositChoice("100")}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "10px",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: depositChoice === "100" ? "2px solid #eab308" : "1px solid #cbd5e1",
                    background: depositChoice === "100" ? "#fef9c3" : "#ffffff",
                    color: depositChoice === "100" ? "#713f12" : "#475569",
                    transition: "all 0.2s ease",
                  }}
                >
                  {preferences.language === "ja" ? "100% 全額" : "Thanh toán 100%"}
                  {depositChoice === "100" ? " ✓" : ""}
                </button>
              </div>
              <div className="dep">
                <span>{preferences.language === "ja" ? `お支払い予定額（${depositChoice}%）：` : `Ước tính thanh toán (${depositChoice}%):`}<small>{t("Chờ ChillBanana duyệt giá trước khi thanh toán")}</small></span>
                <b>{depositVnd.toLocaleString("vi-VN")} đ</b>
              </div>
              <p className="n1">
                <b>{t("Chuẩn quốc tế:")}</b> {t("Đợt 1 bạn chỉ cần đặt cọc trên Tiền hàng gốc & Phí mua hộ. Cước bay quốc tế và Phụ phí hải quan (đối chiếu từ danh mục hàng hóa thực tế) sẽ được tính sau khi kiện hàng thông quan hải quan và cân đo tại kho!")}
              </p>

              {isRateStale && (
                <div style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: "12px",
                  padding: "12px 14px",
                  marginBottom: "14px",
                  fontSize: "0.82rem",
                  color: "#92400e",
                  lineHeight: "1.45"
                }}>
                  <strong>⚠️ Tạm dừng nhận đơn mới:</strong> Tỷ giá trực tuyến đang gián đoạn, tạm dừng nhận đơn mới để bảo vệ giá cho khách; các đơn hàng cũ vẫn xử lý bình thường.
                </div>
              )}

              {!showOrderForm && !createdOrder && (
                <div className="bt">
                  <button
                    className="btn2"
                    type="button"
                    onClick={handleAddToCart}
                    disabled={isRateStale}
                    style={isRateStale ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
                    title={t("Gom vào giỏ hàng để đặt nhiều món cùng lúc")}
                  >
                    <ShoppingCart className="w-4 h-4 inline mr-1" />
                    {t("Thêm Vào Giỏ Hàng")}
                  </button>
                  <button
                    className="cta"
                    type="button"
                    disabled={isRateStale}
                    style={isRateStale ? { opacity: 0.5, cursor: "not-allowed", filter: "grayscale(1)" } : undefined}
                    onClick={() => {
                      if (isRateStale) {
                        showToast(t("Tỷ giá trực tuyến đang gián đoạn, tạm dừng nhận đơn mới để bảo vệ giá cho khách; các đơn hàng cũ vẫn xử lý bình thường."));
                        return;
                      }
                      if (!inputUrl.trim() && !selectedProductId) {
                        showToast(t("Vui lòng dán link sản phẩm từ sàn Nhật hoặc chọn một sản phẩm có sẵn bên dưới."));
                        scrollToSection("quote", "u");
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
                    <label>Email (nhận xác nhận &amp; hóa đơn điện tử) <span style={{ color: "#e11d48" }}>*</span></label>
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={custEmail}
                      onChange={(e) => setCustEmail(e.target.value)}
                      required
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
                    disabled={isSubmitting || isRateStale}
                    style={isRateStale ? { opacity: 0.5, cursor: "not-allowed", filter: "grayscale(1)" } : undefined}
                  >
                    {isSubmitting ? "Đang xử lý..." : isRateStale ? "Tạm Dừng Nhận Đơn (Tỷ Giá Gián Đoạn)" : "Xác Nhận & Tạo Đơn"} <svg><use href="#i-arrow" /></svg>
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
                style={{ maxWidth: "780px", margin: "0 auto", padding: "28px" }}
              >
                <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                  <span style={{ display: "inline-block", padding: "6px 14px", borderRadius: "999px", background: "rgba(16, 185, 129, 0.16)", color: "#10b981", fontWeight: 800, fontSize: "0.82rem", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
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
                  <div style={{ padding: "16px", borderRadius: "16px", background: "rgba(254, 215, 170, 0.15)", border: "1px solid rgba(254, 215, 170, 0.4)", color: "var(--ink)", textAlign: "center", marginBottom: "1.5rem" }}>
                    Báo giá đang chờ ChillBanana kiểm tra. Vui lòng chưa chuyển khoản. Khi được duyệt, bạn có thể thanh toán an toàn từ trang theo dõi đơn.
                    <Link href={`/tracking?orderCode=${createdOrder.orderCode}`} style={{ display: "block", marginTop: "10px", color: "var(--blue-d)", fontWeight: 800 }}>Theo dõi trạng thái báo giá →</Link>
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
                    href={`/tracking?orderCode=${createdOrder.orderCode}`}
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
                      src={`https://img.vietqr.io/image/${bankBin}-${bankAccount}-compact2.png?amount=${createdOrder.depositAmountVnd || depositVnd}&addInfo=${encodeURIComponent(createdOrder.orderCode)}&accountName=${encodeURIComponent(bankOwner)}`}
                      alt="Mã VietQR đặt cọc"
                      style={{ width: "220px", height: "auto", display: "block" }}
                    />
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.6 }}>
                    Ngân hàng: <b>{bankName}</b> · STK: <b>{bankAccount}</b><br />
                    Chủ TK: <b>{bankOwner}</b><br />
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
                      setSelectedProductId(null);
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

        {/* 4 DANH MỤC HOT */}
        <section className="sec" id="hot" style={{ scrollMarginTop: "90px" }}>
          <div className="center">
            <span className="tag">Danh mục nổi bật</span>
            <h2>4 Danh Mục Hàng Nhật Bán Chạy</h2>
          </div>
          <div className="hot">
            <a className="card hc" href="#stock" onClick={(e) => { e.preventDefault(); handleSelectCategoryAndScroll("cosmetics"); }} style={{ "--c": "#ff8fb8" } as any}>
              <i><svg><use href="#i-ai" /></svg></i>
              <h3>Mỹ Phẩm &amp; Chăm Sóc Da</h3>
              <p>Hàng chính hãng Cosme Nhật: DHC, Hada Labo, Anessa, Shiseido</p>
              <b>Xem sản phẩm mỹ phẩm <svg><use href="#i-arrow" /></svg></b>
            </a>
            <a className="card hc" href="#stock" onClick={(e) => { e.preventDefault(); handleSelectCategoryAndScroll("health"); }} style={{ "--c": "#4fcf9b" } as any}>
              <i><svg><use href="#i-ok" /></svg></i>
              <h3>Thực Phẩm Chức Năng</h3>
              <p>Bảo vệ sức khỏe gia đình: Tảo xoắn, Nattokinase, Orihiro</p>
              <b>Xem sản phẩm sức khỏe <svg><use href="#i-arrow" /></svg></b>
            </a>
            <a className="card hc" href="#stock" onClick={(e) => { e.preventDefault(); handleSelectCategoryAndScroll("gadgets"); }} style={{ "--c": "#4aaee0" } as any}>
              <i><svg><use href="#i-box" /></svg></i>
              <h3>Gia Dụng &amp; Điện Tử Mini</h3>
              <p>Bình giữ nhiệt, máy cạo râu, tai nghe (Kèm hướng dẫn điện 100V)</p>
              <b>Xem đồ gia dụng 100V <svg><use href="#i-arrow" /></svg></b>
            </a>
            <a className="card hc" href="#stock" onClick={(e) => { e.preventDefault(); handleSelectCategoryAndScroll("anime"); }} style={{ "--c": "#a58bff" } as any}>
              <i><svg><use href="#i-book" /></svg></i>
              <h3>Anime, Figure &amp; Sưu Tầm</h3>
              <p>Figure chính hãng Bandai, Good Smile, Nendoroid, Gunpla</p>
              <b>Xem mô hình Figure <svg><use href="#i-arrow" /></svg></b>
            </a>
          </div>
        </section>

        {/* SẢN PHẨM CÓ SẴN TỪ DB NEON (CÓ FALLBACK MẪU) */}
        <section className="sec" id="stock" style={{ scrollMarginTop: "90px" }}>
          {/* CuratedProducts tự fetch /api/products và quản lý giỏ hàng */}
          <CuratedProducts quoteSectionId="quote" quoteHref="#quote" />
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

{/* Đã hợp nhất nút nổi AI vào component AIChatBot toàn cục trong LayoutWrapper */}

      {/* Toast thông báo popup */}
      <div className={`toast ${toastMsg ? "on" : ""}`} role="status">
        {toastMsg}
      </div>
    </div>
  </MotionConfig>
  );
}