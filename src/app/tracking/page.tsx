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
  CreditCard,
  Copy,
  Share2,
  MessageSquare,
  Sparkles,
  ClipboardPaste,
  HelpCircle,
  Check,
  Plane,
  ShieldCheck,
} from "lucide-react";
import TrackingStepper from "@/components/TrackingStepper";
import { StoredOrder } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useCart } from "@/context/CartContext";
import { WebsitePreferencesTrigger } from "@/components/WebsitePreferencesPanel";
import { useWebsitePreferences, useWebsiteText } from "@/context/WebsitePreferencesContext";
import { DEFAULT_EXCHANGE_RATE } from "@/features/pricing/calculator";
import "@/styles/NeoDaylightCosmos.css";

function TrackingCosmosContent() {
  const searchParams = useSearchParams();
  const { customer, openAuthModal, logout } = useAuth();
  const { totalItems, openCart } = useCart();
  const { toast } = useToast();

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUserDropdownOpen(false);
      }
    };
    if (userDropdownOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [userDropdownOpen]);

  const { preferences } = useWebsitePreferences();
  const t = useWebsiteText();
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Cấu hình tài khoản nhận cọc VietQR (ưu tiên biến môi trường, đồng bộ với NeoDaylightCosmos)
  const bankBin = process.env.NEXT_PUBLIC_BANK_BIN || "970422";
  const bankAccount = process.env.NEXT_PUBLIC_BANK_ACCOUNT || "0901234567";
  const bankOwner = process.env.NEXT_PUBLIC_BANK_OWNER || "CHILLBANANA VIETNAM";
  const bankName = process.env.NEXT_PUBLIC_BANK_NAME || "MB Bank (Quân Đội)";

  const [searchCode, setSearchCode] = useState("");
  const [order, setOrder] = useState<StoredOrder | null>(null);
  const [vnJpShipment, setVnJpShipment] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requiresEmailAccess, setRequiresEmailAccess] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [accessRequestSent, setAccessRequestSent] = useState(false);
  const [isRedirectingVnpay, setIsRedirectingVnpay] = useState(false);
  const [currentTimestamp, setCurrentTimestamp] = useState(0);

  // Quản lý tab hiển thị: "search" (Tra cứu mã) | "my_orders" (Đơn hàng của tôi)
  const [activeTab, setActiveTab] = useState<"search" | "my_orders">("search");
  const [recentCodes, setRecentCodes] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("chillbanana_recent_tracking");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setRecentCodes(parsed.slice(0, 5));
      }
    } catch {}
  }, []);

  const saveRecentCode = (code: string) => {
    const c = code.trim();
    if (!c) return;
    setRecentCodes((prev) => {
      const next = [c, ...prev.filter((x) => x !== c)].slice(0, 5);
      try {
        window.localStorage.setItem("chillbanana_recent_tracking", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const removeRecentCode = (code: string) => {
    setRecentCodes((prev) => {
      const next = prev.filter((x) => x !== code);
      try {
        window.localStorage.setItem("chillbanana_recent_tracking", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (trimmed) {
        setSearchCode(trimmed);
        fetchOrder(trimmed);
        toast.success("Đã dán mã từ clipboard và đang tra cứu!");
      }
    } catch {
      toast.info("Vui lòng nhập mã đơn hoặc cấp quyền dán cho trình duyệt.");
    }
  };

  const handleCopyOrderCode = (code: string) => {
    try {
      navigator.clipboard.writeText(code);
      toast.success(`Đã sao chép mã đơn #${code}!`);
    } catch {
      toast.info(`Mã đơn: #${code}`);
    }
  };

  const handleShareTrackingLink = (code: string) => {
    try {
      const url = `${window.location.origin}/tracking?code=${encodeURIComponent(code)}`;
      navigator.clipboard.writeText(url);
      toast.success("Đã sao chép liên kết theo dõi đơn hàng!");
    } catch {
      toast.info("Không thể sao chép liên kết.");
    }
  };

  const handleAskNeoAboutOrder = (code: string) => {
    window.dispatchEvent(
      new CustomEvent("open-ai-chat", {
        detail: { initialPrompt: `Neo ơi, hãy kiểm tra tiến độ và hành trình chi tiết của đơn hàng #${code} giúp mình nhé!` },
      })
    );
  };
  const [myOrders, setMyOrders] = useState<StoredOrder[]>([]);
  const [loadingMyOrders, setLoadingMyOrders] = useState(false);

  // Modal Hủy Đơn Hàng (Phía Khách Hàng)
  const [cancelTargetOrder, setCancelTargetOrder] = useState<StoredOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("Tôi đổi ý, không có nhu cầu mua nữa");
  const [cancelCustomReason, setCancelCustomReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  // Trạng thái thanh toán VNPAY trả về
  const [paymentStatus, setPaymentStatus] = useState<"success" | "simulated" | "failed" | "invalid" | "pending" | "cancelled" | null>(null);

  // Tỷ giá live
  const [exchangeRate, setExchangeRate] = useState<number>(DEFAULT_EXCHANGE_RATE);

  // Parallax pointermove listeners
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

    window.addEventListener("pointermove", handleMove, { passive: true });
    return () => window.removeEventListener("pointermove", handleMove);
  }, [preferences.effectsEnabled]);

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
    const c = code.trim();
    if (!c) return;

    // Tra cứu vận đơn gửi hàng chiều Việt Nam -> Nhật Bản
    if (c.toUpperCase().startsWith("VNJP-")) {
      setLoading(true);
      setError("");
      setRequiresEmailAccess(false);
      try {
        const res = await fetch(`/api/vn-jp-shipments/track/${encodeURIComponent(c)}`);
        const data = await res.json();
        if (res.ok && data.success && data.shipment) {
          setVnJpShipment(data.shipment);
          setOrder(null);
          saveRecentCode(c);
          setAccessRequestSent(false);
        } else {
          setError(data.error || "Không tìm thấy mã vận đơn VN → JP. Vui lòng kiểm tra lại.");
          setVnJpShipment(null);
          setOrder(null);
        }
      } catch {
        setError("Lỗi kết nối máy chủ khi tra cứu vận đơn VN → JP. Vui lòng thử lại!");
        setVnJpShipment(null);
        setOrder(null);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Hỗ trợ mã đơn mô phỏng trực quan nhanh (Demo Order)
    if (c.toUpperCase() === "CB-2026-DEMO" || c.toUpperCase() === "CB-DEMO" || c.toUpperCase() === "CB-2026-TOKYO") {
      setLoading(true);
      setError("");
      setRequiresEmailAccess(false);
      setTimeout(() => {
        const demoOrder: StoredOrder = {
          id: "demo-8821",
          orderCode: c.toUpperCase() === "CB-2026-TOKYO" ? "CB-2026-TOKYO" : "CB-2026-DEMO",
          productName: "Mô hình Bandai RG 1/144 RX-78-2 Ver 2.0 (Mobile Suit Gundam JP)",
          category: "figures",
          originalUrl: "https://www.amazon.co.jp/dp/B0D179WXYZ",
          priceJpy: 4500,
          weightKg: 0.6,
          exchangeRate: exchangeRate || 169,
          productPriceVnd: 4500 * (exchangeRate || 169),
          serviceFeeVnd: 30420,
          shippingFeeVnd: 150000,
          totalVnd: 4500 * (exchangeRate || 169) + 30420 + 150000,
          depositPercent: 50,
          depositAmountVnd: Math.round((4500 * (exchangeRate || 169) + 30420 + 150000) * 0.5),
          paymentStatus: "DEPOSITED_50",
          paymentMethod: "VNPAY",
          isPriceVerified: true,
          isGroupBuy: true,
          status: "IN_TRANSIT_AIR",
          jpDomesticTrack: "Yamato: 4829-1029-3810",
          vnDomesticTrack: "ViettelPost: VTP-92817341",
          customerName: "Khách hàng Trải nghiệm (Demo)",
          customerEmail: "khachhang.demo@chillbanana.vn",
          customerPhone: "0901 234 567",
          customerAddress: "Số 88 Đường Láng, Đống Đa, Hà Nội",
          customerNote: "Hộp mô hình cần chèn bọt khí 3 lớp chống móp méo vỏ hộp",
          createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
          updatedAt: new Date().toISOString(),
          canCancel: false,
          trackingLogs: [
            {
              id: "tl-3",
              status: "IN_TRANSIT_AIR",
              title: "Đang bay chuyên tuyến Narita ✈️ Nội Bài",
              description: "Chuyến bay VN686 đã cất cánh từ sân bay Tokyo Narita (NRT), dự kiến hạ cánh Nội Bài (HAN) trong đêm nay.",
              location: "Sân bay Quốc tế Narita (NRT), Tokyo",
              createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
            },
            {
              id: "tl-2",
              status: "WAREHOUSE_JP",
              title: "Nhập kho Tokyo & Đóng bọc xốp khí",
              description: "Kiện hàng đã về kho ChillBanana Tokyo. Đã kiểm tra tem niêm phong và đóng hộp chống sốc 3 lớp.",
              location: "Kho Tokyo (Adachi-ku)",
              createdAt: new Date(Date.now() - 86400000 * 1.5).toISOString(),
            },
            {
              id: "tl-1",
              status: "PURCHASING_JP",
              title: "Đã mua hàng thành công trên Amazon Japan",
              description: "Đơn mua hộ đã được thanh toán cho gian hàng Bandai Namco tại Nhật Bản.",
              location: "Tokyo, Nhật Bản",
              createdAt: new Date(Date.now() - 86400000 * 2.8).toISOString(),
            },
          ],
        };
        setOrder(demoOrder);
        setVnJpShipment(null);
        saveRecentCode(demoOrder.orderCode);
        setLoading(false);
        toast.success("Đang hiển thị dữ liệu hành trình mẫu trực quan!");
      }, 350);
      return;
    }

    setLoading(true);
    setError("");
    setRequiresEmailAccess(false);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(c)}`);
      const data = await res.json();
      if (res.ok && data.success && data.order) {
        setOrder(data.order);
        setVnJpShipment(null);
        saveRecentCode(c);
        setAccessRequestSent(false);
      } else {
        setError(data.error || "Không tìm thấy đơn hàng. Vui lòng kiểm tra lại mã đơn.");
        // BẢO MẬT & UX (P2-11): Chỉ hiện khung xác minh email khi chưa đăng nhập và nhận mã 401 Unauthorized
        setRequiresEmailAccess(!customer && (res.status === 401 || res.status === 404));
        setOrder(null);
      }
    } catch {
      setError("Lỗi kết nối máy chủ. Vui lòng thử lại!");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestGuestAccess = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!searchCode.trim() || !guestEmail.trim()) return;
    setRequestingAccess(true);
    setAccessRequestSent(false);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(searchCode.trim())}/lookup-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: guestEmail.trim() }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setAccessRequestSent(true);
      } else {
        setError(data.error || "Không gửi được yêu cầu. Vui lòng thử lại sau.");
      }
    } catch {
      setError("Không kết nối được máy chủ. Vui lòng thử lại.");
    } finally {
      setRequestingAccess(false);
    }
  };

  const handlePayVnpay = async () => {
    if (!order || !order.isPriceVerified || order.paymentStatus !== "UNPAID") return;
    setIsRedirectingVnpay(true);
    try {
      const res = await fetch("/api/payment/vnpay-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode: order.orderCode,
          phone: order.customerPhone,
          orderInfo: `Thanh toan don hang ${order.orderCode} - ChillBanana`,
        }),
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
    const accessToken = searchParams.get("access");
    const payment = searchParams.get("payment") as "success" | "simulated" | "failed" | "invalid" | "pending" | "cancelled" | null;
    if (payment) setPaymentStatus(payment);
    if (codeParam) {
      setSearchCode(codeParam);
      setActiveTab("search");
      if (accessToken) {
        void (async () => {
          try {
            const response = await fetch(`/api/orders/${encodeURIComponent(codeParam)}/access`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ accessToken }),
            });
            if (!response.ok) {
              setError("Liên kết xem đơn đã hết hạn hoặc không hợp lệ. Bạn có thể yêu cầu gửi liên kết mới qua email.");
              setRequiresEmailAccess(true);
              return;
            }
            const params = new URLSearchParams(window.location.search);
            params.delete("access");
            window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
            await fetchOrder(codeParam);
          } catch {
            setError("Không thể xác minh liên kết. Vui lòng thử lại.");
            setRequiresEmailAccess(true);
          }
        })();
      } else {
        fetchOrder(codeParam);
      }
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
              className="pill-gem pill-gem--active"
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
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition hover:bg-black/5 dark:hover:bg-white/5"
                      style={{ color: "var(--ink, #0f172a)" }}
                      role="menuitem"
                    >
                      <span>👤</span>
                      <span>{t("Hồ sơ của tôi")}</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        setActiveTab("my_orders");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition hover:bg-black/5 dark:hover:bg-white/5 text-left"
                      style={{ color: "var(--ink, #0f172a)" }}
                      role="menuitem"
                    >
                      <span>📦</span>
                      <span>{t("Đơn hàng của tôi")}</span>
                    </button>

                    <div className="my-1 border-t" style={{ borderColor: "var(--line, #e2e8f0)" }} />

                    <button
                      type="button"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        logout();
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

      <div className="track-wrap">

        {/* Hero Section */}
        <div className="track-hero">
          <span className="tag">{t("HỆ THỐNG THEO DÕI VẬN TẢI CHILLBANANA · TOKYO ⇄ VIỆT NAM")}</span>
          <h1>{t("Tra Cứu & Quản Lý Đơn Hàng Mua Hộ")}</h1>
          <p className="sub" style={{ maxWidth: "620px" }}>
            {t("Theo dõi chi tiết 7 chặng vận chuyển từ Tokyo về tận tay bạn tại Việt Nam. Quản lý trạng thái đơn hàng, kiểm tra cước bay và hỗ trợ hủy đơn linh hoạt.")}
          </p>
        </div>

        {/* Banners phản hồi thanh toán VNPAY */}
        {paymentStatus === "success" && (
          <div className="track-card mb-6" style={{ background: "#e8f8f0", borderColor: "#a3e6cd" }}>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-emerald-950">{t("Thanh toán qua VNPAY thành công! 🎉")}</p>
                <p className="text-xs text-emerald-700">{t("Giao dịch đã được xác nhận. Tiến độ xử lý đơn được cập nhật bên dưới.")}</p>
              </div>
              <button onClick={() => setPaymentStatus(null)} className="ml-auto text-emerald-700 hover:text-emerald-950">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        {paymentStatus === "simulated" && (
          <div className="track-card mb-6" style={{ background: "#fff8e6", borderColor: "#f4d27d" }}>
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-amber-700 shrink-0" />
              <div>
                <p className="font-bold text-amber-950">Đã ghi nhận kịch bản VNPAY sandbox</p>
                <p className="text-xs text-amber-800">Đây là kết quả kiểm thử, không phải thanh toán thật. Đơn vẫn chờ thanh toán và không được chuyển sang mua hàng.</p>
              </div>
              <button onClick={() => setPaymentStatus(null)} className="ml-auto text-amber-700 hover:text-amber-950" aria-label="Đóng thông báo">
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
                <p className="font-bold text-rose-950">{t("Thanh toán chưa hoàn tất")}</p>
                <p className="text-xs text-rose-700">{t("Giao dịch bị lỗi hoặc chưa hoàn tất. Đơn vẫn được lưu; bạn có thể thử thanh toán lại từ trang này.")}</p>
              </div>
              <button onClick={() => setPaymentStatus(null)} className="ml-auto text-rose-700 hover:text-rose-950">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        {paymentStatus === "cancelled" && (
          <div className="track-card mb-6" style={{ background: "#fff8e6", borderColor: "#f4d27d" }}>
            <div className="flex items-center gap-3">
              <Ban className="w-6 h-6 text-amber-700 shrink-0" />
              <div>
                <p className="font-bold text-amber-950">{t("Giao dịch thanh toán đã bị hủy")}</p>
                <p className="text-xs text-amber-800">{t("Bạn đã hủy giao dịch thanh toán. Đơn hàng vẫn được lưu ở trạng thái chờ đặt cọc; bạn có thể bấm thanh toán lại bất cứ lúc nào.")}</p>
              </div>
              <button onClick={() => setPaymentStatus(null)} className="ml-auto text-amber-700 hover:text-amber-950" aria-label="Đóng thông báo">
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
                {t("Đơn Hàng Của Tôi")} ({myOrders.length})
              </button>
              <button
                role="tab"
                aria-selected={activeTab === "search"}
                onClick={() => setActiveTab("search")}
              >
                <Search className="w-4 h-4 inline mr-1.5" />
                {t("Tra Cứu Mã Đơn Khác")}
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
                  <span>{preferences.language === "ja" ? `${t("Quản Lý Đơn Hàng Của")} ${customer.name}` : `Quản Lý Đơn Hàng Của ${customer.name}`}</span>
                  <span className="track-badge track-badge-gold">{t("Thành viên VIP")}</span>
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                  {preferences.language === "ja" ? "日本の通販サイトから購入した商品の一覧、配送状況を確認し、必要に応じて注文をキャンセルできます。" : "Theo dõi danh sách đơn mua hộ từ các sàn Nhật Bản, kiểm tra tiến độ giao vận và chủ động hủy đơn khi cần."}
                </p>
              </div>
              <button
                onClick={fetchMyOrders}
                className="btn2"
                style={{ padding: "8px 16px", fontSize: "0.8rem", alignSelf: "flex-start" }}
              >
                <RefreshCw className={`w-3.5 h-3.5 inline mr-1.5 ${loadingMyOrders ? "animate-spin" : ""}`} />
                <span>{t("Làm mới danh sách")}</span>
              </button>
            </div>

            {loadingMyOrders ? (
              <div className="track-card text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-2" />
                <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{t("Đang đồng bộ danh sách đơn hàng từ máy chủ...")}</p>
              </div>
            ) : myOrders.length === 0 ? (
              <div className="track-card text-center py-12 space-y-3">
                <div style={{ fontSize: "2.5rem" }}>🛍️</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800 }}>{t("Bạn chưa có đơn hàng nào")}</h3>
                <p style={{ fontSize: "0.82rem", color: "var(--muted)", maxWidth: "420px", margin: "0 auto" }}>
                  {preferences.language === "ja" ? "Amazon JP、Mercari、Rakutenの商品リンクを見積もりツールに貼り付けて、最初の購入代行注文を作成しましょう。" : "Dán link sản phẩm từ Amazon JP, Mercari hoặc Rakuten vào công cụ tính giá tự động để tạo đơn mua hộ đầu tiên!"}
                </p>
                <div style={{ paddingTop: "8px" }}>
                  <Link href="/#quote" className="cta" style={{ textDecoration: "none", display: "inline-flex" }}>
                    {t("Dán Link Tính Giá Tự Động")} <svg><use href="#i-arrow" /></svg>
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
                          <span className="track-badge track-badge-rose">✕ {t("Đã Hủy")}</span>
                        ) : item.status === "COMPLETED" ? (
                          <span className="track-badge track-badge-green">✓ {t("Hoàn Tất")}</span>
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
                            ? t("Đã hoàn tiền")
                            : item.paymentStatus === "UNPAID"
                            ? t("Chờ cọc")
                            : item.paymentStatus === "DEPOSITED_50"
                            ? t("Đã cọc 50%")
                            : t("Đã TT 100%")}
                        </span>
                      </div>

                      <div>
                        <h4 style={{ fontWeight: 800, fontSize: "0.92rem", color: "var(--ink)", margin: 0 }}>
                          {item.productName}
                        </h4>
                        <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "4px 0 0" }}>
                          {t("Tổng chi phí:")} <strong style={{ color: "var(--ink)", fontFamily: "monospace" }}>{item.totalVnd.toLocaleString("vi-VN")} đ</strong>
                          {preferences.language === "ja" ? `（${item.depositPercent || 50}%を支払う場合：` : ` (Thanh toán ${item.depositPercent || 50}%: `}<b style={{ color: "#d97706" }}>{item.depositAmountVnd.toLocaleString("vi-VN")} đ</b>{preferences.language === "ja" ? "）" : ")"}
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
                        <span>{t("Xem Hành Trình")}</span>
                      </button>

                      {item.canCancel && (
                        <button
                          onClick={() => openCustomerCancelModal(item)}
                          className="btn2"
                          style={{ padding: "8px 14px", fontSize: "0.78rem", color: "#c01048", borderColor: "#fecdd6" }}
                        >
                          <Ban className="w-3.5 h-3.5 inline mr-1" />
                          <span>{t("Hủy Đơn")}</span>
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
            {/* Thanh Search Bar phong cách Cosmos Hiện Đại */}
            <form onSubmit={handleSearchSubmit} className="track-search">
              <div className="track-search-field">
                <Search className="track-search-icon" aria-hidden="true" />
                <input
                  type="text"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  placeholder={t("Nhập mã đơn hàng (Ví dụ: CB-2026-XXXX)")}
                />
                <div className="track-search-actions">
                  {searchCode && (
                    <button
                      type="button"
                      onClick={() => setSearchCode("")}
                      className="track-clear-btn"
                      title="Xóa nội dung"
                    >
                      ✕
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="track-paste-btn"
                    title="Dán mã từ clipboard"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>Dán mã</span>
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="cta"
                style={{ padding: "12px 24px", fontSize: "0.88rem", flexShrink: 0 }}
              >
                {loading ? t("Đang tìm...") : t("Tra Cứu")} <svg><use href="#i-arrow" /></svg>
              </button>
            </form>

            {/* Dải Lịch Sử Tra Cứu Gần Đây & Đơn Mẫu Trải Nghiệm */}
            <div className="track-chips-strip">
              {recentCodes.length > 0 && (
                <>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-500" /> Đơn gần đây:
                  </span>
                  {recentCodes.map((rc) => (
                    <span key={rc} className="track-chip-item">
                      <button
                        type="button"
                        className="chip-code"
                        onClick={() => {
                          setSearchCode(rc);
                          fetchOrder(rc);
                        }}
                      >
                        #{rc}
                      </button>
                      <button
                        type="button"
                        className="chip-remove"
                        onClick={() => removeRecentCode(rc)}
                        title="Xóa khỏi lịch sử"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                </>
              )}

              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-banana-500" /> Xem mẫu:
              </span>
              <button
                type="button"
                className="track-chip-item track-demo-chip"
                onClick={() => {
                  setSearchCode("CB-2026-DEMO");
                  fetchOrder("CB-2026-DEMO");
                }}
              >
                <span>🚀 #CB-2026-DEMO (Đang bay Tokyo ✈️ VN)</span>
              </button>
            </div>

            <p className="track-search-hint" style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--muted)", margin: "4px 0 0" }}>
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

            {requiresEmailAccess && (
              <form onSubmit={handleRequestGuestAccess} className="track-card mx-auto max-w-3xl space-y-3 p-4">
                <div>
                  <h3 className="font-bold text-slate-900">Xác minh đơn mua hộ</h3>
                  <p className="mt-1 text-sm text-slate-600">Để bảo vệ thông tin đơn, khách chưa đăng nhập cần nhận liên kết xác minh tại email đã dùng khi đặt hàng.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={guestEmail}
                    onChange={(event) => setGuestEmail(event.target.value)}
                    placeholder="Email dùng khi đặt đơn"
                    className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button type="submit" disabled={requestingAccess} className="cta" style={{ padding: "10px 16px", fontSize: "0.82rem" }}>
                    {requestingAccess ? "Đang gửi..." : "Gửi link xác minh"}
                  </button>
                </div>
                {accessRequestSent && <p role="status" className="text-sm font-medium text-emerald-700">Nếu mã đơn và email khớp, ChillBanana đã gửi liên kết. Hãy kiểm tra cả thư rác.</p>}
              </form>
            )}

            {/* Welcome guidance khi chưa tra cứu: Hành Trình 7 Chặng Trực Quan & Tiện Lợi */}
            {!order && !loading && !error && (
              <div className="track-card max-w-4xl mx-auto space-y-6">
                <div className="text-center space-y-2">
                  <div style={{ width: "56px", height: "56px", borderRadius: "18px", background: "linear-gradient(135deg, #fef08a, #fde047)", color: "#8a5a00", display: "grid", placeItems: "center", margin: "0 auto", fontSize: "1.6rem", boxShadow: "0 8px 24px rgba(245, 158, 11, 0.25)" }}>
                    📦
                  </div>
                  <h3 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0, color: "var(--ink)" }}>
                    {t("Theo Dõi Hành Trình Kiện Hàng 7 Chặng Tokyo ⇄ Việt Nam")}
                  </h3>
                  <p style={{ fontSize: "0.82rem", color: "var(--muted)", maxWidth: "560px", margin: "0 auto", lineHeight: 1.6 }}>
                    Hệ thống tích hợp định vị thời gian thực từ kho đối tác Nhật Bản đến tận tay bạn. Nhập mã đơn <strong className="font-mono text-slate-800 dark:text-slate-200">CB-2026-XXXX</strong> phía trên hoặc bấm nút xem đơn mẫu để trải nghiệm.
                  </p>
                </div>

                {/* 7-Chặng Vận Tải Infographic Cards */}
                <div className="track-journey-grid">
                  {[
                    { step: "01", icon: "📝", title: "Xác Nhận Đơn", desc: "Thẩm định link, duyệt giá Yên & bảo hiểm" },
                    { step: "02", icon: "🛍️", title: "Mua Tại Nhật", desc: "Check-out Amazon, Mercari, Rakuten" },
                    { step: "03", icon: "🏢", title: "Về Kho Tokyo", desc: "Kiểm đếm, chụp ảnh seal & bọc xốp 3 lớp" },
                    { step: "04", icon: "✈️", title: "Bay Quốc Tế", desc: "Chuyến bay Tokyo ⇄ Hà Nội / TP.HCM" },
                    { step: "05", icon: "🛃", title: "Thông Quan", desc: "Kiểm hóa & hoàn tất thuế quan" },
                    { step: "06", icon: "🚚", title: "Giao Hỏa Tốc", desc: "Bàn giao ViettelPost / GHN / GHTK" },
                    { step: "07", icon: "🎁", title: "Tận Tay Bạn", desc: "Nhận kiện an toàn & kích hoạt BH 100%" },
                  ].map((s) => (
                    <div key={s.step} className="journey-step-card">
                      <div className="step-num">{s.step}</div>
                      <div className="step-icon">{s.icon}</div>
                      <div className="step-title">{s.title}</div>
                      <div className="step-desc">{s.desc}</div>
                    </div>
                  ))}
                </div>

                {/* 3 Cam kết cốt lõi */}
                <div className="track-guarantees">
                  <div className="guarantee-pill">
                    <span className="g-icon">🛡️</span>
                    <div>
                      <b>Bảo Hiểm 100%</b>
                      <p className="text-[11px] text-slate-500 m-0">Đền bù thỏa đáng khi bể vỡ hoặc thất lạc kiện</p>
                    </div>
                  </div>
                  <div className="guarantee-pill">
                    <span className="g-icon">⚡</span>
                    <div>
                      <b>Bay Cố Định 3–5 Ngày</b>
                      <p className="text-[11px] text-slate-500 m-0">Lịch bay đều đặn mỗi tuần từ Tokyo Narita</p>
                    </div>
                  </div>
                  <div className="guarantee-pill">
                    <span className="g-icon">🔎</span>
                    <div>
                      <b>Vận Đơn Minh Bạch</b>
                      <p className="text-[11px] text-slate-500 m-0">Tra cứu mã vận chuyển nội địa Nhật & VN</p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 text-center flex flex-wrap items-center justify-center gap-3">
                  <Link href="/#quote" className="cta" style={{ textDecoration: "none", display: "inline-flex", padding: "10px 22px", fontSize: "0.85rem" }}>
                    <span>✦ {t("Tạo Đơn Hàng Mới Ngay")}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchCode("CB-2026-DEMO");
                      fetchOrder("CB-2026-DEMO");
                    }}
                    className="btn2"
                    style={{ padding: "10px 18px", fontSize: "0.82rem" }}
                  >
                    <span>Xem Dữ Liệu Đơn Mẫu</span> <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Chi tiết đơn hàng & Hành trình khi đã tìm thấy */}
            {order && (
              <div className="space-y-6">
                {/* Card tổng quan & Stepper 7 bước */}
                <div className="track-card space-y-6">
                  {/* Top Bar: Order Code & Badges & Quick Action Buttons */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200/60 gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="track-badge track-badge-gold">{t("Đơn Mua Hộ")}</span>
                        <h2 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0, fontFamily: "monospace", color: "var(--ink)" }}>
                          #{order.orderCode}
                        </h2>
                        <button
                          type="button"
                          onClick={() => handleCopyOrderCode(order.orderCode)}
                          className="track-action-btn"
                          title="Sao chép mã đơn"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShareTrackingLink(order.orderCode)}
                          className="track-action-btn"
                          title="Chia sẻ liên kết theo dõi đơn"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Chia sẻ</span>
                        </button>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "4px 0 0" }}>
                        Khởi tạo lúc: {new Date(order.createdAt).toLocaleString("vi-VN")}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAskNeoAboutOrder(order.orderCode)}
                        className="track-action-btn track-action-btn--ai"
                        title="Hỏi trợ lý Neo AI về đơn hàng này"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Hỏi Neo AI 💬</span>
                      </button>

                      {order.isGroupBuy && (
                        <span className="track-badge track-badge-purple">
                          <Users className="w-3 h-3 mr-1" /> Gộp Đơn Tiết Kiệm (-25%)
                        </span>
                      )}

                      {order.status === "CANCELLED" ? (
                        <span className="track-badge track-badge-rose">
                          <Ban className="w-3 h-3 mr-1" /> {t("Đã Hủy")}
                        </span>
                      ) : (
                        <span className="track-badge track-badge-blue">
                          {order.paymentStatus === "REFUNDED"
                            ? t("Đã hoàn tiền")
                            : order.paymentStatus === "PAID_100"
                            ? t("Đã thanh toán 100%")
                            : order.paymentStatus === "DEPOSITED_50"
                            ? t("Đã cọc 50%")
                            : t("Chờ đặt cọc")}
                        </span>
                      )}

                      {order.canCancel && (
                        <button
                          onClick={() => openCustomerCancelModal(order)}
                          className="btn2"
                          style={{ padding: "6px 14px", fontSize: "0.75rem", color: "#c01048", borderColor: "#fecdd6" }}
                        >
                          <Ban className="w-3.5 h-3.5 inline mr-1 text-rose-600" />
                          <span>{t("Hủy Đơn Hàng")}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stepper 7 Bước */}
                  <div>
                    <h3 style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", margin: "0 0 16px" }}>
                      {t("Tiến Độ Vận Tải Quốc Tế & Nội Địa (7 Chặng)")}
                    </h3>
                    <div className="track-stepper-box">
                      <TrackingStepper currentStatus={order.status} />
                    </div>
                  </div>

                  {/* Vận đơn đối tác nếu có */}
                  {(order.jpDomesticTrack || order.vnDomesticTrack) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      {order.jpDomesticTrack && (
                        <div className="track-item flex items-center justify-between gap-3" style={{ padding: "14px 18px" }}>
                          <div className="flex items-center gap-3">
                            <span style={{ fontSize: "1.5rem" }}>🇯🇵</span>
                            <div>
                              <small style={{ color: "var(--muted)", display: "block" }}>{t("Vận đơn nội địa Nhật Bản:")}</small>
                              <b style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>{order.jpDomesticTrack}</b>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyOrderCode(order.jpDomesticTrack || "")}
                            className="track-action-btn"
                            title="Sao chép mã vận đơn Nhật"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      {order.vnDomesticTrack && (
                        <div className="track-item flex items-center justify-between gap-3" style={{ padding: "14px 18px" }}>
                          <div className="flex items-center gap-3">
                            <span style={{ fontSize: "1.5rem" }}>🇻🇳</span>
                            <div>
                              <small style={{ color: "var(--muted)", display: "block" }}>{t("Vận đơn giao hàng tại Việt Nam:")}</small>
                              <b style={{ fontFamily: "monospace", fontSize: "0.9rem", color: "#167a48" }}>{order.vnDomesticTrack}</b>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyOrderCode(order.vnDomesticTrack || "")}
                            className="track-action-btn"
                            title="Sao chép mã vận đơn Việt Nam"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
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
                      {t("Chi Tiết Kiện Hàng & Chi Phí")}
                    </h3>

                    <div style={{ fontSize: "0.85rem", lineHeight: 1.8 }}>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span style={{ color: "var(--muted)" }}>{t("Tên sản phẩm:")}</span>
                        <b style={{ textAlign: "right", maxWidth: "60%" }}>{order.productName}</b>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span style={{ color: "var(--muted)" }}>{t("Giá gốc tại Nhật:")}</span>
                        <b>{order.priceJpy?.toLocaleString("vi-VN")} ¥</b>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span style={{ color: "var(--muted)" }}>{t("Tỷ giá áp dụng:")}</span>
                        <span>1 JPY = {order.exchangeRate} đ</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span style={{ color: "var(--muted)" }}>{t("Tiền hàng quy đổi:")}</span>
                        <b>{order.productPriceVnd?.toLocaleString("vi-VN")} đ</b>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span style={{ color: "var(--muted)" }}>{t("Phí mua hộ & bảo hiểm (4%):")}</span>
                        <b>{order.serviceFeeVnd?.toLocaleString("vi-VN")} đ</b>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span style={{ color: "var(--muted)" }}>{t("Cước bay quốc tế:")}</span>
                        <b style={{ color: "#167a48" }}>{order.isGroupBuy ? "Ưu đãi Gộp Đơn (-25%)" : "Cân đo thực tế khi về kho"}</b>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-200">
                        <span style={{ fontWeight: 800 }}>{t("Tổng tiền hàng:")}</span>
                        <b style={{ fontSize: "1.1rem", color: "var(--ink)" }}>{order.totalVnd?.toLocaleString("vi-VN")} đ</b>
                      </div>
                      <div className="flex justify-between py-2" style={{ background: "rgba(248,219,85,0.2)", padding: "10px 14px", borderRadius: "14px" }}>
                        <span style={{ fontWeight: 800, color: "#8a5a00" }}>{order.isPriceVerified ? `${t("Số tiền cần thanh toán")} (${order.depositPercent || 50}%):` : t("Mức thanh toán tạm tính:")}</span>
                        <b style={{ fontSize: "1.15rem", color: "#8a5a00" }}>{order.depositAmountVnd?.toLocaleString("vi-VN")} đ</b>
                      </div>
                      {/* Trạng thái tất toán / COD */}
                      {order.paymentStatus === "DEPOSITED_50" && order.status !== "COMPLETED" && (
                        <div className="flex justify-between py-2 mt-1" style={{ background: "rgba(234,88,12,0.1)", padding: "10px 14px", borderRadius: "14px", border: "1px dashed rgba(234,88,12,0.4)" }}>
                          <span style={{ fontWeight: 700, color: "#c2410c", fontSize: "0.82rem" }}>
                            {t("Cần tất toán khi nhận hàng (50% còn lại + Cước bay):")}
                          </span>
                          <b style={{ fontSize: "1.05rem", color: "#c2410c" }}>
                            {Math.max(0, (order.totalVnd || 0) - (order.depositAmountVnd || 0)).toLocaleString("vi-VN")} đ
                          </b>
                        </div>
                      )}
                      {order.paymentStatus === "PAID_100" && (
                        <div className="flex justify-between py-2 mt-1" style={{ background: "rgba(22,163,74,0.1)", padding: "10px 14px", borderRadius: "14px", border: "1px solid rgba(22,163,74,0.3)" }}>
                          <span style={{ fontWeight: 700, color: "#15803d", fontSize: "0.82rem" }}>
                            ✓ {t("Đã tất toán đủ 100% (Gồm tiền hàng, phí & cước bay):")}
                          </span>
                          <b style={{ fontSize: "1.05rem", color: "#15803d" }}>
                            {(order.totalVnd || order.depositAmountVnd || 0).toLocaleString("vi-VN")} đ
                          </b>
                        </div>
                      )}
                    </div>

                    {order.status === "PENDING_DEPOSIT" && order.paymentStatus === "UNPAID" && (
                      order.isPriceVerified ? (
                        order.reservationExpiresAt && currentTimestamp > 0 && new Date(order.reservationExpiresAt).getTime() <= currentTimestamp ? (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Thời gian giữ hàng đã hết. Vui lòng liên hệ ChillBanana để kiểm tra tồn kho trước khi thanh toán.</div>
                        ) : (
                          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 space-y-3">
                            <div>
                              <p className="font-bold text-sky-950">Thanh toán đơn hàng</p>
                              <p className="text-xs text-amber-800">Luồng dưới đây chỉ dùng để kiểm thử sandbox/mô phỏng, không thu tiền thật và không xác nhận đơn đã thanh toán.</p>
                              {order.reservationExpiresAt && <p className="text-xs text-sky-800 mt-1">Thời hạn giữ hàng đến {new Date(order.reservationExpiresAt).toLocaleString("vi-VN")}.</p>}
                            </div>
                            <button onClick={handlePayVnpay} disabled={isRedirectingVnpay} className="w-full rounded-xl bg-[#0066CC] px-4 py-3 text-sm font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2">
                              <CreditCard className="w-4 h-4" />{isRedirectingVnpay ? "Đang mở trang kiểm thử..." : "Thử luồng thanh toán"}
                            </button>
                            <div className="text-center text-xs text-slate-600">
                              <p>Hoặc chuyển khoản VietQR, nội dung: <strong>{order.orderCode}</strong></p>
                              <img src={`https://img.vietqr.io/image/${bankBin}-${bankAccount}-compact2.png?amount=${order.depositAmountVnd}&addInfo=${encodeURIComponent(order.orderCode)}&accountName=${encodeURIComponent(bankOwner)}`} alt="Mã VietQR thanh toán đơn hàng" className="mx-auto mt-2 w-48 rounded-xl border border-white bg-white p-2" />
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
                        <p style={{ margin: "4px 0 0", color: "var(--muted)", fontStyle: "italic" }}>Ghi chú: &quot;{order.customerNote}&quot;</p>
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

            {/* Chi tiết vận đơn tuyến Việt Nam -> Nhật Bản */}
            {vnJpShipment && (
              <div className="space-y-6">
                <div className="track-card space-y-6">
                  {/* Top Bar: Mã vận đơn & Badge */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200/60 gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="track-badge" style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0" }}>
                          🇻🇳 Tuyến Việt Nam ➔ Nhật Bản 🇯🇵
                        </span>
                        <h2 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0, fontFamily: "monospace", color: "var(--ink)" }}>
                          #{vnJpShipment.trackingCode}
                        </h2>
                        <button
                          type="button"
                          onClick={() => handleCopyOrderCode(vnJpShipment.trackingCode)}
                          className="track-action-btn"
                          title="Sao chép mã vận đơn"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép</span>
                        </button>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "4px 0 0" }}>
                        Khởi tạo lúc: {new Date(vnJpShipment.createdAt).toLocaleString("vi-VN")} • Cập nhật: {new Date(vnJpShipment.updatedAt).toLocaleString("vi-VN")}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className="track-badge font-bold"
                        style={{
                          background: vnJpShipment.status === "DELIVERED_JP" ? "#ecfdf5" : vnJpShipment.status === "CANCELLED" ? "#ffeef0" : "#fffbeb",
                          color: vnJpShipment.status === "DELIVERED_JP" ? "#065f46" : vnJpShipment.status === "CANCELLED" ? "#b91c1c" : "#92400e",
                          border: `1px solid ${vnJpShipment.status === "DELIVERED_JP" ? "#a7f3d0" : vnJpShipment.status === "CANCELLED" ? "#fecdd6" : "#fde68a"}`,
                          fontSize: "0.82rem",
                          padding: "6px 12px",
                        }}
                      >
                        {vnJpShipment.statusLabel || vnJpShipment.status}
                      </span>
                    </div>
                  </div>

                  {/* Tiến trình 5 bước chiều VN -> JP */}
                  <div className="py-2">
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 800, margin: "0 0 16px", color: "var(--ink)" }}>
                      Lộ Trình Vận Chuyển Chuyên Tuyến (5 Bước)
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {[
                        { key: "PENDING_CONFIRMATION", title: "1. Tiếp Nhận", desc: "Xác minh & MAFF" },
                        { key: "CONFIRMED_PICKUP", title: "2. Lấy Hàng", desc: "Bưu tá nhận tại VN" },
                        { key: "WAREHOUSE_VN_INSPECTED", title: "3. Kho VN", desc: "Cân đo chuẩn IATA" },
                        { key: "IN_FLIGHT_TO_JP", title: "4. Bay Sang Nhật", desc: "Chuyến bay & Hải quan" },
                        { key: "DELIVERED_JP", title: "5. Hoàn Tất", desc: "Giao tận tay người nhận" },
                      ].map((step, idx) => {
                        const stepOrder = ["PENDING_CONFIRMATION", "CONFIRMED_PICKUP", "WAREHOUSE_VN_INSPECTED", "IN_FLIGHT_TO_JP", "DELIVERED_JP"];
                        const currentIdx = stepOrder.indexOf(vnJpShipment.status);
                        const isDone = currentIdx > idx || vnJpShipment.status === "DELIVERED_JP";
                        const isCurrent = currentIdx === idx && vnJpShipment.status !== "CANCELLED";

                        return (
                          <div
                            key={step.key}
                            className="p-3 rounded-2xl border transition-all flex flex-col items-center text-center"
                            style={{
                              background: isCurrent ? "var(--banana-soft, #fef9c3)" : isDone ? "rgba(16,185,129,0.06)" : "var(--field-bg, rgba(0,0,0,0.02))",
                              borderColor: isCurrent ? "var(--banana-500, #eab308)" : isDone ? "#10b981" : "var(--line, #e2e8f0)",
                            }}
                          >
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-2"
                              style={{
                                background: isCurrent ? "#eab308" : isDone ? "#10b981" : "#cbd5e1",
                                color: isCurrent ? "#0f172a" : "#ffffff",
                              }}
                            >
                              {isDone ? <Check className="w-4 h-4" /> : idx + 1}
                            </div>
                            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: isCurrent ? "var(--ink)" : "var(--muted)" }}>
                              {step.title}
                            </span>
                            <span style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: "2px" }}>
                              {step.desc}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Thông tin chi tiết 2 cột */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200/60" style={{ borderTop: "1px solid var(--line)" }}>
                    {/* Cột 1: Thông tin kiện hàng */}
                    <div className="space-y-3 p-4 rounded-2xl" style={{ background: "var(--field-bg, rgba(0,0,0,0.02))" }}>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">Thông Tin Kiện Hàng</h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span style={{ color: "var(--muted)" }}>Phân loại:</span>
                          <span className="font-bold" style={{ color: "var(--ink)" }}>{vnJpShipment.cargoTypeLabel || vnJpShipment.cargoType}</span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: "var(--muted)" }}>Trọng lượng tính cước:</span>
                          <span className="font-bold" style={{ color: "var(--ink)" }}>
                            {vnJpShipment.chargeableWeightKg || vnJpShipment.actualWeightKg || vnJpShipment.estimatedWeightKg || 0} kg
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: "var(--muted)" }}>Tổng cước vận chuyển:</span>
                          <span className="font-bold text-emerald-600" style={{ fontSize: "0.9rem" }}>
                            {vnJpShipment.totalShippingFeeVnd ? `${vnJpShipment.totalShippingFeeVnd.toLocaleString("vi-VN")} đ` : "Đang tính"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: "var(--muted)" }}>Trạng thái thanh toán:</span>
                          <span className="font-bold">
                            {vnJpShipment.paymentStatus === "PAID" ? "✅ Đã thanh toán cước" : "⏳ Chờ thanh toán khi cân đo"}
                          </span>
                        </div>
                        {vnJpShipment.maffAgreement && (
                          <div className="flex items-center gap-1.5 text-emerald-700 text-[11px] pt-1">
                            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                            <span>Đã cam kết tuân thủ kiểm dịch MAFF Nhật Bản</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Cột 2: Lộ trình & Giao hàng */}
                    <div className="space-y-3 p-4 rounded-2xl" style={{ background: "var(--field-bg, rgba(0,0,0,0.02))" }}>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">Lộ Trình & Giao Hàng</h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span style={{ color: "var(--muted)" }}>Người gửi tại VN:</span>
                          <span className="font-medium" style={{ color: "var(--ink)" }}>
                            {vnJpShipment.senderNameMasked} ({vnJpShipment.senderCity})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: "var(--muted)" }}>Người nhận tại JP:</span>
                          <span className="font-medium" style={{ color: "var(--ink)" }}>
                            {vnJpShipment.receiverNameMasked} ({vnJpShipment.receiverPrefecture} {vnJpShipment.receiverPostalCode})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: "var(--muted)" }}>Chuyến bay:</span>
                          <span className="font-bold" style={{ color: "var(--ink)" }}>
                            {vnJpShipment.flightNumber || "Đang phân bổ chuyến bay"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: "var(--muted)" }}>Đơn vị phát tại Nhật:</span>
                          <span className="font-medium" style={{ color: "var(--ink)" }}>
                            {vnJpShipment.japanCourier || "Yamato / Sagawa / Japan Post"}
                          </span>
                        </div>
                        {vnJpShipment.japanTrackingCode && (
                          <div className="flex justify-between">
                            <span style={{ color: "var(--muted)" }}>Mã tra cứu nội địa Nhật:</span>
                            <span className="font-mono font-bold text-banana-600">
                              {vnJpShipment.japanTrackingCode}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
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
          <div className="track-card max-w-lg w-full space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700" style={{ borderBottom: "1px solid var(--line)" }}>
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
                  style={{ background: "var(--field-bg, transparent)", color: "var(--ink)" }}
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
