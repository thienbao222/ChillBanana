import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPaymentSuccessEmail } from "@/lib/mailer";
import { getRecordedPaymentStatus } from "@/lib/payment-policy";

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

export async function confirmVnpayPayment(orderCode: string, amountMinor: string, providerTransactionId?: string | null) {
  if (!/^\d+$/.test(amountMinor)) return { result: "invalid_amount" as const };
  const amount = Number(amountMinor);
  if (!Number.isSafeInteger(amount)) return { result: "invalid_amount" as const };

  const order = await prisma.order.findUnique({ where: { orderCode } });
  if (!order) return { result: "not_found" as const };
  if (order.paymentStatus !== "UNPAID") {
    return order.paymentStatus === "DEPOSITED_50" || order.paymentStatus === "PAID_100"
      ? { result: "already_paid" as const }
      : { result: "not_payable" as const };
  }
  if (order.status !== "PENDING_DEPOSIT" || !order.isPriceVerified || order.depositAmountVnd <= 0 || amount !== order.depositAmountVnd * 100) {
    return { result: "invalid_amount" as const };
  }

  const recordedStatus = getRecordedPaymentStatus(order.depositPercent);
  const amountVnd = order.depositAmountVnd;
  const transactionId = providerTransactionId?.trim().slice(0, 120) || null;

  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: order.id, paymentStatus: "UNPAID", status: "PENDING_DEPOSIT", isPriceVerified: true },
      data: {
        paymentStatus: recordedStatus,
        paymentMethod: "VNPAY",
        status: "PURCHASING_JP",
        reservationExpiresAt: null,
      },
    });
    if (claimed.count !== 1) return null;
    await tx.paymentTransaction.create({
      data: {
        orderId: order.id,
        provider: "VNPAY",
        amountVnd,
        providerTransactionId: transactionId,
        status: "CONFIRMED",
      },
    });
    await tx.trackingLog.create({
      data: {
        orderId: order.id,
        status: "PURCHASING_JP",
        title: order.depositPercent === 100 ? "Thanh toán 100% thành công" : "Thanh toán cọc 50% thành công",
        description: `VNPAY đã xác nhận ${amountVnd.toLocaleString("vi-VN")} đ. Đội ngũ ChillBanana có thể bắt đầu xử lý đơn hàng.`,
        location: "ChillBanana - Hệ thống",
      },
    });
    return tx.order.findUnique({ where: { id: order.id } });
  });

  if (!updated) {
    const current = await prisma.order.findUnique({ where: { id: order.id }, select: { paymentStatus: true } });
    return current?.paymentStatus === "DEPOSITED_50" || current?.paymentStatus === "PAID_100"
      ? { result: "already_paid" as const }
      : { result: "not_payable" as const };
  }

  sendPaymentSuccessEmail(updated).catch((err) => console.warn("[VNPAY Email Error]", err));
  return { result: "confirmed" as const };
}
