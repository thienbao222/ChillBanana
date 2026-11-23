import { prisma } from "@/lib/prisma";
import { getRecordedPaymentStatus } from "@/features/payments/policy";

export type MockPaymentOutcome = "success" | "failed" | "pending" | "timeout";

export async function applyMockPaymentOutcome(attemptId: string, outcome: MockPaymentOutcome) {
  const now = new Date();
  const attempt = await prisma.paymentAttempt.findUnique({ where: { id: attemptId }, include: { order: true } });
  if (!attempt || attempt.provider !== "MOCK" || attempt.mode !== "mock") return { result: "not_found" as const };
  const isTestEnv = process.env.NODE_ENV === "test" || process.env.VITEST === "true" || process.env.APP_ENV === "test";
  const autoConfirmOrder = !isTestEnv && process.env.PAYMENT_AUTO_CONFIRM_ORDER === "true";

  if (attempt.status === "CONFIRMED") return { result: (autoConfirmOrder ? "confirmed" : "simulated_success") as "confirmed" | "simulated_success", orderCode: attempt.order.orderCode };
  if (attempt.status === "FAILED" || attempt.status === "EXPIRED") return { result: "terminal" as const };
  if (attempt.expiresAt <= now) {
    await prisma.paymentAttempt.updateMany({ where: { id: attempt.id, status: { in: ["INITIATED", "PENDING"] } }, data: { status: "EXPIRED", failureCode: "ATTEMPT_EXPIRED", completedAt: now } });
    return { result: "expired" as const };
  }
  if (outcome !== "success") {
    const status = outcome === "pending" ? "PENDING" : "FAILED";
    const failureCode = outcome === "pending" ? null : outcome === "timeout" ? "SIMULATED_TIMEOUT" : "SIMULATED_DECLINED";
    const update = await prisma.paymentAttempt.updateMany({
      where: { id: attempt.id, status: { in: ["INITIATED", "PENDING"] }, expiresAt: { gt: now } },
      data: { status, failureCode, completedAt: status === "FAILED" ? now : null },
    });
    return update.count === 1 ? { result: outcome as "failed" | "pending" | "timeout" } : { result: "terminal" as const };
  }

  const isBalancePayment =
    attempt.order.status === "WAREHOUSE_VN" &&
    (attempt.order.paymentStatus === "DEPOSITED_50" || attempt.order.paymentStatus === "DEPOSITED_70");

  const isDepositPayment =
    attempt.order.status === "PENDING_DEPOSIT" &&
    attempt.order.paymentStatus === "UNPAID" &&
    attempt.order.isPriceVerified;

  if (!isBalancePayment && !isDepositPayment) {
    return { result: "not_payable" as const };
  }

  const expectedAmount = isBalancePayment
    ? Math.max(0, attempt.order.totalVnd - (attempt.order.depositAmountVnd || 0))
    : attempt.order.depositAmountVnd;

  if (attempt.amountVnd !== expectedAmount) {
    return { result: "not_payable" as const };
  }

  let confirmed = false;
  try {
    confirmed = await prisma.$transaction(async (tx) => {
      const claimedAttempt = await tx.paymentAttempt.updateMany({
        where: { id: attempt.id, status: { in: ["INITIATED", "PENDING"] }, expiresAt: { gt: now } },
        data: { status: "CONFIRMED", providerReference: `MOCK-${attempt.id}`, failureCode: null, completedAt: now },
      });
      if (claimedAttempt.count !== 1) return false;

      if (autoConfirmOrder) {
        if (isBalancePayment) {
          const claimedOrder = await tx.order.updateMany({
            where: {
              id: attempt.orderId,
              status: "WAREHOUSE_VN",
              paymentStatus: { in: ["DEPOSITED_50", "DEPOSITED_70"] },
            },
            data: {
              paymentStatus: "PAID_100",
              depositAmountVnd: attempt.order.totalVnd,
              paymentMethod: "MOCK",
              isSandbox: true,
            },
          });
          if (claimedOrder.count === 1) {
            const mockTxnId = `MOCK_${attempt.order.orderCode}_BAL_${Date.now()}`;
            await tx.paymentTransaction.create({
              data: {
                orderId: attempt.orderId,
                kind: "BALANCE",
                provider: "MOCK",
                amountVnd: attempt.amountVnd,
                providerTransactionId: mockTxnId,
                reference: "Live Demo Mock Auto-Confirm Balance (100%)",
                status: "CONFIRMED",
                confirmedByAdmin: "SYSTEM_DEMO",
              },
            });
            await tx.trackingLog.create({
              data: {
                orderId: attempt.orderId,
                status: "WAREHOUSE_VN",
                title: "Tất toán số dư 100% thành công (Live Demo)",
                description: `Hệ thống ghi nhận thanh toán mô phỏng số dư ${attempt.amountVnd.toLocaleString("vi-VN")} đ. Đơn hàng hoàn tất thanh toán 100%, sẵn sàng giao nội địa.`,
                location: "Kho ChillBanana Việt Nam",
              },
            });
            return true;
          }
        } else {
          const isVnOrigin = (attempt.order as { fulfillmentOrigin?: string }).fulfillmentOrigin === "VN";
          const nextStatus = isVnOrigin ? "WAREHOUSE_VN" : "PURCHASING_JP";
          const recordedStatus = getRecordedPaymentStatus(attempt.order.depositPercent);
          const claimedOrder = await tx.order.updateMany({
            where: {
              id: attempt.orderId,
              status: "PENDING_DEPOSIT",
              paymentStatus: "UNPAID",
            },
            data: {
              paymentStatus: recordedStatus,
              paymentMethod: "MOCK",
              status: nextStatus,
              reservationExpiresAt: null,
              isSandbox: true,
            },
          });
          if (claimedOrder.count === 1) {
            const mockTxnId = `MOCK_${attempt.order.orderCode}_${Date.now()}`;
            await tx.paymentTransaction.create({
              data: {
                orderId: attempt.orderId,
                kind: "DEPOSIT",
                provider: "MOCK",
                amountVnd: attempt.amountVnd,
                providerTransactionId: mockTxnId,
                reference: `Live Demo Mock Auto-Confirm (${attempt.order.depositPercent}%)`,
                status: "CONFIRMED",
                confirmedByAdmin: "SYSTEM_DEMO",
              },
            });
            await tx.trackingLog.create({
              data: {
                orderId: attempt.orderId,
                status: nextStatus,
                title: isVnOrigin
                  ? (attempt.order.depositPercent === 100 ? "Thanh toán 100% thành công (Sẵn kho VN)" : "Thanh toán cọc 50% thành công (Sẵn kho VN)")
                  : (attempt.order.depositPercent === 100 ? "Thanh toán 100% thành công (Live Demo)" : "Thanh toán cọc 50% thành công (Live Demo)"),
                description: isVnOrigin
                  ? `Hệ thống ghi nhận thanh toán ${attempt.amountVnd.toLocaleString("vi-VN")} đ. Hàng có sẵn tại kho VN, sẵn sàng đóng gói giao nội địa.`
                  : `Hệ thống ghi nhận thanh toán mô phỏng ${attempt.amountVnd.toLocaleString("vi-VN")} đ. Đơn hàng chuyển sang bước mua hàng tại Nhật.`,
                location: isVnOrigin ? "Kho ChillBanana Việt Nam" : "ChillBanana Payment Gateway",
              },
            });
            return true;
          }
        }
      }

      await tx.trackingLog.create({
        data: {
          orderId: attempt.orderId,
          status: "PENDING_DEPOSIT",
          title: "Đã chạy kịch bản thanh toán mô phỏng thành công",
          description: `MOCK ghi nhận kịch bản ${attempt.amountVnd.toLocaleString("vi-VN")} đ. Đây không phải khoản tiền thật; đơn vẫn chờ thanh toán và chưa được chuyển sang xử lý mua hàng.`,
          location: "Môi trường mô phỏng",
        },
      });
      return true;
    });
  } catch (error) {
    throw error;
  }
  if (!confirmed) {
    const current = await prisma.paymentAttempt.findUnique({ where: { id: attempt.id }, select: { status: true } });
    return current?.status === "CONFIRMED"
      ? { result: (autoConfirmOrder ? "confirmed" : "simulated_success") as "confirmed" | "simulated_success", orderCode: attempt.order.orderCode }
      : { result: "terminal" as const };
  }

  return {
    result: (autoConfirmOrder ? "confirmed" : "simulated_success") as "confirmed" | "simulated_success",
    orderCode: attempt.order.orderCode,
  };
}
