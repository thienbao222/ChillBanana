"use client";

import React, { useEffect, useState } from "react";
import { BarChart3, MessageSquareText, Sparkles, Clock, AlertTriangle, Scale, Flame, ArrowRight } from "lucide-react";
import ReportsTab from "@/app/admin/components/ReportsTab";
import AiTrendsTab from "@/app/admin/components/AiTrendsTab";
import AdminAgentTab from "@/features/ai/admin/AdminAgentTab";
import { AdminAiModuleId } from "@/features/ai/admin/definitions";

export type AnalyticsSection = "reports" | "trends" | "assistant";

type Props = {
  initialSection?: AnalyticsSection;
  initialAgentModule?: AdminAiModuleId;
};

const sections: { id: AnalyticsSection; label: string; description: string; icon: React.ReactNode }[] = [
  { id: "reports", label: "Báo cáo", description: "Doanh thu, đơn hàng và phễu khách hàng", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "trends", label: "Xu hướng khách", description: "Chủ đề và từ khóa ghi nhận từ chat", icon: <MessageSquareText className="h-4 w-4" /> },
  { id: "assistant", label: "AI Agent", description: "Hỏi dữ liệu theo từng nghiệp vụ", icon: <Sparkles className="h-4 w-4" /> },
];

export default function AnalyticsWorkspaceTab({ initialSection = "reports", initialAgentModule = "overview" }: Props) {
  const [section, setSection] = useState<AnalyticsSection>(initialSection);
  const [agentModule, setAgentModule] = useState<AdminAiModuleId>(initialAgentModule);
  const [agentQuestion, setAgentQuestion] = useState("");
  const [alertStats, setAlertStats] = useState<{
    pendingDepositOver3Days: number;
    unverifiedPrice: number;
    unweighedOrders: number;
    hotLeads: number;
  } | null>(null);

  useEffect(() => {
    setSection(initialSection);
    setAgentModule(initialAgentModule);
  }, [initialSection, initialAgentModule]);

  useEffect(() => {
    fetch("/api/admin/ai-analytics")
      .then((res) => res.json())
      .then((data) => {
        if (data.operationalAlerts) {
          setAlertStats({
            pendingDepositOver3Days: data.operationalAlerts.orders?.pendingDepositOver3Days || 0,
            unverifiedPrice: data.operationalAlerts.orders?.unverifiedPrice || 0,
            unweighedOrders: data.operationalAlerts.orders?.unweighedOrders || 0,
            hotLeads: data.operationalAlerts.customersAndLeads?.hotLeads || 0,
          });
        }
      })
      .catch(() => {});
  }, []);

  const openAgent = (module: AdminAiModuleId, question = "") => {
    setAgentModule(module);
    setAgentQuestion(question);
    setSection("assistant");
  };

  return (
    <div className="space-y-5">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-navy-950 sm:text-2xl">Phân tích kinh doanh &amp; AI</h1>
          <p className="text-sm text-slate-600">Theo dõi kết quả kinh doanh, nhu cầu khách ghi nhận trên website và dùng AI để hỗ trợ ra quyết định.</p>
        </div>

        {/* Actionable Insights Panel */}
        {alertStats && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50/80 via-orange-50/40 to-amber-50/60 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800">
              <Sparkles className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
              <span>Cảnh báo vận hành cần xử lý ngay</span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center justify-between rounded-xl bg-white/90 p-3 shadow-xs border border-amber-100">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Chờ cọc &gt;3 ngày</div>
                    <div className="text-base font-bold text-slate-900">{alertStats.pendingDepositOver3Days} đơn</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openAgent("orders", "Có bao nhiêu đơn chờ cọc quá 3 ngày và cần nhắc cọc?")}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-banana-200 hover:text-navy-950 transition flex items-center gap-1"
                >
                  Xử lý <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-white/90 p-3 shadow-xs border border-amber-100">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Chờ duyệt giá</div>
                    <div className="text-base font-bold text-slate-900">{alertStats.unverifiedPrice} đơn</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openAgent("orders", "Đơn hàng nào chưa duyệt giá (isPriceVerified: false) cần nhân viên kiểm tra?")}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-banana-200 hover:text-navy-950 transition flex items-center gap-1"
                >
                  Duyệt giá <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-white/90 p-3 shadow-xs border border-amber-100">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                    <Scale className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Ở kho chưa cân (0kg)</div>
                    <div className="text-base font-bold text-slate-900">{alertStats.unweighedOrders} đơn</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openAgent("orders", "Đơn hàng nào đã vào kho Nhật/VN nhưng cân nặng vẫn bằng 0kg?")}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-banana-200 hover:text-navy-950 transition flex items-center gap-1"
                >
                  Cân hàng <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-white/90 p-3 shadow-xs border border-amber-100">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                    <Flame className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Khách Lead tiềm năng</div>
                    <div className="text-base font-bold text-slate-900">{alertStats.hotLeads} khách</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openAgent("trends", "Có những phiên chat lead nào đang có nhu cầu mua hàng cần liên hệ chốt đơn?")}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-banana-200 hover:text-navy-950 transition flex items-center gap-1"
                >
                  Tư vấn <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        )}

        <nav aria-label="Phân tích kinh doanh" className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {sections.map((item) => (
            <button key={item.id} type="button" onClick={() => setSection(item.id)} aria-current={section === item.id ? "page" : undefined}
              className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition sm:p-4 ${section === item.id ? "border-banana-400 bg-banana-50 ring-2 ring-banana-100" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}>
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${section === item.id ? "bg-banana-400 text-navy-950" : "bg-slate-100 text-slate-600"}`}>{item.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-900">{item.label}</span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-500">{item.description}</span>
              </span>
            </button>
          ))}
        </nav>
      </header>

      {section === "reports" && <ReportsTab onOpenAgent={() => openAgent("reports")} />}
      {section === "trends" && <AiTrendsTab onOpenAgent={() => openAgent("trends")} />}
      {section === "assistant" && <AdminAgentTab initialModule={agentModule} initialQuestion={agentQuestion} />}
    </div>
  );
}
