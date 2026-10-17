import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendPaymentSuccessEmail } from "@/lib/mailer";
import { getRecordedPaymentStatus } from "@/features/payments/policy";
import type { PaymentCallback, PaymentProvider } from "@/features/payments/providers/types";

// Ghi nhận kết quả thanh toán vào database, không phụ thuộc nhà cung cấp cụ thể (VNPAY, mô phỏng...).

export type ConfirmResult = "confirmed" | "already_paid" | "not_payable" | "not_found" | "invalid_amount";

export async function confirmPayment(input: {
  provider: string;
  orderCode: string;
  amountVnd: number;
  providerTransactionId?: string | null;
}): Promise<{ result: ConfirmResult }> {
  if (!Number.isSafeInteger(input.amountVnd) || input.amountVnd <= 0) return { result: "invalid_amount" };

  const order = await prisma.order.findUnique({ where: { orderCode: input.orderCode } });
  if (!order) return { result: "not_found" };
  if (order.paymentStatus !== "UNPAID") {
    return order.paymentStatus === "DEPOSITED_50" || order.paymentStatus === "PAID_100"
      ? { result: "already_paid" }
      : { result: "not_payable" };
  }
  if (order.status !== "PENDING_DEPOSIT" || !order.isPriceVerified || order.depositAmountVnd <= 0 || input.amountVnd !== order.depositAmountVnd) {
    return { result: "invalid_amount" };
  }

  const recordedStatus = getRecordedPaymentStatus(order.depositPercent);
  const amountVnd = order.depositAmountVnd;
  const transactionId = input.providerTransactionId?.trim().slice(0, 120) || null;
  const label = input.provider === "VNPAY" ? "VNPAY" : input.provider === "MOCK" ? "Cổng mô phỏng" : input.provider;

  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: order.id, paymentStatus: "UNPAID", status: "PENDING_DEPOSIT", isPriceVerified: true },
      data: {
        paymentStatus: recordedStatus,
        paymentMethod: input.provider === "VNPAY" ? "VNPAY" : order.paymentMethod,
        status: "PURCHASING_JP",
        reservationExpiresAt: null,
      },
    });
    if (claimed.count !== 1) return null;

    // Giao dịch cùng mã đã được ghi trước đó dưới dạng PENDING/FAILED thì cập nhật thành CONFIRMED thay vì tạo trùng.
    const existing = transactionId
      ? await tx.paymentTransaction.findFirst({ where: { provider: input.provider, providerTransactionId: transactionId } })
      : null;
    if (existing) {
      await tx.paymentTransaction.update({
        where: { id: existing.id },
        data: { orderId: order.id, amountVnd, status: "CONFIRMED", confirmedAt: new Date() },
      });
    } else {
      await tx.paymentTransaction.create({
        data: { orderId: order.id, provider: input.provider, amountVnd, providerTransactionId: transactionId, status: "CONFIRMED" },
      });
    }
    await tx.trackingLog.create({
      data: {
        orderId: order.id,
        status: "PURCHASING_JP",
        title: order.depositPercent === 100 ? "Thanh toán 100% thành công" : "Thanh toán cọc 50% thành công",
        description: `${label} đã xác nhận ${amountVnd.toLocaleString("vi-VN")} đ. Đội ngũ ChillBanana có thể bắt đầu xử lý đơn hàng.`,
        location: "ChillBanana - Hệ thống",
      },
    });
    return tx.order.findUnique({ where: { id: order.id } });
  });

  if (!updated) {
    const current = await prisma.order.findUnique({ where: { id: order.id }, select: { paymentStatus: true } });
    return current?.paymentStatus === "DEPOSITED_50" || current?.paymentStatus === "PAID_100"
      ? { result: "already_paid" }
      : { result: "not_payable" };
  }

  sendPaymentSuccessEmail(updated).catch((err) => console.warn("[Payment Email Error]", err));
  return { result: "confirmed" };
}

export type NonSuccessStatus = "PENDING" | "FAILED" | "CANCELLED" | "TIMEOUT";
export type RecordResult = "recorded" | "duplicate" | "already_paid" | "not_found";

const NON_SUCCESS_STATUS: Record<string, NonSuccessStatus> = {
  PENDING: "PENDING",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  TIMEOUT: "TIMEOUT",
};

/** Ghi lại giao dịch không thành công (hoặc đang chờ). Gọi lại với cùng mã giao dịch thì không tạo thêm dòng. */
export async function recordNonSuccessPayment(callback: PaymentCallback): Promise<{ result: RecordResult }> {
  const status = NON_SUCCESS_STATUS[callback.outcome];
  if (!status) throw new Error(`Kết quả ${callback.outcome} không phải trạng thái không thành công.`);

  const order = await prisma.order.findUnique({ where: { orderCode: callback.orderCode } });
  if (!order) return { result: "not_found" };
  if (order.paymentStatus === "DEPOSITED_50" || order.paymentStatus === "PAID_100") return { result: "already_paid" };

  const txnId = callback.providerTransactionId?.trim().slice(0, 120) || null;
  if (!txnId) {
    // Không có mã giao dịch thì không dựa được vào ràng buộc duy nhất: chặn bản ghi trùng gửi lại trong 60 giây.
    const recent = await prisma.paymentTransaction.findFirst({
      where: { orderId: order.id, provider: callback.provider, status, createdAt: { gte: new Date(Date.now() - 60_000) } },
    });
    if (recent) return { result: "duplicate" };
  }
  try {
    await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        provider: callback.provider,
        amountVnd: callback.amountVnd,
        status,
        providerTransactionId: txnId,
        reference: callback.failureReason?.slice(0, 200) ?? null,
      },
    });
    return { result: "recorded" };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { result: "duplicate" };
    throw error;
  }
}

export type ApplyCallbackResult = { result: ConfirmResult | RecordResult };

/** Áp dụng một callback đã được nhà cung cấp xác thực: thành công thì xác nhận đơn, ngược lại thì ghi lại giao dịch. */
export async function applyPaymentCallback(callback: PaymentCallback): Promise<ApplyCallbackResult> {
  if (callback.outcome === "SUCCESS") {
    return confirmPayment({
      provider: callback.provider,
      orderCode: callback.orderCode,
      amountVnd: callback.amountVnd,
      providerTransactionId: callback.providerTransactionId,
    });
  }
  return recordNonSuccessPayment(callback);
}

export type RefundServiceResult =
  | { result: "refunded"; providerRefundId: string }
  | { result: "not_found" | "not_refundable" | "no_transaction" }
  | { result: "provider_failed"; message: string };

/**
 * Hoàn tiền toàn phần cho đơn đã hủy mà khách đã thanh toán. Nhà cung cấp phải hoàn được thì đơn mới đổi
 * sang REFUNDED; nếu nhà cung cấp từ chối thì dữ liệu giữ nguyên.
 */
export async function refundOrderPayment(
  provider: PaymentProvider,
  input: { orderCode: string; reason: string }
): Promise<RefundServiceResult> {
  const order = await prisma.order.findFirst({ where: { OR: [{ orderCode: input.orderCode }, { id: input.orderCode }] } });
  if (!order) return { result: "not_found" };
  if (order.status !== "CANCELLED" || (order.paymentStatus !== "DEPOSITED_50" && order.paymentStatus !== "PAID_100")) {
    return { result: "not_refundable" };
  }

  const original = await prisma.paymentTransaction.findFirst({
    where: { orderId: order.id, provider: provider.name, status: "CONFIRMED" },
    orderBy: { createdAt: "desc" },
  });
  if (!original) return { result: "no_transaction" };

  const outcome = await provider.refund({
    orderCode: order.orderCode,
    amountVnd: original.amountVnd,
    providerTransactionId: original.providerTransactionId,
    reason: input.reason,
  });
  if (!outcome.ok) return { result: "provider_failed", message: outcome.message };

  const applied = await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: "CANCELLED", paymentStatus: order.paymentStatus },
      data: { paymentStatus: "REFUNDED" },
    });
    if (claimed.count !== 1) return false;
    await tx.paymentTransaction.update({ where: { id: original.id }, data: { status: "REFUNDED" } });
    await tx.trackingLog.create({
      data: {
        orderId: order.id,
        status: "CANCELLED",
        title: "Đã hoàn tiền",
        description: `Đã hoàn ${original.amountVnd.toLocaleString("vi-VN")} đ cho đơn hàng đã hủy.${provider.isSimulated ? " (Giao dịch mô phỏng)" : ""}`,
        location: "ChillBanana - Hệ thống",
      },
    });
    return true;
  });
  if (!applied) return { result: "not_refundable" };
  return { result: "refunded", providerRefundId: outcome.providerRefundId };
}
