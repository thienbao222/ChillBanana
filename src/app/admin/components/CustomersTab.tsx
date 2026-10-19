"use client";

import React, { useState, useEffect } from "react";
import {
  RefreshCw,
  Users,
  MessageSquare,
  Search,
  Eye
} from "lucide-react";
import { useAdminToast } from "@/context/AdminToastContext";

interface CustomersTabProps {
  onViewOrders: (emailOrName: string) => void;
  onViewAiTrends: () => void;
}

export default function CustomersTab({ onViewOrders, onViewAiTrends }: CustomersTabProps) {
  const { adminToast } = useAdminToast();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerStats, setCustomerStats] = useState<any>(null);
  const [customerTypeFilter, setCustomerTypeFilter] = useState<"ALL" | "REGISTERED" | "GUEST_ORDER" | "CHAT_LEAD">("ALL");

  const fetchCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const res = await fetch("/api/admin/customers");
      const data = await res.json();
      if (res.ok && data.success) {
        setCustomers(data.customers || []);
        setCustomerStats(data.stats || null);
      } else {
        adminToast.error("Lỗi tải danh sách khách hàng");
      }
    } catch {
      adminToast.error("Lỗi kết nối máy chủ");
    } finally {
      setLoadingCustomers(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredCustomers = customers.filter((c: any) => {
    const matchType = customerTypeFilter === "ALL" || c.customerType === customerTypeFilter;
    const term = customerSearch.toLowerCase();
    const matchSearch =
      !term ||
      c.name?.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term) ||
      c.phone?.includes(term);
    return matchType && matchSearch;
  });

  return (
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
                    adminToast.success(data.message || "Đã đồng bộ dữ liệu khách hàng thành công!");
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
                <div className="text-[10px] font-bold text-banana-700 uppercase tracking-wider mb-1">💰 Doanh Thu Đã Thu</div>
                <div className="text-lg font-bold text-banana-600 font-mono">
                  {((customerStats?.totalRevenueVnd ?? customers.reduce((acc, c) => acc + (c.totalSpentVnd || 0), 0)) / 1_000_000).toFixed(1)}M
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">VNĐ từ đơn đã thanh toán</div>
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
                      <th className="p-4">Đã Thanh Toán</th>
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

                            {/* Cột 6: Tổng tiền đã thanh toán */}
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
                                      onViewOrders(c.email || c.name);
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
                                    onClick={() => onViewAiTrends()}
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
  );
}
