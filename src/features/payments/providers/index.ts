import { getPaymentProviderMode } from "@/lib/env";
import { MockPaymentProvider } from "./mock";
import { VnpayProvider } from "./vnpay";
import type { PaymentProvider } from "./types";

export * from "./types";
export { MockPaymentProvider, isMockScenario, MOCK_SCENARIOS, type MockScenario } from "./mock";
export { VnpayProvider } from "./vnpay";

/** Chọn nhà cung cấp theo PAYMENT_PROVIDER (mock | vnpay-sandbox | vnpay-live). Production từ chối mock. */
export function getPaymentProvider(env: Record<string, string | undefined> = process.env): PaymentProvider {
  const mode = getPaymentProviderMode(env);
  if (mode === "mock") return new MockPaymentProvider();
  return new VnpayProvider(mode);
}
