"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  PackageSearch,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Users,
  Ban,
  X,
  ShoppingBag,
  RefreshCw,
  ArrowLeft,
  Truck,
  CreditCard
} from "lucide-react";
import TrackingStepper from "@/components/TrackingStepper";
import { StoredOrder } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useCart } from "@/context/CartContext";
import "@/styles/NeoDaylightCosmos.css";

function TrackingCosmosContent() {
  const searchParams = useSearchParams();
  const { customer, openAuthModal } = useAuth();
  const { totalItems, openCart } = useCart();
  const { toast } = useToast();

  const [calmMode, setCalmMode] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [searchCode, setSearchCode] = useState("");
  const [order, setOrder] = useState<StoredOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isRedirectingVnpay, setIsRedirectingVnpay] = useState(false);
  const [currentTimestamp, setCurrentTimestamp] = useState(0);

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
  const [paymentStatus, setPaymentStatus] = useState<"success" | "failed" | "invalid" | "pending" | null>(null);

  // Tỷ giá live
  const [exchangeRate, setExchangeRate] = useState<number>(172);

  // Parallax pointermove listeners
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (calmMode) return;
      document.documentElement.style.setProperty("--px", (e.clientX / window.innerWidth - 0.5).toString());
      document.documentElement.style.setProperty("--py", (e.clientY / window.innerHeight - 0.5).toString());
    };

    window.addEventListener("pointermove", handleMove, { passive: true });
    return () => window.removeEventListener("pointermove", handleMove);
  }, [calmMode]);

  // Fetch tỷ giá live
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

  useEffect(() => {
    const updateTimestamp = () => setCurrentTimestamp(Date.now());
    updateTimestamp();
    const interval = window.setInterval(updateTimestamp, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleOpenAIChat = () => {
    window.dispatchEvent(new CustomEvent("open-ai-chat"));
  };

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
    } catch {
      setError("Lỗi kết nối máy chủ. Vui lòng thử lại!");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePayVnpay = async () => {
    if (!order || !order.isPriceVerified || order.paymentStatus !== "UNPAID") return;
    setIsRedirectingVnpay(true);
    try {
      const res = await fetch("/api/payment/vnpay-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderCode: order.orderCode, orderInfo: `Thanh toan don hang ${order.orderCode} - ChillBanana` }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        toast.error(data.error || "Không thể tạo liên kết thanh toán. Vui lòng thử lại.");
        setIsRedirectingVnpay(false);
      }
    } catch {
      toast.error("Lỗi kết nối cổng thanh toán. Vui lòng thử lại.");
      setIsRedirectingVnpay(false);
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
    const payment = searchParams.get("payment") as "success" | "failed" | "invalid" | "pending" | null;
    if (payment) setPaymentStatus(payment);
    if (codeParam) {
      setSearchCode(codeParam);
      fetchOrder(codeParam);
      setActiveTab("search");
    } else if (customer) {
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
        toast.success(`Đã hủy đơn hàng #${cancelTargetOrder.orderCode} thành công.`);
        setCancelTargetOrder(null);
        if (order && order.orderCode === cancelTargetOrder.orderCode) {
          fetchOrder(order.orderCode);
        }
        if (customer) {
          fetchMyOrders();
        }
      } else {
        toast.error(data.error || "Không thể hủy đơn hàng. Vui lòng thử lại.");
      }
    } catch {
      toast.error("Không kết nối được máy chủ. Vui lòng thử lại.");
    } finally {
      setIsCancelling(false);
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
          <symbol id="i-box" viewBox="0 0 24 24"><path d="M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10" /></symbol>
          <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></symbol>
        </defs>
      </svg>

      <div className="track-wrap">
        {/* Lối tắt về giao diện NeoDay chính. */}
        <nav className="track-shortcuts" aria-label="Chuyển giao diện">
          <Link href="/" className="track-shortcut">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Về giao diện NeoDay</span>
          </Link>
        </nav>

        {/* Header Bar của trang tra cứu phong cách Cosmos */}
        <header className="track-nav">
          <div className="flex items-center gap-3">
            <Link className="logo" href="/" aria-label="ChillBanana - NeoDay">
              <svg viewBox="0 0 64 64" aria-hidden="true" style={{ width: "100%", height: "100%" }}>
                <path d="M17 43c2-17 15-27 33-27-9 5-14 12-15 24-5 5-13 6-18 3z" fill="#fff3a8" stroke="#c98a00" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M50 16l3-3" stroke="#8a5a00" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </Link>
            <div>
              <b style={{ fontSize: "1.1rem", fontFamily: "'Baloo 2', sans-serif", color: "var(--ink)" }}>ChillBanana</b>
              <span className="jp" style={{ marginLeft: "6px" }}>JP ⇄ VN</span>
              <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--muted)" }}>Theo Dõi Vận Tải Thời Gian Thực</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="track-badge track-badge-gold hidden sm:inline-flex">
              1 JPY = {exchangeRate.toLocaleString("vi-VN")} đ
            </div>
            <button className="chip" onClick={openCart} style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.9)", borderRadius: "999px", padding: "6px 14px", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>
              Giỏ hàng
              <span className="badge" style={{ marginLeft: "6px", background: "var(--banana)", color: "var(--ink)", padding: "1px 6px", borderRadius: "999px", fontSize: "0.7rem", fontWeight: 800 }}>{totalItems}</span>
            </button>
            {customer ? (
              <Link href="/profile" className="chip" style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.9)", borderRadius: "999px", padding: "6px 14px", fontSize: "0.78rem", fontWeight: 700, textDecoration: "none", color: "var(--ink)" }}>
                👤 {customer.name || "Tài khoản"}
              </Link>
            ) : (
              <button className="chip" onClick={() => openAuthModal("login")} style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.9)", borderRadius: "999px", padding: "6px 14px", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>
                Đăng nhập
              </button>
            )}
          </div>
        </header>

        {/* Hero Section */}
        <div className="track-hero">
          <span className="tag">HỆ THỐNG THEO DÕI VẬN TẢI CHILLBANANA · TOKYO ⇄ VIỆT NAM</span>
          <h1>Tra Cứu &amp; Quản Lý Đơn Hàng Mua Hộ</h1>
          <p className="sub" style={{ maxWidth: "620px" }}>
            Theo dõi chi tiết 7 chặng vận chuyển từ Tokyo về tận tay bạn tại Việt Nam. Quản lý trạng thái đơn hàng, kiểm tra cước bay và hỗ trợ hủy đơn linh hoạt.
          </p>
        </div>

        {/* Banners phản hồi thanh toán VNPAY */}
        {paymentStatus === "success" && (
          <div className="track-card mb-6" style={{ background: "#e8f8f0", borderColor: "#a3e6cd" }}>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-emerald-950">Thanh toán qua VNPAY thành công! 🎉</p>
                <p className="text-xs text-emerald-700">Giao dịch đã được xác nhận. Tiến độ xử lý đơn được cập nhật bên dưới.</p>
              </div>
              <button onClick={() => setPaymentStatus(null)} className="ml-auto text-emerald-700 hover:text-emerald-950">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        {(paymentStatus === "failed" || paymentStatus === "invalid") && (
          <div className="track-card mb-6" style={{ background: "#ffeef0", borderColor: "#fecdd6" }}>
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
              <div>
                <p className="font-bold text-rose-950">Thanh toán chưa hoàn tất</p>
                <p className="text-xs text-rose-700">Giao dịch bị hủy hoặc chưa hoàn tất. Đơn vẫn được lưu; bạn có thể thử thanh toán lại từ trang này.</p>
              </div>
              <button onClick={() => setPaymentStatus(null)} className="ml-auto text-rose-700 hover:text-rose-950">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Tab Switcher (Khi khách hàng đã đăng nhập) */}
        {customer && (
          <div className="track-tabs">
            <div className="tabs" role="tablist">
              <button
                role="tab"
                aria-selected={activeTab === "my_orders"}
                onClick={() => setActiveTab("my_orders")}
              >
                <ShoppingBag className="w-4 h-4 inline mr-1.5" />
                Đơn Hàng Của Tôi ({myOrders.length})
              </button>
              <button
                role="tab"
                aria-selected={activeTab === "search"}
                onClick={() => setActiveTab("search")}
              >
                <Search className="w-4 h-4 inline mr-1.5" />
                Tra Cứu Mã Đơn Khác
              </button>
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* TAB 1: ĐƠN HÀNG CỦA TÔI (MY ORDERS CRM) */}
        {/* ========================================================== */}
        {customer && activeTab === "my_orders" && (
          <div className="space-y-6">
            <div className="track-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>Quản Lý Đơn Hàng Của {customer.name}</span>
                  <span className="track-badge track-badge-gold">Thành viên VIP</span>
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                  Theo dõi danh sách đơn mua hộ từ các sàn Nhật Bản, kiểm tra tiến độ giao vận và chủ động hủy đơn khi cần.
                </p>
              </div>
              <button
                onClick={fetchMyOrders}
                className="btn2"
                style={{ padding: "8px 16px", fontSize: "0.8rem", alignSelf: "flex-start" }}
              >
                <RefreshCw className={`w-3.5 h-3.5 inline mr-1.5 ${loadingMyOrders ? "animate-spin" : ""}`} />
                <span>Làm mới danh sách</span>
              </button>
            </div>

            {loadingMyOrders ? (
              <div className="track-card text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-2" />
                <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Đang đồng bộ danh sách đơn hàng từ máy chủ...</p>
              </div>
            ) : myOrders.length === 0 ? (
              <div className="track-card text-center py-12 space-y-3">
                <div style={{ fontSize: "2.5rem" }}>🛍️</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800 }}>Bạn chưa có đơn hàng nào</h3>
                <p style={{ fontSize: "0.82rem", color: "var(--muted)", maxWidth: "420px", margin: "0 auto" }}>
                  Dán link sản phẩm từ Amazon JP, Mercari hoặc Rakuten vào công cụ tính giá tự động để tạo đơn mua hộ đầu tiên!
                </p>
                <div style={{ paddingTop: "8px" }}>
                  <Link href="/#quote" className="cta" style={{ textDecoration: "none", display: "inline-flex" }}>
                    Dán Link Mua Hộ Ngay <svg><use href="#i-arrow" /></svg>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {myOrders.map((item) => (
                  <div key={item.id} className="track-item flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: "0.95rem", color: "var(--ink)" }}>
                          #{item.orderCode}
                        </span>
                        <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                          {new Date(item.createdAt).toLocaleDateString("vi-VN")}
                        </span>

                        {/* Trạng thái đơn hàng */}
                        {item.status === "CANCELLED" ? (
                          <span className="track-badge track-badge-rose">✕ Đã Hủy</span>
                        ) : item.status === "COMPLETED" ? (
                          <span className="track-badge track-badge-green">✓ Hoàn Tất</span>
                        ) : (
                          <span className="track-badge track-badge-blue">{item.status}</span>
                        )}

                        {/* Trạng thái thanh toán */}
                        <span
                          className={`track-badge ${
                            item.paymentStatus === "REFUNDED"
                              ? "track-badge-gray"
                              : item.paymentStatus === "UNPAID"
                              ? "track-badge-gray"
                              : item.paymentStatus === "DEPOSITED_50"
                              ? "track-badge-gold"
                              : "track-badge-green"
                          }`}
                        >
                          {item.paymentStatus === "REFUNDED"
                            ? "Đã hoàn tiền"
                            : item.paymentStatus === "UNPAID"
                            ? "Chờ cọc"
                            : item.paymentStatus === "DEPOSITED_50"
                            ? "Đã cọc 50%"
                            : "Đã TT 100%"}
                        </span>
                      </div>

                      <div>
                        <h4 style={{ fontWeight: 800, fontSize: "0.92rem", color: "var(--ink)", margin: 0 }}>
                          {item.productName}
                        </h4>
                        <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "4px 0 0" }}>
                          Tổng chi phí: <strong style={{ color: "var(--ink)", fontFamily: "monospace" }}>{item.totalVnd.toLocaleString("vi-VN")} đ</strong>
                          {" "}(Thanh toán {item.depositPercent || 50}%: <b style={{ color: "#d97706" }}>{item.depositAmountVnd.toLocaleString("vi-VN")} đ</b>)
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
                        className="cta"
                        style={{ padding: "8px 18px", fontSize: "0.78rem" }}
                      >
                        <PackageSearch className="w-3.5 h-3.5 inline mr-1" />
                        <span>Xem Hành Trình</span>
                      </button>

                      {item.canCancel && (
                        <button
                          onClick={() => openCustomerCancelModal(item)}
                          className="btn2"
                          style={{ padding: "8px 14px", fontSize: "0.78rem", color: "#c01048", borderColor: "#fecdd6" }}
                        >
                          <Ban className="w-3.5 h-3.5 inline mr-1" />
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
          <div className="space-y-6">
            {/* Thanh Search Bar phong cách Cosmos */}
            <form onSubmit={handleSearchSubmit} className="track-search">
              <div className="track-search-field">
                <Search className="track-search-icon" aria-hidden="true" />
                <input
                  type="text"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  placeholder="Nhập mã đơn hàng (Ví dụ: CB-2026-XXXX)"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="cta"
                style={{ padding: "12px 24px", fontSize: "0.88rem", flexShrink: 0 }}
              >
                {loading ? "Đang tìm..." : "Tra Cứu"} <svg><use href="#i-arrow" /></svg>
              </button>
            </form>

            <p className="track-search-hint" style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--muted)", margin: "8px 0 0" }}>
              Mã đơn hàng có cấu trúc <strong style={{ fontFamily: "monospace", color: "var(--ink)" }}>CB-2026-XXXX</strong> được tạo khi bạn bấm Đặt cọc trên hệ thống.
            </p>

            {/* Error display */}
            {error && (
              <div className="track-card max-w-3xl mx-auto" style={{ background: "#ffeef0", borderColor: "#fecdd6", padding: "16px" }}>
                <div className="flex items-center gap-2 text-rose-800 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Welcome guidance khi chưa tra cứu */}
            {!order && !loading && !error && (
              <div className="track-card max-w-3xl mx-auto text-center py-12 space-y-4">
                <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "#fff8d6", color: "#8a5a00", display: "grid", placeItems: "center", margin: "0 auto", fontSize: "1.8rem" }}>
                  📦
                </div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 800 }}>
                  Theo Dõi Hành Trình Kiện Hàng 7 Bước
                </h3>
                <p style={{ fontSize: "0.82rem", color: "var(--muted)", maxWidth: "440px", margin: "0 auto", lineHeight: 1.6 }}>
                  Nhập mã đơn hàng của bạn vào ô tìm kiếm phía trên để theo dõi từng chặng di chuyển thực tế từ kho Tokyo về đến tận cửa nhà bạn tại Việt Nam.
                </p>
                <div style={{ paddingTop: "8px" }}>
                  <Link href="/#quote" className="btn2" style={{ textDecoration: "none", display: "inline-flex" }}>
                    Tạo Đơn Hàng Mới Tại Neo Cosmos <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                  </Link>
                </div>
              </div>
            )}

            {/* Chi tiết đơn hàng & Hành trình khi đã tìm thấy */}
            {order && (
              <div className="space-y-6">
                {/* Card tổng quan & Stepper 7 bước */}
                <div className="track-card space-y-6">
                  {/* Top Bar: Order Code & Badges */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200/60 gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="track-badge track-badge-gold">Đơn Mua Hộ</span>
                        <h2 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0, fontFamily: "monospace", color: "var(--ink)" }}>
                          {order.orderCode}
                        </h2>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "4px 0 0" }}>
                        Khởi tạo lúc: {new Date(order.createdAt).toLocaleString("vi-VN")}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {order.isGroupBuy && (
                        <span className="track-badge track-badge-purple">
                          <Users className="w-3 h-3 mr-1" /> Gộp Đơn Tiết Kiệm (-25%)
                        </span>
                      )}

                      {order.status === "CANCELLED" ? (
                        <span className="track-badge track-badge-rose">
                          <Ban className="w-3 h-3 mr-1" /> Đã Hủy
                        </span>
                      ) : (
                        <span className="track-badge track-badge-blue">
                          {order.paymentStatus === "REFUNDED"
                            ? "Đã hoàn tiền"
                            : order.paymentStatus === "PAID_100"
                            ? "Đã thanh toán 100%"
                            : order.paymentStatus === "DEPOSITED_50"
                            ? "Đã cọc 50%"
                            : "Chờ đặt cọc"}
                        </span>
                      )}

                      {order.canCancel && (
                        <button
                          onClick={() => openCustomerCancelModal(order)}
                          className="btn2"
                          style={{ padding: "6px 14px", fontSize: "0.75rem", color: "#c01048", borderColor: "#fecdd6" }}
                        >
                          <Ban className="w-3.5 h-3.5 inline mr-1 text-rose-600" />
                          <span>Hủy Đơn Hàng</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stepper 7 Bước */}
                  <div>
                    <h3 style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", margin: "0 0 16px" }}>
                      Tiến Độ Vận Tải Quốc Tế &amp; Nội Địa (7 Chặng)
                    </h3>
                    <div className="track-stepper-box">
                      <TrackingStepper currentStatus={order.status} />
                    </div>
                  </div>

                  {/* Vận đơn đối tác nếu có */}
                  {(order.jpDomesticTrack || order.vnDomesticTrack) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      {order.jpDomesticTrack && (
                        <div className="track-item" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={{ fontSize: "1.5rem" }}>🇯🇵</span>
                          <div>
                            <small style={{ color: "var(--muted)", display: "block" }}>Vận đơn nội địa Nhật Bản:</small>
                            <b style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>{order.jpDomesticTrack}</b>
                          </div>
                        </div>
                      )}
                      {order.vnDomesticTrack && (
                        <div className="track-item" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={{ fontSize: "1.5rem" }}>🇻🇳</span>
                          <div>
                            <small style={{ color: "var(--muted)", display: "block" }}>Vận đơn giao hàng tại Việt Nam:</small>
                            <b style={{ fontFamily: "monospace", fontSize: "0.9rem", color: "#167a48" }}>{order.vnDomesticTrack}</b>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2 Cột: Thông tin đơn hàng & Nhật ký hành trình */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Cột Trái: Chi tiết kiện hàng & Tài chính */}
                  <div className="lg:col-span-7 track-card space-y-4">
                    <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: 0, paddingBottom: "12px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                      Chi Tiết Kiện Hàng &amp; Chi Phí
                    </h3>

                    <div style={{ fontSize: "0.85rem", lineHeight: 1.8 }}>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span style={{ color: "var(--muted)" }}>Tên sản phẩm:</span>
                        <b style={{ textAlign: "right", maxWidth: "60%" }}>{order.productName}</b>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span style={{ color: "var(--muted)" }}>Giá gốc tại Nhật:</span>
                        <b>{order.priceJpy?.toLocaleString("vi-VN")} ¥</b>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span style={{ color: "var(--muted)" }}>Tỷ giá áp dụng:</span>
                        <span>1 JPY = {order.exchangeRate} đ</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span style={{ color: "var(--muted)" }}>Tiền hàng quy đổi:</span>
                        <b>{order.productPriceVnd?.toLocaleString("vi-VN")} đ</b>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span style={{ color: "var(--muted)" }}>Phí mua hộ &amp; bảo hiểm (4%):</span>
                        <b>{order.serviceFeeVnd?.toLocaleString("vi-VN")} đ</b>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span style={{ color: "var(--muted)" }}>Cước bay quốc tế:</span>
                        <b style={{ color: "#167a48" }}>{order.isGroupBuy ? "Ưu đãi Gộp Đơn (-25%)" : "Cân đo thực tế khi về kho"}</b>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-200">
                        <span style={{ fontWeight: 800 }}>Tổng tiền hàng:</span>
                        <b style={{ fontSize: "1.1rem", color: "var(--ink)" }}>{order.totalVnd?.toLocaleString("vi-VN")} đ</b>
                      </div>
                      <div className="flex justify-between py-2" style={{ background: "rgba(248,219,85,0.2)", padding: "10px 14px", borderRadius: "14px" }}>
                        <span style={{ fontWeight: 800, color: "#8a5a00" }}>{order.isPriceVerified ? `Số tiền cần thanh toán (${order.depositPercent || 50}%):` : "Mức thanh toán tạm tính:"}</span>
                        <b style={{ fontSize: "1.15rem", color: "#8a5a00" }}>{order.depositAmountVnd?.toLocaleString("vi-VN")} đ</b>
                      </div>
                    </div>

                    {order.status === "PENDING_DEPOSIT" && order.paymentStatus === "UNPAID" && (
                      order.isPriceVerified ? (
                        order.reservationExpiresAt && currentTimestamp > 0 && new Date(order.reservationExpiresAt).getTime() <= currentTimestamp ? (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Thời gian giữ hàng đã hết. Vui lòng liên hệ ChillBanana để kiểm tra tồn kho trước khi thanh toán.</div>
                        ) : (
                          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 space-y-3">
                            <div>
                              <p className="font-bold text-sky-950">Thanh toán đơn hàng</p>
                              <p className="text-xs text-sky-800">VNPAY sẽ tự xác nhận giao dịch. Nếu chuyển khoản VietQR, hãy ghi đúng mã đơn và chờ nhân viên đối chiếu.</p>
                              {order.reservationExpiresAt && <p className="text-xs text-sky-800 mt-1">Thời hạn giữ hàng đến {new Date(order.reservationExpiresAt).toLocaleString("vi-VN")}.</p>}
                            </div>
                            <button onClick={handlePayVnpay} disabled={isRedirectingVnpay} className="w-full rounded-xl bg-[#0066CC] px-4 py-3 text-sm font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2">
                              <CreditCard className="w-4 h-4" />{isRedirectingVnpay ? "Đang chuyển đến VNPAY..." : "Thanh toán qua VNPAY"}
                            </button>
                            <div className="text-center text-xs text-slate-600">
                              <p>Hoặc chuyển khoản VietQR, nội dung: <strong>{order.orderCode}</strong></p>
                              <img src={`https://img.vietqr.io/image/970422-0901234567-compact2.png?amount=${order.depositAmountVnd}&addInfo=${encodeURIComponent(order.orderCode)}&accountName=CHILLBANANA`} alt="Mã VietQR thanh toán đơn hàng" className="mx-auto mt-2 w-48 rounded-xl border border-white bg-white p-2" />
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Đơn đang chờ xác nhận báo giá. Vui lòng chưa thanh toán; hướng dẫn và số tiền cuối cùng sẽ xuất hiện tại đây sau khi được duyệt.</div>
                      )
                    )}

                    {/* Thông tin người nhận */}
                    <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px dashed #cbd5e1", fontSize: "0.82rem" }}>
                      <p style={{ margin: "2px 0", color: "var(--muted)" }}>Người nhận: <b style={{ color: "var(--ink)" }}>{order.customerName}</b> · SĐT: <b style={{ color: "var(--ink)" }}>{order.customerPhone}</b></p>
                      <p style={{ margin: "2px 0", color: "var(--muted)" }}>Địa chỉ giao hàng: <span style={{ color: "var(--ink)" }}>{order.customerAddress}</span></p>
                      {order.customerNote && (
                        <p style={{ margin: "4px 0 0", color: "var(--muted)", fontStyle: "italic" }}>Ghi chú: "{order.customerNote}"</p>
                      )}
                    </div>
                  </div>

                  {/* Cột Phải: Nhật ký hành trình thời gian thực */}
                  <div className="lg:col-span-5 track-card space-y-4">
                    <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: 0, paddingBottom: "12px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                      Nhật Ký Hành Trình Thời Gian Thực
                    </h3>

                    {order.trackingLogs && order.trackingLogs.length > 0 ? (
                      <div style={{ paddingTop: "8px" }}>
                        {order.trackingLogs.map((log) => (
                          <div key={log.id} className="track-log-item">
                            <span className="track-log-dot" />
                            <div style={{ fontSize: "0.85rem" }}>
                              <b style={{ color: "var(--ink)", display: "block" }}>{log.title}</b>
                              <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "3px 0" }}>{log.description}</p>
                              <div className="flex items-center gap-2" style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                                <Clock className="w-3 h-3" />
                                <span>{new Date(log.createdAt).toLocaleString("vi-VN")}</span>
                                {log.location && <span>· 📍 {log.location}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8" style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                        <Truck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        Chưa có ghi nhận nhật ký vận chuyển mới cho đơn hàng này.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Hủy Đơn Hàng Phía Khách Hàng */}
      {cancelTargetOrder && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(6px)", display: "grid", placeItems: "center", padding: "16px" }}>
          <div className="track-card max-w-lg w-full space-y-4" style={{ background: "#fff" }}>
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>
                Xác Nhận Hủy Đơn #{cancelTargetOrder.orderCode}
              </h3>
              <button
                type="button"
                onClick={() => setCancelTargetOrder(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "0.82rem", color: "var(--muted)", margin: 0 }}>
              Bạn đang yêu cầu hủy đơn hàng <b>{cancelTargetOrder.productName}</b>. Vui lòng cho biết lý do để ChillBanana hỗ trợ tốt hơn:
            </p>

            <form onSubmit={handleCustomerCancelSubmit} className="space-y-3">
              {[
                "Tôi đổi ý, không có nhu cầu mua nữa",
                "Tìm được nơi bán khác giá tốt hơn",
                "Thời gian giao dự kiến lâu hơn mong đợi",
                "Tôi nhập sai thông tin địa chỉ / phân loại hàng",
                "Khác",
              ].map((reason) => (
                <label key={reason} className="flex items-center gap-2" style={{ fontSize: "0.8rem", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="reason"
                    checked={cancelReason === reason}
                    onChange={() => setCancelReason(reason)}
                  />
                  <span>{reason}</span>
                </label>
              ))}

              {cancelReason === "Khác" && (
                <textarea
                  value={cancelCustomReason}
                  onChange={(e) => setCancelCustomReason(e.target.value)}
                  placeholder="Nhập lý do cụ thể của bạn..."
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs outline-none focus:border-banana-400"
                  required
                />
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelTargetOrder(null)}
                  className="btn2"
                  style={{ padding: "8px 16px", fontSize: "0.8rem" }}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isCancelling}
                  className="cta"
                  style={{ padding: "8px 20px", fontSize: "0.8rem", background: "linear-gradient(135deg, #f43f5e, #e11d48)", color: "#fff" }}
                >
                  {isCancelling ? "Đang xử lý..." : "Xác Nhận Hủy Đơn"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Nút Mascot AI Nổi */}
      <aside className="neo" aria-label="Trợ lý ChillBanana AI">
        <button
          aria-label="Hỏi ChillBanana AI"
          onClick={handleOpenAIChat}
          title="Bấm để hỏi Neo AI về đơn hàng của bạn"
        >
          <svg viewBox="0 0 34 34" aria-hidden="true">
            <circle cx="17" cy="17" r="12" fill="#fff" stroke="#2b7fb0" strokeWidth="2" />
            <rect x="9" y="12" width="16" height="10" rx="5" fill="#5abae6" />
            <circle cx="14" cy="17" r="1.6" fill="#fff" />
            <circle cx="20" cy="17" r="1.6" fill="#fff" />
          </svg>
        </button>
      </aside>

      {/* Nút công tắc hiệu ứng */}
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

export default function TrackingPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "48px 16px", textAlign: "center", color: "#64748b", fontSize: "0.85rem" }}>
          Đang khởi tạo không gian vũ trụ tra cứu đơn hàng...
        </div>
      }
    >
      <TrackingCosmosContent />
    </Suspense>
  );
}
