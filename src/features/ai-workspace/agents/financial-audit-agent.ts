import { prisma } from "@/lib/prisma";
import {
  AgentId,
  FinancialAuditSummary,
  AgentExecutionResult,
} from "../types";
import {
  calculateDepositV2,
  calculateWarehouseVnBalance,
} from "@/features/payments/policy";

export class FinancialAuditAgent {
  public readonly id: AgentId = "agent:financial_audit";
  public readonly name = "AI Financial Auditor";
  public readonly description = "Tác tử Kiểm toán Tài chính, Đối soát Giao dịch & Thu số dư Kho VN";

  /**
   * Kiểm tra tính tuân thủ của tỷ lệ đặt cọc 3 bậc (WP3.3 / R4).
   * - < 1.000.000 đ: 100%
   * - 1.000.000 - 10.000.000 đ: 70%
   * - > 10.000.000 đ: 50%
   */
  public verifyDepositTier(orderTotalVnd: number, actualDepositAmountVnd: number) {
    const policyResult = calculateDepositV2(orderTotalVnd);
    const expectedDepositVnd = policyResult.depositAmountVnd;
    const diffVnd = Math.abs(actualDepositAmountVnd - expectedDepositVnd);
    const isCompliant = diffVnd <= 1000; // Cho phép sai số làm tròn 1.000 VND

    return {
      orderTotalVnd,
      actualDepositAmountVnd,
      expectedDepositVnd,
      depositTier: policyResult.tier,
      expectedDepositPercent: policyResult.depositPercent,
      actualDepositPercent: orderTotalVnd > 0 ? Math.round((actualDepositAmountVnd / orderTotalVnd) * 100) : 0,
      isCompliant,
      differenceVnd: diffVnd,
    };
  }

  /**
   * Kiểm toán tài chính toàn diện cho một đơn hàng.
   */
  public async auditOrderFinancials(orderId: string): Promise<AgentExecutionResult<FinancialAuditSummary>> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        paymentTransactions: true,
        costLines: true,
      },
    });

    if (!order) {
      return {
        success: false,
        agentId: this.id,
        action: "AUDIT_TRANSACTIONS",
        timestamp: new Date().toISOString(),
        targetId: orderId,
        summary: `Không tìm thấy đơn hàng ID: ${orderId}`,
      };
    }

    const totalPaidFromTx = order.paymentTransactions
      .filter((tx) => tx.status === "CONFIRMED")
      .reduce((sum, tx) => sum + tx.amountVnd, 0);

    const paidAmount = totalPaidFromTx > 0 ? totalPaidFromTx : order.depositAmountVnd;
    const depositAudit = this.verifyDepositTier(order.totalVnd, order.depositAmountVnd);

    const balanceCheck = calculateWarehouseVnBalance({
      totalVnd: order.totalVnd,
      paidAmountVnd: paidAmount,
    });

    const anomalies: FinancialAuditSummary["anomalies"] = [];

    // Kiểm tra cọc thiếu
    if (!depositAudit.isCompliant && order.paymentStatus !== "PAID_100") {
      anomalies.push({
        type: "UNDER_DEPOSIT",
        severity: "WARNING",
        message: `Đơn hàng cọc chưa đúng chính sách 3 bậc: Thu ${order.depositAmountVnd.toLocaleString("vi-VN")} đ thay vì ${depositAudit.expectedDepositVnd.toLocaleString("vi-VN")} đ.`,
      });
    }

    // Kiểm tra số dư tại Kho VN
    if (order.status === "WAREHOUSE_VN" && !balanceCheck.isFullySettled) {
      anomalies.push({
        type: "UNPAID_BALANCE",
        severity: "WARNING",
        message: `Hàng đã về Kho VN nhưng khách chưa thanh toán nốt số dư ${balanceCheck.remainingGoodsBalanceVnd.toLocaleString("vi-VN")} đ. CHƯA ĐƯỢC PHÉP XUẤT GIAO HÀNG.`,
      });
    }

    // Kiểm tra âm biên lợi nhuận
    const totalActualCost = order.costLines.reduce((sum, line) => sum + line.amountVnd, 0);
    if (totalActualCost > 0 && order.totalVnd < totalActualCost) {
      anomalies.push({
        type: "NEGATIVE_MARGIN",
        severity: "CRITICAL",
        message: `Đơn hàng âm biên lợi nhuận! Tổng thu ${order.totalVnd.toLocaleString("vi-VN")} đ < Tổng chi thực tế ${totalActualCost.toLocaleString("vi-VN")} đ (Lỗ ${(totalActualCost - order.totalVnd).toLocaleString("vi-VN")} đ).`,
      });
    }

    const summaryData: FinancialAuditSummary = {
      orderId: order.id,
      orderTotalVnd: order.totalVnd,
      depositAmountVnd: order.depositAmountVnd,
      paidAmountVnd: paidAmount,
      depositTier: depositAudit.depositTier,
      expectedDepositPercent: depositAudit.expectedDepositPercent,
      actualDepositPercent: depositAudit.actualDepositPercent,
      isDepositCorrect: depositAudit.isCompliant,
      warehouseVnBalance: {
        remainingGoodsBalanceVnd: balanceCheck.remainingGoodsBalanceVnd,
        totalRemainingVnd: balanceCheck.totalRemainingVnd,
        isFullySettled: balanceCheck.isFullySettled,
        canReleaseToDelivery: balanceCheck.isFullySettled || order.paymentStatus === "PAID_100",
      },
      anomalies,
    };

    return {
      success: true,
      agentId: this.id,
      action: "AUDIT_TRANSACTIONS",
      timestamp: new Date().toISOString(),
      targetId: orderId,
      summary: anomalies.length === 0
        ? `Đơn hàng #${order.orderCode} kiểm toán tài chính ĐẠT 100%. Không có bất thường.`
        : `Phát hiện ${anomalies.length} vấn đề tài chính trên đơn #${order.orderCode}.`,
      details: summaryData,
      warnings: anomalies.map((a) => a.message),
      recommendations: balanceCheck.remainingGoodsBalanceVnd > 0
        ? [`Mở link thu số dư đợt 2: ${balanceCheck.remainingGoodsBalanceVnd.toLocaleString("vi-VN")} VND`]
        : ["Đơn hàng đủ điều kiện phát hàng nội địa"],
    };
  }

  /**
   * Tất toán số dư đợt 2 tại WAREHOUSE_VN:
   * - Tạo bản ghi PaymentTransaction với kind="BALANCE"
   * - Đổi trạng thái paymentStatus thành PAID_100
   * - Mở khóa chuyển trạng thái sang LOCAL_DELIVERY
   */
  public async settleWarehouseVnBalance(
    orderId: string,
    options?: { provider?: string; reference?: string; note?: string }
  ): Promise<AgentExecutionResult> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { paymentTransactions: true },
    });

    if (!order) {
      return {
        success: false,
        agentId: this.id,
        action: "SETTLE_WAREHOUSE_VN_BALANCE",
        timestamp: new Date().toISOString(),
        targetId: orderId,
        summary: `Không tìm thấy đơn hàng ID: ${orderId}`,
      };
    }

    const totalPaidSoFar = order.paymentTransactions
      .filter((tx) => tx.status === "CONFIRMED")
      .reduce((sum, tx) => sum + tx.amountVnd, 0);

    const paidBase = totalPaidSoFar > 0 ? totalPaidSoFar : order.depositAmountVnd;
    const balanceCalc = calculateWarehouseVnBalance({
      totalVnd: order.totalVnd,
      paidAmountVnd: paidBase,
    });

    if (balanceCalc.isFullySettled || order.paymentStatus === "PAID_100") {
      return {
        success: true,
        agentId: this.id,
        action: "SETTLE_WAREHOUSE_VN_BALANCE",
        timestamp: new Date().toISOString(),
        targetId: orderId,
        summary: `Đơn hàng #${order.orderCode} đã thanh toán đủ 100% trước đó (PAID_100). Không cần thu thêm.`,
      };
    }

    const remainingToCollect = balanceCalc.remainingGoodsBalanceVnd;
    const provider = options?.provider || "VIETQR";
    const refCode = options?.reference || `BAL-VN-${Date.now().toString().slice(-8)}`;

    // Tạo bản ghi giao dịch số dư và cập nhật trạng thái đơn
    await prisma.$transaction([
      prisma.paymentTransaction.create({
        data: {
          orderId: order.id,
          provider,
          amountVnd: remainingToCollect,
          status: "CONFIRMED",
          kind: "BALANCE",
          reference: refCode,
          note: options?.note || `Thu số dư đợt 2 tại Kho VN được xác minh bởi ${this.name}`,
        },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "PAID_100",
          depositAmountVnd: order.totalVnd,
        },
      }),
    ]);

    return {
      success: true,
      agentId: this.id,
      action: "SETTLE_WAREHOUSE_VN_BALANCE",
      timestamp: new Date().toISOString(),
      targetId: orderId,
      summary: `Tất toán thành công ${remainingToCollect.toLocaleString("vi-VN")} VND cho đơn #${order.orderCode}. Đã kích hoạt PAID_100 và mở khóa giao hàng LOCAL_DELIVERY.`,
      details: {
        orderId: order.id,
        collectedAmountVnd: remainingToCollect,
        previousPaidVnd: paidBase,
        newPaymentStatus: "PAID_100",
        reference: refCode,
        canDispatchLocalDelivery: true,
      },
      recommendations: [
        "Đơn hàng đã đủ điều kiện 100% để bàn giao cho đơn vị vận chuyển nội địa (GHTK/GHN)",
      ],
    };
  }

  /**
   * Phát hiện bất thường tài chính toàn hệ thống.
   */
  public async detectSystemFinancialAnomalies(): Promise<AgentExecutionResult> {
    const ordersWithCosts = await prisma.order.findMany({
      where: {
        status: { notIn: ["CANCELLED", "REFUNDED"] },
      },
      take: 50,
      include: {
        costLines: true,
        paymentTransactions: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const issues: Array<{ orderCode: string; issue: string; severity: "WARNING" | "CRITICAL" }> = [];

    for (const ord of ordersWithCosts) {
      const totalCost = ord.costLines.reduce((s, c) => s + c.amountVnd, 0);
      if (totalCost > 0 && ord.totalVnd < totalCost) {
        issues.push({
          orderCode: ord.orderCode,
          issue: `Âm biên lợi nhuận: Thu ${ord.totalVnd.toLocaleString()} đ < Chi ${totalCost.toLocaleString()} đ`,
          severity: "CRITICAL",
        });
      }
      if (ord.status === "LOCAL_DELIVERY" && ord.paymentStatus !== "PAID_100") {
        issues.push({
          orderCode: ord.orderCode,
          issue: `Cảnh báo giao hàng khi chưa PAID_100 (Hiện tại: ${ord.paymentStatus})`,
          severity: "CRITICAL",
        });
      }
    }

    return {
      success: true,
      agentId: this.id,
      action: "DETECT_FINANCIAL_ANOMALIES",
      timestamp: new Date().toISOString(),
      summary: `Quét 50 đơn gần nhất: Phát hiện ${issues.length} bất thường tài chính.`,
      details: { scannedCount: ordersWithCosts.length, issues },
      warnings: issues.map((i) => `[${i.severity}] Đơn #${i.orderCode}: ${i.issue}`),
    };
  }
}

export const financialAuditAgent = new FinancialAuditAgent();
