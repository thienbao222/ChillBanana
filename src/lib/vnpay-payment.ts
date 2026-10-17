import crypto from "crypto";
import { confirmPayment } from "@/features/payments/service";

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

/** Xác nhận thanh toán VNPAY (số tiền VNPAY gửi là đơn vị nhỏ nhất, đã nhân 100). */
export async function confirmVnpayPayment(orderCode: string, amountMinor: string, providerTransactionId?: string | null) {
  if (!/^\d+$/.test(amountMinor)) return { result: "invalid_amount" as const };
  const minor = Number(amountMinor);
  if (!Number.isSafeInteger(minor) || minor % 100 !== 0) return { result: "invalid_amount" as const };
  return confirmPayment({ provider: "VNPAY", orderCode, amountVnd: minor / 100, providerTransactionId });
}
