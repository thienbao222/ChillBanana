"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useRouter } from "next/navigation";
import {
  Package,
  MessageSquare,
  Clock,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Phone,
  Mail,
  LogOut,
  ArrowLeft
} from "lucide-react";
import Link from "next/link";
import "@/styles/NeoDaylightCosmos.css";

export default function ProfilePage() {
  const { customer, loading: authLoading, openAuthModal, logout } = useAuth();
  const { toast } = useToast();
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
          } else {
            toast.error("Không thể tải hồ sơ. Vui lòng thử lại.");
          }
          setLoading(false);
        })
        .catch(() => {
          toast.error("Lỗi kết nối máy chủ. Vui lòng thử lại sau.");
          setLoading(false);
        });
    }
  }, [customer]);


  if (authLoading || (!customer && loading)) {
    return (
      <>
        <div className="min-h-[70vh] flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-banana-400 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-500 font-medium">Đang tải hồ sơ...</p>
          </div>
        </div>
      </>
    );
  }

  if (!customer) return null; // Wait for redirect

  return (
    <>
      <div className="min-h-screen pb-20 pt-8 transition-colors duration-200" style={{ background: "var(--bg, #f8fafc)", color: "var(--ink, #0f172a)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Header */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold transition hover:opacity-80" style={{ color: "var(--banana-600, #ca8a04)" }}>
                  <ArrowLeft className="w-3.5 h-3.5" /> Về Trang Chủ NeoDay
                </Link>
              </div>
              <h1 className="text-3xl font-serif font-bold flex items-center gap-3" style={{ color: "var(--ink, #0f172a)" }}>
                <span className="p-2 rounded-xl text-2xl" style={{ background: "var(--banana-soft, #fef9c3)" }}>👤</span>
                Hồ Sơ Của Tôi
              </h1>
              <p className="mt-2 text-sm" style={{ color: "var(--muted, #64748b)" }}>
                Quản lý thông tin cá nhân và theo dõi đơn hàng của bạn.
              </p>
            </div>

            <button
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-rose-200 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition self-start sm:self-auto"
            >
              <LogOut className="w-4 h-4" />
              Đăng Xuất
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Profile Info */}
            <div className="lg:col-span-1 space-y-6">
              <div
                className="rounded-3xl p-6 border shadow-sm relative overflow-hidden"
                style={{ background: "var(--surface-strong, #ffffff)", borderColor: "var(--line, #e2e8f0)" }}
              >
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-banana-400 to-amber-500" />
                
                <div className="flex flex-col items-center text-center mt-4 mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-600 rounded-full flex items-center justify-center text-3xl font-bold shadow-inner mb-4">
                    {profileData?.name?.charAt(0) || customer.name.charAt(0)}
                  </div>
                  <h2 className="text-xl font-bold" style={{ color: "var(--ink, #0f172a)" }}>{profileData?.name || customer.name}</h2>
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full mt-2 border border-emerald-100">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Thành viên ChillBanana
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 rounded-2xl" style={{ background: "var(--field-bg, rgba(0,0,0,0.02))" }}>
                    <Mail className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] uppercase font-bold tracking-wider" style={{ color: "var(--muted, #64748b)" }}>Email liên hệ</div>
                      <div className="text-sm font-medium" style={{ color: "var(--ink, #0f172a)" }}>{profileData?.email || customer.email}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-2xl" style={{ background: "var(--field-bg, rgba(0,0,0,0.02))" }}>
                    <Phone className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] uppercase font-bold tracking-wider" style={{ color: "var(--muted, #64748b)" }}>Số điện thoại</div>
                      <div className="text-sm font-medium" style={{ color: "var(--ink, #0f172a)" }}>{profileData?.phone || customer.phone || "Chưa cập nhật"}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-2xl" style={{ background: "var(--field-bg, rgba(0,0,0,0.02))" }}>
                    <MapPin className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] uppercase font-bold tracking-wider" style={{ color: "var(--muted, #64748b)" }}>Địa chỉ giao hàng mặc định</div>
                      <div className="text-sm font-medium leading-relaxed" style={{ color: "var(--ink, #0f172a)" }}>{profileData?.address || customer.address || "Chưa cập nhật"}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Card */}
              {profileData && (
                <div className="grid grid-cols-2 gap-4">
                  <div
                    className="p-5 rounded-3xl border shadow-sm flex flex-col items-center justify-center text-center"
                    style={{ background: "var(--surface-strong, #ffffff)", borderColor: "var(--line, #e2e8f0)" }}
                  >
                    <Package className="w-6 h-6 text-banana-500 mb-2" />
                    <div className="text-2xl font-bold font-mono" style={{ color: "var(--ink, #0f172a)" }}>{profileData.orders?.length || 0}</div>
                    <div className="text-xs font-medium" style={{ color: "var(--muted, #64748b)" }}>Đơn hàng</div>
                  </div>
                  <div
                    className="p-5 rounded-3xl border shadow-sm flex flex-col items-center justify-center text-center"
                    style={{ background: "var(--surface-strong, #ffffff)", borderColor: "var(--line, #e2e8f0)" }}
                  >
                    <MessageSquare className="w-6 h-6 text-blue-500 mb-2" />
                    <div className="text-2xl font-bold font-mono" style={{ color: "var(--ink, #0f172a)" }}>{profileData.chatSessions?.length || 0}</div>
                    <div className="text-xs font-medium" style={{ color: "var(--muted, #64748b)" }}>Phiên tư vấn</div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Orders & History */}
            <div className="lg:col-span-2 space-y-6">
              {/* Orders Section */}
              <div
                className="rounded-3xl border shadow-sm overflow-hidden"
                style={{ background: "var(--surface-strong, #ffffff)", borderColor: "var(--line, #e2e8f0)" }}
              >
                <div
                  className="p-5 border-b flex items-center justify-between"
                  style={{ borderColor: "var(--line, #e2e8f0)", background: "var(--field-bg, rgba(0,0,0,0.02))" }}
                >
                  <h3 className="font-bold flex items-center gap-2 text-lg" style={{ color: "var(--ink, #0f172a)" }}>
                    <Package className="w-5 h-5 text-banana-500" />
                    Đơn Hàng Của Tôi
                  </h3>
                  <Link href="/tracking" className="text-xs font-bold text-banana-600 hover:text-banana-700 flex items-center gap-1 transition-colors">
                    Tra cứu mã đơn khác <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                
                <div className="p-5">
                  {loading ? (
                    <div className="py-8 text-center text-sm" style={{ color: "var(--muted, #64748b)" }}>Đang tải danh sách đơn hàng...</div>
                  ) : profileData?.orders?.length > 0 ? (
                    <div className="space-y-4">
                      {profileData.orders.map((order: any) => (
                        <div
                          key={order.id}
                          className="border rounded-2xl p-4 transition-colors group"
                          style={{ borderColor: "var(--line, #e2e8f0)", background: "var(--surface-strong, #ffffff)" }}
                        >
                          <div className="flex flex-col sm:flex-row justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg" style={{ background: "var(--field-bg, rgba(0,0,0,0.05))", color: "var(--ink, #0f172a)" }}>
                                  #{order.orderCode}
                                </span>
                                <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--muted, #64748b)" }}>
                                  <Clock className="w-3 h-3" />
                                  {new Date(order.createdAt).toLocaleDateString("vi-VN")}
                                </span>
                              </div>
                              <h4 className="font-bold line-clamp-1" style={{ color: "var(--ink, #0f172a)" }}>{order.productName}</h4>
                              <div className="mt-3 flex items-center gap-4 text-xs font-medium">
                                <div className="px-3 py-1.5 rounded-xl border" style={{ background: "var(--field-bg, rgba(0,0,0,0.02))", borderColor: "var(--line, #e2e8f0)" }}>
                                  <span style={{ color: "var(--muted, #64748b)", marginRight: "4px" }}>Tổng cộng:</span>
                                  <span className="text-banana-700 font-bold">{order.totalVnd.toLocaleString("vi-VN")} đ</span>
                                </div>
                                <div className="px-3 py-1.5 rounded-xl border flex items-center gap-1.5" style={{ background: "var(--field-bg, rgba(0,0,0,0.02))", borderColor: "var(--line, #e2e8f0)" }}>
                                  <div className={`w-2 h-2 rounded-full ${
                                    order.paymentStatus === 'UNPAID' ? 'bg-amber-400' : 'bg-emerald-500'
                                  }`} />
                                  <span className={order.paymentStatus === 'REFUNDED' ? 'text-slate-600' : order.paymentStatus === 'UNPAID' ? 'text-amber-700' : 'text-emerald-700'}>
                                    {order.paymentStatus === 'REFUNDED'
                                      ? 'Đã hoàn tiền'
                                      : order.paymentStatus === 'UNPAID'
                                      ? (!order.isPriceVerified ? 'Chờ duyệt giá' : `Chờ cọc (${order.depositPercent || 50}%)`)
                                      : (order.depositPercent === 100 ? 'Đã thanh toán 100%' : 'Đã cọc 50%')}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div
                              className="flex flex-col items-start sm:items-end justify-center shrink-0 border-t sm:border-t-0 sm:border-l pt-4 sm:pt-0 sm:pl-4"
                              style={{ borderColor: "var(--line, #e2e8f0)" }}
                            >
                              <div className="mb-2 w-full text-left sm:text-right">
                                <div className="text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: "var(--muted, #64748b)" }}>Trạng thái</div>
                                <div className="text-sm font-bold" style={{ color: "var(--ink, #0f172a)" }}>
                                  {order.status === "PENDING_DEPOSIT" && (!order.isPriceVerified ? "⏳ Chờ duyệt giá" : `⏳ Chờ đặt cọc (${order.depositPercent || 50}%)`)}
                                  {order.status === "PURCHASING_JP" && "🛒 Đã cọc • Đang mua tại Nhật"}
                                  {order.status === "WAREHOUSE_JP" && "📦 Đã về kho Tokyo"}
                                  {order.status === "IN_TRANSIT_AIR" && "✈️ Đang bay về Việt Nam"}
                                  {order.status === "WAREHOUSE_VN" && "🛬 Đã về kho Việt Nam"}
                                  {order.status === "LOCAL_DELIVERY" && "🚚 Đang giao hàng nội địa"}
                                  {order.status === "COMPLETED" && "✅ Đã hoàn thành"}
                                  {order.status === "CANCELLED" && "❌ Đã hủy"}
                                </div>
                              </div>
                              <Link 
                                href={`/tracking?code=${encodeURIComponent(order.orderCode)}`}
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
                    <div className="text-center py-10 rounded-2xl border border-dashed" style={{ background: "var(--field-bg, rgba(0,0,0,0.02))", borderColor: "var(--line, #e2e8f0)" }}>
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm text-2xl" style={{ background: "var(--surface-strong, #ffffff)" }}>📦</div>
                      <p className="font-medium mb-1" style={{ color: "var(--ink, #0f172a)" }}>Bạn chưa có đơn hàng nào.</p>
                      <p className="text-xs mb-4" style={{ color: "var(--muted, #64748b)" }}>Các đơn hàng của bạn sẽ hiển thị tại đây.</p>
                      <Link href="/" className="inline-block px-4 py-2 bg-banana-400 text-navy-900 font-bold text-xs rounded-xl hover:bg-banana-500 transition-colors">
                        Bắt Đầu Mua Sắm
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Chat History Section */}
              <div
                className="rounded-3xl border shadow-sm overflow-hidden"
                style={{ background: "var(--surface-strong, #ffffff)", borderColor: "var(--line, #e2e8f0)" }}
              >
                <div
                  className="p-5 border-b"
                  style={{ borderColor: "var(--line, #e2e8f0)", background: "var(--field-bg, rgba(0,0,0,0.02))" }}
                >
                  <h3 className="font-bold flex items-center gap-2 text-lg" style={{ color: "var(--ink, #0f172a)" }}>
                    <MessageSquare className="w-5 h-5 text-blue-500" />
                    Lịch Sử Tư Vấn AI
                  </h3>
                </div>
                <div className="p-5">
                  {loading ? (
                    <div className="py-8 text-center text-sm" style={{ color: "var(--muted, #64748b)" }}>Đang tải lịch sử...</div>
                  ) : profileData?.chatSessions?.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {profileData.chatSessions.map((session: any) => (
                        <div
                          key={session.id}
                          className="p-4 border rounded-2xl flex flex-col h-full"
                          style={{ borderColor: "var(--line, #e2e8f0)", background: "var(--field-bg, rgba(0,0,0,0.02))" }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-xs font-medium" style={{ color: "var(--muted, #64748b)" }}>{new Date(session.updatedAt).toLocaleDateString("vi-VN")}</span>
                          </div>
                          <h4 className="font-bold text-sm mb-2 flex-grow line-clamp-2" style={{ color: "var(--ink, #0f172a)" }}>
                            {session.topic || "Tư vấn sản phẩm Nhật Bản"}
                          </h4>
                          {session.sentiment && (
                            <div className="mt-auto pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--line, #e2e8f0)" }}>
                              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted, #64748b)" }}>Đánh giá AI</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--surface-strong, #ffffff)", border: "1px solid var(--line, #e2e8f0)" }}>
                                {session.sentiment}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm" style={{ color: "var(--muted, #64748b)" }}>Chưa có lịch sử tư vấn nào được lưu.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
