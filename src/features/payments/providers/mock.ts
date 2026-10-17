import crypto from "node:crypto";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentCallback,
  PaymentOutcome,
  PaymentProvider,
  RefundInput,
  RefundResult,
  VerifyCallbackResult,
} from "./types";

// Nhà cung cấp mô phỏng: không có tiền thật. Dùng để diễn tập mọi tình huống thanh toán khi chưa có cổng thật.
// Bị từ chối trên production (xem getPaymentProviderMode trong src/lib/env.ts).

export type MockScenario = "success" | "failed" | "pending" | "timeout" | "cancelled" | "duplicate";

export const MOCK_SCENARIOS: readonly MockScenario[] = ["success", "failed", "pending", "timeout", "cancelled", "duplicate"];

const OUTCOME_BY_SCENARIO: Record<Exclude<MockScenario, "duplicate">, PaymentOutcome> = {
  success: "SUCCESS",
  failed: "FAILED",
  pending: "PENDING",
  timeout: "TIMEOUT",
  cancelled: "CANCELLED",
};

const FAILURE_REASON: Partial<Record<PaymentOutcome, string>> = {
  FAILED: "Mô phỏng: ngân hàng từ chối giao dịch",
  TIMEOUT: "Mô phỏng: hết thời gian chờ thanh toán",
  CANCELLED: "Mô phỏng: khách hủy thanh toán",
};

export function isMockScenario(value: unknown): value is MockScenario {
  return typeof value === "string" && (MOCK_SCENARIOS as readonly string[]).includes(value);
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "MOCK" as const;
  readonly isSimulated = true;

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return {
      provider: this.name,
      providerReference: `MOCK-${input.orderCode}-${crypto.randomBytes(4).toString("hex")}`,
      paymentUrl: null,
      isSimulated: true,
    };
  }

  /**
   * Sinh các callback mà cổng giả lập sẽ gửi cho một kịch bản. "duplicate" trả về hai callback thành công
   * giống hệt nhau (webhook gửi trùng). txnId cố định để kiểm tra tính idempotent.
   */
  buildCallbacks(scenario: MockScenario, input: { orderCode: string; amountVnd: number; txnId?: string }): PaymentCallback[] {
    const txnId = input.txnId ?? `MOCKTXN-${crypto.randomBytes(5).toString("hex")}`;
    const make = (outcome: PaymentOutcome): PaymentCallback => ({
      provider: this.name,
      orderCode: input.orderCode,
      amountVnd: input.amountVnd,
      outcome,
      providerTransactionId: txnId,
      failureReason: FAILURE_REASON[outcome],
    });
    if (scenario === "duplicate") return [make("SUCCESS"), make("SUCCESS")];
    return [make(OUTCOME_BY_SCENARIO[scenario])];
  }

  /** Callback mô phỏng dạng form: mock_order_code, mock_amount_vnd, mock_outcome, mock_txn_id, mock_reason. */
  verifyCallback(raw: URLSearchParams | Record<string, string>): VerifyCallbackResult {
    const get = (key: string) => (raw instanceof URLSearchParams ? raw.get(key) : raw[key]) ?? "";
    const orderCode = get("mock_order_code");
    const amountVnd = Number(get("mock_amount_vnd"));
    const outcome = get("mock_outcome") as PaymentOutcome;
    if (!orderCode) return { valid: false, reason: "Thiếu mã đơn" };
    if (!Number.isSafeInteger(amountVnd) || amountVnd <= 0) return { valid: false, reason: "Số tiền không hợp lệ" };
    if (!["SUCCESS", "FAILED", "PENDING", "TIMEOUT", "CANCELLED"].includes(outcome)) return { valid: false, reason: "Kết quả không hợp lệ" };
    return {
      valid: true,
      callback: {
        provider: this.name,
        orderCode,
        amountVnd,
        outcome,
        providerTransactionId: get("mock_txn_id") || null,
        failureReason: get("mock_reason") || FAILURE_REASON[outcome],
      },
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    if (!input.providerTransactionId) return { ok: false, message: "Giao dịch gốc không có mã giao dịch" };
    return { ok: true, providerRefundId: `MOCKREFUND-${input.providerTransactionId}` };
  }
}
