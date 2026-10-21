"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  Users,
  ShieldCheck,
  LogOut,
  BarChart3,
  ShoppingBag,
  ShoppingCart,
  Columns,
  ExternalLink,
  RefreshCw,
  FlaskConical,
  Settings2,
  Plane,
} from "lucide-react";
import { AdminToastProvider, useAdminToast } from "@/context/AdminToastContext";
import AnalyticsWorkspaceTab, { AnalyticsSection } from "@/app/admin/components/AnalyticsWorkspaceTab";
import CustomersTab from "@/app/admin/components/CustomersTab";
import ProductsTab from "@/app/admin/components/ProductsTab";
import OrderManagementTab from "@/app/admin/components/OrderManagementTab";
import VnJpDispatchTab from "@/app/admin/components/VnJpDispatchTab";
import PurchaseTasksTab from "@/features/purchasing/AdminPurchaseTasksTab";
import BusinessSettingsTab from "@/app/admin/components/BusinessSettingsTab";
import AuditLogsTab from "@/app/admin/components/AuditLogsTab";
import SandboxTab from "@/app/admin/components/SandboxTab";
import { AdminAiModuleId } from "@/features/ai/admin/definitions";
import "./admin-neoday.css";

function AdminDashboardPageInner() {
  const router = useRouter();
  const { adminToast } = useAdminToast();

  // Chế độ giao diện: "dashboard" | "operations" | "vn_jp_dispatch"
  const [adminViewMode, setAdminViewMode] = useState<"dashboard" | "operations" | "vn_jp_dispatch">("dashboard");

  // Auth
  const [authChecking, setAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ username: string; name: string; role: string } | null>(null);

  // Tab đang chọn
  const [activeTab, setActiveTab] = useState<"orders" | "customers" | "products" | "analytics" | "purchase" | "settings" | "audit" | "sandbox">("orders");
  const [analyticsInitialSection, setAnalyticsInitialSection] = useState<AnalyticsSection>("reports");
  const [analyticsInitialModule, setAnalyticsInitialModule] = useState<AdminAiModuleId>("overview");

  const openAnalytics = (section: AnalyticsSection, module: AdminAiModuleId = "overview") => {
    setAnalyticsInitialSection(section);
    setAnalyticsInitialModule(module);
    setActiveTab("analytics");
  };

  // searchTerm để truyền vào OrderManagementTab (khi bấm "Xem Đơn" từ tab Khách Hàng)
  const [searchTerm, setSearchTerm] = useState("");

  // Kiểm tra xác thực Admin
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/admin/auth");
        const data = await res.json();
        if (res.ok && data.authenticated) {
          setCurrentUser(data.user);
          setAuthChecking(false);
        } else {
          router.push("/admin/login");
        }
      } catch {
        router.push("/admin/login");
      }
    };
    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
      router.push("/admin/login");
      router.refresh();
    } catch {
      router.push("/admin/login");
    }
  };

  if (authChecking) {
    return (
      <div className="admin-neoday min-h-screen flex items-center justify-center text-xs">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-5 h-5 animate-spin text-sky-700" />
          <span>Đang xác thực quyền quản trị...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-neoday min-h-screen">
      <header className="admin-neoday-header sticky top-0 z-30">
        <div className="admin-neoday-topbar">
          <Link href="/admin" className="admin-neoday-brand" aria-label="ChillBanana Admin Portal">
            <span className="admin-neoday-logo" aria-hidden="true">
              <img src="/logo.png" alt="" className="w-6 h-6 object-contain" />
            </span>
            <span className="admin-neoday-brand-name">Chill<span>Banana</span></span>
            <span className="admin-neoday-portal">Admin Portal</span>
          </Link>

          <div className="admin-neoday-userbar">
            <div className="admin-neoday-user">
              <ShieldCheck className="h-4 w-4" />
              <span>{currentUser?.name || "Admin"}</span>
              <span className="admin-neoday-role">{currentUser?.role || "SUPER_ADMIN"}</span>
            </div>
            <Link href="/" target="_blank" className="admin-neoday-action">
              <ExternalLink className="h-4 w-4" />
              <span>Xem Web</span>
            </Link>
            <button onClick={handleLogout} className="admin-neoday-logout">
              <LogOut className="h-4 w-4" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>

        <div className="admin-neoday-navrow">
          <div className="admin-neoday-modes" aria-label="Chế độ quản trị">
            <button
              onClick={() => setAdminViewMode("dashboard")}
              className={`admin-neoday-mode ${adminViewMode === "dashboard" ? "is-active" : ""}`}
              title="Bảng điều khiển tổng quan"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setAdminViewMode("operations")}
              className={`admin-neoday-mode ${adminViewMode === "operations" ? "is-active" : ""}`}
              title="Bàn tác nghiệp đơn hàng Kanban (Mua Hộ JP ➔ VN)"
            >
              <Columns className="h-4 w-4" />
              <span>Tác nghiệp (JP➔VN)</span>
            </button>
            <button
              onClick={() => setAdminViewMode("vn_jp_dispatch")}
              className={`admin-neoday-mode ${adminViewMode === "vn_jp_dispatch" ? "is-active" : ""}`}
              title="Bàn điều phối vận đơn tuyến Việt Nam sang Nhật Bản"
              style={{
                borderColor: adminViewMode === "vn_jp_dispatch" ? "#10b981" : undefined,
                color: adminViewMode === "vn_jp_dispatch" ? "#065f46" : undefined,
                fontWeight: 700,
              }}
            >
              <Plane className="h-4 w-4 text-emerald-600" />
              <span>✈️ Điều phối VN➔JP</span>
            </button>
          </div>

          {adminViewMode === "dashboard" ? (
            <nav className="admin-neoday-tabs" aria-label="Khu vực quản trị">
              {[
                { key: "orders", icon: <Package className="h-4 w-4" />, label: "Đơn hàng" },
                { key: "customers", icon: <Users className="h-4 w-4" />, label: "Khách hàng" },
                { key: "products", icon: <ShoppingBag className="h-4 w-4" />, label: "Sản phẩm" },
                { key: "purchase", icon: <ShoppingCart className="h-4 w-4" />, label: "Tác vụ mua hộ" },
                { key: "analytics", icon: <BarChart3 className="h-4 w-4" />, label: "Phân tích & AI" },
                { key: "sandbox", icon: <FlaskConical className="h-4 w-4" />, label: "Sandbox & Demo" },
                ...(currentUser?.role === "SUPER_ADMIN" ? [
                  { key: "settings", icon: <Settings2 className="h-4 w-4" />, label: "Cài đặt nghiệp vụ" },
                  { key: "audit", icon: <ShieldCheck className="h-4 w-4" />, label: "Nhật ký kiểm toán" },
                ] : []),
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`admin-neoday-tab ${activeTab === tab.key ? "is-active" : ""}`}
                >
                  {tab.icon}<span>{tab.label}</span>
                </button>
              ))}
            </nav>
          ) : adminViewMode === "operations" ? (
            <div className="admin-neoday-workspace-label">
              <Columns className="h-4 w-4" />
              <span>Bàn tác nghiệp đơn hàng (Mua Hộ JP ➔ VN)</span>
              <span className="admin-neoday-kanban-pill">Kanban 7 bước</span>
            </div>
          ) : (
            <div className="admin-neoday-workspace-label" style={{ background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
              <Plane className="h-4 w-4 text-emerald-700" />
              <span style={{ color: "#065f46", fontWeight: 800 }}>Bàn điều phối vận đơn ký gửi (VN ➔ JP)</span>
              <span className="admin-neoday-kanban-pill" style={{ background: "#059669", color: "#ffffff" }}>Kanban 5 bước</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Admin Workspace */}
      <main className="admin-neoday-main">

        {/* Phân hệ Điều Phối VN ➔ JP chạy song song độc lập */}
        {adminViewMode === "vn_jp_dispatch" && (
          <VnJpDispatchTab />
        )}

        {/* OrderManagementTab handles both Dashboard Orders tab and Kanban Operations view */}
        {adminViewMode !== "vn_jp_dispatch" && (
          <OrderManagementTab
            adminViewMode={adminViewMode}
            activeTab={activeTab}
            externalSearchTerm={searchTerm}
            onClearSearch={() => setSearchTerm("")}
          />
        )}

        {/* Other dashboard tabs — rendered only in dashboard mode */}
        {adminViewMode === "dashboard" && (
          <>
            {activeTab === "customers" && (
              <CustomersTab
                onViewOrders={(term) => { setSearchTerm(term); setActiveTab("orders"); }}
                onViewAiTrends={() => openAnalytics("trends", "trends")}
              />
            )}
            {activeTab === "products"  && <ProductsTab />}
            {activeTab === "purchase"  && <PurchaseTasksTab />}
            {activeTab === "analytics" && (
              <AnalyticsWorkspaceTab initialSection={analyticsInitialSection} initialAgentModule={analyticsInitialModule} />
            )}
            {activeTab === "sandbox"   && <SandboxTab />}
            {activeTab === "settings" && currentUser?.role === "SUPER_ADMIN" && <BusinessSettingsTab />}
            {activeTab === "audit" && currentUser?.role === "SUPER_ADMIN" && <AuditLogsTab />}
          </>
        )}

      </main>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <AdminToastProvider>
      <AdminDashboardPageInner />
    </AdminToastProvider>
  );
}
