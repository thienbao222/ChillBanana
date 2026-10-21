import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { resolvePaymentMode } from "@/features/payments/provider";
import { getRecordedPaymentStatus } from "@/features/payments/policy";
import { sendPaymentSuccessEmail } from "@/lib/mailer";

function sortObject(obj: Record<string, string>) {
  return Object.fromEntries(Object.keys(obj).sort().map((key) => [key, obj[key]]));
}

function buildQueryString(params: Record<string, string>) {
  return Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value).replace(/%20/g, "+")}`)
    .join("&");
}

export function verifyVnpaySignature(searchParams: URLSearchParams): boolean {
  const secret = process.env.VNPAY_HASH_SECRET;
  if (!secret) return false;
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (key.startsWith("vnp_") && key !== "vnp_SecureHash" && key !== "vnp_SecureHashType") params[key] = value;
  });
  const supplied = searchParams.get("vnp_SecureHash") || "";
  const signed = crypto.createHmac("sha512", secret).update(buildQueryString(sortObject(params)), "utf8").digest("hex");
  const suppliedBuffer = Buffer.from(supplied, "utf8");
  const signedBuffer = Buffer.from(signed, "utf8");
  return suppliedBuffer.length === signedBuffer.length && crypto.timingSafeEqual(suppliedBuffer, signedBuffer);
}

export async function recordVnpayAttemptFailure(orderCode: string, responseCode: string | null, rawTxnRef?: string) {
  const order = await prisma.order.findUnique({ where: { orderCode }, select: { id: true } });
  if (!order) return;
  // BẢO MẬT (P1-14): Tìm theo providerReference (vnp_TxnRef) để tránh đánh dấu sai attempt khi có nhiều phiên
  let attempt = rawTxnRef
    ? await prisma.paymentAttempt.findFirst({
        where: { orderId: order.id, providerReference: rawTxnRef, status: { in: ["INITIATED", "PENDING"] } },
      })
    : null;
  if (!attempt) {
    attempt = await prisma.paymentAttempt.findFirst({
      where: { orderId: order.id, provider: "VNPAY_SANDBOX", status: { in: ["INITIATED", "PENDING"] } },
      orderBy: { createdAt: "desc" },
    });
  }
  if (!attempt) return;
  await prisma.paymentAttempt.updateMany({
    where: { id: attempt.id, status: { in: ["INITIATED", "PENDING"] } },
    data: { status: "FAILED", failureCode: `VNPAY_${(responseCode || "FAILED").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24)}`, completedAt: new Date() },
  });
}

export async function confirmVnpayPayment(orderCode: string, amountMinor: string, providerTransactionId?: string | null, rawTxnRef?: string) {
  if (resolvePaymentMode() !== "sandbox") return { result: "not_payable" as const };
  if (!/^\d+$/.test(amountMinor)) return { result: "invalid_amount" as const };
  const amount = Number(amountMinor);
  if (!Number.isSafeInteger(amount)) return { result: "invalid_amount" as const };

  const order = await prisma.order.findUnique({ where: { orderCode } });
  if (!order) return { result: "not_found" as const };

  // BẢO MẬT & IDEMPOTENCY: Kiểm tra attempt đã hoàn tất trước để đảm bảo phản hồi 02 nếu IPN gọi lại
  const completedAttempt = await prisma.paymentAttempt.findFirst({
    where: { orderId: order.id, provider: "VNPAY_SANDBOX", status: "CONFIRMED" },
    orderBy: { completedAt: "desc" },
  });
  if (completedAttempt) return { result: "already_paid" as const };

  if (order.paymentStatus !== "UNPAID") return { result: "not_payable" as const };
  if (order.status !== "PENDING_DEPOSIT" || !order.isPriceVerified || order.depositAmountVnd <= 0 || amount !== order.depositAmountVnd * 100) {
    return { result: "invalid_amount" as const };
  }

  const amountVnd = order.depositAmountVnd;
  const transactionId = providerTransactionId?.trim().slice(0, 120) || null;

  // BẢO MẬT (P1-14): Tìm theo suffix của rawTxnRef hoặc providerReference hoặc attempt mới nhất
  const attemptSuffix = rawTxnRef && rawTxnRef.includes("_") ? rawTxnRef.split("_").pop() : null;
  let attempt = attemptSuffix
    ? await prisma.paymentAttempt.findFirst({
        where: { orderId: order.id, id: { endsWith: attemptSuffix }, status: { in: ["INITIATED", "PENDING"] } },
      })
    : null;
  if (!attempt && rawTxnRef) {
    attempt = await prisma.paymentAttempt.findFirst({
      where: { orderId: order.id, providerReference: rawTxnRef, status: { in: ["INITIATED", "PENDING"] } },
    });
  }
  if (!attempt) {
    attempt = await prisma.paymentAttempt.findFirst({
      where: { orderId: order.id, provider: "VNPAY_SANDBOX", status: { in: ["INITIATED", "PENDING"] } },
      orderBy: { createdAt: "desc" },
    });
  }
  if (!attempt) return { result: "not_payable" as const };
  if (attempt.expiresAt <= new Date() || attempt.amountVnd !== amountVnd) {
    await prisma.paymentAttempt.updateMany({ where: { id: attempt.id, status: { in: ["INITIATED", "PENDING"] } }, data: { status: "EXPIRED", failureCode: "ATTEMPT_EXPIRED_OR_AMOUNT_MISMATCH", completedAt: new Date() } });
    return { result: "invalid_amount" as const };
  }

  const autoSettleOrder = process.env.PAYMENT_AUTO_CONFIRM_ORDER === "true";

  const updated = await prisma.$transaction(async (tx) => {
    const claimedAttempt = await tx.paymentAttempt.updateMany({
      where: { id: attempt.id, status: { in: ["INITIATED", "PENDING"] }, expiresAt: { gt: new Date() }, amountVnd },
      data: { status: "CONFIRMED", providerReference: transactionId, failureCode: null, completedAt: new Date() },
    });
    if (claimedAttempt.count !== 1) return null;

    if (autoSettleOrder) {
      const recordedStatus = getRecordedPaymentStatus(order.depositPercent);
      const updatedOrder = await tx.order.updateMany({
        where: {
          id: order.id,
          paymentStatus: "UNPAID",
          status: "PENDING_DEPOSIT",
          isPriceVerified: true,
        },
        data: {
          paymentStatus: recordedStatus,
          paymentMethod: "VNPAY_SANDBOX",
          status: "PURCHASING_JP",
          reservationExpiresAt: null,
        },
      });
      if (updatedOrder.count !== 1) return null;
      // BẢO MẬT (P1-14): Chống trùng lặp Unique Constraint @@unique([provider, providerTransactionId])
      const safeProviderTxId = (!transactionId || transactionId === "0")
        ? `VNPAY_${order.orderCode}_${Date.now()}`
        : `${order.orderCode}_${transactionId}`;

      await tx.paymentTransaction.create({
        data: {
          orderId: order.id,
          provider: "VNPAY_SANDBOX",
          amountVnd,
          providerTransactionId: safeProviderTxId,
          reference: `VNPAY IPN Auto-Confirm (${order.depositPercent}%)`,
          status: "CONFIRMED",
          confirmedByAdmin: "VNPAY_IPN",
        },
      });
      await tx.trackingLog.create({
        data: {
          orderId: order.id,
          status: "PURCHASING_JP",
          title: order.depositPercent === 100 ? "Đã thanh toán 100% qua VNPAY" : "Đã đặt cọc 50% qua VNPAY",
          description: `Cổng VNPAY xác nhận thanh toán ${amountVnd.toLocaleString("vi-VN")} đ. Đơn hàng tự động chuyển sang bước mua hộ tại Nhật.`,
          location: "Cổng thanh toán VNPAY",
        },
      });
    } else {
      await tx.trackingLog.create({
        data: {
          orderId: order.id,
          status: "PENDING_DEPOSIT",
          title: order.depositPercent === 100 ? "Thanh toán VNPAY sandbox mô phỏng thành công (100%)" : "Thanh toán VNPAY sandbox mô phỏng thành công (50%)",
          description: `Sandbox VNPAY ghi nhận kịch bản ${amountVnd.toLocaleString("vi-VN")} đ. Đây không phải khoản tiền thật và chưa cho phép bắt đầu mua hàng thực tế.`,
          location: "Môi trường sandbox",
        },
      });
    }
    return tx.paymentAttempt.findUnique({ where: { id: attempt.id } });
  });

  if (!updated) {
    const current = await prisma.paymentAttempt.findUnique({ where: { id: attempt.id }, select: { status: true } });
    return current?.status === "CONFIRMED"
      ? { result: "already_paid" as const }
      : { result: "not_payable" as const };
  }

  if (autoSettleOrder) {
    const settledOrder = await prisma.order.findUnique({ where: { id: order.id } });
    if (settledOrder) {
      sendPaymentSuccessEmail(settledOrder).catch((err) => console.warn("[VNPAY Auto-Settle Email Error]", err));
    }
  }

  return { result: "confirmed" as const };
}
