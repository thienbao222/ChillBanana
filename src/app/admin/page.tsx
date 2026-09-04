"use client";

import React, { useState, useEffect } from "react";
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
  Plane, 
  ExternalLink,
  Users,
  Building2,
  Mail,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Plus
} from "lucide-react";
import { StoredOrder } from "@/lib/order-store";
import { OrderStatus } from "@/types";

export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (res.ok && data.orders) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const openUpdateModal = (order: StoredOrder) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setJpTrack(order.jpDomesticTrack || "");
    setVnTrack(order.vnDomesticTrack || "");

    // Gợi ý thông tin theo trạng thái tiếp theo
    if (order.status === "PENDING_DEPOSIT") {
      setNewStatus("PURCHASING_JP");
      setUpdateTitle("Đã nhận cọc - Đang mua hàng tại Tokyo");
      setUpdateDesc("Nhân viên văn phòng Tokyo đã tiến hành order hàng trực tiếp.");
      setUpdateLocation("Tokyo, Nhật Bản");
    } else if (order.status === "PURCHASING_JP") {
      setNewStatus("WAREHOUSE_JP");
      setUpdateTitle("Đã nhập kho Tokyo (Edogawa-ku)");
      setUpdateDesc("Kiện hàng đã về kho Nhật, kiểm tra seal nguyên vẹn và cân nặng chuẩn xác.");
      setUpdateLocation("Kho Tokyo (Edogawa-ku)");
    } else if (order.status === "WAREHOUSE_JP") {
      setNewStatus("IN_TRANSIT_AIR");
      setUpdateTitle("Đang bay quốc tế Tokyo ✈ Việt Nam");
      setUpdateDesc("Kiện hàng đã lên chuyến bay chuyên tuyến Narita về sân bay Việt Nam.");
      setUpdateLocation("Sân bay Quốc tế Narita (NRT)");
    } else if (order.status === "IN_TRANSIT_AIR") {
      setNewStatus("WAREHOUSE_VN");
      setUpdateTitle("Đã nhập kho phân loại tại Việt Nam");
      setUpdateDesc("Hàng hoàn tất thông quan hải quan và chuyển về kho phân phối.");
      setUpdateLocation("Kho ChillBanana Hà Nội / TP.HCM");
    } else if (order.status === "WAREHOUSE_VN") {
      setNewStatus("LOCAL_DELIVERY");
      setUpdateTitle("Đang giao hàng chặng cuối");
      setUpdateDesc("Đã bàn giao cho đơn vị vận chuyển nội địa (GHTK/GHN) phát tận tay khách.");
      setUpdateLocation("Việt Nam");
    } else if (order.status === "LOCAL_DELIVERY") {
      setNewStatus("COMPLETED");
      setUpdateTitle("Giao hàng thành công");
      setUpdateDesc("Khách hàng đã nhận đủ hàng và hoàn tất đơn.");
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
        alert(`Đã cập nhật trạng thái đơn #${selectedOrder.orderCode} thành công! Email thông báo tự động đã được gửi tới khách hàng.`);
        setSelectedOrder(null);
        fetchOrders();
      } else {
        alert("Lỗi cập nhật: " + (data.error || "Vui lòng thử lại"));
      }
    } catch (err) {
      alert("Lỗi kết nối máy chủ");
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredOrders = orders.filter((ord) => {
    const matchesStatus = filterStatus === "ALL" || ord.status === filterStatus;
    const matchesSearch =
      ord.orderCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ord.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ord.customerPhone.includes(searchTerm) ||
      ord.productName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Thống kê nhanh
  const totalRevenue = orders.reduce((acc, curr) => acc + curr.totalVnd, 0);
  const inTransitCount = orders.filter((o) => o.status === "IN_TRANSIT_AIR" || o.status === "WAREHOUSE_JP").length;

  return (
    <div className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-banana-800 bg-banana-100 px-3 py-1 rounded-full uppercase tracking-wider mb-1 border border-banana-200">
            <LayoutDashboard className="w-3.5 h-3.5 text-banana-600" />
            <span>ChillBanana Admin Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-navy-900">
            Quản Lý Đơn Hàng Mua Hộ &amp; Vận Tải Đa Chặng
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchOrders}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Làm mới dữ liệu</span>
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-navy-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow"
          >
            Về Trang Chủ
          </Link>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-slate-400">Tổng Đơn Tiếp Nhận</span>
          <p className="text-2xl font-bold font-serif text-navy-900">{orders.length} đơn</p>
          <p className="text-[11px] text-slate-500">Đơn hàng mua hộ JP ⇄ VN</p>
        </div>
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-slate-400">Đang Bay / Tại Kho Nhật</span>
          <p className="text-2xl font-bold font-serif text-blue-600">{inTransitCount} kiện</p>
          <p className="text-[11px] text-slate-500">Đang chuẩn bị chuyến bay tuần</p>
        </div>
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-slate-400">Tổng Giá Trị Đơn Hàng</span>
          <p className="text-2xl font-bold font-serif text-banana-600">{totalRevenue.toLocaleString("vi-VN")} đ</p>
          <p className="text-[11px] text-slate-500">Bao gồm tiền hàng & cước bay</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo mã đơn, tên khách, số ĐT..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-banana-500"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto no-scrollbar">
          <span className="text-xs text-slate-500 font-medium shrink-0 flex items-center">
            <Filter className="w-3 h-3 mr-1" /> Trạng thái:
          </span>
          {["ALL", "PENDING_DEPOSIT", "PURCHASING_JP", "WAREHOUSE_JP", "IN_TRANSIT_AIR", "WAREHOUSE_VN", "LOCAL_DELIVERY", "COMPLETED"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                filterStatus === st
                  ? "bg-navy-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {st === "ALL" ? "Tất Cả" : st}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b">
              <tr>
                <th className="py-3.5 px-4">Mã Đơn Hàng</th>
                <th className="py-3.5 px-4">Khách Hàng</th>
                <th className="py-3.5 px-4">Sản Phẩm</th>
                <th className="py-3.5 px-4">Tổng Tiền / Cọc</th>
                <th className="py-3.5 px-4">Trạng Thái 7 Bước</th>
                <th className="py-3.5 px-4">Vận Đơn JP/VN</th>
                <th className="py-3.5 px-4 text-right">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Không tìm thấy đơn hàng nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-navy-900">{ord.orderCode}</div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(ord.createdAt).toLocaleDateString("vi-VN")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{ord.customerName}</div>
                      <div className="text-[11px] text-slate-400">{ord.customerPhone}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-medium text-slate-800 line-clamp-1">{ord.productName}</div>
                      <div className="text-[10px] text-slate-400">
                        {ord.priceJpy.toLocaleString()} ¥ • {ord.weightKg} kg {ord.isGroupBuy && "• [Gộp đơn]"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-banana-700">{ord.totalVnd.toLocaleString("vi-VN")} đ</div>
                      <div className="text-[10px] text-emerald-700 font-medium">
                        Cọc: {ord.depositAmountVnd.toLocaleString("vi-VN")} đ
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border">
                        {ord.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[11px]">
                      {ord.jpDomesticTrack && <div>🇯🇵 {ord.jpDomesticTrack}</div>}
                      {ord.vnDomesticTrack && <div className="text-emerald-700 font-medium">🇻🇳 {ord.vnDomesticTrack}</div>}
                      {!ord.jpDomesticTrack && !ord.vnDomesticTrack && <span className="text-slate-300">Chưa có</span>}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          href={`/tracking?code=${ord.orderCode}`}
                          target="_blank"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Xem trên trang tracking"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => openUpdateModal(ord)}
                          className="px-3 py-1.5 bg-banana-500 hover:bg-banana-600 text-navy-950 rounded-lg font-bold flex items-center space-x-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Cập nhật</span>
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

      {/* Modal Cập Nhật Trạng Thái Đơn Hàng */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border relative my-8">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-slate-700 text-lg font-bold"
            >
              ✕
            </button>

            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div className="border-b pb-3">
                <span className="text-xs font-bold text-banana-700 uppercase tracking-wider">
                  Cập Nhật Tiến Độ Vận Tải
                </span>
                <h3 className="text-xl font-bold font-serif text-navy-900">
                  Đơn Hàng #{selectedOrder.orderCode}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Khách: <strong>{selectedOrder.customerName}</strong> ({selectedOrder.customerEmail})
                </p>
              </div>

              <div className="space-y-3 text-xs">
                {/* Chọn trạng thái mới */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Trạng Thái 7 Bước Kế Tiếp *
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
                    className="w-full px-3 py-2 border rounded-xl font-semibold bg-slate-50"
                  >
                    <option value="PENDING_DEPOSIT">1. PENDING_DEPOSIT - Chờ thanh toán cọc</option>
                    <option value="PURCHASING_JP">2. PURCHASING_JP - Đã cọc / Đang mua tại Tokyo</option>
                    <option value="WAREHOUSE_JP">3. WAREHOUSE_JP - Đã nhập kho Edogawa Tokyo</option>
                    <option value="IN_TRANSIT_AIR">4. IN_TRANSIT_AIR - Đang bay quốc tế Narita ✈ VN</option>
                    <option value="WAREHOUSE_VN">5. WAREHOUSE_VN - Đã thông quan & Nhập kho VN</option>
                    <option value="LOCAL_DELIVERY">6. LOCAL_DELIVERY - Đang giao hàng nội địa</option>
                    <option value="COMPLETED">7. COMPLETED - Hoàn tất giao hàng thành công</option>
                  </select>
                </div>

                {/* Tiêu đề log */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tiêu Đề Thông Báo Cho Khách *
                  </label>
                  <input
                    type="text"
                    required
                    value={updateTitle}
                    onChange={(e) => setUpdateTitle(e.target.value)}
                    placeholder="VD: Kiện hàng đã về đến sân bay Nội Bài"
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>

                {/* Mô tả chi tiết log */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nội Dung Chi Tiết (Sẽ hiển thị trên Timeline & Email) *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={updateDesc}
                    onChange={(e) => setUpdateDesc(e.target.value)}
                    placeholder="VD: Hàng đã thông quan hoàn tất, đang trên đường chuyển về kho phân phối..."
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>

                {/* Vị trí */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Vị Trí Hiện Tại Của Kiện Hàng *
                  </label>
                  <input
                    type="text"
                    required
                    value={updateLocation}
                    onChange={(e) => setUpdateLocation(e.target.value)}
                    placeholder="VD: Kho Tokyo / Sân bay Narita / Hà Nội"
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>

                {/* Mã vận đơn JP & VN */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Mã Vận Đơn Nhật (Yamato/Sagawa)
                    </label>
                    <input
                      type="text"
                      value={jpTrack}
                      onChange={(e) => setJpTrack(e.target.value)}
                      placeholder="VD: YAMATO-8812"
                      className="w-full px-3 py-2 border rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Mã Vận Đơn VN (GHTK/GHN)
                    </label>
                    <input
                      type="text"
                      value={vnTrack}
                      onChange={(e) => setVnTrack(e.target.value)}
                      placeholder="VD: GHTK-HN-2026"
                      className="w-full px-3 py-2 border rounded-xl"
                    />
                  </div>
                </div>

                <div className="p-3 bg-banana-50 rounded-xl border border-banana-200 text-slate-700 flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-banana-700 shrink-0" />
                  <span className="text-[11px]">
                    Hệ thống sẽ <strong>tự động gửi email thông báo</strong> tiến độ tới hộp thư của khách hàng.
                  </span>
                </div>
              </div>

              <div className="pt-3 flex space-x-3">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 py-3 bg-navy-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow transition-all"
                >
                  {isUpdating ? "Đang cập nhật..." : "Lưu Thay Đổi & Gửi Email"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
