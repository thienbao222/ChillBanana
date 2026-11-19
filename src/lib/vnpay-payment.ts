import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { resolvePaymentMode } from "@/features/payments/provider";
import { getRecordedPaymentStatus } from "@/features/payments/policy";
import { sendPaymentSuccessEmail } from "@/lib/mailer";
import { writeAuditLog } from "@/lib/audit";

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

  // Idempotency: Kiểm tra nếu attempt đã hoàn tất trước đó
  if (!attempt && rawTxnRef) {
    const alreadyDone = await prisma.paymentAttempt.findFirst({
      where: { orderId: order.id, providerReference: rawTxnRef, status: "CONFIRMED" },
    });
    if (alreadyDone) return { result: "already_paid" as const };
  }
  if (!attempt) return { result: "not_payable" as const };

  // Phân loại luồng thanh toán: Cọc đợt 1 (DEPOSIT) hay Tất toán số dư đợt 2 (BALANCE)
  const isBalancePayment =
    order.status === "WAREHOUSE_VN" &&
    (order.paymentStatus === "DEPOSITED_50" || order.paymentStatus === "DEPOSITED_70");

  const isDepositPayment =
    order.status === "PENDING_DEPOSIT" && order.paymentStatus === "UNPAID";

  let amountVnd = 0;
  if (isBalancePayment) {
    const remainingGoodsBalanceVnd = Math.max(0, order.totalVnd - (order.depositAmountVnd || 0));
    if (remainingGoodsBalanceVnd <= 0 || amount !== remainingGoodsBalanceVnd * 100) {
      return { result: "invalid_amount" as const };
    }
    amountVnd = remainingGoodsBalanceVnd;
  } else if (isDepositPayment) {
    if (!order.isPriceVerified || order.depositAmountVnd <= 0 || amount !== order.depositAmountVnd * 100) {
      return { result: "invalid_amount" as const };
    }
    amountVnd = order.depositAmountVnd;
  } else {
    if (order.paymentStatus === "PAID_100") {
      return { result: "already_paid" as const };
    }
    return { result: "not_payable" as const };
  }

  const transactionId = providerTransactionId?.trim().slice(0, 120) || null;

  if (attempt.expiresAt <= new Date() || attempt.amountVnd !== amountVnd) {
    await prisma.paymentAttempt.updateMany({ where: { id: attempt.id, status: { in: ["INITIATED", "PENDING"] } }, data: { status: "EXPIRED", failureCode: "ATTEMPT_EXPIRED_OR_AMOUNT_MISMATCH", completedAt: new Date() } });
    return { result: "invalid_amount" as const };
  }

  const isIntegrationTest = process.env.APP_ENV === "test";
  const autoSettleOrder = !isIntegrationTest && process.env.PAYMENT_AUTO_CONFIRM_ORDER === "true";

  const updated = await prisma.$transaction(async (tx) => {
    const claimedAttempt = await tx.paymentAttempt.updateMany({
      where: { id: attempt.id, status: { in: ["INITIATED", "PENDING"] }, expiresAt: { gt: new Date() }, amountVnd },
      data: { status: "CONFIRMED", providerReference: transactionId, failureCode: null, completedAt: new Date() },
    });
    if (claimedAttempt.count !== 1) return null;

    if (autoSettleOrder) {
      if (isBalancePayment) {
        const updatedOrder = await tx.order.updateMany({
          where: {
            id: order.id,
            status: "WAREHOUSE_VN",
            paymentStatus: { in: ["DEPOSITED_50", "DEPOSITED_70"] },
          },
          data: {
            paymentStatus: "PAID_100",
            depositAmountVnd: order.totalVnd,
            paymentMethod: "VNPAY_SANDBOX",
          },
        });
        if (updatedOrder.count !== 1) return null;

        const safeProviderTxId = (!transactionId || transactionId === "0")
          ? `VNPAY_${order.orderCode}_BAL_${Date.now()}`
          : `${order.orderCode}_${transactionId}`;

        await tx.paymentTransaction.create({
          data: {
            orderId: order.id,
            kind: "BALANCE",
            provider: "VNPAY_SANDBOX",
            amountVnd,
            providerTransactionId: safeProviderTxId,
            reference: "VNPAY IPN Auto-Confirm Balance (100%)",
            status: "CONFIRMED",
            confirmedByAdmin: "VNPAY_IPN",
          },
        });

        await tx.trackingLog.create({
          data: {
            orderId: order.id,
            status: "WAREHOUSE_VN",
            title: "Đã tất toán 100% qua VNPAY",
            description: `Cổng VNPAY xác nhận thanh toán số dư đợt 2 ${amountVnd.toLocaleString("vi-VN")} đ. Đơn hàng hoàn tất thanh toán 100%, sẵn sàng bàn giao giao hàng nội địa.`,
            location: "Kho ChillBanana Việt Nam",
          },
        });
      } else {
        const isVnOrigin = (order as { fulfillmentOrigin?: string }).fulfillmentOrigin === "VN";
        const nextStatus = isVnOrigin ? "WAREHOUSE_VN" : "PURCHASING_JP";
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
            status: nextStatus,
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
            kind: "DEPOSIT",
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
            status: nextStatus,
            title: order.depositPercent === 100 ? "Đã thanh toán 100% qua VNPAY" : "Đã đặt cọc 50% qua VNPAY",
            description: isVnOrigin
              ? `Cổng VNPAY xác nhận thanh toán ${amountVnd.toLocaleString("vi-VN")} đ. Hàng có sẵn tại kho VN, sẵn sàng đóng gói giao nội địa.`
              : `Cổng VNPAY xác nhận thanh toán ${amountVnd.toLocaleString("vi-VN")} đ. Đơn hàng tự động chuyển sang bước mua hộ tại Nhật.`,
            location: isVnOrigin ? "Kho ChillBanana Việt Nam" : "Cổng thanh toán VNPAY",
          },
        });
      }
    } else {
      await tx.trackingLog.create({
        data: {
          orderId: order.id,
          status: isBalancePayment ? "WAREHOUSE_VN" : "PENDING_DEPOSIT",
          title: isBalancePayment
            ? "Thanh toán số dư VNPAY sandbox mô phỏng thành công"
            : (order.depositPercent === 100 ? "Thanh toán VNPAY sandbox mô phỏng thành công (100%)" : "Thanh toán VNPAY sandbox mô phỏng thành công (50%)"),
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
    if (isBalancePayment) {
      await writeAuditLog({
        actor: "VNPAY_IPN",
        actorType: "SYSTEM",
        action: "ORDER_BALANCE_SETTLED",
        entityType: "Order",
        entityId: order.orderCode,
        summary: `Khách hàng tất toán số dư đợt 2 qua VNPAY cho đơn ${order.orderCode} (${amountVnd.toLocaleString("vi-VN")} đ). Trạng thái thanh toán chuyển sang PAID_100.`,
        metadata: {
          orderCode: order.orderCode,
          amountVnd,
          paymentStatus: "PAID_100",
          provider: "VNPAY_SANDBOX",
          providerTransactionId: transactionId,
        },
      });
    }
    const settledOrder = await prisma.order.findUnique({ where: { id: order.id } });
    if (settledOrder) {
      sendPaymentSuccessEmail(settledOrder).catch((err) => console.warn("[VNPAY Auto-Settle Email Error]", err));
    }
  }

  return { result: "confirmed" as const };
}
