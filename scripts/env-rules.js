// Quy tắc kiểm tra biến môi trường cho bản deploy production (CommonJS để vercel-build.js dùng được).
// Được kiểm thử bằng tests/unit/env-rules.test.ts. Không đọc process.env trực tiếp: nhận env làm tham số.

const PAYMENT_PROVIDER_MODES = ["mock", "vnpay-sandbox", "vnpay-live"];
const DEFAULT_PAYMENT_PROVIDER = "vnpay-sandbox";

function parsePaymentProviderMode(env) {
  const raw = (env.PAYMENT_PROVIDER || "").trim().toLowerCase();
  if (!raw) return { mode: DEFAULT_PAYMENT_PROVIDER, valid: true };
  return PAYMENT_PROVIDER_MODES.includes(raw) ? { mode: raw, valid: true } : { mode: raw, valid: false };
}

function isSandboxVnpayUrl(url) {
  return /sandbox\.vnpayment\.vn/i.test(url);
}

/** Trả về { errors, warnings }. errors không rỗng nghĩa là KHÔNG được deploy production. */
function validateProductionEnv(env) {
  const errors = [];
  const warnings = [];

  for (const key of ["DATABASE_URL", "ADMIN_SESSION_SECRET", "CUSTOMER_SESSION_SECRET", "CRON_SECRET"]) {
    if (!env[key]) errors.push(`Thiếu biến môi trường bắt buộc ${key}.`);
  }
  for (const key of ["ADMIN_SESSION_SECRET", "CUSTOMER_SESSION_SECRET", "CRON_SECRET"]) {
    if (env[key] && env[key].length < 32) warnings.push(`${key} ngắn hơn 32 ký tự; nên dùng chuỗi ngẫu nhiên dài hơn.`);
  }

  const appUrl = env.APP_URL || env.NEXT_PUBLIC_APP_URL || "";
  if (!appUrl) {
    errors.push("Thiếu NEXT_PUBLIC_APP_URL (địa chỉ công khai của website, ví dụ https://ten-mien-cua-ban). Không còn dùng domain mặc định trong code.");
  } else if (!/^https:\/\//i.test(appUrl)) {
    errors.push(`NEXT_PUBLIC_APP_URL/APP_URL phải bắt đầu bằng https:// (hiện tại: ${appUrl}).`);
  } else if (/localhost|127\.0\.0\.1/i.test(appUrl)) {
    errors.push("NEXT_PUBLIC_APP_URL/APP_URL không được trỏ về localhost trên production.");
  }

  if (env.APP_ENV === "test") errors.push("APP_ENV=test không được bật trên production (bật hook tỷ giá cố định dành cho kiểm thử).");
  if (env.TEST_FIXED_JPY_VND_RATE) warnings.push("TEST_FIXED_JPY_VND_RATE đang được đặt; chỉ dành cho kiểm thử, nên xóa khỏi production.");
  if (env.ADMIN_INITIAL_PASSWORD) warnings.push("ADMIN_INITIAL_PASSWORD đang được đặt trên production; nên xóa sau khi tạo tài khoản admin.");

  const provider = parsePaymentProviderMode(env);
  if (!provider.valid) {
    errors.push(`PAYMENT_PROVIDER="${provider.mode}" không hợp lệ. Chỉ nhận: ${PAYMENT_PROVIDER_MODES.join(", ")}.`);
  } else if (provider.mode === "mock") {
    errors.push("PAYMENT_PROVIDER=mock không được dùng trên production (thanh toán giả lập sẽ ghi nhận tiền không có thật).");
  } else {
    for (const key of ["VNPAY_TMN_CODE", "VNPAY_HASH_SECRET", "VNPAY_URL"]) {
      if (!env[key]) warnings.push(`Thiếu ${key}: thanh toán VNPAY sẽ báo "chưa cấu hình" cho tới khi bổ sung.`);
    }
    if (env.VNPAY_URL) {
      const sandboxUrl = isSandboxVnpayUrl(env.VNPAY_URL);
      if (provider.mode === "vnpay-live" && sandboxUrl) errors.push("PAYMENT_PROVIDER=vnpay-live nhưng VNPAY_URL là địa chỉ sandbox.");
      if (provider.mode === "vnpay-sandbox" && !sandboxUrl) errors.push("PAYMENT_PROVIDER=vnpay-sandbox nhưng VNPAY_URL không phải địa chỉ sandbox (tránh nhận tiền thật khi đang chạy thử).");
    }
  }

  return { errors, warnings };
}

module.exports = { PAYMENT_PROVIDER_MODES, DEFAULT_PAYMENT_PROVIDER, parsePaymentProviderMode, validateProductionEnv };
