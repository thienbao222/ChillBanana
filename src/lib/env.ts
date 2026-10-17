// Cấu hình môi trường tập trung. Quy tắc kiểm tra khi deploy production nằm ở scripts/env-rules.js.
import { PAYMENT_PROVIDER_MODES, parsePaymentProviderMode } from "../../scripts/env-rules.js";

export type PaymentProviderMode = "mock" | "vnpay-sandbox" | "vnpay-live";

/** Chế độ nhà cung cấp thanh toán. Mặc định vnpay-sandbox; giá trị không hợp lệ thì báo lỗi rõ ràng. */
export function getPaymentProviderMode(env: Record<string, string | undefined> = process.env): PaymentProviderMode {
  const parsed = parsePaymentProviderMode(env);
  if (!parsed.valid) {
    throw new Error(`PAYMENT_PROVIDER="${parsed.mode}" không hợp lệ (chỉ nhận ${PAYMENT_PROVIDER_MODES.join(", ")}).`);
  }
  if (parsed.mode === "mock" && env.VERCEL_ENV === "production") {
    throw new Error("PAYMENT_PROVIDER=mock bị từ chối trên production.");
  }
  return parsed.mode as PaymentProviderMode;
}

/**
 * Địa chỉ công khai của website (không có dấu / ở cuối).
 * Không còn domain hard-code: production bắt buộc có NEXT_PUBLIC_APP_URL (được kiểm tra lúc build).
 */
export function getAppUrl(env: Record<string, string | undefined> = process.env): string {
  const configured = env.APP_URL || env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (env.VERCEL_ENV === "preview" && env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  if (env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error("Thiếu NEXT_PUBLIC_APP_URL: không thể xác định địa chỉ công khai của website.");
}
