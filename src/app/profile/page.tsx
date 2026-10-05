"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { User, Package, MessageSquare, Clock, ArrowRight, ShieldCheck, MapPin, Phone, Mail, FileText } from "lucide-react";
import Link from "next/link";
import LayoutWrapper from "@/components/LayoutWrapper";

export default function ProfilePage() {
  const { customer, loading: authLoading, openAuthModal } = useAuth();
  const router = useRouter();
  
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !customer) {
      router.push("/");
      openAuthModal("login");
    }
  }, [authLoading, customer, router, openAuthModal]);

  useEffect(() => {
    if (customer) {
      fetch("/api/customer/profile")
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setProfileData(data.profile);
          }
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [customer]);

  if (authLoading || (!customer && loading)) {
    return (
      <LayoutWrapper>
        <div className="min-h-[70vh] flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-banana-400 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-500 font-medium">Đang tải hồ sơ...</p>
          </div>
        </div>
      </LayoutWrapper>
    );
  }

  if (!customer) return null; // Wait for redirect

  return (
    <LayoutWrapper>
      <div className="bg-slate-50 min-h-screen pb-20 pt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-serif font-bold text-navy-900 flex items-center gap-3">
              <span className="bg-banana-100 text-banana-600 p-2 rounded-xl text-2xl">👤</span>
              Hồ Sơ Của Tôi
            </h1>
            <p className="text-slate-500 mt-2">Quản lý thông tin cá nhân và theo dõi đơn hàng của bạn.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Profile Info */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-banana-400 to-amber-500" />
                
                <div className="flex flex-col items-center text-center mt-4 mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-600 rounded-full flex items-center justify-center text-3xl font-bold shadow-inner mb-4">
                    {profileData?.name?.charAt(0) || customer.name.charAt(0)}
                  </div>
                  <h2 className="text-xl font-bold text-navy-900">{profileData?.name || customer.name}</h2>
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full mt-2 border border-emerald-100">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Thành viên ChillBanana
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl">
                    <Mail className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Email liên hệ</div>
                      <div className="text-sm font-medium text-navy-900">{profileData?.email || customer.email}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl">
                    <Phone className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Số điện thoại</div>
                      <div className="text-sm font-medium text-navy-900">{profileData?.phone || customer.phone || "Chưa cập nhật"}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl">
                    <MapPin className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Địa chỉ giao hàng mặc định</div>
                      <div className="text-sm font-medium text-navy-900 leading-relaxed">{profileData?.address || customer.address || "Chưa cập nhật"}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Card */}
              {profileData && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                    <Package className="w-6 h-6 text-banana-500 mb-2" />
                    <div className="text-2xl font-bold text-navy-900 font-mono">{profileData.orders?.length || 0}</div>
                    <div className="text-xs text-slate-500 font-medium">Đơn hàng</div>
                  </div>
                  <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                    <MessageSquare className="w-6 h-6 text-blue-500 mb-2" />
                    <div className="text-2xl font-bold text-navy-900 font-mono">{profileData.chatSessions?.length || 0}</div>
                    <div className="text-xs text-slate-500 font-medium">Phiên tư vấn</div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Orders & History */}
            <div className="lg:col-span-2 space-y-6">
              {/* Orders Section */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="font-bold text-navy-900 flex items-center gap-2 text-lg">
                    <Package className="w-5 h-5 text-banana-500" />
                    Đơn Hàng Của Tôi
                  </h3>
                  <Link href="/tracking" className="text-xs font-bold text-banana-600 hover:text-banana-700 flex items-center gap-1 transition-colors">
                    Tra cứu mã đơn khác <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                
                <div className="p-5">
                  {loading ? (
                    <div className="py-8 text-center text-slate-400 text-sm">Đang tải danh sách đơn hàng...</div>
                  ) : profileData?.orders?.length > 0 ? (
                    <div className="space-y-4">
                      {profileData.orders.map((order: any) => (
                        <div key={order.id} className="border border-slate-200 rounded-2xl p-4 hover:border-banana-300 transition-colors group">
                          <div className="flex flex-col sm:flex-row justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">#{order.orderCode}</span>
                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(order.createdAt).toLocaleDateString("vi-VN")}
                                </span>
                              </div>
                              <h4 className="font-bold text-navy-900 line-clamp-1">{order.productName}</h4>
                              <div className="mt-3 flex items-center gap-4 text-xs font-medium">
                                <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                  <span className="text-slate-500 mr-1">Tổng cộng:</span>
                                  <span className="text-banana-700 font-bold">{order.totalVnd.toLocaleString("vi-VN")} đ</span>
                                </div>
                                <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-1.5">
                                  <div className={`w-2 h-2 rounded-full ${
                                    order.paymentStatus === 'UNPAID' ? 'bg-amber-400' : 'bg-emerald-500'
                                  }`} />
                                  <span className={order.paymentStatus === 'UNPAID' ? 'text-amber-700' : 'text-emerald-700'}>
                                    {order.paymentStatus === 'UNPAID' ? 'Chờ cọc (50%)' : 'Đã cọc'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-start sm:items-end justify-center shrink-0 border-t sm:border-t-0 sm:border-l border-slate-100 pt-4 sm:pt-0 sm:pl-4">
                              <div className="mb-2 w-full text-left sm:text-right">
                                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Trạng thái</div>
                                <div className="text-sm font-bold text-navy-900">
                                  {order.status === "PENDING_DEPOSIT" && "⏳ Chờ đặt cọc"}
                                  {order.status === "DEPOSITED_50" && "💸 Đã cọc - Chờ mua"}
                                  {order.status === "PURCHASING_JP" && "🛒 Đang mua tại Nhật"}
                                  {order.status === "SHIPPED_TO_VN" && "✈️ Đang bay về VN"}
                                  {order.status === "ARRIVED_VN" && "🛬 Đã tới kho VN"}
                                  {order.status === "DELIVERING_LOCAL" && "🚚 Đang giao hàng"}
                                  {order.status === "COMPLETED" && "✅ Đã hoàn thành"}
                                  {order.status === "CANCELLED" && "❌ Đã hủy"}
                                </div>
                              </div>
                              <Link 
                                href={`/tracking?code=${order.orderCode}`}
                                className="w-full text-center px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                              >
                                Xem Chi Tiết
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm text-2xl">📦</div>
                      <p className="text-slate-500 font-medium mb-1">Bạn chưa có đơn hàng nào.</p>
                      <p className="text-xs text-slate-400 mb-4">Các đơn hàng của bạn sẽ hiển thị tại đây.</p>
                      <Link href="/" className="inline-block px-4 py-2 bg-banana-400 text-navy-900 font-bold text-xs rounded-xl hover:bg-banana-500 transition-colors">
                        Bắt Đầu Mua Sắm
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Chat History Section */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-navy-900 flex items-center gap-2 text-lg">
                    <MessageSquare className="w-5 h-5 text-blue-500" />
                    Lịch Sử Tư Vấn AI
                  </h3>
                </div>
                <div className="p-5">
                  {loading ? (
                    <div className="py-8 text-center text-slate-400 text-sm">Đang tải lịch sử...</div>
                  ) : profileData?.chatSessions?.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {profileData.chatSessions.map((session: any) => (
                        <div key={session.id} className="p-4 border border-slate-200 rounded-2xl bg-slate-50 flex flex-col h-full">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-xs text-slate-500 font-medium">{new Date(session.updatedAt).toLocaleDateString("vi-VN")}</span>
                          </div>
                          <h4 className="font-bold text-sm text-navy-900 mb-2 flex-grow line-clamp-2">
                            {session.topic || "Tư vấn sản phẩm Nhật Bản"}
                          </h4>
                          {session.sentiment && (
                            <div className="mt-auto pt-3 border-t border-slate-200 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đánh giá AI</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-white border rounded-full">
                                {session.sentiment}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-slate-500 text-sm">Chưa có lịch sử tư vấn nào được lưu.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </LayoutWrapper>
  );
}
