"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, QrCode, CreditCard, ShoppingCart } from "lucide-react";
import "@/styles/NeoDaylightCosmos.css";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import CuratedProducts from "@/components/CuratedProducts";
import WhyChooseUs from "@/components/WhyChooseUs";
import NewsCorner from "@/components/NewsCorner";

export default function NeoDaylightCosmos() {
  const { totalItems, openCart, addToCart } = useCart();
  const { customer, openAuthModal } = useAuth();
  const [showMini, setShowMini] = useState(false);
  const [calmMode, setCalmMode] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  // Form quote state
  const [inputUrl, setInputUrl] = useState("");
  const [productName, setProductName] = useState("");
  const [productImage, setProductImage] = useState("");
  const [detectedStore, setDetectedStore] = useState("");
  const [category, setCategory] = useState("cosmetics");
  const [priceJpy, setPriceJpy] = useState<number>(3500);
  const [weightKg] = useState<number>(0);
  const [isGroupBuy, setIsGroupBuy] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<"JP_VN" | "VN_JP">("JP_VN");

  // Order form state
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custNote, setCustNote] = useState("");
  const [depositChoice, setDepositChoice] = useState<"50" | "100">("50");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirectingVnpay, setIsRedirectingVnpay] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<any>(null);

  // Exchange rate state (live from API)
  const [exchangeRate, setExchangeRate] = useState<number>(172);
  const [rateLabel, setRateLabel] = useState<string>("172,0 đ");

  // Parallax pointermove & scroll listeners
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (calmMode) return;
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
  }, [calmMode]);

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

  // Auto-fill customer info if logged in
  useEffect(() => {
    if (customer) {
      if (customer.name && !custName) setCustName(customer.name);
      if (customer.phone && !custPhone) setCustPhone(customer.phone);
      if (customer.address && !custAddress) setCustAddress(customer.address);
      if (customer.email && !custEmail) setCustEmail(customer.email);
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
      if (typeof product.priceJpy === "number" && product.priceJpy > 0) setPriceJpy(product.priceJpy);
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
      el.scrollIntoView({ behavior: calmMode ? "auto" : "smooth", block: "start" });
    }
  };

  const handleOpenAIChat = () => {
    window.dispatchEvent(new CustomEvent("open-ai-chat"));
  };

  // Quét link tự động (gửi POST đến /api/scrape-link)
  const handleScanLink = async () => {
    if (!inputUrl.trim()) {
      showToast("Vui lòng dán link sản phẩm (Amazon JP, Mercari, Rakuten...)");
      return;
    }
    setIsScanning(true);
    showToast("Đang bóc tách dữ liệu từ link...");
    try {
      const res = await fetch("/api/scrape-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        if (data.data.title) setProductName(data.data.title);
        if (data.data.priceJpy && data.data.priceJpy > 0) setPriceJpy(Number(data.data.priceJpy));
        if (data.data.imageUrl) setProductImage(data.data.imageUrl);
        if (data.data.storeName) setDetectedStore(data.data.storeName);
        if (data.data.category) setCategory(data.data.category);
        showToast("Đã trích xuất thông tin sản phẩm thành công!");
      } else {
        showToast(data.error || "Không thể tự động bóc tách link này. Vui lòng nhập thông tin thủ công.");
      }
    } catch {
      showToast("Lỗi kết nối khi quét link. Bạn có thể nhập giá thủ công.");
    } finally {
      setIsScanning(false);
    }
  };

  // Tính toán chi phí theo tỷ giá live
  const productPriceVnd = Math.round(priceJpy * exchangeRate);
  const serviceFeeVnd = Math.max(20000, Math.round(productPriceVnd * 0.04));
  const baseOrderCost = productPriceVnd + serviceFeeVnd;
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
      weightKg: 0,
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
    if (!inputUrl.trim()) {
      showToast("Vui lòng dán link sản phẩm trước khi tạo đơn đặt cọc.");
      return;
    }
    if (baseOrderCost < 300000) {
      showToast("Giá trị đơn hàng tối thiểu là 300.000 đ để đủ điều kiện mua hộ.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: custName.trim(),
          customerPhone: custPhone.trim(),
          customerAddress: custAddress.trim(),
          customerEmail: custEmail.trim() || undefined,
          customerNote: custNote.trim() || undefined,
          productName: productName.trim() || "Đơn mua hộ từ Nhật Bản",
          originalUrl: inputUrl.trim(),
          priceJpy,
          weightKg,
          category,
          isGroupBuy,
          items: [],
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.order) {
        setCreatedOrder(data.order);
        showToast("Tạo đơn hàng thành công! Vui lòng chọn phương thức thanh toán tiền cọc.");
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
          orderInfo: `Dat coc don hang ${createdOrder.orderCode} - ChillBanana`,
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
    <div className={`cosmos-root ${calmMode ? "calm" : ""}`}>
      {/* Nền trời vũ trụ ban ngày */}
      <div className="sky" aria-hidden="true">
        <div className="sun par" style={{ "--k": 6 } as any} />
        <div className="cloud par" style={{ "--k": 12, left: "-6vw", top: "14vh" } as any} />
        <div className="cloud par" style={{ "--k": 18, left: "44vw", top: "52vh", animationDuration: "80s" } as any} />
        <div id="sparks">
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className="sp"
              style={{
                left: `${(i * 17) % 100}%`,
                top: `${(i * 23) % 95}%`,
                width: `${8 + (i % 8)}px`,
                height: `${8 + (i % 8)}px`,
                animationDelay: `-${(i * 0.4).toFixed(1)}s`,
                animationDuration: `${2.5 + (i % 4)}s`,
                background: i % 4 ? "#fff" : "#f8db55",
              }}
            />
          ))}
        </div>
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

      {/* Lối tắt sang giao diện cũ */}
      <div className="fixed top-2 left-4 z-50">
        <Link
          href="/classic"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold shadow-lg backdrop-blur border border-white/20 transition-all hover:scale-105"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Về giao diện cũ</span>
        </Link>
      </div>

      {/* HEADER: Logo cụm hành tinh & quỹ đạo */}
      <header id="hd">
        <div className="top">
          {/* Cụm Quỹ Đạo Hành Tinh (Cluster Nav) */}
          <nav className="card cluster" aria-label="Danh mục chính">
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
                  <i><svg><use href="#i-link" /></svg></i>Dán Link Tính Giá
                </a>
              </div>
            </div>

            {/* Quỹ đạo 2: Sản phẩm có sẵn */}
            <div className="ring r2" style={{ "--c": "#4aaee0", "--n": 1 } as any}>
              <div className="spin">
                <a className="pl" href="#stock" onClick={(e) => { e.preventDefault(); scrollToSection("stock"); }}>
                  <i><svg><use href="#i-bag" /></svg></i>Sản Phẩm Có Sẵn
                </a>
              </div>
            </div>

            {/* Quỹ đạo 3: Tra cứu */}
            <div className="ring r3" style={{ "--c": "#a58bff", "--n": 2 } as any}>
              <div className="spin">
                <Link className="pl" href="/tracking">
                  <i><svg><use href="#i-box" /></svg></i>Tra Cứu Đơn Hàng
                </Link>
              </div>
            </div>

            {/* Quỹ đạo 4: Cẩm nang */}
            <div className="ring r4" style={{ "--c": "#4fcf9b", "--n": 3 } as any}>
              <div className="spin">
                <a className="pl" href="#news" onClick={(e) => { e.preventDefault(); scrollToSection("news"); }}>
                  <i><svg><use href="#i-book" /></svg></i>Cẩm Nang Hàng Nhật
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
              <Link className="admin" href="/admin/login">
                Admin Portal
              </Link>
            </div>

            <div className="acct">
              <button className="chip" onClick={openCart}>
                Giỏ hàng
                <span className="badge">{totalItems}</span>
              </button>
              {customer ? (
                <Link href="/profile" className="chip" title={customer.email}>
                  👤 {customer.name || "Tài khoản"}
                </Link>
              ) : (
                <button className="chip" onClick={() => openAuthModal("login")}>
                  Đăng nhập ▾
                </button>
              )}
              <button className="cta" onClick={() => scrollToSection("quote")}>
                Đặt Mua Hộ Ngay
              </button>
            </div>

            <div className="stats">
              <div className="stat">
                <b>{rateLabel}</b>
                1 JPY · Tỷ giá live
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
      <nav className={`mini ${showMini ? "on" : ""}`} id="mini" aria-label="Điều hướng nhanh">
        <Link className="mlogo" href="/" aria-label="ChillBanana" />
        <a className="mp" href="#quote" onClick={(e) => { e.preventDefault(); scrollToSection("quote"); }} title="Dán Link Tính Giá" style={{ "--c": "#f2c21b" } as any}>
          <i><svg><use href="#i-link" /></svg></i>
        </a>
        <a className="mp" href="#stock" onClick={(e) => { e.preventDefault(); scrollToSection("stock"); }} title="Sản Phẩm Có Sẵn" style={{ "--c": "#4aaee0" } as any}>
          <i><svg><use href="#i-bag" /></svg></i>
        </a>
        <Link className="mp" href="/tracking" title="Tra Cứu Đơn Hàng" style={{ "--c": "#a58bff" } as any}>
          <i><svg><use href="#i-box" /></svg></i>
        </Link>
        <a className="mp" href="#news" onClick={(e) => { e.preventDefault(); scrollToSection("news"); }} title="Cẩm Nang Hàng Nhật" style={{ "--c": "#4fcf9b" } as any}>
          <i><svg><use href="#i-book" /></svg></i>
        </a>
        <button className="cta" onClick={() => scrollToSection("quote")}>
          Đặt Mua Hộ Ngay
        </button>
      </nav>

      {/* NỘI DUNG CHÍNH (MAIN) */}
      <main>
        {/* HERO SECTION */}
        <section className="hero">
          <div>
            <span className="tag">Mua Hàng Nhật Chuẩn – Thư Thái Cùng ChillBanana · JP</span>
            <h1>Ủy Thác Mua Hộ Hàng Nhật <u>Tự Động Bóc Tách Link</u> &amp; <em>ChillBanana AI</em></h1>
            <p className="lead">
              Dán link từ <b>Amazon JP, Mercari, Rakuten, Yahoo Auctions</b> — hệ thống tự động lấy giá Yên gốc thực tế, tính chi phí minh bạch theo <b>tỷ giá ngân hàng trực tiếp</b>, tích hợp <b>Trợ lý ChillBanana AI Agent</b> tư vấn 24/7 và giải pháp <b>Gộp đơn tiết kiệm 25% cước</b>.
            </p>
            <div className="trust">
              <span><svg><use href="#i-ok" /></svg>Cam kết 100% chính hãng nội địa Nhật</span>
              <span><svg><use href="#i-ok" /></svg>Tỷ giá cập nhật liên tục theo thời gian thực</span>
              <span><svg><use href="#i-ok" /></svg>Bảo hiểm đền bù 100% khi mất mát, bể vỡ</span>
            </div>
            <a className="cta lg" href="#quote" onClick={(e) => { e.preventDefault(); scrollToSection("quote"); }}>
              Dán Link Tính Giá Tự Động <svg><use href="#i-arrow" /></svg>
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
              "Mình muốn mua mô hình Gundam RG RX-78-2 Ver 2.0 trên Amazon Nhật, bên bạn có nhận mua hộ không và bảo quản hộp seal thế nào?"
            </div>
            <div className="a">
              <b>ChillBanana AI:</b>
              "Dạ chào bạn! ChillBanana chuyên săn deal Gunpla Bandai và Figure chính hãng từ Amazon JP/Surugaya. Mọi kiện hàng đều được bọc xốp bóng khí 4 lớp, bảo vệ hộp nguyên seal. Bạn chỉ cần dán link vào ô tính giá là hệ thống tự động bóc tách giá Yên và tính chi phí trọn gói ngay ạ!"
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
            <span className="tag">Công Cụ Tự Động Bóc Tách Link &amp; Báo Giá Trọn Gói</span>
            <h2>Dán Link Nhật - ChillBanana Báo Giá Trong 3 Giây</h2>
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
              JP → VN · Mua Hàng Từ Nhật Về Việt Nam
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "VN_JP"}
              onClick={() => {
                setActiveTab("VN_JP");
                showToast("Chiều VN → JP hiện đang tiếp nhận qua hotline 1900 6868 & tư vấn viên trực tiếp!");
              }}
            >
              VN → JP · Gửi Quà / Hàng Sang Nhật Bản
            </button>
          </div>

          <div className="qgrid">
            {/* Form nhập liệu */}
            <form className="card form" onSubmit={(e) => e.preventDefault()}>
              <div className="f">
                <label htmlFor="u">
                  1. Dán đường dẫn link sản phẩm Nhật Bản <em>Tự động lấy Tên, Ảnh &amp; Giá Yên</em>
                </label>
                <div className="in">
                  <input
                    id="u"
                    inputMode="url"
                    placeholder="https://www.amazon.co.jp/... hoặc https://jp.mercari.com/..."
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                  />
                  <button
                    className="scan"
                    type="button"
                    disabled={isScanning}
                    onClick={handleScanLink}
                  >
                    {isScanning ? "Đang quét..." : "Quét Link Tự Động"}
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
                  <label htmlFor="n">2. Tên sản phẩm (hiển thị trên đơn)</label>
                  <input
                    id="n"
                    placeholder="VD: Kem chống nắng Anessa / Mô hình Gundam"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                  />
                </div>
                <div className="f">
                  <label htmlFor="c">3. Danh mục hàng hóa</label>
                  <select id="c" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="cosmetics">Mỹ Phẩm &amp; Chăm Sóc Da</option>
                    <option value="health">Thực Phẩm Chức Năng</option>
                    <option value="gadgets">Gia Dụng &amp; Điện Tử Mini</option>
                    <option value="anime">Anime, Figure &amp; Sưu Tầm</option>
                  </select>
                </div>
              </div>

              <div className="fg">
                <div className="f">
                  <label htmlFor="y">
                    4. Giá gốc tại Nhật (¥ Yên) <em>≈ {productPriceVnd.toLocaleString("vi-VN")} đ</em>
                  </label>
                  <input
                    id="y"
                    type="number"
                    value={priceJpy}
                    onChange={(e) => setPriceJpy(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
                <div className="f">
                  <label>5. Trọng lượng kiện hàng <em>Cân đo thực tế tại kho</em></label>
                  <div className="box">
                    Hệ thống <b>không áp đặt số kg mặc định</b> vào tiền cọc. Kiện hàng về kho Tokyo sẽ được cân đo chính xác theo gram để bảo đảm công bằng nhất.
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
                  <b>Đơn hàng đã đạt hạn mức tối thiểu và đủ điều kiện vận chuyển chuyên biệt!</b><br />
                  Bật Chế Độ Gộp Đơn (Tiết kiệm 25% cước vận chuyển cho kiện &lt; 0.5kg)
                </span>
              </label>
            </form>

            {/* Bảng kê chi phí trọn gói */}
            <aside className="sheet" aria-label="Bảng kê chi phí">
              <div className="sh">
                <h3>Bảng kê chi phí trọn gói</h3>
                <span>1 JPY = {exchangeRate} đ</span>
              </div>
              <div className="row">
                <span>Tiền hàng gốc ({priceJpy.toLocaleString("vi-VN")} ¥):</span>
                <b>{productPriceVnd.toLocaleString("vi-VN")} đ</b>
              </div>
              <div className="row">
                <span>Phí mua hộ &amp; bảo hiểm (4%):</span>
                <b>{serviceFeeVnd.toLocaleString("vi-VN")} đ</b>
              </div>
              <div className="row">
                <span>Cước bay quốc tế:</span>
                <b className="ok">{isGroupBuy ? "Ưu đãi Mua Chung (-25%)" : "Cân đo thực tế khi về kho (0 đ)"}</b>
              </div>
              <div className="row">
                <span>Phụ phí hải quan &amp; đóng gói:</span>
                <b className="ok">0 đ (Miễn phí)</b>
              </div>
              <div className="total">
                <span>Tiền Hàng &amp; Phí Mua Hộ:</span>
                <b>{baseOrderCost.toLocaleString("vi-VN")} <small>đ</small></b>
              </div>
              <div className="dep">
                <span>Tiền đặt cọc trước ({depositChoice}%):<small>✓ {depositChoice}% Tiền Hàng + Phí Mua Hộ</small></span>
                <b>{depositVnd.toLocaleString("vi-VN")} đ</b>
              </div>
              <p className="n1">
                <b>Chuẩn quốc tế:</b> Bạn chỉ cần cọc tiền mua hàng. Cước bay quốc tế sẽ được cân đo chính xác khi kiện hàng về tới kho Tokyo/VN và thanh toán khi nhận hàng!
              </p>

              {!showOrderForm && !createdOrder && (
                <div className="bt">
                  <button
                    className="btn2"
                    type="button"
                    onClick={handleAddToCart}
                    title="Gom vào giỏ hàng để đặt nhiều món cùng lúc"
                  >
                    <ShoppingCart className="w-4 h-4 inline mr-1" />
                    Thêm Vào Giỏ Hàng
                  </button>
                  <button
                    className="cta"
                    type="button"
                    onClick={() => {
                      if (!inputUrl.trim()) {
                        showToast("Vui lòng dán link sản phẩm trước.");
                        scrollToSection("quote");
                        return;
                      }
                      setShowOrderForm(true);
                      setTimeout(() => scrollToSection("order-form"), 150);
                    }}
                  >
                    Đặt Cọc &amp; Mua Ngay <svg><use href="#i-arrow" /></svg>
                  </button>
                </div>
              )}
            </aside>
          </div>

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
                    Thông tin giao nhận &amp; Đặt cọc
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowOrderForm(false)}
                    style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "0.85rem" }}
                  >
                    ✕ Đóng form
                  </button>
                </div>

                <div className="fg">
                  <div className="f">
                    <label>Họ và tên người nhận *</label>
                    <input
                      placeholder="Nguyễn Văn A"
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="f">
                    <label>Số điện thoại nhận hàng *</label>
                    <input
                      placeholder="0901 234 567"
                      value={custPhone}
                      onChange={(e) => setCustPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="f">
                  <label>Địa chỉ nhận hàng tại Việt Nam *</label>
                  <input
                    placeholder="Số nhà, tên đường, Phường/Xã, Quận/Huyện, Tỉnh/TP"
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
                    Số tiền cọc cần thanh toán: <b style={{ color: "#d97706", fontSize: "1.1rem" }}>{(createdOrder.depositAmountVnd || depositVnd).toLocaleString("vi-VN")} đ</b>
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "1.5rem" }}>
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
                </div>

                {/* Khối VietQR chuyển khoản */}
                <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: "1.2rem", textAlign: "center" }}>
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
                </div>

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

      {/* Nút bật/tắt hiệu ứng chuyển động */}
      <button
        className="fxbtn"
        id="fx"
        aria-pressed={!calmMode}
        onClick={() => {
          setCalmMode(!calmMode);
          showToast(!calmMode ? "Đã tắt hiệu ứng chuyển động" : "Đã bật hiệu ứng chuyển động");
        }}
      >
        ✨ Hiệu ứng: {!calmMode ? "Bật" : "Tắt"}
      </button>

      {/* Toast thông báo popup */}
      <div className={`toast ${toastMsg ? "on" : ""}`} role="status">
        {toastMsg}
      </div>
    </div>
  );
}
