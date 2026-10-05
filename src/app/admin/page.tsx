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
import { OrderStatus, CuratedProduct } from "@/types";

function AdminDashboardPageInner() {
  const router = useRouter();
  const { adminToast } = useAdminToast();

  // Chế độ giao diện Admin: "dashboard" (Bảng điều khiển tổng quan) | "operations" (Bàn tác nghiệp kho vận Kanban)
  const [adminViewMode, setAdminViewMode] = useState<"dashboard" | "operations">("dashboard");
  const [packingSlipOrder, setPackingSlipOrder] = useState<StoredOrder | null>(null);

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
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal Cập nhật trạng thái đơn
  const [selectedOrder, setSelectedOrder] = useState<StoredOrder | null>(null);
  const [newStatus, setNewStatus] = useState<OrderStatus>("PURCHASING_JP");
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateDesc, setUpdateDesc] = useState("");
  const [updateLocation, setUpdateLocation] = useState("Tokyo, Nhật Bản");
  const [jpTrack, setJpTrack] = useState("");
  const [vnTrack, setVnTrack] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Modal Hủy đơn hàng
  const [cancelModalOrder, setCancelModalOrder] = useState<StoredOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("Sản phẩm hết hàng tại Nhật / Người bán hủy bán");
  const [cancelCustomReason, setCancelCustomReason] = useState("");
  const [refundDeposit, setRefundDeposit] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

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

  // 2. Tải danh sách đơn hàng
  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (res.ok && data.orders) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOrders(false);
    }
  };

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
      fetchOrders();
      fetchProducts();
      fetchCustomers();
    }
  }, [authChecking]);

  useEffect(() => {
    if (activeTab === "customers") fetchCustomers();
  }, [activeTab]);

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

  // Thao tác 1-Click chuyển trạng thái trên Bàn Tác Nghiệp Kho Vận
  const quickMoveStatus = async (
    orderCode: string,
    nextStatus: OrderStatus,
    title: string,
    desc: string,
    loc: string
  ) => {
    try {
      const res = await fetch(`/api/orders/${orderCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          title,
          description: desc,
          location: loc,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchOrders();
      } else {
        alert("Lỗi cập nhật: " + (data.error || "Vui lòng thử lại"));
      }
    } catch {
      adminToast.error("Lỗi kết nối máy chủ");
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

  // Mở modal cập nhật trạng thái đơn
  const openUpdateModal = (order: StoredOrder) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setJpTrack(order.jpDomesticTrack || "");
    setVnTrack(order.vnDomesticTrack || "");

    if (order.status === "PENDING_DEPOSIT") {
      setNewStatus("PURCHASING_JP");
      setUpdateTitle("Đã nhận cọc - Đang mua hàng tại Tokyo");
      setUpdateDesc("Nhân viên văn phòng Tokyo đã tiến hành order hàng trực tiếp từ người bán.");
      setUpdateLocation("Tokyo, Nhật Bản");
    } else if (order.status === "PURCHASING_JP") {
      setNewStatus("WAREHOUSE_JP");
      setUpdateTitle("Đã nhập kho Tokyo");
      setUpdateDesc("Kiện hàng đã về kho Nhật, kiểm tra seal nguyên vẹn và cân nặng chuẩn xác.");
      setUpdateLocation("Kho Tokyo (Edogawa-ku)");
    } else if (order.status === "WAREHOUSE_JP") {
      setNewStatus("IN_TRANSIT_AIR");
      setUpdateTitle("Đang vận chuyển quốc tế Tokyo ⇄ Việt Nam");
      setUpdateDesc("Kiện hàng đã được đóng gói chống sốc và lên lộ trình chuyển về Việt Nam.");
      setUpdateLocation("Sân bay Quốc tế Narita (NRT)");
    } else if (order.status === "IN_TRANSIT_AIR") {
      setNewStatus("WAREHOUSE_VN");
      setUpdateTitle("Đã nhập kho phân loại tại Việt Nam");
      setUpdateDesc("Hàng hoàn tất thông quan hải quan và chuyển về kho trung chuyển.");
      setUpdateLocation("Kho ChillBanana Hà Nội / TP.HCM");
    } else if (order.status === "WAREHOUSE_VN") {
      setNewStatus("LOCAL_DELIVERY");
      setUpdateTitle("Đang giao hàng chặng cuối");
      setUpdateDesc("Đã bàn giao cho đơn vị vận chuyển nội địa (GHTK/GHN/ViettelPost) phát tận tay khách.");
      setUpdateLocation("Việt Nam");
    } else if (order.status === "LOCAL_DELIVERY") {
      setNewStatus("COMPLETED");
      setUpdateTitle("Giao hàng thành công");
      setUpdateDesc("Khách hàng đã nhận đủ hàng và hoàn tất đơn hàng.");
      setUpdateLocation("Việt Nam");
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setIsUpdating(true);

    try {
      const res = await fetch(`/api/orders/${selectedOrder.orderCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          title: updateTitle || "Cập nhật tiến độ đơn hàng",
          description: updateDesc || "Đơn hàng đã chuyển sang trạng thái mới.",
          location: updateLocation || "Việt Nam",
          jpTrack,
          vnTrack,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        adminToast.success(`Đã cập nhật đơn #${selectedOrder.orderCode} thành công!`);
        setSelectedOrder(null);
        fetchOrders();
      } else {
        alert("Lỗi cập nhật: " + (data.error || "Vui lòng thử lại"));
      }
    } catch {
      adminToast.error("Lỗi kết nối máy chủ");
    } finally {
      setIsUpdating(false);
    }
  };

  const openCancelModal = (order: StoredOrder) => {
    setCancelModalOrder(order);
    setCancelReason("Sản phẩm hết hàng tại Nhật / Người bán hủy bán");
    setCancelCustomReason("");
    setRefundDeposit(order.paymentStatus !== "UNPAID");
  };

  const handleCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalOrder) return;
    setIsCancelling(true);

    const finalReason =
      cancelReason === "Khác" && cancelCustomReason.trim()
        ? cancelCustomReason.trim()
        : cancelReason;

    try {
      const res = await fetch(`/api/orders/${cancelModalOrder.orderCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          by: "ADMIN",
          reason: finalReason,
          paymentStatus: refundDeposit ? "UNPAID" : cancelModalOrder.paymentStatus,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        adminToast.success(`Đã hủy đơn hàng #${cancelModalOrder.orderCode} thành công!`);
        setCancelModalOrder(null);
        fetchOrders();
      } else {
        alert("Lỗi khi hủy đơn: " + (data.error || "Vui lòng thử lại"));
      }
    } catch {
      adminToast.error("Lỗi kết nối máy chủ");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDeleteOrder = async (orderCode: string) => {
    const confirmed = window.confirm(
      `CẢNH BÁO: Bạn có chắc chắn muốn XÓA VĨNH VIỄN đơn hàng #${orderCode} khỏi cơ sở dữ liệu?\nThao tác này sẽ dọn sạch dữ liệu và không thể hoàn tác!`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/orders/${orderCode}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        adminToast.error(`Đã xóa vĩnh viễn đơn #${orderCode}!`);
        fetchOrders();
      } else {
        alert("Lỗi khi xóa đơn: " + (data.error || "Vui lòng thử lại"));
      }
    } catch {
      adminToast.error("Lỗi kết nối máy chủ khi xóa");
    }
  };

  const filteredOrders = orders.filter((ord) => {
    const matchesStatus = filterStatus === "ALL" || ord.status === filterStatus;
    const matchesSearch =
      ord.orderCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ord.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ord.customerEmail && ord.customerEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
      ord.customerPhone.includes(searchTerm) ||
      ord.productName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const totalRevenue = orders.reduce((acc, curr) => acc + curr.totalVnd, 0);
  const actualRevenue = orders
    .filter((o) => o.paymentStatus !== "UNPAID")
    .reduce((acc, curr) => acc + curr.depositAmountVnd, 0);
  const depositedCount = orders.filter((o) => o.paymentStatus !== "UNPAID").length;
  const completedCount = orders.filter((o) => o.status === "COMPLETED").length;

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
                  <span>Đơn Hàng ({orders.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab("customers")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                    activeTab === "customers" ? "bg-slate-800 text-white border border-slate-700 shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Khách Hàng ({customers.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab("products")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                    activeTab === "products" ? "bg-slate-800 text-white border border-slate-700 shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Sản Phẩm ({products.length})</span>
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
            {activeTab === "orders" && (
              <div className="space-y-6">
            
            {/* Quick Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Tổng Đơn Hàng</span>
                <div className="text-2xl font-bold text-navy-900 mt-1">{orders.length} đơn</div>
                <span className="text-[11px] text-emerald-600 font-bold mt-1 inline-block">Lưu trữ an toàn trong CSDL</span>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Doanh Thu Thực Thu</span>
                <div className="text-2xl font-bold text-banana-600 mt-1 font-mono">
                  {actualRevenue.toLocaleString("vi-VN")} đ
                </div>
                <span className="text-[11px] text-slate-500 mt-1 inline-block">Tổng cọc đã nhận từ {depositedCount} đơn</span>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Đơn Hoàn Thành</span>
                <div className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
                  {completedCount} / {orders.length}
                </div>
                <span className="text-[11px] text-emerald-600 mt-1 inline-block">
                  Tỷ lệ: {orders.length > 0 ? Math.round((completedCount / orders.length) * 100) : 0}% hoàn thành
                </span>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Đang Xử Lý Mua & Vận Chuyển</span>
                <div className="text-2xl font-bold text-blue-600 mt-1 font-mono">
                  {orders.filter((o) => o.status !== "COMPLETED" && o.status !== "PENDING_DEPOSIT" && o.status !== "CANCELLED").length} đơn
                </div>
                <span className="text-[11px] text-slate-500 mt-1 inline-block">Tiến độ 7 bước liên tục</span>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo mã đơn, khách, sđt, sản phẩm..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-banana-500 focus:bg-white"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <Filter className="w-4 h-4 text-slate-400 mr-1 hidden sm:inline" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-banana-500"
                >
                  <option value="ALL">Tất cả trạng thái ({orders.length})</option>
                  <option value="PENDING_DEPOSIT">1. Chờ cọc (Pending Deposit)</option>
                  <option value="PURCHASING_JP">2. Đang mua hàng tại Nhật</option>
                  <option value="WAREHOUSE_JP">3. Đã nhập kho Tokyo</option>
                  <option value="IN_TRANSIT_AIR">4. Đang vận chuyển quốc tế</option>
                  <option value="WAREHOUSE_VN">5. Đã về kho Việt Nam</option>
                  <option value="LOCAL_DELIVERY">6. Đang phát nội địa VN</option>
                  <option value="COMPLETED">7. Giao hàng thành công</option>
                  <option value="CANCELLED">❌ Đã hủy (Cancelled)</option>
                </select>

                <button
                  onClick={fetchOrders}
                  className="p-2 text-slate-600 hover:text-banana-600 hover:bg-slate-100 rounded-xl transition-colors"
                  title="Làm mới danh sách"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingOrders ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-4">Mã Đơn</th>
                      <th className="p-4">Khách Hàng</th>
                      <th className="p-4">Sản Phẩm &amp; Sàn</th>
                      <th className="p-4">Tổng Tiền (VND)</th>
                      <th className="p-4">Cọc / TT</th>
                      <th className="p-4">Trạng Thái 7 Bước</th>
                      <th className="p-4 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-slate-500">
                          <div className="max-w-md mx-auto space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl mx-auto">
                              📦
                            </div>
                            <div className="font-bold text-navy-900 text-sm">
                              Chưa có đơn hàng nào trong CSDL SQLite
                            </div>
                            <p className="text-xs text-slate-400">
                              Hệ thống đã dọn sạch toàn bộ dữ liệu mẫu. Khi có khách hàng thật đặt đơn trên trang chủ, thông tin đơn sẽ xuất hiện ngay tại đây!
                            </p>
                            <div className="pt-1">
                              <Link
                                href="/#calculator"
                                target="_blank"
                                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-banana-500 hover:bg-banana-600 text-navy-950 font-bold text-xs rounded-xl shadow-sm transition-all"
                              >
                                <span>Mở Trang Chủ Đặt Hàng Thử Nghiệm</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4 font-mono font-bold text-navy-900">
                            #{ord.orderCode}
                            {ord.isGroupBuy && (
                              <span className="block text-[10px] font-sans text-amber-600 font-bold">
                                📦 Gộp đơn
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900">{ord.customerName}</span>
                              {((ord as any).customerType === "REGISTERED" || (ord as any).customerId) ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">
                                  👤 Thành viên
                                </span>
                              ) : (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-orange-100 text-orange-700 border border-orange-200 shrink-0">
                                  🛍️ Khách lạ
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">{ord.customerPhone}</div>
                          </td>
                          <td className="p-4 max-w-xs">
                            <div className="font-semibold text-navy-950 truncate" title={ord.productName}>
                              {ord.productName}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {ord.priceJpy.toLocaleString()} ¥ • {ord.weightKg} kg
                            </div>
                          </td>
                          <td className="p-4 font-mono font-bold text-navy-900">
                            {ord.totalVnd.toLocaleString()} đ
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                ord.paymentStatus === "UNPAID"
                                  ? "bg-rose-100 text-rose-700"
                                  : ord.paymentStatus === "DEPOSITED_50"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {ord.paymentStatus === "UNPAID"
                                ? "Chưa cọc"
                                : ord.paymentStatus === "DEPOSITED_50"
                                ? "Cọc 50%"
                                : "Đã trả 100%"}
                            </span>
                          </td>
                          <td className="p-4">
                            {ord.status === "CANCELLED" ? (
                              <span className="inline-flex items-center text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-xl">
                                ✕ Đã Hủy
                              </span>
                            ) : ord.status === "COMPLETED" ? (
                              <span className="inline-flex items-center text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
                                ✓ Hoàn Tất
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl">
                                {ord.status}
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {ord.status !== "CANCELLED" && (
                                <>
                                  <button
                                    onClick={() => openUpdateModal(ord)}
                                    title="Cập nhật tiến độ"
                                    className="px-2.5 py-1.5 bg-banana-500 hover:bg-banana-600 text-navy-950 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center space-x-1"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Tiến độ</span>
                                  </button>
                                  <button
                                    onClick={() => openCancelModal(ord)}
                                    title="Hủy đơn hàng"
                                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-all flex items-center space-x-1"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                    <span>Hủy</span>
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => handleDeleteOrder(ord.orderCode)}
                                title="Xóa vĩnh viễn đơn rác / test"
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB: QUẢN LÝ KHÁCH HÀNG TOÀN DIỆN (UNIFIED CUSTOMER CRM) */}
        {/* ======================================================== */}
        {activeTab === "customers" && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center space-x-1.5 bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full mb-2">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span>Unified Customer 360 — CRM Toàn Diện</span>
                </div>
                <h2 className="text-2xl font-serif font-bold text-navy-900">
                  Quản Lý Toàn Bộ Khách Hàng
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-xl">
                  Theo dõi đầy đủ: Thành viên đã đăng ký, Khách lạ đặt đơn (Guest Checkout) và Khách tư vấn Chat AI — tất cả trong một trang.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    const res = await fetch("/api/admin/stitch-all", { method: "POST" });
                    const data = await res.json();
                    alert(data.message || "Hoan thanh!");
                    fetchCustomers();
                  }}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-2xl transition-all flex items-center space-x-2"
                >
                  <span>🔗 Hop Nhat Du Lieu Cu</span>
                </button>
                <button
                  onClick={fetchCustomers}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-all flex items-center space-x-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingCustomers ? "animate-spin" : ""}`} />
                  <span>Làm Mới</span>
                </button>
              </div>
            </div>

            {/* KPI Cards — 5 chỉ số bấm được để lọc */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div
                onClick={() => setCustomerTypeFilter("ALL")}
                className={`bg-white p-4 rounded-3xl border-2 cursor-pointer transition-all shadow-sm hover:shadow-md ${
                  customerTypeFilter === "ALL" ? "border-navy-700 bg-navy-50" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tất Cả</div>
                <div className="text-2xl font-bold text-navy-900 font-mono">{customerStats?.totalAll ?? customers.length}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">khách hàng & lead</div>
              </div>

              <div
                onClick={() => setCustomerTypeFilter("REGISTERED")}
                className={`bg-white p-4 rounded-3xl border-2 cursor-pointer transition-all shadow-sm hover:shadow-md ${
                  customerTypeFilter === "REGISTERED" ? "border-emerald-600 bg-emerald-50" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">👤 Thành Viên</div>
                <div className="text-2xl font-bold text-emerald-700 font-mono">{customerStats?.totalRegistered ?? customers.filter(c => c.customerType === "REGISTERED").length}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">đã đăng ký tài khoản</div>
              </div>

              <div
                onClick={() => setCustomerTypeFilter("GUEST_ORDER")}
                className={`bg-white p-4 rounded-3xl border-2 cursor-pointer transition-all shadow-sm hover:shadow-md ${
                  customerTypeFilter === "GUEST_ORDER" ? "border-orange-500 bg-orange-50" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="text-[10px] font-bold text-orange-700 uppercase tracking-wider mb-1">🛍️ Vãng Lai</div>
                <div className="text-2xl font-bold text-orange-600 font-mono">{customerStats?.totalGuestOrder ?? customers.filter(c => c.customerType === "GUEST_ORDER").length}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">đặt đơn không đăng ký</div>
              </div>

              <div
                onClick={() => setCustomerTypeFilter("CHAT_LEAD")}
                className={`bg-white p-4 rounded-3xl border-2 cursor-pointer transition-all shadow-sm hover:shadow-md ${
                  customerTypeFilter === "CHAT_LEAD" ? "border-purple-500 bg-purple-50" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-1">💬 Chat Lead</div>
                <div className="text-2xl font-bold text-purple-600 font-mono">{customerStats?.totalChatLead ?? customers.filter(c => c.customerType === "CHAT_LEAD").length}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">chỉ tư vấn chưa mua</div>
              </div>

              <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                <div className="text-[10px] font-bold text-banana-700 uppercase tracking-wider mb-1">💰 Doanh Số</div>
                <div className="text-lg font-bold text-banana-600 font-mono">
                  {((customerStats?.totalRevenueVnd ?? customers.reduce((acc, c) => acc + (c.totalSpentVnd || 0), 0)) / 1_000_000).toFixed(1)}M
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">VNĐ tích lũy</div>
              </div>
            </div>

            {/* Toolbar: Search + Segment Filter Buttons */}
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-96">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Tìm theo tên, email, số điện thoại..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-banana-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 text-xs font-bold flex-wrap justify-end">
                {([
                  { key: "ALL" as const, label: "Tất Cả" },
                  { key: "REGISTERED" as const, label: "👤 Thành Viên" },
                  { key: "GUEST_ORDER" as const, label: "🛍️ Vãng Lai" },
                  { key: "CHAT_LEAD" as const, label: "💬 Chat Lead" },
                ]).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setCustomerTypeFilter(key)}
                    className={`px-3 py-1.5 rounded-xl transition-all ${
                      customerTypeFilter === key
                        ? key === "ALL" ? "bg-navy-900 text-white"
                          : key === "REGISTERED" ? "bg-emerald-600 text-white"
                          : key === "GUEST_ORDER" ? "bg-orange-500 text-white"
                          : "bg-purple-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bảng danh sách khách hàng hợp nhất */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[10px] font-bold">
                      <th className="p-4 pl-6">Khách Hàng</th>
                      <th className="p-4">Phân Loại</th>
                      <th className="p-4">Thông Tin Liên Hệ</th>
                      <th className="p-4 text-center">Đơn Hàng</th>
                      <th className="p-4 text-center">Lịch Sử Chat AI</th>
                      <th className="p-4">Tổng Chi Tiêu</th>
                      <th className="p-4">Hoạt Động Gần Nhất</th>
                      <th className="p-4 pr-6 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingCustomers ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-banana-500" />
                          Đang tải dữ liệu khách hàng hợp nhất...
                        </td>
                      </tr>
                    ) : (
                      customers
                        .filter((c) => {
                          const matchType = customerTypeFilter === "ALL" || c.customerType === customerTypeFilter;
                          if (!matchType) return false;
                          if (!customerSearch.trim()) return true;
                          const q = customerSearch.toLowerCase();
                          return (
                            c.name?.toLowerCase().includes(q) ||
                            c.email?.toLowerCase().includes(q) ||
                            c.phone?.includes(q) ||
                            c.address?.toLowerCase().includes(q)
                          );
                        })
                        .map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                            {/* Cột 1: Thông tin khách hàng */}
                            <td className="p-4 pl-6">
                              <div className="flex items-center space-x-3">
                                <div className={`w-9 h-9 rounded-2xl font-bold flex items-center justify-center text-xs shadow-sm uppercase shrink-0 text-white ${
                                  c.customerType === "REGISTERED" ? "bg-gradient-to-br from-emerald-500 to-emerald-600" :
                                  c.customerType === "GUEST_ORDER" ? "bg-gradient-to-br from-orange-400 to-orange-500" :
                                  "bg-gradient-to-br from-purple-400 to-purple-500"
                                }`}>
                                  {c.name ? c.name.charAt(0) : "U"}
                                </div>
                                <div>
                                  <div className="font-bold text-navy-900 text-xs">{c.name}</div>
                                  <div className="text-[10px] text-slate-400">
                                    {c.customerType === "REGISTERED" ? `Gia nhập: ${new Date(c.createdAt).toLocaleDateString("vi-VN")}` :
                                     c.customerType === "GUEST_ORDER" ? `Đơn đầu: ${new Date(c.createdAt).toLocaleDateString("vi-VN")}` :
                                     `Chat từ: ${new Date(c.createdAt).toLocaleDateString("vi-VN")}`}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Cột 2: Badge phân loại */}
                            <td className="p-4">
                              {c.customerType === "REGISTERED" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                  👤 Thành Viên
                                </span>
                              )}
                              {c.customerType === "GUEST_ORDER" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
                                  🛍️ Vãng Lai
                                </span>
                              )}
                              {c.customerType === "CHAT_LEAD" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                                  💬 Chat Lead
                                </span>
                              )}
                            </td>

                            {/* Cột 3: Liên hệ */}
                            <td className="p-4">
                              <div className="space-y-0.5">
                                <div className="font-mono text-slate-800 text-[11px]">{c.email || "—"}</div>
                                <div className="text-[11px] text-slate-500">📞 {c.phone}</div>
                              </div>
                            </td>

                            {/* Cột 4: Đơn hàng */}
                            <td className="p-4 text-center">
                              {c.customerType !== "CHAT_LEAD" ? (
                                <div className="space-y-1">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
                                    c.orderCount > 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-400"
                                  }`}>
                                    {c.orderCount} đơn
                                  </span>
                                  {c.latestOrderCode && (
                                    <div className="text-[10px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 truncate max-w-[110px]">
                                      #{c.latestOrderCode}
                                    </div>
                                  )}
                                  {c.latestOrderStatus && (
                                    <div className="text-[10px] text-slate-400 truncate max-w-[110px]">{c.latestOrderStatus}</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300 text-[11px]">—</span>
                              )}
                            </td>

                            {/* Cột 5: Chat AI */}
                            <td className="p-4 text-center">
                              {c.chatSessionCount > 0 ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-purple-50 text-purple-700 border border-purple-200">
                                    💬 {c.chatSessionCount} phiên
                                  </span>
                                  {c.lastChatTopic && (
                                    <div className="text-[10px] text-slate-400 truncate max-w-[110px]">{c.lastChatTopic}</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300 text-[11px]">—</span>
                              )}
                            </td>

                            {/* Cột 6: Tổng chi tiêu */}
                            <td className="p-4 font-mono font-bold text-navy-900 text-xs">
                              {c.customerType !== "CHAT_LEAD"
                                ? (c.totalSpentVnd || 0).toLocaleString("vi-VN") + " đ"
                                : <span className="text-slate-300">—</span>}
                            </td>

                            {/* Cột 7: Hoạt động gần nhất */}
                            <td className="p-4 text-[10px] text-slate-500">
                              {c.lastActiveAt ? new Date(c.lastActiveAt).toLocaleDateString("vi-VN", {
                                day: "2-digit", month: "2-digit", year: "numeric"
                              }) : "—"}
                            </td>

                            {/* Cột 8: Thao tác */}
                            <td className="p-4 pr-6 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {c.customerType !== "CHAT_LEAD" && (
                                  <button
                                    onClick={() => {
                                      setActiveTab("orders");
                                      setSearchTerm(c.email || c.name);
                                    }}
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-banana-500 hover:text-navy-950 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition-all inline-flex items-center space-x-1"
                                    title="Xem đơn hàng của khách này"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Xem Đơn</span>
                                  </button>
                                )}
                                {c.chatSessionCount > 0 && (
                                  <button
                                    onClick={() => setActiveTab("ai_trends")}
                                    className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-xs rounded-xl shadow-sm transition-all inline-flex items-center space-x-1"
                                    title="Xem lịch sử chat AI"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>Chat</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                    {!loadingCustomers && customers.filter((c) => {
                      const matchType = customerTypeFilter === "ALL" || c.customerType === customerTypeFilter;
                      if (!matchType) return false;
                      if (!customerSearch.trim()) return true;
                      const q = customerSearch.toLowerCase();
                      return (
                        c.name?.toLowerCase().includes(q) ||
                        c.email?.toLowerCase().includes(q) ||
                        c.phone?.includes(q) ||
                        c.address?.toLowerCase().includes(q)
                      );
                    }).length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-slate-400">
                          <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          <div className="font-medium">Không tìm thấy khách hàng nào phù hợp.</div>
                          {customerTypeFilter !== "ALL" && (
                            <button
                              onClick={() => setCustomerTypeFilter("ALL")}
                              className="mt-2 text-xs text-banana-600 hover:underline"
                            >
                              Xem tất cả khách hàng
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Footer tổng kết */}
              <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  Hiển thị <strong className="text-navy-900">{customers.filter((c) => {
                    const matchType = customerTypeFilter === "ALL" || c.customerType === customerTypeFilter;
                    if (!matchType) return false;
                    if (!customerSearch.trim()) return true;
                    const q = customerSearch.toLowerCase();
                    return (
                      c.name?.toLowerCase().includes(q) ||
                      c.email?.toLowerCase().includes(q) ||
                      c.phone?.includes(q) ||
                      c.address?.toLowerCase().includes(q)
                    );
                  }).length}</strong> / {customers.length} khách hàng
                </span>
                {customerStats?.anonymousSessionCount > 0 && (
                  <span className="text-slate-400 italic">
                    + {customerStats.anonymousSessionCount} phiên chat ẩn danh (chưa xác định danh tính)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: QUẢN LÝ SẢN PHẨM (GỢI Ý MẶT HÀNG HOT & GOM SLOT) */}
        {/* ======================================================== */}
        {activeTab === "products" && (
          <div className="space-y-6">
            
            {/* Header Banner */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center space-x-1.5 bg-banana-100 text-banana-800 text-xs font-bold px-3 py-1 rounded-full mb-2">
                  <ShoppingBag className="w-3.5 h-3.5 text-banana-600" />
                  <span>Kho Sản Phẩm & Gom Order</span>
                </div>
                <h2 className="text-2xl font-serif font-bold text-navy-900">
                  Quản Lý Sản Phẩm Nội Địa Nhật
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-xl">
                  Thêm mới hoặc điều chỉnh danh sách sản phẩm hot hiển thị trên trang chủ để khách hàng chọn nhanh và tính bill tự động.
                </p>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <button
                  onClick={fetchProducts}
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all"
                  title="Tải lại danh sách"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingProducts ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={openCreateProductModal}
                  className="px-4 py-2.5 bg-banana-500 hover:bg-banana-600 text-navy-950 font-bold text-xs rounded-2xl shadow-md transition-all flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm Sản Phẩm Mới</span>
                </button>
              </div>
            </div>

            {/* Quick Filter & Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm sản phẩm theo tên..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500"
                />
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto text-xs">
                {["all", "cosmetics", "health", "gadgets", "anime"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setProductCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                      productCategoryFilter === cat
                        ? "bg-navy-900 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat === "all" && `Tất Cả (${products.length})`}
                    {cat === "cosmetics" && "Mỹ Phẩm"}
                    {cat === "health" && "Sức Khỏe"}
                    {cat === "gadgets" && "Gia Dụng 100V"}
                    {cat === "anime" && "Anime Figure"}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Sản Phẩm</th>
                      <th className="px-6 py-4">Danh Mục</th>
                      <th className="px-6 py-4">Nguồn Bán</th>
                      <th className="px-6 py-4">Giá Yên &amp; VNĐ</th>
                      <th className="px-6 py-4">Trọng Lượng</th>
                      <th className="px-6 py-4">Slot Còn</th>
                      <th className="px-6 py-4">Hot Deal</th>
                      <th className="px-6 py-4 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products
                      .filter((p) => {
                        const matchCat = productCategoryFilter === "all" || p.category === productCategoryFilter;
                        const matchSearch = p.name.toLowerCase().includes(productSearch.toLowerCase());
                        return matchCat && matchSearch;
                      })
                      .map((prod) => (
                        <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              <img
                                src={prod.imageUrl}
                                alt={prod.name}
                                className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                              />
                              <div>
                                <div className="font-bold text-navy-900 line-clamp-1 max-w-xs">{prod.name}</div>
                                {prod.voltageNote && (
                                  <span className="text-[10px] text-amber-700 font-medium">⚡ {prod.voltageNote}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2.5 py-1 rounded-lg">
                              {prod.categoryName || prod.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-600">
                            {prod.originalStore}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-navy-900 font-mono">{prod.priceJpy?.toLocaleString()} ¥</div>
                            <div className="text-[11px] text-banana-700 font-semibold">{prod.priceVnd?.toLocaleString("vi-VN")} đ</div>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-600 font-mono">
                            {prod.weightKg} kg
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                              {prod.stockSlots} slots
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {prod.isHot ? (
                              <span className="text-[10px] bg-banana-100 text-banana-900 font-extrabold px-2 py-0.5 rounded border border-banana-300">
                                🔥 HOT
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Thường</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => openEditProductModal(prod)}
                                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
                                title="Chỉnh sửa sản phẩm"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(prod.id, prod.name)}
                                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all"
                                title="Xóa sản phẩm"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

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
        {adminViewMode === "operations" && (
          <div className="space-y-6">
            {/* Header Toolbar */}
            <div className="bg-gradient-to-r from-slate-900 via-navy-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center space-x-2 bg-banana-500/20 text-banana-300 text-xs font-bold px-3 py-1 rounded-full mb-2 border border-banana-500/30">
                  <Columns className="w-3.5 h-3.5 text-banana-400" />
                  <span>Giao Diện Tác Nghiệp Kho Vận Tokyo ⇄ Việt Nam</span>
                </div>
                <h2 className="text-2xl font-serif font-bold text-white">
                  Bàn Điều Phối &amp; Xử Lý Đơn Hàng 1-Click
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-xl">
                  Giao diện chuyên sâu dành cho nhân viên kho Nhật và điều phối giao hàng Việt Nam: chuyển trạng thái 1 chạm, in phiếu gửi và cập nhật mã vận đơn tức thì.
                </p>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <div className="relative w-64">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm mã đơn, tên khách..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-banana-500"
                  />
                </div>
                <button
                  onClick={fetchOrders}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors border border-slate-700"
                  title="Làm mới dữ liệu"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingOrders ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* Kanban Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
              
              {/* CỘT 1: CHỜ CỌC */}
              <div className="bg-slate-100/90 rounded-2xl p-4 border border-slate-200 flex flex-col min-h-[400px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                  <div className="flex items-center space-x-1.5 font-bold text-xs text-amber-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span>1. Chờ Cọc</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
                    {orders.filter((o) => o.status === "PENDING_DEPOSIT").length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[70vh]">
                  {orders
                    .filter((o) => o.status === "PENDING_DEPOSIT")
                    .map((ord) => (
                      <div key={ord.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all text-xs space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="font-mono font-bold text-navy-900 text-xs">#{ord.orderCode}</span>
                          <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-200">
                            Chưa Cọc
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 line-clamp-1">{ord.customerName}</div>
                        <div className="text-[11px] text-slate-500">📞 {ord.customerPhone}</div>
                        <div className="text-[11px] text-navy-900 line-clamp-2 bg-slate-50 p-2 rounded-lg border">
                          {ord.productName}
                        </div>
                        <div className="text-right font-mono font-bold text-banana-700">
                          {ord.totalVnd?.toLocaleString()} đ
                        </div>
                        <div className="pt-2 border-t flex flex-col gap-1.5">
                          <button
                            onClick={() => quickMoveStatus(
                              ord.orderCode,
                              "PURCHASING_JP",
                              "Đã nhận cọc - Đang mua hàng tại Tokyo",
                              "Nhân viên văn phòng Tokyo đã tiến hành order trực tiếp từ người bán.",
                              "Tokyo, Nhật Bản"
                            )}
                            className="w-full py-1.5 bg-banana-500 hover:bg-banana-600 text-navy-950 font-bold rounded-lg text-[11px] transition-colors flex items-center justify-center space-x-1"
                          >
                            <span>Xác nhận cọc &amp; Mua</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setPackingSlipOrder(ord)}
                              className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold"
                            >
                              In Phiếu
                            </button>
                            <button
                              onClick={() => openUpdateModal(ord)}
                              className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold"
                            >
                              Chi Tiết
                            </button>
                            <button
                              onClick={() => openCancelModal(ord)}
                              title="Hủy đơn"
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px]"
                            >
                              <Ban className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteOrder(ord.orderCode)}
                              title="Xóa đơn rác"
                              className="px-2 py-1 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg text-[10px]"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  {orders.filter((o) => o.status === "PENDING_DEPOSIT").length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      Không có đơn chờ cọc
                    </div>
                  )}
                </div>
              </div>

              {/* CỘT 2: ĐANG MUA TẠI NHẬT */}
              <div className="bg-slate-100/90 rounded-2xl p-4 border border-slate-200 flex flex-col min-h-[400px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                  <div className="flex items-center space-x-1.5 font-bold text-xs text-blue-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    <span>2. Mua Tại Nhật</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold bg-blue-200/80 text-blue-900 px-2 py-0.5 rounded-full">
                    {orders.filter((o) => o.status === "PURCHASING_JP").length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[70vh]">
                  {orders
                    .filter((o) => o.status === "PURCHASING_JP")
                    .map((ord) => (
                      <div key={ord.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all text-xs space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="font-mono font-bold text-navy-900 text-xs">#{ord.orderCode}</span>
                          <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200">
                            Đang Mua
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 line-clamp-1">{ord.customerName}</div>
                        <div className="text-[11px] text-slate-500">📞 {ord.customerPhone}</div>
                        <div className="text-[11px] text-navy-900 line-clamp-2 bg-slate-50 p-2 rounded-lg border">
                          {ord.productName}
                        </div>
                        <div className="text-right font-mono font-bold text-banana-700">
                          {ord.priceJpy?.toLocaleString()} ¥
                        </div>
                        <div className="pt-2 border-t flex flex-col gap-1.5">
                          <button
                            onClick={() => quickMoveStatus(
                              ord.orderCode,
                              "WAREHOUSE_JP",
                              "Đã nhập kho Tokyo",
                              "Kiện hàng đã về kho Nhật, kiểm tra seal nguyên vẹn và cân nặng chuẩn xác.",
                              "Kho Tokyo (Edogawa-ku)"
                            )}
                            className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[11px] transition-colors flex items-center justify-center space-x-1"
                          >
                            <span>Đã Mua $\rightarrow$ Về Kho Tokyo</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setPackingSlipOrder(ord)}
                              className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold"
                            >
                              In Phiếu
                            </button>
                            <button
                              onClick={() => openUpdateModal(ord)}
                              className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold"
                            >
                              Chi Tiết
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  {orders.filter((o) => o.status === "PURCHASING_JP").length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      Không có đơn đang mua
                    </div>
                  )}
                </div>
              </div>

              {/* CỘT 3: KHO TOKYO */}
              <div className="bg-slate-100/90 rounded-2xl p-4 border border-slate-200 flex flex-col min-h-[400px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                  <div className="flex items-center space-x-1.5 font-bold text-xs text-purple-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                    <span>3. Kho Tokyo</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold bg-purple-200/80 text-purple-900 px-2 py-0.5 rounded-full">
                    {orders.filter((o) => o.status === "WAREHOUSE_JP").length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[70vh]">
                  {orders
                    .filter((o) => o.status === "WAREHOUSE_JP")
                    .map((ord) => (
                      <div key={ord.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all text-xs space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="font-mono font-bold text-navy-900 text-xs">#{ord.orderCode}</span>
                          <span className="bg-purple-50 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-200">
                            Tại Kho Nhật
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 line-clamp-1">{ord.customerName}</div>
                        <div className="text-[11px] text-slate-500">Trọng lượng: {ord.weightKg} kg</div>
                        <div className="text-[11px] text-navy-900 line-clamp-2 bg-slate-50 p-2 rounded-lg border">
                          {ord.productName}
                        </div>
                        <div className="pt-2 border-t flex flex-col gap-1.5">
                          <button
                            onClick={() => quickMoveStatus(
                              ord.orderCode,
                              "IN_TRANSIT_AIR",
                              "Đang vận chuyển quốc tế Tokyo ⇄ Việt Nam",
                              "Kiện hàng đã được đóng gói chống sốc và lên lộ trình chuyển về Việt Nam.",
                              "Tokyo, Nhật Bản"
                            )}
                            className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-[11px] transition-colors flex items-center justify-center space-x-1"
                          >
                            <span>Xuất Kho $\rightarrow$ Bay Về VN</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setPackingSlipOrder(ord)}
                              className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold"
                            >
                              In Phiếu
                            </button>
                            <button
                              onClick={() => openUpdateModal(ord)}
                              className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold"
                            >
                              Chi Tiết
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  {orders.filter((o) => o.status === "WAREHOUSE_JP").length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      Kho Tokyo trống
                    </div>
                  )}
                </div>
              </div>

              {/* CỘT 4: VẬN CHUYỂN QUỐC TẾ & KHO VN */}
              <div className="bg-slate-100/90 rounded-2xl p-4 border border-slate-200 flex flex-col min-h-[400px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                  <div className="flex items-center space-x-1.5 font-bold text-xs text-orange-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                    <span>4. Về Kho VN</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold bg-orange-200/80 text-orange-900 px-2 py-0.5 rounded-full">
                    {orders.filter((o) => o.status === "IN_TRANSIT_AIR" || o.status === "WAREHOUSE_VN").length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[70vh]">
                  {orders
                    .filter((o) => o.status === "IN_TRANSIT_AIR" || o.status === "WAREHOUSE_VN")
                    .map((ord) => (
                      <div key={ord.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all text-xs space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="font-mono font-bold text-navy-900 text-xs">#{ord.orderCode}</span>
                          <span className="bg-orange-50 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded border border-orange-200">
                            {ord.status === "IN_TRANSIT_AIR" ? "Đang Vận Chuyển" : "Kho VN"}
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 line-clamp-1">{ord.customerName}</div>
                        <div className="text-[11px] text-slate-500">📍 {ord.customerAddress}</div>
                        <div className="text-[11px] text-navy-900 line-clamp-2 bg-slate-50 p-2 rounded-lg border">
                          {ord.productName}
                        </div>
                        <div className="pt-2 border-t flex flex-col gap-1.5">
                          <button
                            onClick={() => quickMoveStatus(
                              ord.orderCode,
                              "LOCAL_DELIVERY",
                              "Đang giao hàng chặng cuối",
                              "Đã bàn giao cho đơn vị vận chuyển nội địa (GHTK/GHN/ViettelPost) phát tận tay khách.",
                              "Việt Nam"
                            )}
                            className="w-full py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg text-[11px] transition-colors flex items-center justify-center space-x-1"
                          >
                            <span>Bàn Giao Shipper</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setPackingSlipOrder(ord)}
                              className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold"
                            >
                              In Phiếu
                            </button>
                            <button
                              onClick={() => openUpdateModal(ord)}
                              className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold"
                            >
                              Chi Tiết
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  {orders.filter((o) => o.status === "IN_TRANSIT_AIR" || o.status === "WAREHOUSE_VN").length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      Không có đơn đang chuyển
                    </div>
                  )}
                </div>
              </div>

              {/* CỘT 5: GIAO HÀNG & HOÀN TẤT */}
              <div className="bg-slate-100/90 rounded-2xl p-4 border border-slate-200 flex flex-col min-h-[400px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                  <div className="flex items-center space-x-1.5 font-bold text-xs text-emerald-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span>5. Giao Hàng &amp; Xong</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full">
                    {orders.filter((o) => o.status === "LOCAL_DELIVERY" || o.status === "COMPLETED").length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[70vh]">
                  {orders
                    .filter((o) => o.status === "LOCAL_DELIVERY" || o.status === "COMPLETED")
                    .map((ord) => (
                      <div key={ord.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all text-xs space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="font-mono font-bold text-navy-900 text-xs">#{ord.orderCode}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            ord.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}>
                            {ord.status === "COMPLETED" ? "Đã Giao Xong" : "Đang Phát Hàng"}
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 line-clamp-1">{ord.customerName}</div>
                        <div className="text-[11px] text-slate-500">Mã VN: {ord.vnDomesticTrack || "Chưa gán"}</div>
                        <div className="text-[11px] text-navy-900 line-clamp-2 bg-slate-50 p-2 rounded-lg border">
                          {ord.productName}
                        </div>
                        <div className="pt-2 border-t flex flex-col gap-1.5">
                          {ord.status !== "COMPLETED" && (
                            <button
                              onClick={() => quickMoveStatus(
                                ord.orderCode,
                                "COMPLETED",
                                "Giao hàng thành công",
                                "Khách hàng đã nhận đủ hàng và hoàn tất đơn hàng.",
                                "Việt Nam"
                              )}
                              className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] transition-colors flex items-center justify-center space-x-1"
                            >
                              <span>Xác Nhận Đã Nhận</span>
                              <CheckCircle2 className="w-3 h-3" />
                            </button>
                          )}
                          <div className="flex gap-1">
                            <button
                              onClick={() => setPackingSlipOrder(ord)}
                              className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold"
                            >
                              In Phiếu
                            </button>
                            <button
                              onClick={() => openUpdateModal(ord)}
                              className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold"
                            >
                              Chi Tiết
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  {orders.filter((o) => o.status === "LOCAL_DELIVERY" || o.status === "COMPLETED").length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      Chưa có đơn hoàn tất
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* MODAL 1: CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG (7 BƯỚC) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative my-8">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-6 h-6" />
            </button>

            <h3 className="text-lg font-bold text-navy-900 mb-1">
              Cập Nhật Tiến Độ Đơn #{selectedOrder.orderCode}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Khách: <strong>{selectedOrder.customerName}</strong> • {selectedOrder.productName}
            </p>

            <form onSubmit={handleUpdateStatus} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Trạng thái tiếp theo</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-banana-500"
                >
                  <option value="PENDING_DEPOSIT">1. Chờ cọc (Pending Deposit)</option>
                  <option value="PURCHASING_JP">2. Đang mua hàng tại Nhật (Tokyo)</option>
                  <option value="WAREHOUSE_JP">3. Đã nhập kho Tokyo (Cân &amp; Đóng gói)</option>
                  <option value="IN_TRANSIT_AIR">4. Đang vận chuyển quốc tế Tokyo ⇄ VN</option>
                  <option value="WAREHOUSE_VN">5. Đã nhập kho phân phối Việt Nam</option>
                  <option value="LOCAL_DELIVERY">6. Đang giao hàng chặng cuối (GHTK/GHN)</option>
                  <option value="COMPLETED">7. Giao hàng thành công</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tiêu đề thông báo</label>
                <input
                  type="text"
                  value={updateTitle}
                  onChange={(e) => setUpdateTitle(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  placeholder="VD: Đã nhập kho Tokyo"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mô tả chi tiết</label>
                <textarea
                  rows={2}
                  value={updateDesc}
                  onChange={(e) => setUpdateDesc(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  placeholder="VD: Kiện hàng đã được kiểm tra và cân nặng chuẩn xác."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mã vận đơn JP (Sagawa/Yamato)</label>
                  <input
                    type="text"
                    value={jpTrack}
                    onChange={(e) => setJpTrack(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                    placeholder="VD: SGW-88219"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mã vận đơn VN (GHTK/GHN)</label>
                  <input
                    type="text"
                    value={vnTrack}
                    onChange={(e) => setVnTrack(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                    placeholder="VD: GHTK-VN0982"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 bg-banana-500 hover:bg-banana-600 text-navy-950 rounded-xl font-bold disabled:opacity-50"
                >
                  {isUpdating ? "Đang lưu..." : "Xác nhận cập nhật"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: HỦY ĐƠN HÀNG DÀNH CHO ADMIN */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative my-8">
            <button
              onClick={() => setCancelModalOrder(null)}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex items-center space-x-2 text-rose-600 mb-1">
              <Ban className="w-5 h-5" />
              <h3 className="text-lg font-bold text-navy-900">
                Xác Nhận Hủy Đơn Hàng #{cancelModalOrder.orderCode}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Khách hàng: <strong>{cancelModalOrder.customerName}</strong> ({cancelModalOrder.customerPhone}) • {cancelModalOrder.productName}
            </p>

            <form onSubmit={handleCancelOrder} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Lý do hủy đơn hàng <span className="text-rose-500">*</span>
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-rose-500"
                >
                  <option value="Sản phẩm hết hàng tại Nhật / Người bán hủy bán">
                    1. Sản phẩm hết hàng tại Nhật / Người bán hủy bán
                  </option>
                  <option value="Người bán có dấu hiệu lừa đảo / Đánh giá quá thấp">
                    2. Người bán có dấu hiệu lừa đảo / Đánh giá quá thấp
                  </option>
                  <option value="Hàng thuộc danh mục cấm bay quốc tế (Pin, Bình xịt khí nén, Chất lỏng cấm)">
                    3. Hàng thuộc danh mục cấm bay quốc tế (Pin, Khí nén...)
                  </option>
                  <option value="Khách hàng yêu cầu hủy đơn hàng">
                    4. Khách hàng yêu cầu hủy đơn hàng
                  </option>
                  <option value="Khác">5. Lý do khác (Nhập chi tiết bên dưới)</option>
                </select>
              </div>

              {cancelReason === "Khác" && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Chi tiết lý do hủy
                  </label>
                  <textarea
                    rows={2}
                    value={cancelCustomReason}
                    onChange={(e) => setCancelCustomReason(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500"
                    placeholder="Nhập lý do chi tiết để thông báo đến khách hàng..."
                    required
                  />
                </div>
              )}

              {cancelModalOrder.paymentStatus !== "UNPAID" && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
                  <div className="font-bold text-amber-800 flex items-center space-x-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Đơn hàng đã có tiền cọc ({cancelModalOrder.depositAmountVnd.toLocaleString("vi-VN")} đ)</span>
                  </div>
                  <label className="flex items-center space-x-2 text-slate-700 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={refundDeposit}
                      onChange={(e) => setRefundDeposit(e.target.checked)}
                      className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                    />
                    <span className="font-semibold text-xs">
                      Xác nhận đã hoàn trả tiền cọc cho khách hàng (Chuyển trạng thái thanh toán về Chưa cọc)
                    </span>
                  </label>
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">
                Lưu ý: Sau khi hủy, đơn hàng sẽ chuyển sang trạng thái <strong>CANCELLED</strong> và được ghi nhật ký hành trình để khách hàng tra cứu minh bạch.
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setCancelModalOrder(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isCancelling}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>{isCancelling ? "Đang xử lý..." : "Xác Nhận Hủy Đơn"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: XEM CHI TIẾT ĐỐI THOẠI AI CỦA KHÁCH HÀNG */}
      {selectedAiSession && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 relative my-8 flex flex-col max-h-[85vh]">
            <button
              onClick={() => setSelectedAiSession(null)}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="border-b pb-3 mb-3">
              <span className="text-[10px] font-bold text-banana-900 bg-banana-100 px-2.5 py-0.5 rounded-full border border-banana-200">
                Phiên: {selectedAiSession.sessionId}
              </span>
              <h3 className="text-base font-bold text-navy-900 mt-1">
                Lịch Sử Trò Chuyện Khách Hàng ⇄ Gemini AI Agent
              </h3>
              <p className="text-xs text-slate-500">
                Chủ đề nhận diện: <strong>{selectedAiSession.topic}</strong> • Từ khóa: {selectedAiSession.detectedKeywords || "Chưa có"}
              </p>
            </div>

            {/* Messages Transcript */}
            <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-slate-50 rounded-2xl border text-xs">
              {selectedAiSession.messages?.map((msg: any, idx: number) => (
                <div
                  key={msg.id || idx}
                  className={`flex items-start gap-2 ${
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      msg.role === "user" ? "bg-navy-900 text-white" : "bg-banana-500 text-navy-950 font-extrabold"
                    }`}
                  >
                    {msg.role === "user" ? "Khách" : "🍌"}
                  </div>

                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${
                      msg.role === "user"
                        ? "bg-navy-900 text-white rounded-tr-none"
                        : "bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 flex justify-end">
              <button
                onClick={() => setSelectedAiSession(null)}
                className="px-5 py-2 bg-navy-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: THÊM / SỬA SẢN PHẨM TRANG CHỦ */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative my-8">
            <button
              onClick={() => setIsProductModalOpen(false)}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="mb-6">
              <span className="text-[10px] font-bold text-banana-900 bg-banana-100 px-3 py-1 rounded-full border border-banana-200">
                {editingProduct ? "Cập Nhật Sản Phẩm" : "Thêm Mới Sản Phẩm"}
              </span>
              <h3 className="text-xl font-serif font-bold text-navy-900 mt-2">
                {editingProduct ? `Chỉnh sửa: ${editingProduct.name}` : "Thêm Sản Phẩm Gom Mua Vào Trang Chủ"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Sản phẩm sau khi lưu sẽ xuất hiện trực tiếp trong mục gợi ý săn deal trên trang chủ ChillBanana.
              </p>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              
              {/* Tên sản phẩm */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tên sản phẩm <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nồi Cơm Điện Cao Tần Zojirushi IH 1L"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500"
                />
              </div>

              {/* Danh mục & Nguồn Store */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Danh mục</label>
                  <select
                    value={productForm.category}
                    onChange={(e) => {
                      const cat = e.target.value;
                      let voltageNote = productForm.voltageNote;
                      if (cat === "gadgets" && !voltageNote) {
                        voltageNote = "Điện áp 100V - Cần dùng biến áp đổi nguồn";
                      }
                      setProductForm({ ...productForm, category: cat, voltageNote });
                    }}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500 bg-white"
                  >
                    <option value="cosmetics">🌸 Mỹ Phẩm & Chăm Sóc Da</option>
                    <option value="health">🌿 Thực Phẩm Chức Năng</option>
                    <option value="gadgets">⚡ Gia Dụng & Điện Tử Mini (100V)</option>
                    <option value="anime">🎎 Anime, Manga & Sưu Tầm</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nguồn website mua hộ</label>
                  <input
                    type="text"
                    placeholder="Amazon JP, Rakuten, Mercari..."
                    value={productForm.originalStore}
                    onChange={(e) => setProductForm({ ...productForm, originalStore: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500"
                  />
                </div>
              </div>

              {/* Giá Yên & Cân Nặng & Slot */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Giá gốc (JPY ¥) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={productForm.priceJpy}
                    onChange={(e) => setProductForm({ ...productForm, priceJpy: Number(e.target.value) })}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500 font-mono font-bold"
                  />
                  <span className="text-[11px] text-banana-700 font-semibold mt-1 block">
                    ≈ {Math.round(productForm.priceJpy * 172).toLocaleString("vi-VN")} đ
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Trọng lượng (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0.1}
                    value={productForm.weightKg}
                    onChange={(e) => setProductForm({ ...productForm, weightKg: Number(e.target.value) })}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số slot gom</label>
                  <input
                    type="number"
                    min={1}
                    value={productForm.stockSlots}
                    onChange={(e) => setProductForm({ ...productForm, stockSlots: Number(e.target.value) })}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500 font-mono"
                  />
                </div>
              </div>

              {/* URL Hình ảnh */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Đường dẫn hình ảnh (URL)</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={productForm.imageUrl}
                    onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                    className="flex-1 p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500"
                  />
                  {productForm.imageUrl && (
                    <img
                      src={productForm.imageUrl}
                      alt="Preview"
                      className="w-11 h-11 object-cover rounded-xl border shrink-0"
                    />
                  )}
                </div>
              </div>

              {/* Ghi chú điện áp & Nổi bật */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Cảnh báo điện áp (nếu có)
                  </label>
                  <input
                    type="text"
                    placeholder="Điện áp 100V - Cần dùng biến áp đổi nguồn"
                    value={productForm.voltageNote}
                    onChange={(e) => setProductForm({ ...productForm, voltageNote: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ghi chú nổi bật / Tag</label>
                  <input
                    type="text"
                    placeholder="Top 1 Cosme Nhật Bản, Săn sale 30%..."
                    value={productForm.featuredNote}
                    onChange={(e) => setProductForm({ ...productForm, featuredNote: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500"
                  />
                </div>
              </div>

              {/* Hot Deal Checkbox */}
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="isHot"
                  checked={productForm.isHot}
                  onChange={(e) => setProductForm({ ...productForm, isHot: e.target.checked })}
                  className="w-4 h-4 text-banana-600 rounded border-slate-300 focus:ring-banana-500"
                />
                <label htmlFor="isHot" className="font-bold text-navy-900 cursor-pointer">
                  Gắn nhãn 🔥 HOT DEAL trên trang chủ
                </label>
              </div>

              {/* Mô tả */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Mô tả ngắn</label>
                <textarea
                  rows={2}
                  placeholder="Mô tả công dụng, tính năng hoặc lưu ý khi đặt hàng..."
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-banana-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="px-6 py-2.5 bg-banana-500 hover:bg-banana-600 text-navy-950 rounded-xl font-bold transition-all shadow-md disabled:opacity-50 flex items-center space-x-2"
                >
                  {isSavingProduct ? (
                    <span>Đang lưu sản phẩm...</span>
                  ) : (
                    <span>{editingProduct ? "Lưu Thay Đổi" : "Tạo Sản Phẩm"}</span>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: PHIẾU GIAO HÀNG & ĐÓNG GÓI (PACKING SLIP PRINT) */}
      {packingSlipOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-300 relative my-8 text-slate-900 font-sans">
            <button
              onClick={() => setPackingSlipOrder(null)}
              className="absolute right-5 top-5 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 print:hidden"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Slip Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-4 flex justify-between items-start">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">🍌</span>
                  <span className="font-serif font-extrabold text-xl tracking-tight text-navy-950">
                    Chill<span className="text-banana-600">Banana</span>
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-0.5">
                  Phiếu Giao Hàng &amp; Vận Đơn Ủy Thác Nhật - Việt
                </div>
              </div>

              <div className="text-right">
                <div className="font-mono text-base font-black bg-slate-100 px-3 py-1 rounded-lg border border-slate-300">
                  #{packingSlipOrder.orderCode}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-1">
                  Ngày tạo: {new Date(packingSlipOrder.createdAt).toLocaleDateString("vi-VN")}
                </div>
              </div>
            </div>

            {/* Sender & Receiver Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="font-bold text-[10px] uppercase text-slate-400 block mb-1">Người gửi / Đơn vị mua hộ:</span>
                <p className="font-bold text-navy-950">Kho ChillBanana Express</p>
                <p className="text-slate-600 text-[11px]">Tokyo Hub ⇄ Hà Nội / TP.HCM</p>
                <p className="text-slate-600 text-[11px]">Hotline: 1900 8888</p>
              </div>

              <div>
                <span className="font-bold text-[10px] uppercase text-slate-400 block mb-1">Người nhận:</span>
                <p className="font-bold text-navy-950">{packingSlipOrder.customerName}</p>
                <p className="font-mono text-slate-800 text-[11px]">📞 {packingSlipOrder.customerPhone}</p>
                <p className="text-slate-600 text-[11px] leading-tight mt-0.5">{packingSlipOrder.customerAddress}</p>
              </div>
            </div>

            {/* Product Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden mb-4 text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Sản Phẩm</th>
                    <th className="p-2.5 text-center">Trọng Lượng</th>
                    <th className="p-2.5 text-right">Tổng Tiền</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2.5 font-medium max-w-[200px]">
                      <div className="font-bold text-navy-950 line-clamp-2">{packingSlipOrder.productName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Giá gốc: {packingSlipOrder.priceJpy?.toLocaleString()} ¥</div>
                    </td>
                    <td className="p-2.5 text-center font-mono">{packingSlipOrder.weightKg} kg</td>
                    <td className="p-2.5 text-right font-mono font-bold text-navy-950">
                      {packingSlipOrder.totalVnd?.toLocaleString()} đ
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Payment Summary */}
            <div className="space-y-1.5 text-xs border-t pt-3 mb-4 font-medium">
              <div className="flex justify-between text-slate-600">
                <span>Số tiền đã đặt cọc:</span>
                <span className="font-mono font-bold text-emerald-700">
                  - {packingSlipOrder.depositAmountVnd?.toLocaleString()} đ ({packingSlipOrder.paymentStatus === "PAID_100" ? "Đã trả 100%" : "Đã cọc 50%"})
                </span>
              </div>
              <div className="flex justify-between text-navy-950 font-bold text-sm pt-1 border-t">
                <span>Thu hộ khi giao hàng (COD):</span>
                <span className="font-mono text-banana-700">
                  {(packingSlipOrder.totalVnd - packingSlipOrder.depositAmountVnd).toLocaleString()} đ
                </span>
              </div>
            </div>

            {/* Tracking Identifiers */}
            <div className="p-3 bg-slate-100 rounded-xl font-mono text-[11px] text-slate-700 space-y-1 mb-4">
              <div>🇯🇵 Mã vận đơn Nhật: <strong className="text-navy-900">{packingSlipOrder.jpDomesticTrack || "YAMATO-PENDING"}</strong></div>
              <div>🇻🇳 Mã bưu cục Việt Nam: <strong className="text-navy-900">{packingSlipOrder.vnDomesticTrack || "GHTK-PENDING"}</strong></div>
            </div>

            {/* Signature Box */}
            <div className="grid grid-cols-2 gap-4 text-center text-xs pt-2 border-t text-slate-600 mb-4">
              <div>
                <p className="font-bold text-[11px]">Người lập phiếu</p>
                <div className="h-10"></div>
                <p className="text-[10px] text-slate-400">(Ký &amp; ghi rõ họ tên)</p>
              </div>
              <div>
                <p className="font-bold text-[11px]">Người nhận hàng</p>
                <div className="h-10"></div>
                <p className="text-[10px] text-slate-400">(Xác nhận hàng nguyên vẹn)</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-2 border-t print:hidden">
              <button
                onClick={() => setPackingSlipOrder(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
              >
                Đóng
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 bg-navy-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow flex items-center space-x-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In Phiếu Gửi Hàng</span>
              </button>
            </div>

          </div>
        </div>
      )}

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
