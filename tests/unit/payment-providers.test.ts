import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MockPaymentProvider,
  MOCK_SCENARIOS,
  PaymentProviderConfigError,
  VnpayProvider,
  getPaymentProvider,
  isMockScenario,
} from "@/features/payments/providers";
import { verifyVnpaySignature } from "@/lib/vnpay-payment";
import { MockShippingProvider } from "@/features/logistics/shipping-provider";
import { DEFAULT_PRICING_CONFIG } from "@/features/pricing/config";
import { signVnpay } from "../helpers/vnpay";

beforeEach(() => {
  vi.stubEnv("VNPAY_TMN_CODE", "TESTTMN1");
  vi.stubEnv("VNPAY_HASH_SECRET", "unit-test-secret");
  vi.stubEnv("VNPAY_URL", "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");
});
afterEach(() => vi.unstubAllEnvs());

describe("MockPaymentProvider", () => {
  const mock = new MockPaymentProvider();
  const input = { orderCode: "CB-1", amountVnd: 500_000, txnId: "TX1" };

  it("createPayment: mô phỏng, không có URL thanh toán thật", async () => {
    const r = await mock.createPayment({ orderCode: "CB-1", amountVnd: 1, returnUrl: "http://x" });
    expect(r).toMatchObject({ provider: "MOCK", paymentUrl: null, isSimulated: true });
    expect(r.providerReference).toContain("CB-1");
  });

  it("mỗi kịch bản cho đúng kết quả", () => {
    const outcome = (s: (typeof MOCK_SCENARIOS)[number]) => mock.buildCallbacks(s, input).map((c) => c.outcome);
    expect(outcome("success")).toEqual(["SUCCESS"]);
    expect(outcome("failed")).toEqual(["FAILED"]);
    expect(outcome("pending")).toEqual(["PENDING"]);
    expect(outcome("timeout")).toEqual(["TIMEOUT"]);
    expect(outcome("cancelled")).toEqual(["CANCELLED"]);
  });

  it("kịch bản duplicate gửi hai callback thành công giống hệt nhau (webhook trùng)", () => {
    const [a, b] = mock.buildCallbacks("duplicate", input);
    expect(a).toEqual(b);
    expect(a.outcome).toBe("SUCCESS");
    expect(a.providerTransactionId).toBe("TX1");
  });

  it("callback thất bại có lý do, thành công thì không", () => {
    expect(mock.buildCallbacks("failed", input)[0].failureReason).toBeTruthy();
    expect(mock.buildCallbacks("success", input)[0].failureReason).toBeUndefined();
  });

  it("verifyCallback chấp nhận dữ liệu hợp lệ và từ chối dữ liệu hỏng", () => {
    const ok = mock.verifyCallback({ mock_order_code: "CB-1", mock_amount_vnd: "500000", mock_outcome: "FAILED", mock_txn_id: "T9" });
    expect(ok).toMatchObject({ valid: true, callback: { orderCode: "CB-1", amountVnd: 500_000, outcome: "FAILED", providerTransactionId: "T9" } });
    expect(mock.verifyCallback({ mock_order_code: "", mock_amount_vnd: "1", mock_outcome: "SUCCESS" }).valid).toBe(false);
    expect(mock.verifyCallback({ mock_order_code: "CB-1", mock_amount_vnd: "-5", mock_outcome: "SUCCESS" }).valid).toBe(false);
    expect(mock.verifyCallback({ mock_order_code: "CB-1", mock_amount_vnd: "5", mock_outcome: "LOL" }).valid).toBe(false);
  });

  it("refund: thành công khi có mã giao dịch gốc, thất bại khi không có", async () => {
    expect(await mock.refund({ orderCode: "CB-1", amountVnd: 1, providerTransactionId: "TX1", reason: "x" })).toEqual({ ok: true, providerRefundId: "MOCKREFUND-TX1" });
    expect((await mock.refund({ orderCode: "CB-1", amountVnd: 1, providerTransactionId: null, reason: "x" })).ok).toBe(false);
  });

  it("isMockScenario", () => {
    expect(isMockScenario("success")).toBe(true);
    expect(isMockScenario("boom")).toBe(false);
    expect(isMockScenario(undefined)).toBe(false);
  });
});

describe("VnpayProvider", () => {
  const sandbox = new VnpayProvider("vnpay-sandbox");

  it("createPayment tạo URL có chữ ký mà verifyVnpaySignature chấp nhận, số tiền nhân 100", async () => {
    const r = await sandbox.createPayment({ orderCode: "CB-1", amountVnd: 530_400, ipAddress: "1.2.3.4", returnUrl: "https://shop.example/return" });
    expect(r.isSimulated).toBe(true);
    const url = new URL(r.paymentUrl!);
    expect(url.origin + url.pathname).toBe("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");
    expect(url.searchParams.get("vnp_Amount")).toBe("53040000");
    expect(url.searchParams.get("vnp_TxnRef")).toBe("CB-1");
    expect(verifyVnpaySignature(url.searchParams)).toBe(true);
  });

  it("thiếu cấu hình thì ném PaymentProviderConfigError", async () => {
    vi.stubEnv("VNPAY_HASH_SECRET", "");
    await expect(sandbox.createPayment({ orderCode: "CB-1", amountVnd: 1, returnUrl: "x" })).rejects.toBeInstanceOf(PaymentProviderConfigError);
  });

  it("chế độ live không bị đánh dấu là mô phỏng", () => {
    expect(new VnpayProvider("vnpay-live").isSimulated).toBe(false);
  });

  const signed = (over: Record<string, string> = {}) => {
    const params: Record<string, string> = {
      vnp_TxnRef: "CB-1",
      vnp_Amount: "53040000",
      vnp_TransactionNo: "T77",
      vnp_ResponseCode: "00",
      vnp_TransactionStatus: "00",
      ...over,
    };
    return new URLSearchParams({ ...params, vnp_SecureHash: signVnpay(params, "unit-test-secret") });
  };

  it("verifyCallback: thành công, hủy (24), thất bại (mã khác)", () => {
    expect(sandbox.verifyCallback(signed())).toMatchObject({ valid: true, callback: { outcome: "SUCCESS", amountVnd: 530_400, providerTransactionId: "T77" } });
    expect(sandbox.verifyCallback(signed({ vnp_ResponseCode: "24", vnp_TransactionStatus: "02" }))).toMatchObject({ valid: true, callback: { outcome: "CANCELLED" } });
    expect(sandbox.verifyCallback(signed({ vnp_ResponseCode: "51", vnp_TransactionStatus: "02" }))).toMatchObject({ valid: true, callback: { outcome: "FAILED" } });
  });

  it("mã giao dịch '0' của giao dịch thất bại được coi là không có mã", () => {
    const r = sandbox.verifyCallback(signed({ vnp_ResponseCode: "51", vnp_TransactionNo: "0" }));
    expect(r).toMatchObject({ valid: true, callback: { providerTransactionId: null } });
  });

  it("verifyCallback từ chối chữ ký sai hoặc số tiền hỏng", () => {
    const forged = signed();
    forged.set("vnp_Amount", "1");
    expect(sandbox.verifyCallback(forged).valid).toBe(false);
    expect(sandbox.verifyCallback(signed({ vnp_Amount: "12abc" })).valid).toBe(false);
  });

  it("refund chưa tích hợp: báo rõ để hoàn thủ công", async () => {
    const r = await sandbox.refund({ orderCode: "CB-1", amountVnd: 1, providerTransactionId: "T", reason: "x" });
    expect(r.ok).toBe(false);
  });
});

describe("getPaymentProvider", () => {
  it("chọn theo PAYMENT_PROVIDER; mặc định là VNPAY sandbox", () => {
    expect(getPaymentProvider({}).name).toBe("VNPAY");
    expect(getPaymentProvider({}).isSimulated).toBe(true);
    expect(getPaymentProvider({ PAYMENT_PROVIDER: "mock" }).name).toBe("MOCK");
    expect(getPaymentProvider({ PAYMENT_PROVIDER: "vnpay-live" }).isSimulated).toBe(false);
  });
  it("từ chối mock trên production", () => {
    expect(() => getPaymentProvider({ PAYMENT_PROVIDER: "mock", VERCEL_ENV: "production" })).toThrow();
  });
});

describe("MockShippingProvider", () => {
  const shipping = new MockShippingProvider(DEFAULT_PRICING_CONFIG);

  it("báo cước theo cấu hình giá và luôn đánh dấu mô phỏng", async () => {
    const q = await shipping.quote({ weightKg: 2 });
    expect(q).toMatchObject({ feeVnd: 370_000, isSimulated: true });
    expect((await new MockShippingProvider({ ...DEFAULT_PRICING_CONFIG, airShippingPerKgVnd: 100_000 }).quote({ weightKg: 2 })).feeVnd).toBe(200_000);
    expect((await shipping.quote({ weightKg: -1 })).feeVnd).toBe(0);
  });

  it("tạo vận đơn và hành trình mô phỏng cố định", async () => {
    const s = await shipping.createShipment({ orderCode: "CB-1", weightKg: 1, address: "1 Test" });
    expect(s).toMatchObject({ trackingCode: "MOCK-CB-1", isSimulated: true });
    const events = await shipping.getTrackingEvents(s.trackingCode);
    expect(events.map((e) => e.status)).toEqual(["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"]);
    expect(events.every((e) => e.isSimulated)).toBe(true);
    await expect(shipping.createShipment({ orderCode: "CB-1", weightKg: 1, address: "  " })).rejects.toThrow();
  });
});
