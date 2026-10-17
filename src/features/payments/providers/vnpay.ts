import crypto from "node:crypto";
import { verifyVnpaySignature } from "@/lib/vnpay-payment";
import {
  PaymentProviderConfigError,
  type CreatePaymentInput,
  type CreatePaymentResult,
  type PaymentProvider,
  type RefundInput,
  type RefundResult,
  type VerifyCallbackResult,
} from "./types";

function sortObject(obj: Record<string, string>) {
  return Object.fromEntries(Object.keys(obj).sort().map((key) => [key, obj[key]]));
}

function buildQueryString(params: Record<string, string>) {
  return Object.entries(params)
    .map(([key, val]) => `${key}=${encodeURIComponent(val).replace(/%20/g, "+")}`)
    .join("&");
}

/** yyyyMMddHHmmss theo giờ Việt Nam (GMT+7), đúng định dạng VNPAY yêu cầu. */
function vnpayDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}${get("month")}${get("day")}${get("hour")}${get("minute")}${get("second")}`;
}

export class VnpayProvider implements PaymentProvider {
  readonly name = "VNPAY" as const;
  readonly isSimulated: boolean;

  /** sandbox: cổng thử nghiệm của VNPAY (không có tiền thật); live: cổng thật. */
  constructor(readonly mode: "vnpay-sandbox" | "vnpay-live") {
    this.isSimulated = mode === "vnpay-sandbox";
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const tmnCode = process.env.VNPAY_TMN_CODE;
    const hashSecret = process.env.VNPAY_HASH_SECRET;
    const vnpUrl = process.env.VNPAY_URL;
    if (!tmnCode || !hashSecret || !vnpUrl) {
      throw new PaymentProviderConfigError("Cổng thanh toán chưa được cấu hình đầy đủ.");
    }

    const now = new Date();
    const params: Record<string, string> = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: tmnCode,
      vnp_Amount: String(Math.round(input.amountVnd) * 100), // VNPAY yêu cầu số tiền x100
      vnp_CreateDate: vnpayDate(now),
      vnp_CurrCode: "VND",
      vnp_IpAddr: input.ipAddress || "127.0.0.1",
      vnp_Locale: "vn",
      vnp_OrderInfo: `Thanh toan don hang ${input.orderCode}`,
      vnp_OrderType: "other",
      vnp_ReturnUrl: input.returnUrl,
      vnp_TxnRef: input.orderCode,
      vnp_ExpireDate: vnpayDate(new Date(now.getTime() + 15 * 60 * 1000)),
    };

    const signData = buildQueryString(sortObject(params));
    const signed = crypto.createHmac("sha512", hashSecret).update(Buffer.from(signData, "utf-8")).digest("hex");
    return {
      provider: this.name,
      providerReference: input.orderCode,
      paymentUrl: `${vnpUrl}?${signData}&vnp_SecureHash=${signed}`,
      isSimulated: this.isSimulated,
    };
  }

  verifyCallback(raw: URLSearchParams | Record<string, string>): VerifyCallbackResult {
    const params = raw instanceof URLSearchParams ? raw : new URLSearchParams(raw);
    if (!verifyVnpaySignature(params)) return { valid: false, reason: "Chữ ký không hợp lệ" };

    const orderCode = params.get("vnp_TxnRef") || "";
    if (!orderCode) return { valid: false, reason: "Thiếu mã đơn" };
    const amountMinor = params.get("vnp_Amount") || "";
    if (!/^\d+$/.test(amountMinor) || !Number.isSafeInteger(Number(amountMinor))) return { valid: false, reason: "Số tiền không hợp lệ" };

    const transactionNo = params.get("vnp_TransactionNo");
    const responseCode = params.get("vnp_ResponseCode");
    const success = responseCode === "00" && params.get("vnp_TransactionStatus") === "00";
    // 24 = khách hủy giao dịch; các mã khác là thất bại.
    const outcome = success ? "SUCCESS" : responseCode === "24" ? "CANCELLED" : "FAILED";
    return {
      valid: true,
      callback: {
        provider: this.name,
        orderCode,
        amountVnd: Number(amountMinor) / 100,
        outcome,
        providerTransactionId: transactionNo && transactionNo !== "0" ? transactionNo : null,
        failureReason: success ? undefined : `VNPAY mã phản hồi ${responseCode ?? "không rõ"}`,
      },
    };
  }

  async refund(_input: RefundInput): Promise<RefundResult> {
    void _input;
    return {
      ok: false,
      message: "Hoàn tiền qua VNPAY chưa được tích hợp: thực hiện thủ công trên cổng merchant của VNPAY rồi ghi nhận lại.",
    };
  }
}
