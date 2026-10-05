"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  LayoutDashboard, 
  Package, 
  Search, 
  Filter, 
  RefreshCw, 
  Edit3, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  Users,
  ShieldCheck,
  TrendingUp,
  LogOut,
  Sparkles,
  MessageSquare,
  BarChart3,
  Bot,
  AlertCircle,
  Eye,
  X,
  ShoppingBag,
  Plus,
  Trash2,
  Tag,
  Columns,
  FileText,
  Printer,
  ChevronRight,
  Ban
} from "lucide-react";
import { StoredOrder } from "@/lib/order-store";
import { AdminToastProvider, useAdminToast } from "@/context/AdminToastContext";
import ReportsTab from "@/app/admin/components/ReportsTab";
import AiTrendsTab from "@/app/admin/components/AiTrendsTab";
import CustomersTab from "@/app/admin/components/CustomersTab";
import ProductsTab from "@/app/admin/components/ProductsTab";
import OrderManagementTab from "@/app/admin/components/OrderManagementTab";
import { OrderStatus, CuratedProduct } from "@/types";

function AdminDashboardPageInner() {
  const router = useRouter();
  const { adminToast } = useAdminToast();

  // Chế độ giao diện Admin: "dashboard" (Bảng điều khiển tổng quan) | "operations" (Bàn tác nghiệp kho vận Kanban)
  const [adminViewMode, setAdminViewMode] = useState<"dashboard" | "operations">("dashboard");

  // Trạng thái Auth
  const [authChecking, setAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ username: string; name: string; role: string } | null>(null);

  // Tab đang chọn trong chế độ Dashboard: "orders" | "customers" | "products" | "ai_trends" | "reports"
  const [activeTab, setActiveTab] = useState<"orders" | "customers" | "ai_trends" | "products" | "reports">("orders");

  // Quản lý Khách Hàng (Customer CRM)
  const [customers, setCustomers] = useState<any[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerStats, setCustomerStats] = useState<any>(null);
  const [customerTypeFilter, setCustomerTypeFilter] = useState<"ALL" | "REGISTERED" | "GUEST_ORDER" | "CHAT_LEAD">("ALL");

  // Quản lý đơn hàng
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal Cập nhật trạng thái đơn

  // Modal Hủy đơn hàng

  // Quản lý xu hướng Chat AI
  const [aiStats, setAiStats] = useState<any>(null);
  const [aiSessions, setAiSessions] = useState<any[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [selectedAiSession, setSelectedAiSession] = useState<any | null>(null);

  // Chat Trends Filters
  const [chatSearch, setChatSearch] = useState("");
  const [chatCustomerType, setChatCustomerType] = useState<string>("ALL");
  const [chatDateFrom, setChatDateFrom] = useState("");
  const [chatDateTo, setChatDateTo] = useState("");

  // API Keys Monitor
  const [apiKeyStatus, setApiKeyStatus] = useState<any>(null);

  // Báo cáo doanh thu & mặt hàng
  const [reportData, setReportData] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Sprint 4 — Phễu Chuyển Đổi (Conversion Funnel)
  const [funnelData, setFunnelData] = useState<any>(null);
  const [loadingFunnel, setLoadingFunnel] = useState(false);

  // AI Business Insights
  const [insightsData, setInsightsData] = useState<any>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Quản lý Sản Phẩm (Products CRUD)
  const [products, setProducts] = useState<CuratedProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CuratedProduct | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    category: "cosmetics",
    priceJpy: 3000,
    weightKg: 0.4,
    imageUrl: "",
    description: "",
    originalStore: "Amazon JP",
    stockSlots: 10,
    isHot: false,
    featuredNote: "",
    voltageNote: "",
  });
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // 1. Kiểm tra xác thực Admin
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


  // 3. Tải thống kê xu hướng AI
  const fetchAiTrends = async () => {
    setLoadingAi(true);
    try {
      const params = new URLSearchParams();
      if (chatSearch) params.append("search", chatSearch);
      if (chatCustomerType !== "ALL") params.append("customerType", chatCustomerType);
      if (chatDateFrom) params.append("dateFrom", chatDateFrom);
      if (chatDateTo) params.append("dateTo", chatDateTo);

      const res = await fetch(`/api/admin/chat-trends?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setAiStats(data.stats);
        setAiSessions(data.sessions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAi(false);
    }
  };

  const fetchApiKeyStatus = async () => {
    try {
      const res = await fetch("/api/admin/api-keys");
      const data = await res.json();
      if (res.ok && data.success) {
        setApiKeyStatus(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 4. Tải danh sách sản phẩm
  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      if (res.ok && data.products) {
        setProducts(data.products);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProducts(false);
    }
  };

  // 5. Tải danh sách khách hàng & phân tích chi tiêu
  const fetchCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const res = await fetch("/api/admin/customers");
      const data = await res.json();
      if (res.ok && data.success) {
        setCustomers(data.customers || []);
        setCustomerStats(data.stats || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  // 6. Tải báo cáo doanh thu
  const fetchReport = async () => {
    setLoadingReport(true);
    try {
      const res = await fetch("/api/admin/reports");
      const data = await res.json();
      if (res.ok && data.success) {
        setReportData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReport(false);
    }
  };

  // 7. Tải dữ liệu phễu chuyển đổi (Sprint 4)
  const fetchFunnel = async () => {
    setLoadingFunnel(true);
    try {
      const res = await fetch("/api/admin/funnel");
      const data = await res.json();
      if (res.ok && data.success) {
        setFunnelData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFunnel(false);
    }
  };

  useEffect(() => {
    if (!authChecking) {
      // fetchOrders removed
    }
  }, [authChecking]);

  // Child tabs (CustomersTab, ProductsTab, AiTrendsTab, ReportsTab) manage their own data fetching.

  // Handlers Quản lý sản phẩm
  const openCreateProductModal = () => {
    setEditingProduct(null);
    setProductForm({
      name: "",
      category: "cosmetics",
      priceJpy: 3500,
      weightKg: 0.4,
      imageUrl: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80",
      description: "Sản phẩm nội địa Nhật Bản chính hãng gom mua trực tiếp.",
      originalStore: "Amazon JP",
      stockSlots: 10,
      isHot: true,
      featuredNote: "Mặt hàng săn sale số lượng có hạn",
      voltageNote: "",
    });
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (prod: CuratedProduct) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name,
      category: prod.category,
      priceJpy: prod.priceJpy,
      weightKg: prod.weightKg,
      imageUrl: prod.imageUrl,
      description: prod.description || "",
      originalStore: prod.originalStore || "Amazon JP",
      stockSlots: prod.stockSlots || 10,
      isHot: Boolean(prod.isHot),
      featuredNote: prod.featuredNote || "",
      voltageNote: prod.voltageNote || "",
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || !productForm.priceJpy) {
      adminToast.error("Vui lòng điền tên sản phẩm và giá Yên!");
      return;
    }

    setIsSavingProduct(true);
    try {
      if (editingProduct) {
        // Cập nhật PUT
        const res = await fetch("/api/products", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingProduct.id,
            ...productForm,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          adminToast.success("Cập nhật sản phẩm thành công!");
          setIsProductModalOpen(false);
          fetchProducts();
        } else {
          alert(data.error || "Lỗi cập nhật");
        }
      } else {
        // Tạo mới POST
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(productForm),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          adminToast.success("Đã thêm sản phẩm mới thành công!");
          setIsProductModalOpen(false);
          fetchProducts();
        } else {
          alert(data.error || "Lỗi tạo sản phẩm");
        }
      }
    } catch (err) {
      adminToast.error("Lỗi kết nối máy chủ");
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa sản phẩm "${name}" khỏi trang chủ?`)) return;

    try {
      const res = await fetch(`/api/products?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        adminToast.error("Đã xóa sản phẩm!");
        fetchProducts();
      } else {
        alert(data.error || "Lỗi khi xóa");
      }
    } catch {
      adminToast.error("Lỗi kết nối");
    }
  };


  // Đăng xuất
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
                Chill<span className="text-banana-400">Banana</span> <span className="text-xs font-sans font-normal text-banana-200 bg-navy-800 px-2 py-0.5 rounded-full ml-1">Admin Portal</span>
              </span>
            </Link>

            <span className="text-slate-600 hidden sm:inline">|</span>

            {/* Bộ Chuyển Đổi 2 Giao Diện Quản Trị */}
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
                title="Giao diện 2: Bàn tác nghiệp kho vận & xử lý đơn hàng chuyên sâu (Kanban)"
              >
                <Columns className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Bàn Tác Nghiệp Kho (Kanban)</span>
              </button>
            </div>

            {adminViewMode === "dashboard" && (
              <nav className="hidden lg:flex items-center space-x-2 text-xs border-l border-navy-800 pl-3">
                <button
                  onClick={() => setActiveTab("orders")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                    activeTab === "orders" ? "bg-slate-800 text-white border border-slate-700 shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Đơn Hàng</span>
                </button>

                <button
                  onClick={() => setActiveTab("customers")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                    activeTab === "customers" ? "bg-slate-800 text-white border border-slate-700 shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Khách Hàng</span>
                </button>

                <button
                  onClick={() => setActiveTab("products")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                    activeTab === "products" ? "bg-slate-800 text-white border border-slate-700 shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Sản Phẩm</span>
                </button>

                <button
                  onClick={() => setActiveTab("ai_trends")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                    activeTab === "ai_trends" ? "bg-slate-800 text-white border border-slate-700 shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Xu Hướng AI</span>
                </button>

                <button
                  onClick={() => setActiveTab("reports")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                    activeTab === "reports" ? "bg-slate-800 text-white border border-slate-700 shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Báo Cáo</span>
                </button>
              </nav>
            )}
          </div>

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
        <div className="sm:hidden flex border-t border-navy-800 text-xs">
          <button
            onClick={() => setActiveTab("orders")}
            className={`flex-1 py-2 text-center font-bold ${
              activeTab === "orders" ? "bg-banana-500 text-navy-950" : "text-slate-300"
            }`}
          >
            Đơn Hàng
          </button>
          <button
            onClick={() => setActiveTab("customers")}
            className={`flex-1 py-2 text-center font-bold ${
              activeTab === "customers" ? "bg-banana-500 text-navy-950" : "text-slate-300"
            }`}
          >
            Khách Hàng
          </button>
          <button
            onClick={() => setActiveTab("products")}
            className={`flex-1 py-2 text-center font-bold ${
              activeTab === "products" ? "bg-banana-500 text-navy-950" : "text-slate-300"
            }`}
          >
            Sản Phẩm
          </button>
          <button
            onClick={() => setActiveTab("ai_trends")}
            className={`flex-1 py-2 text-center font-bold ${
              activeTab === "ai_trends" ? "bg-banana-500 text-navy-950" : "text-slate-300"
            }`}
          >
            AI
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`flex-1 py-2 text-center font-bold ${
              activeTab === "reports" ? "bg-banana-500 text-navy-950" : "text-slate-300"
            }`}
          >
            Báo Cáo
          </button>
        </div>
      </header>

      {/* Main Admin Workspace (Full Screen 95-98% for professional operations) */}
      <main className="w-full px-4 sm:px-8 lg:px-12 py-6">
        
        {/* ======================================================== */}
        {/* GIAO DIỆN 1: BẢNG ĐIỀU KHIỂN DASHBOARD (TỔNG QUAN) */}
        {/* ======================================================== */}
        {adminViewMode === "dashboard" && (
          <div className="space-y-6">
            {/* TAB 1: QUẢN LÝ ĐƠN HÀNG */}
        <OrderManagementTab 
          adminViewMode={adminViewMode} 
          activeTab={activeTab} 
          externalSearchTerm={searchTerm} 
          onClearSearch={() => setSearchTerm("")} 
        />

        {/* ======================================================== */}
        {/* TAB: QUẢN LÝ KHÁCH HÀNG TOÀN DIỆN (UNIFIED CUSTOMER CRM) */}
        {/* ======================================================== */}
        {activeTab === "customers" && (
          <CustomersTab 
            onViewOrders={(term) => { setSearchTerm(term); setActiveTab("orders"); }} 
            onViewAiTrends={() => setActiveTab("ai_trends")} 
          />
        )}

        {/* ======================================================== */}
        {/* TAB 2: QUẢN LÝ SẢN PHẨM (GỢI Ý MẶT HÀNG HOT & GOM SLOT) */}
        {/* ======================================================== */}
        {activeTab === "products" && <ProductsTab />}

        {/* ======================================================== */}
        {/* TAB 3: PHÂN TÍCH XU HƯỚNG KHÁCH HÀNG TỪ AI CHAT (CSDL) */}
        {/* ======================================================== */}
        {activeTab === "ai_trends" && <AiTrendsTab />}


        {/* ======================================================== */}
        {/* TAB 5: BÁO CÁO DOANH THU & MẶT HÀNG BÁN CHẠY           */}
        {/* ======================================================== */}
        {activeTab === "reports" && <ReportsTab />}

        {/* Đóng GIAO DIỆN 1 (DASHBOARD) */}
        </div>
        )}

        {/* ======================================================== */}
        {/* GIAO DIỆN 2: BÀN TÁC NGHIỆP KHO VẬN KANBAN (OPERATIONS) */}
        {/* ======================================================== */}
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
