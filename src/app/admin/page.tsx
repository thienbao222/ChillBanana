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
  Columns,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { AdminToastProvider, useAdminToast } from "@/context/AdminToastContext";
import AnalyticsWorkspaceTab, { AnalyticsSection } from "@/app/admin/components/AnalyticsWorkspaceTab";
import CustomersTab from "@/app/admin/components/CustomersTab";
import ProductsTab from "@/app/admin/components/ProductsTab";
import OrderManagementTab from "@/app/admin/components/OrderManagementTab";
import { AdminAiModuleId } from "@/lib/admin-ai/definitions";
import "./admin-neoday.css";

function AdminDashboardPageInner() {
  const router = useRouter();
  const { adminToast } = useAdminToast();

  // Chế độ giao diện: "dashboard" | "operations"
  const [adminViewMode, setAdminViewMode] = useState<"dashboard" | "operations">("dashboard");

  // Auth
  const [authChecking, setAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ username: string; name: string; role: string } | null>(null);

  // Tab đang chọn
  const [activeTab, setActiveTab] = useState<"orders" | "customers" | "products" | "analytics">("orders");
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
            <span className="admin-neoday-logo" aria-hidden="true">🍌</span>
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
              title="Bàn tác nghiệp đơn hàng Kanban"
            >
              <Columns className="h-4 w-4" />
              <span>Tác nghiệp</span>
            </button>
          </div>

          {adminViewMode === "dashboard" ? (
            <nav className="admin-neoday-tabs" aria-label="Khu vực quản trị">
              {[
                { key: "orders", icon: <Package className="h-4 w-4" />, label: "Đơn hàng" },
                { key: "customers", icon: <Users className="h-4 w-4" />, label: "Khách hàng" },
                { key: "products", icon: <ShoppingBag className="h-4 w-4" />, label: "Sản phẩm" },
                { key: "analytics", icon: <BarChart3 className="h-4 w-4" />, label: "Phân tích & AI" },
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
          ) : (
            <div className="admin-neoday-workspace-label">
              <Columns className="h-4 w-4" />
              <span>Bàn tác nghiệp đơn hàng</span>
              <span className="admin-neoday-kanban-pill">Kanban</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Admin Workspace */}
      <main className="admin-neoday-main">

        {/* OrderManagementTab handles both Dashboard Orders tab and Kanban Operations view */}
        <OrderManagementTab
          adminViewMode={adminViewMode}
          activeTab={activeTab}
          externalSearchTerm={searchTerm}
          onClearSearch={() => setSearchTerm("")}
        />

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
            {activeTab === "analytics" && (
              <AnalyticsWorkspaceTab initialSection={analyticsInitialSection} initialAgentModule={analyticsInitialModule} />
            )}
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
