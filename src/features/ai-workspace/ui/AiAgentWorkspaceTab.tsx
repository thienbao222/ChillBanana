"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShoppingBag,
  ShieldAlert,
  BadgeDollarSign,
  Compass,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Search,
  Layers,
  Zap,
} from "lucide-react";
import {
  WorkspaceOverviewData,
  AgentId,
  AgentCardInfo,
  JapaneseProductAnalysis,
  ComplianceScreeningResult,
  FinancialAuditSummary,
} from "../types";

export function AiAgentWorkspaceTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState<WorkspaceOverviewData | null>(null);
  const [activeAgentTab, setActiveAgentTab] = useState<AgentId>("agent:purchasing");

  // State tương tác Purchasing Agent
  const [productUrl, setProductUrl] = useState("https://jp.mercari.com/item/m12345678901");
  const [productPriceJpy, setProductPriceJpy] = useState(4800);
  const [purchasingLoading, setPurchasingLoading] = useState(false);
  const [productAnalysis, setProductAnalysis] = useState<JapaneseProductAnalysis | null>(null);
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [purchaseResult, setPurchaseResult] = useState<any>(null);

  // State tương tác Quarantine Agent
  const [quarantineText, setQuarantineText] = useState("Áo len Uniqlo, mô hình Gundam và 1 gói ruốc thịt heo");
  const [lengthCm, setLengthCm] = useState(30);
  const [widthCm, setWidthCm] = useState(20);
  const [heightCm, setHeightCm] = useState(15);
  const [actualWeightKg, setActualWeightKg] = useState(1.2);
  const [quarantineLoading, setQuarantineLoading] = useState(false);
  const [quarantineResult, setQuarantineResult] = useState<ComplianceScreeningResult | null>(null);

  // State tương tác Financial Audit Agent
  const [auditOrderId, setAuditOrderId] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<FinancialAuditSummary | null>(null);
  const [testOrderTotalVnd, setTestOrderTotalVnd] = useState(2500000);
  const [testDepositVnd, setTestDepositVnd] = useState(1750000);
  const [tierCheckResult, setTierCheckResult] = useState<any>(null);

  // State tương tác Executive Assistant
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [dispatchMessage, setDispatchMessage] = useState<string | null>(null);

  // Load Overview Data
  const loadOverview = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/admin/ai-workspace/overview");
      const json = await res.json();
      if (json.success && json.data) {
        setOverview(json.data);
      }
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu AI Workspace:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // Hành động 1: Phân tích URL sàn Nhật
  const handleAnalyzeUrl = async () => {
    setPurchasingLoading(true);
    try {
      const res = await fetch("/api/admin/ai-workspace/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent:purchasing",
          action: "ANALYZE_PRODUCT_URL",
          params: { url: productUrl, priceJpy: productPriceJpy },
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.details) {
        setProductAnalysis(json.data.details);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPurchasingLoading(false);
    }
  };

  // Hành động 2: Mua hàng tự động
  const handleAutoPurchase = async () => {
    if (!purchaseOrderId.trim()) {
      alert("Vui lòng nhập ID hoặc mã đơn hàng cần mua");
      return;
    }
    setPurchasingLoading(true);
    try {
      const res = await fetch("/api/admin/ai-workspace/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent:purchasing",
          action: "AUTO_PURCHASE_ORDER",
          targetId: purchaseOrderId.trim(),
        }),
      });
      const json = await res.json();
      setPurchaseResult(json.data);
      loadOverview();
    } catch (err) {
      console.error(err);
    } finally {
      setPurchasingLoading(false);
    }
  };

  // Hành động 3: Quét kiểm dịch MAFF & IATA
  const handleQuarantineScan = async () => {
    setQuarantineLoading(true);
    try {
      const res = await fetch("/api/admin/ai-workspace/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent:quarantine",
          action: "SCREEN_COMPLIANCE",
          params: {
            text: quarantineText,
            dimensions: { lengthCm, widthCm, heightCm, actualWeightKg },
          },
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.details) {
        setQuarantineResult(json.data.details);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setQuarantineLoading(false);
    }
  };

  // Hành động 4: Kiểm tra cọc 3 bậc
  const handleCheckDepositTier = async () => {
    try {
      const res = await fetch("/api/admin/ai-workspace/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent:financial_audit",
          action: "CHECK_DEPOSIT_TIER",
          params: { orderTotalVnd: testOrderTotalVnd, actualDepositAmountVnd: testDepositVnd },
        }),
      });
      const json = await res.json();
      if (json.success) {
        setTierCheckResult(json.data.details);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Hành động 5: Kiểm toán đơn hàng
  const handleAuditOrder = async () => {
    if (!auditOrderId.trim()) {
      alert("Vui lòng nhập ID đơn hàng cần kiểm toán");
      return;
    }
    setAuditLoading(true);
    try {
      const res = await fetch("/api/admin/ai-workspace/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent:financial_audit",
          action: "AUDIT_TRANSACTIONS",
          targetId: auditOrderId.trim(),
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.details) {
        setAuditResult(json.data.details);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAuditLoading(false);
    }
  };

  // Hành động 6: Thu số dư đợt 2 tại Kho VN
  const handleSettleBalance = async () => {
    if (!auditOrderId.trim()) {
      alert("Vui lòng nhập ID đơn hàng cần tất toán số dư");
      return;
    }
    setAuditLoading(true);
    try {
      const res = await fetch("/api/admin/ai-workspace/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent:financial_audit",
          action: "SETTLE_WAREHOUSE_VN_BALANCE",
          targetId: auditOrderId.trim(),
        }),
      });
      const json = await res.json();
      alert(json.data?.summary || "Đã tất toán số dư thành công");
      loadOverview();
    } catch (err) {
      console.error(err);
    } finally {
      setAuditLoading(false);
    }
  };

  // Hành động 7: One-Click Dispatch
  const handleDispatchAction = async (dispatchActionName: string) => {
    setDispatchLoading(true);
    setDispatchMessage(null);
    try {
      const res = await fetch("/api/admin/ai-workspace/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent:executive_assistant",
          action: "DISPATCH_ACTION",
          params: { dispatchActionName },
        }),
      });
      const json = await res.json();
      if (json.success) {
        setDispatchMessage(json.data?.summary || "Đã điều phối thành công");
        loadOverview();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDispatchLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-600" />
        <p className="text-sm font-medium">Đang khởi tạo không gian điều hành Agentic AI Workspace...</p>
      </div>
    );
  }

  const agents = overview?.agents || [];
  const pipeline = overview?.pipeline?.stages || [];
  const scorecard = overview?.scorecard;
  const recentLogs = overview?.recentAuditLogs || [];

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto px-4 sm:px-6">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-12">
          <Sparkles className="w-64 h-64 text-violet-300" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-800/60 border border-violet-500/40 text-violet-200 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>ChillBanana Agentic Operations v4.0</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Trung Tâm Chỉ Huy Tác Nghiệp Đa Agent (AI Workspace)
            </h1>
            <p className="text-violet-200 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Kiến trúc vận hành tự động Phương án B: Giữ 2 vai trò Admin người thật và chuyển giao 4 nghiệp vụ chuyên môn sâu cho 4 AI Agent chuyên trách.
            </p>
          </div>
          <button
            onClick={loadOverview}
            disabled={refreshing}
            className="self-start md:self-auto inline-flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            <span>Làm Mới Dữ Liệu</span>
          </button>
        </div>
      </div>

      {/* 1. STATUS CARDS: 4 AGENT ROSTER */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-violet-600" />
          <span>Biệt Đội 4 AI Agent Chuyên Trách (Agent Roster)</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {agents.map((ag: AgentCardInfo) => {
            const isSelected = activeAgentTab === ag.id;
            return (
              <div
                key={ag.id}
                onClick={() => setActiveAgentTab(ag.id)}
                className={`cursor-pointer rounded-xl p-4 transition-all duration-200 border ${
                  isSelected
                    ? "bg-white border-violet-600 shadow-md ring-2 ring-violet-500/20"
                    : "bg-slate-50/80 hover:bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded-lg bg-violet-100 text-violet-700">
                    {ag.type === "PURCHASING" && <ShoppingBag className="w-5 h-5" />}
                    {ag.type === "QUARANTINE_COMPLIANCE" && <ShieldAlert className="w-5 h-5" />}
                    {ag.type === "FINANCIAL_AUDIT" && <BadgeDollarSign className="w-5 h-5" />}
                    {ag.type === "EXECUTIVE_ASSISTANT" && <Compass className="w-5 h-5" />}
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    {ag.status}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-sm mt-3">{ag.name}</h3>
                <p className="text-[11px] text-slate-500 line-clamp-1">{ag.roleTitle}</p>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                  <span>Hoàn tất: <b>{ag.completedTasksCount}</b></span>
                  <span>Tỷ lệ đạt: <b className="text-emerald-600">{ag.successRate}%</b></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. PIPELINE WORKFLOW CANVAS */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Quy Trình Tác Nghiệp Tự Động (Pipeline Workflow Canvas)</h2>
              <p className="text-xs text-slate-500">7 trạm kiểm soát xuyên suốt từ tiếp nhận đơn đến phát hàng bưu tá</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
            Thông lượng: {scorecard?.throughputScore || 96}%
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {pipeline.map((stage: any, idx: number) => (
            <div
              key={stage.id}
              className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 flex flex-col justify-between relative group hover:border-violet-300 transition"
            >
              <div>
                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 mb-1">
                  <span>Bước {idx + 1}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      stage.status === "CONGESTED"
                        ? "bg-rose-500 animate-ping"
                        : stage.status === "ATTENTION"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                  />
                </div>
                <div className="text-xs font-bold text-slate-800 line-clamp-1">{stage.label}</div>
              </div>
              <div className="mt-2 flex items-baseline justify-between pt-2 border-t border-slate-200/50">
                <span className="text-[10px] text-slate-500 font-mono">Đang chờ:</span>
                <span className="text-sm font-extrabold text-violet-700">{stage.count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. INTERACTIVE AGENT CONSOLES (TABS CHUYÊN MÔN) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50/50">
          <button
            onClick={() => setActiveAgentTab("agent:purchasing")}
            className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeAgentTab === "agent:purchasing"
                ? "border-violet-600 text-violet-700 bg-white"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>1. Purchasing Agent (Sàn Nhật & Mua Hàng)</span>
          </button>
          <button
            onClick={() => setActiveAgentTab("agent:quarantine")}
            className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeAgentTab === "agent:quarantine"
                ? "border-violet-600 text-violet-700 bg-white"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>2. Quarantine Agent (Kiểm Dịch MAFF & IATA)</span>
          </button>
          <button
            onClick={() => setActiveAgentTab("agent:financial_audit")}
            className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeAgentTab === "agent:financial_audit"
                ? "border-violet-600 text-violet-700 bg-white"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
            }`}
          >
            <BadgeDollarSign className="w-4 h-4" />
            <span>3. Financial Audit Agent (Tài Chính & Thu Số Dư)</span>
          </button>
          <button
            onClick={() => setActiveAgentTab("agent:executive_assistant")}
            className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeAgentTab === "agent:executive_assistant"
                ? "border-violet-600 text-violet-700 bg-white"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>4. Executive Assistant (Bảng Điểm & Điều Phối)</span>
          </button>
        </div>

        {/* Tab 1 Content: Purchasing Agent */}
        {activeAgentTab === "agent:purchasing" && (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-violet-600" />
                <span>Thẩm Định Link Sàn Nhật & Tự Động Mua Hàng Tokyo</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Agent phân tích uy tín nhà bán, tình trạng hàng, cước nội địa, và cấp mã vận đơn Yamato/Sagawa.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form Thẩm định link */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Thẩm định URL sản phẩm</h4>
                <div>
                  <label className="text-xs font-medium text-slate-700">Link sản phẩm (Mercari / Rakuten / Yahoo / Amazon JP):</label>
                  <input
                    type="text"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    className="mt-1 w-full text-xs px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-violet-500 focus:outline-none"
                    placeholder="https://jp.mercari.com/item/..."
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Giá gốc niêm yết (JPY):</label>
                  <input
                    type="number"
                    value={productPriceJpy}
                    onChange={(e) => setProductPriceJpy(Number(e.target.value))}
                    className="mt-1 w-full text-xs px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleAnalyzeUrl}
                  disabled={purchasingLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                >
                  {purchasingLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Phân Tích & Thẩm Định Link Sàn Nhật</span>
                </button>

                {productAnalysis && (
                  <div className="mt-4 p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-2">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-slate-700">Sàn phát hiện:</span>
                      <span className="uppercase text-violet-700 px-2 py-0.5 rounded bg-violet-50">
                        {productAnalysis.platform}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Độ uy tín Seller:</span>
                      <span className="font-semibold text-emerald-600">
                        {productAnalysis.sellerReliability.rating} ({productAnalysis.sellerReliability.score}/100)
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Tình trạng hàng:</span>
                      <span className="font-medium text-slate-800">{productAnalysis.itemCondition}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Cước nội địa Nhật:</span>
                      <span className="font-semibold text-slate-900">
                        {productAnalysis.isFreeDomesticShipping ? "Miễn phí (Free Ship)" : `${productAnalysis.estimatedDomesticShippingJpy} ¥`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <span className="font-bold text-slate-800">Quy đổi ước tính:</span>
                      <span className="font-extrabold text-violet-700">
                        {productAnalysis.estimatedPriceVnd.toLocaleString("vi-VN")} đ
                      </span>
                    </div>
                    {productAnalysis.risksIdentified.length > 0 && (
                      <div className="p-2 rounded bg-amber-50 text-amber-800 text-[11px] space-y-1">
                        <b>Cảnh báo rủi ro:</b>
                        {productAnalysis.risksIdentified.map((r, i) => (
                          <div key={i}>• {r}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Form Mua hàng tự động */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Tự động Mua hàng & Cấp Mã JP Tracking</h4>
                <p className="text-xs text-slate-500">
                  Tác tử tự động tạo mã đơn đối tác tại Nhật, gán mã vận đơn Yamato/Sagawa, và chuyển trạng thái đơn sang PURCHASED.
                </p>
                <div>
                  <label className="text-xs font-medium text-slate-700">Nhập Order ID đơn hàng:</label>
                  <input
                    type="text"
                    value={purchaseOrderId}
                    onChange={(e) => setPurchaseOrderId(e.target.value)}
                    className="mt-1 w-full text-xs px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-violet-500 focus:outline-none"
                    placeholder="VD: clxx12345 hoặc mã đơn"
                  />
                </div>
                <button
                  onClick={handleAutoPurchase}
                  disabled={purchasingLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                >
                  <Zap className="w-4 h-4" />
                  <span>Kích Hoạt Mua Hàng Tự Động 1-Click</span>
                </button>

                {purchaseResult && (
                  <div className={`mt-4 p-3 rounded-lg border text-xs space-y-1.5 ${
                    purchaseResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-rose-50 border-rose-200 text-rose-900"
                  }`}>
                    <div className="font-bold flex items-center gap-1.5">
                      {purchaseResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                      <span>{purchaseResult.summary}</span>
                    </div>
                    {purchaseResult.details?.jpTrackingCode && (
                      <div className="mt-1 font-mono text-[11px] bg-white p-2 rounded border border-emerald-200">
                        <div>Mã vận đơn JP: <b>{purchaseResult.details.jpTrackingCode}</b></div>
                        <div>Mã đơn sàn nguồn: <b>{purchaseResult.details.supplierOrderCode}</b></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2 Content: Quarantine Agent */}
        {activeAgentTab === "agent:quarantine" && (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <span>Rà Soát Kiểm Dịch Nông Nghiệp MAFF & An Ninh Hàng Không IATA</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Kiểm soát thịt gia súc, xúc xích, ruốc, hạt giống (MAFF) và pin lithium, chất lỏng áp suất (IATA).
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cột trái: Form nhập văn bản & kích thước */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Kiểm tra kiện hàng</h4>
                <div>
                  <label className="text-xs font-medium text-slate-700">Mô tả sản phẩm / Kiện hàng:</label>
                  <textarea
                    rows={3}
                    value={quarantineText}
                    onChange={(e) => setQuarantineText(e.target.value)}
                    className="mt-1 w-full text-xs px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    placeholder="VD: Son môi, tai nghe bluetooth kèm sạc dự phòng pin lithium..."
                  />
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-600">Dài (cm):</label>
                    <input
                      type="number"
                      value={lengthCm}
                      onChange={(e) => setLengthCm(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1.5 border rounded bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600">Rộng (cm):</label>
                    <input
                      type="number"
                      value={widthCm}
                      onChange={(e) => setWidthCm(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1.5 border rounded bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600">Cao (cm):</label>
                    <input
                      type="number"
                      value={heightCm}
                      onChange={(e) => setHeightCm(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1.5 border rounded bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600">Cân thực (kg):</label>
                    <input
                      type="number"
                      step={0.1}
                      value={actualWeightKg}
                      onChange={(e) => setActualWeightKg(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1.5 border rounded bg-white text-xs"
                    />
                  </div>
                </div>

                <button
                  onClick={handleQuarantineScan}
                  disabled={quarantineLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                >
                  {quarantineLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                  <span>Rà Soát Kiểm Dịch MAFF & Quy Đổi IATA</span>
                </button>
              </div>

              {/* Cột phải: Kết quả thẩm định */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Kết quả phân tích từ Tác tử</h4>
                {quarantineResult ? (
                  <div className="space-y-3 text-xs">
                    <div className={`p-3 rounded-lg border font-bold flex items-center gap-2 ${
                      quarantineResult.isCompliant
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : "bg-rose-50 border-rose-300 text-rose-900"
                    }`}>
                      {quarantineResult.isCompliant ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          <span>AN TOÀN HÀNG KHÔNG (SAFE): Đạt chuẩn kiểm dịch MAFF và IATA.</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                          <span>CẢNH BÁO ĐỎ: Phát hiện mặt hàng cấm ({quarantineResult.maffStatus.flaggedKeywords.join(", ")})!</span>
                        </>
                      )}
                    </div>

                    {/* Thẩm định thể tích IATA */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
                      <div className="font-bold text-slate-800">Quy chuẩn thể tích IATA (D x R x C / 5000):</div>
                      <div className="flex justify-between text-slate-600">
                        <span>Cân nặng thực tế:</span>
                        <b>{quarantineResult.volumetricIata.actualWeightKg} kg</b>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Cân nặng quy đổi thể tích:</span>
                        <b>{quarantineResult.volumetricIata.volumetricWeightKg} kg</b>
                      </div>
                      <div className="flex justify-between text-slate-900 pt-1 border-t border-slate-100 font-bold">
                        <span>Cân nặng tính cước bay:</span>
                        <span className="text-violet-700">{quarantineResult.volumetricIata.chargeableWeightKg} kg</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Đề xuất cỡ thùng:</span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold">{quarantineResult.volumetricIata.suggestedBox}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Mã HS Code gợi ý:</span>
                        <span className="font-mono font-bold text-slate-700">{quarantineResult.hsCodeSuggested}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Nhập thông tin kiện hàng và bấm quét để xem kết quả thẩm định MAFF/IATA.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3 Content: Financial Audit Agent */}
        {activeAgentTab === "agent:financial_audit" && (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BadgeDollarSign className="w-5 h-5 text-emerald-600" />
                <span>Kiểm Toán Tài Chính, Đối Soát Giao Dịch & Thu Số Dư Kho VN</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Kiểm tra tỷ lệ cọc 3 bậc, đối soát thanh toán, tất toán số dư đợt 2 tại WAREHOUSE_VN để kích hoạt PAID_100.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Kiểm tra cọc 3 bậc */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Kiểm toán tỷ lệ cọc 3 bậc</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-slate-700">Tổng tiền đơn (VND):</label>
                    <input
                      type="number"
                      value={testOrderTotalVnd}
                      onChange={(e) => setTestOrderTotalVnd(Number(e.target.value))}
                      className="mt-1 w-full text-xs px-3 py-2 border rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Tiền cọc thực thu (VND):</label>
                    <input
                      type="number"
                      value={testDepositVnd}
                      onChange={(e) => setTestDepositVnd(Number(e.target.value))}
                      className="mt-1 w-full text-xs px-3 py-2 border rounded bg-white"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCheckDepositTier}
                  className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition"
                >
                  Kiểm Tra Tuân Thủ Cọc 3 Bậc
                </button>

                {tierCheckResult && (
                  <div className={`p-3 rounded-lg border text-xs space-y-1 ${
                    tierCheckResult.isCompliant ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-amber-50 border-amber-200 text-amber-900"
                  }`}>
                    <div className="font-bold">
                      {tierCheckResult.isCompliant ? "✓ ĐÚNG CHÍNH SÁCH 3 BẬC" : "⚠ LỆCH CHÍNH SÁCH CỌC"}
                    </div>
                    <div>Phân loại: <b>Tier {tierCheckResult.depositTier}</b> ({tierCheckResult.expectedDepositPercent}%)</div>
                    <div>Cọc chuẩn quy định: <b>{tierCheckResult.expectedDepositVnd?.toLocaleString()} đ</b></div>
                    <div>Thực thu: <b>{tierCheckResult.actualDepositAmountVnd?.toLocaleString()} đ</b></div>
                  </div>
                )}
              </div>

              {/* Thu số dư đợt 2 Kho VN */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Tất toán số dư đợt 2 (Kho VN ➔ PAID_100)</h4>
                <p className="text-xs text-slate-500">
                  Nhập ID đơn hàng để kiểm toán tài chính hoặc xác nhận thu số dư còn lại khi hàng về tới Việt Nam.
                </p>
                <div>
                  <label className="text-xs font-medium text-slate-700">Order ID:</label>
                  <input
                    type="text"
                    value={auditOrderId}
                    onChange={(e) => setAuditOrderId(e.target.value)}
                    className="mt-1 w-full text-xs px-3 py-2 border rounded bg-white"
                    placeholder="VD: clxx12345"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAuditOrder}
                    disabled={auditLoading}
                    className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                  >
                    Kiểm Toán Đơn Hàng
                  </button>
                  <button
                    onClick={handleSettleBalance}
                    disabled={auditLoading}
                    className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                  >
                    Tất Toán Số Dư Đợt 2
                  </button>
                </div>

                {auditResult && (
                  <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1.5">
                    <div className="font-bold text-slate-800">Kết quả kiểm toán tài chính:</div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Tổng giá trị đơn:</span>
                      <b>{auditResult.orderTotalVnd?.toLocaleString()} đ</b>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Đã thanh toán:</span>
                      <b>{auditResult.paidAmountVnd?.toLocaleString()} đ</b>
                    </div>
                    <div className="flex justify-between pt-1 border-t text-amber-700 font-bold">
                      <span>Số dư đợt 2 còn thiếu:</span>
                      <span>{auditResult.warehouseVnBalance?.remainingGoodsBalanceVnd?.toLocaleString()} đ</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Được phép xuất giao hàng:</span>
                      <span className={`font-bold ${auditResult.warehouseVnBalance?.canReleaseToDelivery ? "text-emerald-600" : "text-rose-600"}`}>
                        {auditResult.warehouseVnBalance?.canReleaseToDelivery ? "ĐÃ MỞ KHÓA (PAID_100)" : "CHẶN GIAO (CHƯA ĐỦ TIỀN)"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4 Content: Executive Assistant */}
        {activeAgentTab === "agent:executive_assistant" && (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Compass className="w-5 h-5 text-indigo-600" />
                <span>Bảng Điểm Vận Hành & Khơi Thông Điểm Nghẽn (One-Click Dispatch)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Trợ lý Giám đốc vận hành phát hiện các đơn hàng đứng yên, tải kho Tokyo / kho VN và đề xuất hành động.
              </p>
            </div>

            {/* Scorecard Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <div className="text-[11px] font-semibold text-slate-500">Thông Lượng Hệ Thống</div>
                <div className="text-xl font-extrabold text-violet-700 mt-1">{scorecard?.throughputScore || 96}%</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <div className="text-[11px] font-semibold text-slate-500">Tải Kho Tokyo</div>
                <div className="text-xl font-extrabold text-indigo-700 mt-1">{scorecard?.tokyoWarehouseLoadPercent || 15}%</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <div className="text-[11px] font-semibold text-slate-500">Tải Kho Việt Nam</div>
                <div className="text-xl font-extrabold text-sky-700 mt-1">{scorecard?.vnWarehouseLoadPercent || 20}%</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <div className="text-[11px] font-semibold text-slate-500">Đơn Đứng Yên &gt; 48h</div>
                <div className="text-xl font-extrabold text-amber-600 mt-1">{scorecard?.stagnantOrdersCount48h || 0}</div>
              </div>
            </div>

            {/* Bottlenecks & One-Click Dispatch */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Các Điểm Nghẽn Đang Cần Khơi Thông</span>
              </h4>

              {dispatchMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{dispatchMessage}</span>
                </div>
              )}

              {scorecard?.bottlenecks && scorecard.bottlenecks.length > 0 ? (
                <div className="space-y-3">
                  {scorecard.bottlenecks.map((bn: any) => (
                    <div
                      key={bn.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            bn.severity === "CRITICAL"
                              ? "bg-rose-100 text-rose-800"
                              : bn.severity === "HIGH"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}>
                            {bn.severity}
                          </span>
                          <span className="font-bold text-xs text-slate-900">{bn.title}</span>
                          <span className="text-[11px] text-slate-500">({bn.affectedOrdersCount} đơn)</span>
                        </div>
                        <p className="text-xs text-slate-600">{bn.description}</p>
                        <p className="text-[11px] text-violet-700 font-medium">💡 Đề xuất: {bn.recommendedAction}</p>
                      </div>
                      <button
                        onClick={() => handleDispatchAction(bn.dispatchActionName)}
                        disabled={dispatchLoading}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold transition shrink-0 self-start sm:self-auto disabled:opacity-50"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Kích Hoạt 1-Click</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
                  Không phát hiện điểm nghẽn nghiêm trọng. Toàn bộ chuỗi vận hành đang lưu thông trơn tru.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. REALTIME AUDIT STREAM */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Nhật Ký Quyết Định AI Thời Gian Thực (Audit Stream)</h2>
              <p className="text-xs text-slate-500">Mọi hành động của AI Agent đều được ghi nhận bất biến vào AuditLog</p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Tự động đồng bộ</span>
        </div>

        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {recentLogs.length > 0 ? (
            recentLogs.map((log: any) => (
              <div key={log.id} className="py-2.5 flex items-start justify-between gap-4 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                      {log.actor}
                    </span>
                    <span className="font-bold text-slate-800">{log.action}</span>
                  </div>
                  <p className="text-slate-600 text-xs">{log.summary}</p>
                </div>
                <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleTimeString("vi-VN")}
                </span>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-slate-400 text-xs">
              Chưa có nhật ký audit log nào từ các AI Agent.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
