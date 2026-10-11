"use client";

import React, { useEffect, useState } from "react";
import { BarChart3, MessageSquareText, Sparkles } from "lucide-react";
import ReportsTab from "@/app/admin/components/ReportsTab";
import AiTrendsTab from "@/app/admin/components/AiTrendsTab";
import AdminAgentTab from "@/app/admin/components/AdminAgentTab";
import { AdminAiModuleId } from "@/lib/admin-ai/definitions";

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

  useEffect(() => {
    setSection(initialSection);
    setAgentModule(initialAgentModule);
  }, [initialSection, initialAgentModule]);

  const openAgent = (module: AdminAiModuleId) => {
    setAgentModule(module);
    setSection("assistant");
  };

  return (
    <div className="space-y-5">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-navy-950 sm:text-2xl">Phân tích kinh doanh &amp; AI</h1>
          <p className="text-sm text-slate-600">Theo dõi kết quả kinh doanh, nhu cầu khách ghi nhận trên website và dùng AI để hỗ trợ ra quyết định.</p>
        </div>
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
      {section === "assistant" && <AdminAgentTab initialModule={agentModule} />}
    </div>
  );
}
