"use client";

import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useCart } from "@/context/CartContext";
import { useWebsitePreferences, useWebsiteText } from "@/context/WebsitePreferencesContext";
import { WebsitePreferencesTrigger } from "@/components/WebsitePreferencesPanel";
import { useRouter } from "next/navigation";
import {
  Package,
  MessageSquare,
  Clock,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Phone,
  Mail,
  LogOut,
  ArrowLeft,
  ChevronRight,
  Sparkles,
  ShoppingBag
} from "lucide-react";
import Link from "next/link";
import "@/styles/NeoDaylightCosmos.css";

export default function ProfilePage() {
  const { customer, loading: authLoading, openAuthModal, logout } = useAuth();
  const { totalItems, openCart } = useCart();
  const { preferences } = useWebsitePreferences();
  const t = useWebsiteText();
  const { toast } = useToast();
  const router = useRouter();

  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exchangeRate, setExchangeRate] = useState<number>(169);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Xử lý đóng menu người dùng khi click ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Hiệu ứng Parallax chuyển động nhẹ theo con trỏ chuột
  useEffect(() => {
    if (!preferences.effectsEnabled) return;
    const handleMove = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      document.querySelectorAll<HTMLElement>(".par").forEach((el) => {
        const k = parseFloat(el.style.getPropertyValue("--k") || "10");
        el.style.transform = `translate3d(${x * k}px, ${y * k}px, 0)`;
      });
    };
    window.addEventListener("pointermove", handleMove, { passive: true });
    return () => window.removeEventListener("pointermove", handleMove);
  }, [preferences.effectsEnabled]);

  // Lấy tỷ giá JPY/VND thực tế
  useEffect(() => {
    fetch("/api/exchange-rate")
      .then((r) => r.json())
      .then((data) => {
        if (data?.data?.roundedRate) {
          setExchangeRate(Number(data.data.roundedRate));
        }
      })
      .catch(() => {});
  }, []);

  // Kiểm tra đăng nhập
  useEffect(() => {
    if (!authLoading && !customer) {
      router.push("/");
      openAuthModal("login");
    }
  }, [authLoading, customer, router, openAuthModal]);

  // Tải dữ liệu hồ sơ cá nhân
  useEffect(() => {
    if (customer) {
      fetch("/api/customer/profile")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setProfileData(data.profile);
          } else {
            toast.error("Không thể tải hồ sơ. Vui lòng thử lại.");
          }
          setLoading(false);
        })
        .catch(() => {
          toast.error("Lỗi kết nối máy chủ. Vui lòng thử lại sau.");
          setLoading(false);
        });
    }
  }, [customer]);

  const handleOpenAIChat = () => {
    window.dispatchEvent(new CustomEvent("open-ai-chat"));
  };

  if (authLoading || (!customer && loading)) {
    return (
      <div className={`cosmos-root ${preferences.effectsEnabled ? "" : "calm"} min-h-screen flex items-center justify-center`}>
        <div className="sky" aria-hidden="true">
          <div className="sun par" style={{ "--k": 6 } as any} />
        </div>
        <div className="track-card flex flex-col items-center p-8 z-10 text-center">
          <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-bold text-sm" style={{ color: "var(--ink, #0f172a)" }}>{t("Đang tải hồ sơ của bạn...")}</p>
        </div>
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div className={`cosmos-root ${preferences.effectsEnabled ? "" : "calm"}`}>
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
          <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></symbol>
          <symbol id="i-bag" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" /></symbol>
          <symbol id="i-box" viewBox="0 0 24 24"><path d="M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10" /></symbol>
          <symbol id="i-book" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5z" /></symbol>
          <symbol id="i-ai" viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></symbol>
        </defs>
      </svg>

      {/* HEADER: Cosmic Floating Island Dock */}
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
            </div>
          </div>

          {/* Cụm 2: 5 Viên Ngọc Điều Hướng Vũ Trụ */}
          <nav className="island-pills" aria-label={t("Danh mục chính")}>
            <Link
              className="pill-gem pill-gem--muaho"
              href="/#quote"
              style={{ "--pill-rgb": "245, 158, 11" } as any}
              title={t("Đặt Mua Hộ Hàng Nhật")}
            >
              <i className="gem-icon"><svg><use href="#i-arrow" /></svg></i>
              <span>{t("Đặt Mua Hộ")} <b className="pill-gem-sparkle">✦</b></span>
            </Link>

            <Link
              className="pill-gem"
              href="/#stock"
              style={{ "--pill-rgb": "74, 174, 224" } as any}
            >
              <i className="gem-icon"><svg><use href="#i-bag" /></svg></i>
              <span>{t("Sẵn Hàng")}</span>
            </Link>

            <Link
              className="pill-gem"
              href="/tracking"
              style={{ "--pill-rgb": "165, 139, 255" } as any}
            >
              <i className="gem-icon"><svg><use href="#i-box" /></svg></i>
              <span>{t("Tra Cứu")}</span>
            </Link>

            <Link
              className="pill-gem"
              href="/#news"
              style={{ "--pill-rgb": "79, 207, 155" } as any}
            >
              <i className="gem-icon"><svg><use href="#i-book" /></svg></i>
              <span>{t("Cẩm Nang")}</span>
            </Link>

            <button
              type="button"
              className="pill-gem pill-gem--ai"
              style={{ "--pill-rgb": "255, 143, 184", background: "none", border: "none", cursor: "pointer" } as any}
              onClick={handleOpenAIChat}
              title="Hỏi Trợ Lý Neo AI"
            >
              <i className="gem-icon"><svg><use href="#i-ai" /></svg></i>
              <span>Neo AI</span>
            </button>
          </nav>

          {/* Cụm 3: Tiện ích tài khoản & Giỏ hàng */}
          <div className="island-actions">
            <button className="chip chip-cart" onClick={openCart} title="Xem giỏ hàng">
              <span className="cart-icon">🛒</span>
              <span className="cart-label">{t("Giỏ hàng")}</span>
              <span className="badge">{totalItems}</span>
            </button>

            {customer ? (
              <div className="relative" ref={userDropdownRef}>
                <button
                  type="button"
                  className="chip chip-user"
                  onClick={() => setUserDropdownOpen((prev) => !prev)}
                  title={customer.email}
                  aria-expanded={userDropdownOpen}
                  aria-haspopup="true"
                >
                  <span className="user-icon">👤</span>
                  <span className="user-name">{customer.name || t("Tài khoản")}</span>
                  <span className="text-[10px] ml-0.5 opacity-70">▾</span>
                </button>

                {userDropdownOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 rounded-2xl shadow-2xl border p-2 z-[9999] animate-in fade-in zoom-in-95 duration-150"
                    style={{
                      background: "var(--surface-strong, #ffffff)",
                      borderColor: "var(--line, #e2e8f0)",
                      boxShadow: "0 18px 40px -12px rgba(0,0,0,0.25)",
                    }}
                    role="menu"
                  >
                    <div className="px-3 py-2 border-b mb-1" style={{ borderColor: "var(--line, #e2e8f0)" }}>
                      <p className="text-xs font-bold truncate" style={{ color: "var(--ink, #0f172a)" }}>
                        {customer.name || "Khách hàng"}
                      </p>
                      <p className="text-[11px] truncate opacity-70" style={{ color: "var(--muted, #64748b)" }}>
                        {customer.email}
                      </p>
                    </div>

                    <Link
                      href="/profile"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-950/30 transition"
                      role="menuitem"
                    >
                      <span>👤</span>
                      <span>{t("Hồ sơ của tôi")}</span>
                    </Link>

                    <Link
                      href="/tracking"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition hover:bg-black/5 dark:hover:bg-white/5"
                      style={{ color: "var(--ink, #0f172a)" }}
                      role="menuitem"
                    >
                      <span>📦</span>
                      <span>{t("Đơn hàng của tôi")}</span>
                    </Link>

                    <div className="my-1 border-t" style={{ borderColor: "var(--line, #e2e8f0)" }} />

                    <button
                      type="button"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        logout();
                        router.push("/");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition text-left"
                      role="menuitem"
                    >
                      <span>🚪</span>
                      <span>{t("Đăng xuất")}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className="chip chip-user" onClick={() => openAuthModal("login")}>
                <span className="user-icon">👤</span>
                <span className="user-text">{t("Đăng nhập ▾")}</span>
              </button>
            )}

            <WebsitePreferencesTrigger className="island-pref-btn" />
          </div>
        </div>

        {/* Dải Telemetry Vũ Trụ */}
        <div className="cosmos-telemetry-strip">
          <div className="telemetry-item">
            <span className="telemetry-pulse" />
            <span>1 JPY = <b className="text-amber-500 font-extrabold">{exchangeRate.toLocaleString("vi-VN")} đ</b> ({t("Tỷ giá live")})</span>
          </div>
          <div className="telemetry-sep">✦</div>
          <div className="telemetry-item">
            <span>🛡️ <b>100%</b> {t("Bảo hiểm hàng hóa nội địa Nhật")}</span>
          </div>
          <div className="telemetry-sep">✦</div>
          <div className="telemetry-item">
            <span>📞 Hotline 8h–22h: <a href="tel:19006868" className="hover:underline font-bold text-slate-800 dark:text-slate-200">1900 6868</a></span>
          </div>
        </div>
      </header>

      {/* Main Wrap */}
      <div className="track-wrap">
        {/* Shortcuts */}
        <div className="track-shortcuts">
          <Link href="/" className="track-shortcut">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t("Về Trang Chủ NeoDay")}</span>
          </Link>
        </div>

        {/* Hero Section */}
        <div className="track-hero">
          <span className="tag">{t("TRANG CÁ NHÂN KHÁCH HÀNG · CHILLBANANA ACCOUNT")}</span>
          <h1>{t("Hồ Sơ Của Tôi")}</h1>
          <p className="sub" style={{ maxWidth: "620px" }}>
            {t("Quản lý thông tin tài khoản cá nhân, theo dõi hành trình đơn hàng và lịch sử các phiên tư vấn cùng trợ lý Neo AI.")}
          </p>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
          {/* Cột trái: Thông tin cá nhân & Thống kê */}
          <div className="lg:col-span-1 space-y-6">
            <div className="track-card relative overflow-hidden">
              <div className="flex flex-col items-center text-center mb-6">
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-extrabold shadow-inner mb-4 select-none"
                  style={{
                    background: "linear-gradient(135deg, rgba(254, 240, 138, 0.6), rgba(253, 224, 71, 0.85))",
                    color: "#854d0e",
                    border: "3px solid rgba(255, 255, 255, 0.9)",
                  }}
                >
                  {profileData?.name?.charAt(0) || customer.name.charAt(0)}
                </div>
                <h2 className="text-xl font-extrabold" style={{ color: "var(--ink, #0f172a)" }}>
                  {profileData?.name || customer.name}
                </h2>
                <div className="track-badge track-badge-green mt-2">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{t("Thành viên ChillBanana")}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl border" style={{ background: "var(--field-bg, rgba(0,0,0,0.02))", borderColor: "var(--line, #e2e8f0)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Mail className="w-4 h-4 opacity-60" style={{ color: "var(--muted, #64748b)" }} />
                    <span className="text-[10px] uppercase font-extrabold tracking-wider" style={{ color: "var(--muted, #64748b)" }}>Email liên hệ</span>
                  </div>
                  <div className="text-sm font-semibold truncate" style={{ color: "var(--ink, #0f172a)" }}>
                    {profileData?.email || customer.email}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl border" style={{ background: "var(--field-bg, rgba(0,0,0,0.02))", borderColor: "var(--line, #e2e8f0)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Phone className="w-4 h-4 opacity-60" style={{ color: "var(--muted, #64748b)" }} />
                    <span className="text-[10px] uppercase font-extrabold tracking-wider" style={{ color: "var(--muted, #64748b)" }}>Số điện thoại</span>
                  </div>
                  <div className="text-sm font-semibold" style={{ color: "var(--ink, #0f172a)" }}>
                    {profileData?.phone || customer.phone || "Chưa cập nhật"}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl border" style={{ background: "var(--field-bg, rgba(0,0,0,0.02))", borderColor: "var(--line, #e2e8f0)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 opacity-60" style={{ color: "var(--muted, #64748b)" }} />
                    <span className="text-[10px] uppercase font-extrabold tracking-wider" style={{ color: "var(--muted, #64748b)" }}>Địa chỉ giao hàng</span>
                  </div>
                  <div className="text-sm font-semibold leading-relaxed" style={{ color: "var(--ink, #0f172a)" }}>
                    {profileData?.address || customer.address || "Chưa cập nhật"}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t" style={{ borderColor: "var(--line, #e2e8f0)" }}>
                <button
                  onClick={() => {
                    logout();
                    router.push("/");
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold border border-rose-200 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition shadow-sm"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t("Đăng xuất tài khoản")}</span>
                </button>
              </div>
            </div>

            {/* Thống kê nhanh */}
            <div className="grid grid-cols-2 gap-4">
              <div className="track-card p-4 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-2" style={{ background: "rgba(245, 158, 11, 0.12)", color: "#d97706" }}>
                  <Package className="w-5 h-5" />
                </div>
                <div className="text-2xl font-black font-mono" style={{ color: "var(--ink, #0f172a)" }}>
                  {profileData?.orders?.length || 0}
                </div>
                <div className="text-xs font-semibold" style={{ color: "var(--muted, #64748b)" }}>{t("Đơn hàng")}</div>
              </div>

              <div className="track-card p-4 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-2" style={{ background: "rgba(59, 130, 246, 0.12)", color: "#2563eb" }}>
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div className="text-2xl font-black font-mono" style={{ color: "var(--ink, #0f172a)" }}>
                  {profileData?.chatSessions?.length || 0}
                </div>
                <div className="text-xs font-semibold" style={{ color: "var(--muted, #64748b)" }}>{t("Phiên tư vấn")}</div>
              </div>
            </div>
          </div>

          {/* Cột phải: Danh sách đơn hàng & Lịch sử tư vấn */}
          <div className="lg:col-span-2 space-y-6">
            {/* Thẻ đơn hàng */}
            <div className="track-card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b gap-2" style={{ borderColor: "var(--line, #e2e8f0)" }}>
                <h3 className="font-extrabold flex items-center gap-2 text-lg" style={{ color: "var(--ink, #0f172a)" }}>
                  <span>📦</span>
                  <span>{t("Đơn Hàng Của Tôi")}</span>
                  {profileData?.orders?.length > 0 && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold ml-1" style={{ background: "var(--field-bg, rgba(0,0,0,0.06))", color: "var(--ink, #0f172a)" }}>
                      {profileData.orders.length}
                    </span>
                  )}
                </h3>
                <Link href="/tracking" className="text-xs font-extrabold text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-1 transition">
                  <span>{t("Tra cứu mã đơn khác")}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div>
                {loading ? (
                  <div className="py-12 text-center text-sm" style={{ color: "var(--muted, #64748b)" }}>
                    <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <span>{t("Đang tải danh sách đơn hàng...")}</span>
                  </div>
                ) : profileData?.orders?.length > 0 ? (
                  <div className="space-y-4">
                    {profileData.orders.map((order: any) => (
                      <div
                        key={order.id}
                        className="track-item"
                      >
                        <div className="flex flex-col sm:flex-row justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-lg border shadow-sm" style={{ background: "var(--surface-strong, #fff)", borderColor: "var(--line, #e2e8f0)", color: "var(--ink, #0f172a)" }}>
                                #{order.orderCode}
                              </span>
                              <span className="text-[11px] flex items-center gap-1 opacity-75" style={{ color: "var(--muted, #64748b)" }}>
                                <Clock className="w-3 h-3" />
                                {new Date(order.createdAt).toLocaleDateString("vi-VN")}
                              </span>
                            </div>
                            <h4 className="font-bold text-sm sm:text-base line-clamp-1" style={{ color: "var(--ink, #0f172a)" }}>
                              {order.productName}
                            </h4>
                            <div className="mt-3 flex flex-wrap items-center gap-2.5 text-xs font-semibold">
                              <span className="track-badge track-badge-gold">
                                <span className="opacity-70 mr-1">Tổng cộng:</span>
                                <b>{order.totalVnd.toLocaleString("vi-VN")} đ</b>
                              </span>

                              <span className={`track-badge ${
                                order.paymentStatus === 'REFUNDED'
                                  ? 'track-badge-gray'
                                  : order.paymentStatus === 'UNPAID'
                                  ? 'track-badge-gold'
                                  : 'track-badge-green'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full mr-1 ${
                                  order.paymentStatus === 'UNPAID' ? 'bg-amber-500' : 'bg-emerald-500'
                                }`} />
                                {order.paymentStatus === 'REFUNDED'
                                  ? 'Đã hoàn tiền'
                                  : order.paymentStatus === 'UNPAID'
                                  ? (!order.isPriceVerified ? 'Chờ duyệt giá' : `Chờ cọc (${order.depositPercent || 50}%)`)
                                  : (order.depositPercent === 100 ? 'Đã thanh toán 100%' : order.depositPercent === 70 ? 'Đã cọc 70%' : 'Đã cọc 50%')}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col items-start sm:items-end justify-between shrink-0 border-t sm:border-t-0 sm:border-l pt-3 sm:pt-0 sm:pl-4" style={{ borderColor: "var(--line, #e2e8f0)" }}>
                            <div className="mb-2 w-full text-left sm:text-right">
                              <div className="text-[10px] uppercase font-black tracking-wider mb-0.5" style={{ color: "var(--muted, #64748b)" }}>Tiến độ</div>
                              <div className="text-xs font-bold" style={{ color: "var(--ink, #0f172a)" }}>
                                {order.status === "PENDING_DEPOSIT" && (!order.isPriceVerified ? "⏳ Chờ duyệt giá" : `⏳ Chờ đặt cọc (${order.depositPercent || 50}%)`)}
                                {order.status === "PURCHASING_JP" && "🛒 Đã cọc • Đang mua tại Nhật"}
                                {order.status === "WAREHOUSE_JP" && "📦 Đã về kho Tokyo"}
                                {order.status === "IN_TRANSIT_AIR" && "✈️ Đang bay về Việt Nam"}
                                {order.status === "WAREHOUSE_VN" && "🛬 Đã về kho Việt Nam"}
                                {order.status === "LOCAL_DELIVERY" && "🚚 Đang giao hàng nội địa"}
                                {order.status === "COMPLETED" && "✅ Đã hoàn thành"}
                                {order.status === "CANCELLED" && "❌ Đã hủy"}
                              </div>
                            </div>

                            <Link
                              href={`/tracking?code=${encodeURIComponent(order.orderCode)}`}
                              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition hover:opacity-90 w-full sm:w-auto"
                              style={{ background: "linear-gradient(135deg, #1e293b, #0f172a)" }}
                            >
                              <span>{t("Xem Chi Tiết")}</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 rounded-3xl border border-dashed p-6" style={{ background: "var(--field-bg, rgba(0,0,0,0.02))", borderColor: "var(--line, #e2e8f0)" }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm text-3xl" style={{ background: "var(--surface-strong, #ffffff)" }}>📦</div>
                    <h4 className="font-extrabold text-base mb-1" style={{ color: "var(--ink, #0f172a)" }}>{t("Bạn chưa có đơn hàng nào.")}</h4>
                    <p className="text-xs mb-5 max-w-sm mx-auto" style={{ color: "var(--muted, #64748b)" }}>{t("Các đơn hàng mua hộ từ Nhật Bản của bạn sẽ được hiển thị và cập nhật lộ trình tự động tại đây.")}</p>
                    <Link
                      href="/#quote"
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-extrabold rounded-2xl transition shadow-md"
                      style={{ background: "#f8db55", color: "#422006" }}
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>{t("Bắt Đầu Mua Sắm")}</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Thẻ lịch sử tư vấn AI */}
            <div className="track-card">
              <div className="pb-4 mb-4 border-b flex items-center justify-between" style={{ borderColor: "var(--line, #e2e8f0)" }}>
                <h3 className="font-extrabold flex items-center gap-2 text-lg" style={{ color: "var(--ink, #0f172a)" }}>
                  <span>💬</span>
                  <span>{t("Lịch Sử Tư Vấn AI")}</span>
                  {profileData?.chatSessions?.length > 0 && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold ml-1" style={{ background: "var(--field-bg, rgba(0,0,0,0.06))", color: "var(--ink, #0f172a)" }}>
                      {profileData.chatSessions.length}
                    </span>
                  )}
                </h3>
                <button
                  onClick={handleOpenAIChat}
                  className="text-xs font-extrabold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t("Hỏi Neo AI ngay")}</span>
                </button>
              </div>

              <div>
                {loading ? (
                  <div className="py-8 text-center text-sm" style={{ color: "var(--muted, #64748b)" }}>{t("Đang tải lịch sử...")}</div>
                ) : profileData?.chatSessions?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {profileData.chatSessions.map((session: any) => (
                      <div
                        key={session.id}
                        className="track-item flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-3.5 h-3.5 opacity-60" style={{ color: "var(--muted, #64748b)" }} />
                            <span className="text-xs font-semibold opacity-75" style={{ color: "var(--muted, #64748b)" }}>
                              {new Date(session.updatedAt).toLocaleDateString("vi-VN")}
                            </span>
                          </div>
                          <h4 className="font-bold text-sm mb-3 line-clamp-2" style={{ color: "var(--ink, #0f172a)" }}>
                            {session.topic || t("Tư vấn sản phẩm Nhật Bản")}
                          </h4>
                        </div>
                        {session.sentiment && (
                          <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--line, #e2e8f0)" }}>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: "var(--muted, #64748b)" }}>Đánh giá AI</span>
                            <span className="track-badge track-badge-blue text-[10px]">
                              {session.sentiment}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm font-medium" style={{ color: "var(--muted, #64748b)" }}>{t("Chưa có lịch sử tư vấn nào được lưu.")}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
