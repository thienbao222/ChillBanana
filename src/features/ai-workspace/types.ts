// Types định nghĩa cho Agentic AI Workspace (R4)
// Tác tử Thông minh Chuyên trách ChillBanana

export type AgentId =
  | "agent:purchasing"
  | "agent:quarantine"
  | "agent:financial_audit"
  | "agent:executive_assistant";

export type AgentType =
  | "PURCHASING"
  | "QUARANTINE_COMPLIANCE"
  | "FINANCIAL_AUDIT"
  | "EXECUTIVE_ASSISTANT";

export type AgentStatus = "ONLINE" | "BUSY" | "IDLE" | "ERROR";

export interface AgentCardInfo {
  id: AgentId;
  type: AgentType;
  name: string;
  roleTitle: string;
  avatarIcon: string; // Tên icon hiển thị
  status: AgentStatus;
  statusBadge: string;
  activeTasksCount: number;
  completedTasksCount: number;
  successRate: number; // e.g. 99.4%
  lastActive: string;
  description: string;
  specialties: string[];
}

// ==========================================
// ACTIONS & EXECUTION REQUESTS
// ==========================================

export type PurchasingAgentAction =
  | "ANALYZE_PRODUCT_URL"
  | "CREATE_PURCHASE_TASK"
  | "AUTO_PURCHASE_ORDER"
  | "ASSIGN_JP_TRACKING"
  | "VERIFY_QUOTE";

export type QuarantineAgentAction =
  | "SCREEN_COMPLIANCE"
  | "INSPECT_MAFF"
  | "CALCULATE_IATA_VOLUMETRIC"
  | "GENERATE_CN23_DECLARATION";

export type FinancialAuditAgentAction =
  | "AUDIT_TRANSACTIONS"
  | "CHECK_DEPOSIT_TIER"
  | "SETTLE_WAREHOUSE_VN_BALANCE"
  | "DETECT_FINANCIAL_ANOMALIES";

export type ExecutiveAssistantAgentAction =
  | "GENERATE_OPERATIONS_SCORECARD"
  | "DETECT_BOTTLENECK"
  | "DISPATCH_ACTION"
  | "OPTIMIZE_PIPELINE";

export type AgentAction =
  | PurchasingAgentAction
  | QuarantineAgentAction
  | FinancialAuditAgentAction
  | ExecutiveAssistantAgentAction
  | string;

export interface AgentExecutionRequest {
  agentId: AgentId;
  action: AgentAction;
  targetId?: string; // e.g. orderId, taskId, shipmentId
  params?: Record<string, unknown>;
  triggeredBy?: string; // username của Admin ra lệnh
}

export interface AgentExecutionResult<TData = unknown> {
  success: boolean;
  agentId: AgentId;
  action: AgentAction;
  timestamp: string;
  targetId?: string;
  summary: string;
  details?: TData;
  warnings?: string[];
  recommendations?: string[];
  auditLogId?: string;
}

// ==========================================
// DOMAIN-SPECIFIC AGENT DATA STRUCTURES
// ==========================================

// 1. Purchasing Agent
export interface JapaneseProductAnalysis {
  url: string;
  platform: "mercari" | "rakuten" | "yahoo_jp" | "amazon_jp" | "unknown";
  sellerReliability: {
    score: number; // 0 - 100
    rating: "EXCELLENT" | "GOOD" | "RISKY" | "WARNING";
    reviewsCount?: number;
    badgeNote?: string;
  };
  itemCondition: "BRAND_NEW" | "LIKE_NEW" | "USED_GOOD" | "JUNK" | "UNKNOWN";
  estimatedDomesticShippingJpy: number; // 0 nếu free ship
  isFreeDomesticShipping: boolean;
  estimatedPriceJpy: number;
  estimatedPriceVnd: number;
  exchangeRateUsed: number;
  risksIdentified: string[];
  isEligibleForAutoPurchase: boolean;
}

export interface AutoPurchaseResult {
  orderId: string;
  purchaseTaskId?: string;
  jpTrackingCode: string;
  status: "PURCHASED" | "IN_TRANSIT_JP";
  supplierOrderCode: string;
  purchasePriceJpy: number;
  purchasedAt: string;
}

// 2. Quarantine & Compliance Agent
export interface ComplianceScreeningResult {
  targetId: string;
  isCompliant: boolean;
  riskLevel: "SAFE" | "CONDITIONAL" | "PROHIBITED";
  maffStatus: {
    isMaffProhibited: boolean;
    flaggedKeywords: string[];
    regulationsViolated: string[];
    actionRequiredVi: string;
  };
  iataStatus: {
    isIataDangerousGoods: boolean;
    batteryDetected: boolean;
    flammableDetected: boolean;
    pressureDetected: boolean;
    hazmatCategory?: string;
  };
  volumetricIata: {
    actualWeightKg: number;
    dimensionsCm: { length: number; width: number; height: number };
    volumetricWeightKg: number; // (L * W * H) / 5000
    chargeableWeightKg: number; // Math.max(actual, volumetric)
    suggestedBox: "BOX_S" | "BOX_M" | "BOX_L" | "CUSTOM";
  };
  hsCodeSuggested?: string;
  cn23Declaration?: {
    category: "GIFT" | "COMMERCIAL_SAMPLE" | "DOCUMENTS";
    englishDescription: string;
    hsCode: string;
    originCountry: string;
    weightKg: number;
    valueJpy: number;
  };
}

// 3. Financial Audit Agent
export interface FinancialAuditSummary {
  orderId: string;
  orderTotalVnd: number;
  depositAmountVnd: number;
  paidAmountVnd: number;
  depositTier: "LOW" | "STANDARD" | "HIGH";
  expectedDepositPercent: number;
  actualDepositPercent: number;
  isDepositCorrect: boolean;
  warehouseVnBalance: {
    remainingGoodsBalanceVnd: number;
    totalRemainingVnd: number;
    isFullySettled: boolean;
    canReleaseToDelivery: boolean;
  };
  anomalies: Array<{
    type: "UNDER_DEPOSIT" | "UNPAID_BALANCE" | "NEGATIVE_MARGIN" | "SUSPICIOUS_TX" | "COST_OVERRUN";
    severity: "INFO" | "WARNING" | "CRITICAL";
    message: string;
  }>;
}

// 4. Executive Assistant Agent
export interface OperationsScorecard {
  generatedAt: string;
  pipelineCounts: {
    pendingDeposit: number;
    depositPaid: number;
    purchasingQueue: number;
    warehouseJp: number;
    inTransitAir: number;
    warehouseVn: number;
    localDelivery: number;
    completed: number;
  };
  bottlenecks: Array<{
    id: string;
    title: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    affectedOrdersCount: number;
    description: string;
    recommendedAction: string;
    dispatchActionName: string;
    dispatchPayload?: Record<string, unknown>;
  }>;
  throughputScore: number; // 0 - 100
  tokyoWarehouseLoadPercent: number;
  vnWarehouseLoadPercent: number;
  stagnantOrdersCount48h: number;
}

// ==========================================
// OVERVIEW API RESPONSE
// ==========================================

export interface WorkspaceOverviewData {
  agents: AgentCardInfo[];
  pipeline: {
    stages: Array<{
      id: string;
      label: string;
      agentAssigned: AgentId;
      count: number;
      status: "HEALTHY" | "ATTENTION" | "CONGESTED";
    }>;
  };
  scorecard: OperationsScorecard;
  recentAuditLogs: Array<{
    id: string;
    actor: string;
    action: string;
    summary: string;
    entityId?: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
  }>;
}
