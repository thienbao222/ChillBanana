import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  AgentExecutionRequest,
  AgentExecutionResult,
  WorkspaceOverviewData,
  AgentCardInfo,
} from "../types";
import { purchasingAgent } from "../agents/purchasing-agent";
import { quarantineAgent } from "../agents/quarantine-agent";
import { financialAuditAgent } from "../agents/financial-audit-agent";
import { executiveAssistantAgent } from "../agents/executive-assistant-agent";

export class AgentOrchestrator {
  /**
   * Cung cấp danh sách 4 Agent chuyên trách và thẻ thông tin trạng thái.
   */
  public getAgentRoster(): AgentCardInfo[] {
    return [
      {
        id: "agent:purchasing",
        type: "PURCHASING",
        name: "AI Purchasing Specialist",
        roleTitle: "Chuyên viên Thẩm định Sàn Nhật & Mua hàng Tokyo",
        avatarIcon: "ShoppingBag",
        status: "ONLINE",
        statusBadge: "Sẵn sàng",
        activeTasksCount: 3,
        completedTasksCount: 142,
        successRate: 99.2,
        lastActive: "Vừa xong",
        description: "Bóc tách link Mercari/Rakuten/Yahoo/Amazon JP, đánh giá seller, tự động tạo PurchaseTask và sinh mã vận đơn JP.",
        specialties: ["Mercari & Yahoo Bidding", "Cào giá tỷ giá JPY live", "Yamato/Sagawa JP Tracking"],
      },
      {
        id: "agent:quarantine",
        type: "QUARANTINE_COMPLIANCE",
        name: "AI Quarantine & Aviation Safety",
        roleTitle: "Kiểm dịch Nông nghiệp MAFF & An ninh Bay IATA",
        avatarIcon: "ShieldAlert",
        status: "ONLINE",
        statusBadge: "Giám sát 24/7",
        activeTasksCount: 0,
        completedTasksCount: 388,
        successRate: 100,
        lastActive: "1 phút trước",
        description: "Rà soát hàng cấm bay (pin lithium, bình xịt) và thực phẩm cấm MAFF (ruốc, xúc xích, thịt gia súc), tính cân IATA.",
        specialties: ["MAFF Animal & Plant Quarantine", "IATA DGR Hazmat", "Tờ khai hải quan CN23"],
      },
      {
        id: "agent:financial_audit",
        type: "FINANCIAL_AUDIT",
        name: "AI Financial Auditor",
        roleTitle: "Kiểm toán Tài chính & Thu số dư Kho VN",
        avatarIcon: "BadgeDollarSign",
        status: "ONLINE",
        statusBadge: "Đối soát tự động",
        activeTasksCount: 2,
        completedTasksCount: 215,
        successRate: 99.8,
        lastActive: "3 phút trước",
        description: "Kiểm toán cọc 3 bậc, đối soát VietQR/VNPAY, tất toán số dư đợt 2 tại kho Việt Nam để kích hoạt PAID_100.",
        specialties: ["Kiểm toán cọc 3 bậc", "Thu số dư đợt 2 (Kho VN)", "Phát hiện âm biên lợi nhuận"],
      },
      {
        id: "agent:executive_assistant",
        type: "EXECUTIVE_ASSISTANT",
        name: "AI Operations Director",
        roleTitle: "Giám đốc Vận hành Tự động",
        avatarIcon: "Compass",
        status: "ONLINE",
        statusBadge: "Điều phối trung tâm",
        activeTasksCount: 1,
        completedTasksCount: 94,
        successRate: 98.7,
        lastActive: "Vừa xong",
        description: "Tổng hợp bức tranh vận hành toàn diện (Scorecard), phát hiện điểm nghẽn và kích hoạt One-Click Dispatch.",
        specialties: ["Bảng điểm vận hành BI", "Nhận diện đơn kẹt 48h", "One-Click Dispatch"],
      },
    ];
  }

  /**
   * Tổng hợp bức tranh tổng quan của AI Workspace cho Dashboard.
   */
  public async getWorkspaceOverview(): Promise<WorkspaceOverviewData> {
    const agents = this.getAgentRoster();
    const scorecard = await executiveAssistantAgent.generateOperationsScorecard();

    // Lấy 15 nhật ký AuditLog gần nhất có actor là AI agent hoặc tác vụ AI
    const rawLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { actor: { startsWith: "agent:" } },
          { actorType: "SYSTEM" },
          { action: { startsWith: "AI_" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    });

    const recentAuditLogs = rawLogs.map((log) => ({
      id: log.id,
      actor: log.actor,
      action: log.action,
      summary: log.summary || "Thực thi tác vụ AI không có mô tả",
      entityId: log.entityId || undefined,
      createdAt: log.createdAt.toISOString(),
      metadata: (log.metadata as Record<string, unknown>) || undefined,
    }));

    const p = scorecard.pipelineCounts;

    return {
      agents,
      pipeline: {
        stages: [
          { id: "s1", label: "1. Tạo đơn & Duyệt cọc", agentAssigned: "agent:financial_audit", count: p.pendingDeposit, status: p.pendingDeposit > 10 ? "CONGESTED" : "HEALTHY" },
          { id: "s2", label: "2. Rà soát kiểm dịch", agentAssigned: "agent:quarantine", count: p.depositPaid, status: "HEALTHY" },
          { id: "s3", label: "3. Mua hàng Tokyo", agentAssigned: "agent:purchasing", count: p.purchasingQueue, status: "HEALTHY" },
          { id: "s4", label: "4. Nhập kho Tokyo", agentAssigned: "agent:purchasing", count: p.warehouseJp, status: "HEALTHY" },
          { id: "s5", label: "5. Vận chuyển bay", agentAssigned: "agent:quarantine", count: p.inTransitAir, status: "HEALTHY" },
          { id: "s6", label: "6. Thu số dư Kho VN", agentAssigned: "agent:financial_audit", count: p.warehouseVn, status: p.warehouseVn > 5 ? "ATTENTION" : "HEALTHY" },
          { id: "s7", label: "7. Giao hàng nội địa", agentAssigned: "agent:executive_assistant", count: p.localDelivery, status: "HEALTHY" },
        ],
      },
      scorecard,
      recentAuditLogs,
    };
  }

  /**
   * Điều phối và thực thi hành động của Agent, tự động ghi AuditLog bất biến.
   */
  public async executeAgentAction(request: AgentExecutionRequest): Promise<AgentExecutionResult> {
    const { agentId, action, targetId, params, triggeredBy } = request;
    let executionResult: AgentExecutionResult;

    try {
      switch (agentId) {
        case "agent:purchasing": {
          if (action === "ANALYZE_PRODUCT_URL") {
            const url = (params?.url as string) || "";
            const priceJpy = typeof params?.priceJpy === "number" ? params.priceJpy : 5000;
            const analysis = purchasingAgent.analyzeProductUrl(url, priceJpy);
            executionResult = {
              success: true,
              agentId,
              action,
              timestamp: new Date().toISOString(),
              targetId,
              summary: `Thẩm định link ${analysis.platform.toUpperCase()}: Điểm uy tín ${analysis.sellerReliability.score}/100 (${analysis.sellerReliability.rating}).`,
              details: analysis,
            };
          } else if (action === "CREATE_PURCHASE_TASK") {
            executionResult = await purchasingAgent.createPurchaseTask(targetId || "");
          } else if (action === "AUTO_PURCHASE_ORDER") {
            executionResult = await purchasingAgent.executeAutoPurchase(targetId || "", {
              trackingCarrier: params?.trackingCarrier as "yamato" | "sagawa" | undefined,
              customSupplierOrderId: params?.customSupplierOrderId as string | undefined,
            });
          } else if (action === "ASSIGN_JP_TRACKING") {
            executionResult = await purchasingAgent.assignJpTracking(
              targetId || "",
              params?.jpTrackingCode as string | undefined
            );
          } else {
            throw new Error(`Hành động không hợp lệ cho Purchasing Agent: ${action}`);
          }
          break;
        }

        case "agent:quarantine": {
          if (action === "SCREEN_COMPLIANCE") {
            if (targetId) {
              executionResult = await quarantineAgent.inspectOrderCompliance(targetId);
            } else {
              const text = (params?.text as string) || "";
              const screening = quarantineAgent.screenTextCompliance(text, params?.dimensions as never);
              executionResult = {
                success: true,
                agentId,
                action,
                timestamp: new Date().toISOString(),
                summary: screening.isCompliant
                  ? "Rà soát kiểm dịch MAFF & IATA: AN TOÀN (SAFE)."
                  : `PHÁT HIỆN HÀNG CẤM: ${screening.maffStatus.flaggedKeywords.join(", ")}`,
                details: screening,
              };
            }
          } else if (action === "CALCULATE_IATA_VOLUMETRIC") {
            const actualW = Number(params?.actualWeightKg) || 1;
            const l = Number(params?.lengthCm) || 20;
            const w = Number(params?.widthCm) || 15;
            const h = Number(params?.heightCm) || 10;
            const volResult = quarantineAgent.calculateIataVolumetric(actualW, l, w, h);
            executionResult = {
              success: true,
              agentId,
              action,
              timestamp: new Date().toISOString(),
              summary: `Quy đổi IATA: Cân thực ${actualW}kg vs Cân thể tích ${volResult.volumetricWeightKg}kg -> Tính cước ${volResult.chargeableWeightKg}kg (${volResult.suggestedBox}).`,
              details: volResult,
            };
          } else {
            throw new Error(`Hành động không hợp lệ cho Quarantine Agent: ${action}`);
          }
          break;
        }

        case "agent:financial_audit": {
          if (action === "AUDIT_TRANSACTIONS") {
            executionResult = await financialAuditAgent.auditOrderFinancials(targetId || "");
          } else if (action === "CHECK_DEPOSIT_TIER") {
            const total = Number(params?.orderTotalVnd) || 0;
            const deposit = Number(params?.actualDepositAmountVnd) || 0;
            const check = financialAuditAgent.verifyDepositTier(total, deposit);
            executionResult = {
              success: true,
              agentId,
              action,
              timestamp: new Date().toISOString(),
              summary: check.isCompliant
                ? `Kiểm tra cọc 3 bậc: HỢP LỆ (Tier ${check.depositTier} - ${check.expectedDepositPercent}%).`
                : `LỆCH CỌC: Thu ${deposit.toLocaleString()} đ thay vì ${check.expectedDepositVnd.toLocaleString()} đ.`,
              details: check,
            };
          } else if (action === "SETTLE_WAREHOUSE_VN_BALANCE") {
            executionResult = await financialAuditAgent.settleWarehouseVnBalance(targetId || "", {
              provider: params?.provider as string | undefined,
              reference: params?.reference as string | undefined,
              note: params?.note as string | undefined,
            });
          } else if (action === "DETECT_FINANCIAL_ANOMALIES") {
            executionResult = await financialAuditAgent.detectSystemFinancialAnomalies();
          } else {
            throw new Error(`Hành động không hợp lệ cho Financial Audit Agent: ${action}`);
          }
          break;
        }

        case "agent:executive_assistant": {
          if (action === "GENERATE_OPERATIONS_SCORECARD") {
            const scorecard = await executiveAssistantAgent.generateOperationsScorecard();
            executionResult = {
              success: true,
              agentId,
              action,
              timestamp: new Date().toISOString(),
              summary: `Bảng điểm vận hành hoàn tất: Thông lượng ${scorecard.throughputScore}%, ${scorecard.bottlenecks.length} điểm nghẽn.`,
              details: scorecard,
            };
          } else if (action === "DISPATCH_ACTION") {
            const dispatchActionName = (params?.dispatchActionName as string) || "DISPATCH_EXPEDITE";
            executionResult = await executiveAssistantAgent.dispatchAction(dispatchActionName, params);
          } else {
            throw new Error(`Hành động không hợp lệ cho Executive Assistant Agent: ${action}`);
          }
          break;
        }

        default:
          throw new Error(`Mã Agent không được hỗ trợ: ${agentId}`);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      executionResult = {
        success: false,
        agentId,
        action,
        timestamp: new Date().toISOString(),
        targetId,
        summary: `Lỗi thực thi tác tử ${agentId}: ${errMsg}`,
        warnings: [errMsg],
      };
    }

    // Tự động ghi nhật ký kiểm toán bất biến vào AuditLog
    await writeAuditLog({
      actor: agentId,
      actorType: "SYSTEM",
      action: `AI_${action}`,
      entityType: targetId ? "ORDER" : "SYSTEM",
      entityId: targetId || undefined,
      summary: executionResult.summary,
      metadata: {
        agentId,
        action,
        triggeredBy: triggeredBy || "ADMIN_CONSOLE",
        success: executionResult.success,
        details: executionResult.details,
      },
    });

    return executionResult;
  }
}

export const agentOrchestrator = new AgentOrchestrator();
