import { prisma } from "@/lib/prisma";

export type MockPaymentOutcome = "success" | "failed" | "pending" | "timeout";

export async function applyMockPaymentOutcome(attemptId: string, outcome: MockPaymentOutcome) {
  const now = new Date();
  const attempt = await prisma.paymentAttempt.findUnique({ where: { id: attemptId }, include: { order: true } });
  if (!attempt || attempt.provider !== "MOCK" || attempt.mode !== "mock") return { result: "not_found" as const };
  if (attempt.status === "CONFIRMED") return { result: "simulated_success" as const, orderCode: attempt.order.orderCode };
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

  if (attempt.order.paymentStatus !== "UNPAID" || attempt.order.status !== "PENDING_DEPOSIT" || !attempt.order.isPriceVerified || attempt.amountVnd !== attempt.order.depositAmountVnd) {
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
      ? { result: "simulated_success" as const, orderCode: attempt.order.orderCode }
      : { result: "terminal" as const };
  }

  // A simulation is recorded on PaymentAttempt only; it never marks the order paid or triggers a receipt email.
  return { result: "simulated_success" as const, orderCode: attempt.order.orderCode };
}
