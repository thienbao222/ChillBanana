"use client";

import React, { useState, useEffect } from "react";
import {
  RefreshCw, TrendingUp, BarChart3, ShoppingBag, Package, AlertCircle, Sparkles,
} from "lucide-react";
import { useAdminToast } from "@/context/AdminToastContext";
import DailyInsightCard from "@/features/ai/admin/DailyInsightCard";

export default function ReportsTab({ onOpenAgent }: { onOpenAgent?: () => void }) {
  const { adminToast } = useAdminToast();
  const [reportData, setReportData] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [funnelData, setFunnelData] = useState<any>(null);
  const [loadingFunnel, setLoadingFunnel] = useState(false);

  const fetchReport = async () => {
    setLoadingReport(true);
    try {
      const res = await fetch("/api/admin/reports");
      const data = await res.json();
      if (res.ok && data.success) setReportData(data);
    } catch { adminToast.error("Lỗi tải báo cáo"); }
    finally { setLoadingReport(false); }
  };

  const fetchFunnel = async () => {
    setLoadingFunnel(true);
    try {
      const res = await fetch("/api/admin/funnel");
      const data = await res.json();
      if (res.ok && data.success) setFunnelData(data);
    } catch { adminToast.error("Lỗi tải phễu"); }
    finally { setLoadingFunnel(false); }
  };

  useEffect(() => {
    fetchReport();
    fetchFunnel();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
          <div className="space-y-6">

            {/* Header */}
            <div className="bg-gradient-to-r from-navy-900 via-slate-800 to-navy-900 text-white p-6 rounded-3xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center space-x-1.5 bg-banana-500/20 text-banana-300 text-xs font-bold px-3 py-1 rounded-full mb-2 border border-banana-500/30">
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Báo Cáo Kinh Doanh Thực Tế</span>
                </span>
                <h2 className="text-2xl font-serif font-bold text-white">
                  Thống Kê Doanh Thu & Mặt Hàng Bán Chạy
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                  Dữ liệu tổng hợp từ PostgreSQL (Neon). Doanh thu thực thu chỉ tính các đơn hàng đã nhận cọc (DEPOSITED_50 / PAID_100).
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onOpenAgent}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-banana-200 border border-white/15 font-bold text-xs rounded-2xl transition-all flex items-center space-x-2 shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Hỏi AI Agent</span>
                </button>
                <button
                  onClick={() => {
                    const csvLines = [
                      "BÁO CÁO DOANH THU CHILLBANANA",
                      `Tổng số đơn: ${reportData?.kpi?.totalOrders || 0}`,
                      `Doanh thu thực thu: ${reportData?.kpi?.actualRevenue || 0} VND`,
                      "",
                      "Danh mục,Số đơn,Doanh thu (VND)"
                    ];
                    if (reportData?.categoryBreakdown) {
                      reportData.categoryBreakdown.forEach((c: any) => {
                        csvLines.push(`${c.label},${c.count},${c.revenue}`);
                      });
                    }
                    const blob = new Blob([csvLines.join("\\n")], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.setAttribute("href", url);
                    link.setAttribute("download", `bao-cao-doanh-thu-${new Date().toISOString().slice(0,10)}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  disabled={!reportData}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-2xl shadow transition-all flex items-center space-x-2 shrink-0 disabled:opacity-50"
                >
                  <span>Xuất CSV</span>
                </button>
                <button
                  onClick={fetchReport}
                  className="px-4 py-2.5 bg-banana-500 hover:bg-banana-400 text-navy-950 font-bold text-xs rounded-2xl shadow transition-all flex items-center space-x-2 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingReport ? "animate-spin" : ""}`} />
                  <span>Làm Mới</span>
                </button>
              </div>
            </div>

            <DailyInsightCard />

            {loadingReport ? (
              <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Đang tải dữ liệu báo cáo...
              </div>
            ) : reportData ? (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                    <span className="text-xs font-medium text-slate-500">Tổng Đơn Hàng</span>
                    <div className="text-2xl font-bold text-navy-900 mt-1 font-mono">{reportData.kpi.totalOrders}</div>
                    <div className="text-[11px] text-slate-500 mt-1">{reportData.kpi.activeOrders} đang xử lý • {reportData.kpi.cancelledOrders} đã hủy</div>
                  </div>
                  <div className="bg-white p-5 rounded-3xl border border-banana-200 shadow-sm bg-banana-50/50">
                    <span className="text-xs font-medium text-slate-500">Doanh Thu Thực Thu</span>
                    <div className="text-2xl font-bold text-banana-600 mt-1 font-mono">{reportData.kpi.actualRevenue.toLocaleString("vi-VN")} đ</div>
                    <div className="text-[11px] text-slate-500 mt-1">Tổng cọc đã nhận thực tế</div>
                  </div>
                  <div className="bg-white p-5 rounded-3xl border border-emerald-200 shadow-sm bg-emerald-50/50">
                    <span className="text-xs font-medium text-slate-500">Đơn Hoàn Thành</span>
                    <div className="text-2xl font-bold text-emerald-600 mt-1 font-mono">{reportData.kpi.completedOrders}</div>
                    <div className="text-[11px] text-emerald-700 mt-1 font-bold">Tỷ lệ: {reportData.kpi.conversionRate}%</div>
                  </div>
                  <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                    <span className="text-xs font-medium text-slate-500">Giá Trị Trung Bình / Đơn</span>
                    <div className="text-2xl font-bold text-blue-600 mt-1 font-mono">{reportData.kpi.avgOrderValue.toLocaleString("vi-VN")} đ</div>
                    <div className="text-[11px] text-slate-500 mt-1">Dựa trên tổng giá trị đơn</div>
                  </div>
                </div>

                {/* Phân loại khách hàng */}
                {reportData.customerTypeBreakdown && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-5 rounded-3xl border border-emerald-200 shadow-sm flex justify-between items-center bg-emerald-50/30">
                      <div>
                        <span className="text-xs font-medium text-emerald-800">Thành Viên (Đã Đăng Ký)</span>
                        <div className="text-xl font-bold text-emerald-600 mt-1">{reportData.customerTypeBreakdown.registered.revenue.toLocaleString("vi-VN")} đ</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-navy-900 font-mono">{reportData.customerTypeBreakdown.registered.count}</div>
                        <span className="text-[10px] text-slate-500">Đơn hàng</span>
                      </div>
                    </div>
                    <div className="bg-white p-5 rounded-3xl border border-amber-200 shadow-sm flex justify-between items-center bg-amber-50/30">
                      <div>
                        <span className="text-xs font-medium text-amber-800">Khách Vãng Lai (Guest)</span>
                        <div className="text-xl font-bold text-amber-600 mt-1">{reportData.customerTypeBreakdown.guest.revenue.toLocaleString("vi-VN")} đ</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-navy-900 font-mono">{reportData.customerTypeBreakdown.guest.count}</div>
                        <span className="text-[10px] text-slate-500">Đơn hàng</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2-Col: Top Products + Category */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* Top Products */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between border-b pb-3 mb-4">
                      <h3 className="font-bold text-sm text-navy-900 flex items-center space-x-2">
                        <TrendingUp className="w-4 h-4 text-banana-600" />
                        <span>Top 10 Mặt Hàng Đặt Mua Nhiều Nhất</span>
                      </h3>
                      <span className="text-[10px] text-slate-400">Nhóm theo tên sản phẩm</span>
                    </div>
                    <div className="space-y-2.5">
                      {reportData.topProducts.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-6">Chưa có dữ liệu đơn hàng</p>
                      ) : (
                        reportData.topProducts.map((p: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-xs p-2.5 bg-slate-50 rounded-2xl hover:bg-banana-50/60 transition-colors">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                idx === 0 ? "bg-banana-500 text-navy-950" :
                                idx === 1 ? "bg-slate-300 text-slate-800" :
                                idx === 2 ? "bg-amber-300 text-amber-900" : "bg-slate-200 text-slate-600"
                              }`}>{idx + 1}</span>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                                <p className="text-slate-400 text-[10px]">{
                                  p.category === "cosmetics" ? "Mỹ phẩm" :
                                  p.category === "health" ? "Thực phẩm CN" :
                                  p.category === "gadgets" ? "Gia dụng" :
                                  p.category === "anime" ? "Anime" : "Khác"
                                }</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono font-bold text-navy-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200">{p.count} đơn</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Category Revenue Breakdown */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between border-b pb-3 mb-4">
                      <h3 className="font-bold text-sm text-navy-900 flex items-center space-x-2">
                        <ShoppingBag className="w-4 h-4 text-blue-600" />
                        <span>Phân Bổ Doanh Thu Theo Danh Mục</span>
                      </h3>
                      <span className="text-[10px] text-slate-400">Chỉ đơn đã cọc</span>
                    </div>
                    <div className="space-y-4">
                      {reportData.categoryBreakdown.map((cat: any, idx: number) => {
                        const total = reportData.categoryBreakdown.reduce((s: number, c: any) => s + c.revenue, 0);
                        const pct = total > 0 ? Math.round((cat.revenue / total) * 100) : 0;
                        const colors = ["bg-banana-400", "bg-emerald-400", "bg-blue-400", "bg-purple-400", "bg-slate-300"];
                        return (
                          <div key={idx} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-700">{cat.label}</span>
                              <span className="font-mono font-bold text-slate-900">
                                {cat.revenue.toLocaleString("vi-VN")} đ <span className="text-slate-400 font-normal">({pct}%)</span>
                              </span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${colors[idx % colors.length]} rounded-full transition-all duration-700`}
                                style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-slate-400">{cat.count} đơn đã cọc</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Daily Revenue 7 ngày */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between border-b pb-3 mb-5">
                    <h3 className="font-bold text-sm text-navy-900 flex items-center space-x-2">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      <span>Doanh Thu & Số Đơn Theo Ngày (7 Ngày Gần Nhất)</span>
                    </h3>
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {reportData.dailyRevenue.map((day: any, idx: number) => {
                      const maxRev = Math.max(...reportData.dailyRevenue.map((d: any) => d.revenue), 1);
                      const barH = Math.max(day.revenue > 0 ? Math.round((day.revenue / maxRev) * 100) : 0, day.revenue > 0 ? 6 : 0);
                      const label = new Date(day.date).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" });
                      return (
                        <div key={idx} className="flex flex-col items-center space-y-1.5">
                          <span className="text-[10px] font-mono font-bold text-slate-700">{day.count > 0 ? day.count : ""}</span>
                          <div className="w-full h-24 flex items-end">
                            <div
                              className={`w-full rounded-t-lg transition-all duration-700 ${day.revenue > 0 ? "bg-banana-400" : "bg-slate-100"}`}
                              style={{ height: `${barH}%` }}
                              title={`${day.revenue.toLocaleString("vi-VN")} đ`}
                            />
                          </div>
                          <span className="text-[9px] text-slate-400 text-center leading-tight">{label}</span>
                          {day.revenue > 0 && (
                            <span className="text-[9px] font-mono text-banana-700 font-bold text-center">
                              {(day.revenue / 1000).toFixed(0)}K
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Status Breakdown */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between border-b pb-3 mb-4">
                    <h3 className="font-bold text-sm text-navy-900 flex items-center space-x-2">
                      <Package className="w-4 h-4 text-slate-600" />
                      <span>Phân Bổ Đơn Hàng Theo Trạng Thái</span>
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { key: "PENDING_DEPOSIT", label: "Chờ Cọc", color: "text-amber-600 bg-amber-50 border-amber-200" },
                      { key: "PURCHASING_JP", label: "Đang Mua JP", color: "text-blue-600 bg-blue-50 border-blue-200" },
                      { key: "WAREHOUSE_JP", label: "Kho Tokyo", color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
                      { key: "IN_TRANSIT_AIR", label: "Đang Bay", color: "text-sky-600 bg-sky-50 border-sky-200" },
                      { key: "WAREHOUSE_VN", label: "Kho VN", color: "text-teal-600 bg-teal-50 border-teal-200" },
                      { key: "LOCAL_DELIVERY", label: "Đang Giao", color: "text-orange-600 bg-orange-50 border-orange-200" },
                      { key: "COMPLETED", label: "Hoàn Thành", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
                      { key: "CANCELLED", label: "Đã Hủy", color: "text-rose-600 bg-rose-50 border-rose-200" },
                    ].map((s) => (
                      <div key={s.key} className={`p-4 rounded-2xl border text-center ${s.color}`}>
                        <div className="text-2xl font-bold font-mono">{reportData.statusBreakdown[s.key] || 0}</div>
                        <div className="text-[11px] font-bold mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ============================================== */}
                {/* SPRINT 4 — PHỄU CHUYỂN ĐỔI (CONVERSION FUNNEL) */}
                {/* ============================================== */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-navy-900 flex items-center space-x-2">
                        <TrendingUp className="w-4 h-4 text-banana-600" />
                        <span>Phễu Chuyển Đổi Khách Hàng (Conversion Funnel)</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">Đo lường hành trình: Chat AI → Để lại thông tin → Đặt hàng → Đăng ký thành viên</p>
                    </div>
                    <button
                      onClick={fetchFunnel}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-banana-100 text-slate-700 hover:text-banana-900 rounded-xl text-xs font-bold flex items-center space-x-1 transition-colors"
                    >
                      <RefreshCw className={`w-3 h-3 ${loadingFunnel ? "animate-spin" : ""}`} />
                      <span>Làm mới</span>
                    </button>
                  </div>

                  {loadingFunnel ? (
                    <div className="flex items-center justify-center py-16 text-slate-400 text-xs">
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Đang tải dữ liệu phễu...
                    </div>
                  ) : funnelData ? (
                    <div className="p-6 space-y-6">
                      {/* Funnel Steps Visual */}
                      <div className="space-y-3">
                        {funnelData.funnel?.map((step: any) => (
                          <div key={step.step} className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                              {step.step}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-navy-900">{step.label}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-bold text-navy-900">{step.count.toLocaleString()}</span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    step.percentage >= 50 ? "bg-emerald-100 text-emerald-700" :
                                    step.percentage >= 20 ? "bg-amber-100 text-amber-700" :
                                    "bg-rose-100 text-rose-700"
                                  }`}>{step.percentage}%</span>
                                </div>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-700 ${
                                    step.step === 1 ? "bg-slate-500" :
                                    step.step === 2 ? "bg-blue-500" :
                                    step.step === 3 ? "bg-amber-500" :
                                    step.step === 4 ? "bg-emerald-500" : "bg-banana-500"
                                  }`}
                                  style={{ width: `${Math.max(step.percentage, 2)}%` }}
                                />
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5">{step.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Summary Metrics */}
                      {funnelData.summary && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
                          <div className="text-center p-3 bg-slate-50 rounded-2xl">
                            <div className="text-lg font-bold text-navy-900 font-mono">{funnelData.summary.chatToOrderRate}%</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">Chat → Đặt Hàng</div>
                          </div>
                          <div className="text-center p-3 bg-emerald-50 rounded-2xl">
                            <div className="text-lg font-bold text-emerald-700 font-mono">{funnelData.summary.memberConversionRate}%</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">Chat → Đăng Ký</div>
                          </div>
                          <div className="text-center p-3 bg-amber-50 rounded-2xl">
                            <div className="text-lg font-bold text-amber-700 font-mono">{funnelData.summary.orderCompletionRate}%</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">Tỷ lệ Hoàn Thành</div>
                          </div>
                          <div className="text-center p-3 bg-blue-50 rounded-2xl">
                            <div className="text-lg font-bold text-blue-700 font-mono">{funnelData.summary.chatLeadEmails}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">Chat Leads (có email)</div>
                          </div>
                        </div>
                      )}

                      {/* Revenue Split by Customer Type */}
                      {funnelData.summary && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-slate-100">
                          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                            <div className="text-xs font-bold text-emerald-800 mb-1">💎 Doanh Thu từ Thành Viên</div>
                            <div className="text-base font-bold text-emerald-600 font-mono">{funnelData.summary.registeredRevenue.toLocaleString("vi-VN")} đ</div>
                            <div className="text-[10px] text-slate-500">{funnelData.summary.registeredOrders} đơn</div>
                          </div>
                          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                            <div className="text-xs font-bold text-amber-800 mb-1">🛍️ Doanh Thu từ Khách Vãng Lai</div>
                            <div className="text-base font-bold text-amber-600 font-mono">{funnelData.summary.guestRevenue.toLocaleString("vi-VN")} đ</div>
                            <div className="text-[10px] text-slate-500">{funnelData.summary.guestOrders} đơn</div>
                          </div>
                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                            <div className="text-xs font-bold text-blue-800 mb-1">💬 Chat Lead → Có Đơn Hàng</div>
                            <div className="text-base font-bold text-blue-600 font-mono">{funnelData.summary.ordersFromChatLeads}</div>
                            <div className="text-[10px] text-slate-500">đơn phát sinh từ Chat Lead</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-12 text-slate-400 text-xs">
                      <AlertCircle className="w-4 h-4 mr-2" /> Nhấn làm mới để tải dữ liệu phễu.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
                <AlertCircle className="w-5 h-5 mr-2" /> Không tải được dữ liệu báo cáo.
              </div>
            )}
          </div>
  );
}
