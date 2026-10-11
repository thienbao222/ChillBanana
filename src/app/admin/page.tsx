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
  FileText,
  ExternalLink,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { AdminToastProvider, useAdminToast } from "@/context/AdminToastContext";
import ReportsTab from "@/app/admin/components/ReportsTab";
import AiTrendsTab from "@/app/admin/components/AiTrendsTab";
import AdminAgentTab from "@/app/admin/components/AdminAgentTab";
import CustomersTab from "@/app/admin/components/CustomersTab";
import ProductsTab from "@/app/admin/components/ProductsTab";
import OrderManagementTab from "@/app/admin/components/OrderManagementTab";
import { AdminAiModuleId } from "@/lib/admin-ai/definitions";

function AdminDashboardPageInner() {
  const router = useRouter();
  const { adminToast } = useAdminToast();

  // Chế độ giao diện: "dashboard" | "operations"
  const [adminViewMode, setAdminViewMode] = useState<"dashboard" | "operations">("dashboard");

  // Auth
  const [authChecking, setAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ username: string; name: string; role: string } | null>(null);

  // Tab đang chọn
  const [activeTab, setActiveTab] = useState<"orders" | "customers" | "ai_trends" | "products" | "reports" | "admin_agent">("orders");
  const [agentInitialModule, setAgentInitialModule] = useState<AdminAiModuleId>("overview");

  const openAdminAgent = (module: AdminAiModuleId) => {
    setAgentInitialModule(module);
    setActiveTab("admin_agent");
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xs">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-5 h-5 animate-spin text-banana-400" />
          <span>Đang xác thực quyền quản trị...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-navy-950 font-sans">

      {/* Admin Top Header */}
      <header className="bg-navy-900 text-white border-b border-navy-800 sticky top-0 z-30 shadow-md">
        <div className="w-full px-4 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/admin" className="flex items-center space-x-2">
              <span className="text-2xl">🍌</span>
              <span className="font-serif font-bold text-lg text-white">
                Chill<span className="text-banana-400">Banana</span>{" "}
                <span className="text-xs font-sans font-normal text-banana-200 bg-navy-800 px-2 py-0.5 rounded-full ml-1">Admin Portal</span>
              </span>
            </Link>

            <span className="text-slate-600 hidden sm:inline">|</span>

            {/* Bộ Chuyển Đổi 2 Giao Diện */}
            <div className="flex items-center bg-navy-950 p-1 rounded-xl border border-navy-800">
              <button
                onClick={() => setAdminViewMode("dashboard")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  adminViewMode === "dashboard"
                    ? "bg-banana-500 text-navy-950 shadow"
                    : "text-slate-300 hover:text-white"
                }`}
                title="Giao diện 1: Bảng điều khiển phân tích & quản trị tổng quan"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Giao Diện Dashboard</span>
              </button>

              <button
                onClick={() => setAdminViewMode("operations")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  adminViewMode === "operations"
                    ? "bg-banana-500 text-navy-950 shadow"
                    : "text-slate-300 hover:text-white"
                }`}
                title="Giao diện 2: Bàn tác nghiệp kho vận & xử lý đơn hàng Kanban"
              >
                <Columns className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Bàn Tác Nghiệp Kho (Kanban)</span>
              </button>
            </div>

            {/* Desktop Tab Nav */}
            {adminViewMode === "dashboard" && (
              <nav className="hidden 2xl:flex items-center space-x-2 text-xs border-l border-navy-800 pl-3">
                {[
                  { key: "orders",    icon: <Package className="w-3.5 h-3.5" />,     label: "Đơn Hàng" },
                  { key: "customers", icon: <Users className="w-3.5 h-3.5" />,       label: "Khách Hàng" },
                  { key: "products",  icon: <ShoppingBag className="w-3.5 h-3.5" />, label: "Sản Phẩm" },
                  { key: "ai_trends", icon: <BarChart3 className="w-3.5 h-3.5" />,   label: "Xu Hướng AI" },
                  { key: "reports",   icon: <FileText className="w-3.5 h-3.5" />,    label: "Báo Cáo" },
                  { key: "admin_agent", icon: <Sparkles className="w-3.5 h-3.5" />, label: "AI Agent" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as typeof activeTab)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                      activeTab === tab.key
                        ? "bg-slate-800 text-white border border-slate-700 shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>
            )}
          </div>

          {/* Right side: user info + links */}
          <div className="flex items-center space-x-4 text-xs">
            <div className="hidden md:flex items-center space-x-2 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{currentUser?.name || "Admin"}</span>
              <span className="text-[10px] bg-navy-800 text-banana-400 px-2 py-0.5 rounded font-mono">
                {currentUser?.role || "SUPER_ADMIN"}
              </span>
            </div>

            <Link
              href="/"
              target="_blank"
              className="text-slate-300 hover:text-white flex items-center space-x-1 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Xem Web</span>
            </Link>

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800/80 rounded-xl transition-colors flex items-center space-x-1 font-bold"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng Xuất</span>
            </button>
          </div>
        </div>

        {/* Mobile Tab Bar */}
        <div className="2xl:hidden flex border-t border-navy-800 text-xs">
          {[
            { key: "orders",    label: "Đơn Hàng" },
            { key: "customers", label: "Khách Hàng" },
            { key: "products",  label: "Sản Phẩm" },
            { key: "ai_trends", label: "AI" },
            { key: "reports",   label: "Báo Cáo" },
            { key: "admin_agent", label: "Agent" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex-1 py-2 text-center font-bold ${
                activeTab === tab.key ? "bg-banana-500 text-navy-950" : "text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Admin Workspace */}
      <main className="w-full px-4 sm:px-8 lg:px-12 py-6">

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
                onViewAiTrends={() => setActiveTab("ai_trends")}
              />
            )}
            {activeTab === "products"  && <ProductsTab />}
            {activeTab === "ai_trends" && <AiTrendsTab onOpenAgent={() => openAdminAgent("trends")} />}
            {activeTab === "reports"   && <ReportsTab onOpenAgent={() => openAdminAgent("reports")} />}
            {activeTab === "admin_agent" && <AdminAgentTab initialModule={agentInitialModule} />}
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
