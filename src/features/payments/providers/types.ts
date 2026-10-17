// Giao diện chung cho nhà cung cấp thanh toán. Mỗi nhà cung cấp (mock, VNPAY sandbox, VNPAY live)
// chỉ lo phần giao tiếp với cổng; việc ghi nhận đơn/giao dịch nằm ở ../service.ts.

export type PaymentOutcome = "SUCCESS" | "FAILED" | "PENDING" | "TIMEOUT" | "CANCELLED";

export type CreatePaymentInput = {
  orderCode: string;
  amountVnd: number;
  ipAddress?: string;
  returnUrl: string;
};

export type CreatePaymentResult = {
  provider: string;
  providerReference: string;
  /** null khi nhà cung cấp là mô phỏng (không có trang thanh toán thật). */
  paymentUrl: string | null;
  isSimulated: boolean;
};

export type PaymentCallback = {
  provider: string;
  orderCode: string;
  amountVnd: number;
  outcome: PaymentOutcome;
  providerTransactionId: string | null;
  failureReason?: string;
};

export type VerifyCallbackResult =
  | { valid: true; callback: PaymentCallback }
  | { valid: false; reason: string };

export type RefundInput = {
  orderCode: string;
  amountVnd: number;
  providerTransactionId: string | null;
  reason: string;
};

export type RefundResult =
  | { ok: true; providerRefundId: string }
  | { ok: false; message: string };

export class PaymentProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentProviderConfigError";
  }
}

export interface PaymentProvider {
  /** Giá trị lưu ở PaymentTransaction.provider: "VNPAY" hoặc "MOCK". */
  readonly name: "VNPAY" | "MOCK";
  readonly isSimulated: boolean;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  /** Kiểm tra dữ liệu callback/IPN (chữ ký với VNPAY) và chuyển thành PaymentCallback chuẩn. */
  verifyCallback(raw: URLSearchParams | Record<string, string>): VerifyCallbackResult;
  refund(input: RefundInput): Promise<RefundResult>;
}
