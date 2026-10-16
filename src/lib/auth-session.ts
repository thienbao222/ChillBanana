import type { NextRequest } from "next/server";
import crypto from "crypto";
import {
  hashPassword,
  verifyAdminPassword as verifyAdminPasswordCore,
  verifyLegacyCustomerSha256,
  verifyScryptPassword,
  isScryptHash,
  type PasswordCheck,
} from "@/lib/password";

// ============================================================================
// Module xác thực phiên đăng nhập DÙNG CHUNG cho Admin & Customer.
//
// TẠI SAO FILE NÀY TỒN TẠI:
// Trước đây mỗi route (products, orders, admin/customers, admin/reports,
// admin/funnel, admin/chat-trends, admin/assistant, admin/api-keys,
// admin/stitch-all, analytics/chats, customer/profile, auth/customer...)
// tự khai báo lại logic đọc ADMIN_SESSION_SECRET / CUSTOMER_SESSION_SECRET,
// và vài file lại tự bịa một giá trị fallback KHÁC NHAU khi thiếu biến môi
// trường (`"chillbanana_secure_admin_salt_2026"` ở một nhóm file, còn
// `'INSECURE_PLACEHOLDER_SET_ADMIN_SESSION_SECRET_ENV'` ở nhóm file khác).
//
// Hậu quả thực tế: nếu ADMIN_SESSION_SECRET chưa được set trên Vercel, cookie
// đăng nhập admin được ký bằng fallback A (ở admin/auth), nhưng route Sản
// phẩm/Khách hàng/Báo cáo/Funnel/AI Agent/API Keys lại verify bằng fallback
// B khác -> admin đăng nhập được nhưng vào các mục đó bị 401 "Không có quyền
// truy cập". Gom về một nơi duy nhất để toàn bộ hệ thống luôn dùng ĐÚNG MỘT
// giá trị secret, dù biến môi trường có được set hay không.
// ============================================================================

export const ADMIN_COOKIE_NAME = "chillbanana_admin_session";
export const CUSTOMER_COOKIE_NAME = "cb_customer_session";
export const ORDER_ACCESS_COOKIE_NAME = "cb_order_access";

const isProd = process.env.NODE_ENV === "production";

function resolveSecret(
  envValue: string | undefined,
  envName: string,
  devFallback: string,
  warnedRef: { warned: boolean }
): string {
  if (envValue) return envValue;
  if (isProd) {
    throw new Error(`[SECURITY] ${envName} bắt buộc phải được cấu hình trong production.`);
  }
  if (!warnedRef.warned) {
    warnedRef.warned = true;
    console.error(
      `[SECURITY] ${envName} chưa được thiết lập trong biến môi trường. ` +
        (isProd
          ? `Đây là PRODUCTION — đang dùng secret tạm thời KHÔNG AN TOÀN, hãy set ${envName} trên Vercel (Settings → Environment Variables) rồi redeploy ngay.`
          : `Đang dùng secret tạm thời cho môi trường dev.`)
    );
  }
  return devFallback;
}

// Secret được "nhớ" (memoize) qua biến module-level, tính đúng 1 lần cho mỗi
// cold start — tránh log cảnh báo lặp lại ở mỗi request, nhưng vẫn đảm bảo
// MỌI route trong cùng 1 lần deploy đều đọc ra cùng 1 giá trị.
const adminWarnState = { warned: false };
const customerWarnState = { warned: false };

function getAdminSecret(): string {
  return resolveSecret(
    process.env.ADMIN_SESSION_SECRET,
    "ADMIN_SESSION_SECRET",
    "dev-only-insecure-admin-secret-do-not-use-in-prod",
    adminWarnState
  );
}

function getCustomerSecret(): string {
  return resolveSecret(
    process.env.CUSTOMER_SESSION_SECRET,
    "CUSTOMER_SESSION_SECRET",
    "dev-only-insecure-customer-secret-do-not-use-in-prod",
    customerWarnState
  );
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function sign(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function encodeToken(payload: string, signature: string): string {
  return Buffer.from(`${payload}::${signature}`).toString("base64");
}

function decodeToken(token: string): { payloadStr: string; signature: string } | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const sepIndex = decoded.lastIndexOf("::");
    if (sepIndex === -1) return null;
    return { payloadStr: decoded.slice(0, sepIndex), signature: decoded.slice(sepIndex + 2) };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// ADMIN
// ---------------------------------------------------------------------------

/** Hash mật khẩu admin mới: scrypt có salt riêng (không còn phụ thuộc ADMIN_SESSION_SECRET). */
export function hashAdminPassword(password: string): string {
  return hashPassword(password);
}

/**
 * Kiểm tra mật khẩu admin. Hỗ trợ hash HMAC cũ để chuyển tiếp: nếu khớp thì needsRehash=true
 * và nơi gọi phải lưu lại hash scrypt mới.
 */
export function verifyAdminPassword(password: string, storedHash: string): PasswordCheck {
  return verifyAdminPasswordCore(password, storedHash, process.env.ADMIN_SESSION_SECRET);
}

export function createAdminSessionToken(username: string): string {
  const payload = JSON.stringify({ username, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 });
  return encodeToken(payload, sign(getAdminSecret(), payload));
}

export function verifyAdminSessionToken(token: string): { valid: boolean; username?: string } {
  const decoded = decodeToken(token);
  if (!decoded) return { valid: false };
  const expected = sign(getAdminSecret(), decoded.payloadStr);
  if (!safeEqual(expected, decoded.signature)) return { valid: false };
  try {
    const payload = JSON.parse(decoded.payloadStr);
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return { valid: false };
    return { valid: true, username: payload.username };
  } catch {
    return { valid: false };
  }
}

/** Dùng trong route handler: true/false xem request hiện tại có phải admin đã đăng nhập hợp lệ không. */
export function isAdminRequest(req: NextRequest): boolean {
  const cookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!cookie) return false;
  return verifyAdminSessionToken(cookie).valid;
}

export function getAdminUsernameFromRequest(req: NextRequest): string | null {
  const cookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!cookie) return null;
  const session = verifyAdminSessionToken(cookie);
  return session.valid && typeof session.username === "string" ? session.username : null;
}

// ---------------------------------------------------------------------------
// CUSTOMER
// ---------------------------------------------------------------------------

export function hashCustomerPassword(password: string): string {
  return hashPassword(password);
}

export function verifyCustomerPassword(password: string, storedHash: string): PasswordCheck {
  if (isScryptHash(storedHash)) {
    return { valid: verifyScryptPassword(password, storedHash), needsRehash: false };
  }
  // Hash đời đầu được nâng cấp sau khi đăng nhập thành công.
  const valid = verifyLegacyCustomerSha256(password, storedHash);
  return { valid, needsRehash: valid };
}

export function createCustomerSessionToken(data: { id: string; email: string }): string {
  const payload = JSON.stringify({ ...data, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 });
  return encodeToken(payload, sign(getCustomerSecret(), payload));
}

export function createCustomerEmailVerificationToken(data: { id: string; email: string }): string {
  const payload = JSON.stringify({ ...data, purpose: "verify-email", exp: Date.now() + 1000 * 60 * 60 * 24 });
  return encodeToken(payload, sign(getCustomerSecret(), payload));
}

export function verifyCustomerEmailVerificationToken(token: string): { id: string; email: string } | null {
  const decoded = decodeToken(token);
  if (!decoded) return null;
  const expected = sign(getCustomerSecret(), decoded.payloadStr);
  if (!safeEqual(expected, decoded.signature)) return null;
  try {
    const payload = JSON.parse(decoded.payloadStr);
    if (payload.purpose !== "verify-email" || typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (typeof payload.id !== "string" || typeof payload.email !== "string") return null;
    return { id: payload.id, email: payload.email };
  } catch {
    return null;
  }
}

export function verifyCustomerSessionToken(token: string): { id: string; email: string } | null {
  const decoded = decodeToken(token);
  if (!decoded) return null;
  const expected = sign(getCustomerSecret(), decoded.payloadStr);
  if (!safeEqual(expected, decoded.signature)) return null;
  try {
    const payload = JSON.parse(decoded.payloadStr);
    if (!payload?.id || !payload?.email || typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return { id: payload.id, email: payload.email };
  } catch {
    return null;
  }
}

/** Dùng trong route handler: lấy {id, email} của khách đang đăng nhập từ cookie, hoặc null nếu chưa đăng nhập/không hợp lệ. */
export function getCustomerFromRequest(req: NextRequest): { id: string; email: string } | null {
  const cookie = req.cookies.get(CUSTOMER_COOKIE_NAME)?.value;
  if (!cookie) return null;
  return verifyCustomerSessionToken(cookie);
}

type GuestOrderAccess = { orderCode: string; emailDigest: string };

function digestOrderEmail(email: string): string {
  return sign(getCustomerSecret(), `guest-order-email:${email.trim().toLowerCase()}`);
}

/** Short-lived bearer link sent only to the email address attached to a guest order. */
export function createGuestOrderAccessToken(orderCode: string, email: string): string {
  const payload = JSON.stringify({
    purpose: "guest-order-access",
    orderCode,
    emailDigest: digestOrderEmail(email),
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  });
  return encodeToken(payload, sign(getCustomerSecret(), payload));
}

export function verifyGuestOrderAccessToken(token: string): (GuestOrderAccess & { exp: number }) | null {
  const decoded = decodeToken(token);
  if (!decoded) return null;
  const expected = sign(getCustomerSecret(), decoded.payloadStr);
  if (!safeEqual(expected, decoded.signature)) return null;
  try {
    const payload = JSON.parse(decoded.payloadStr);
    if (
      payload.purpose !== "guest-order-access" ||
      typeof payload.exp !== "number" || payload.exp < Date.now() ||
      typeof payload.orderCode !== "string" ||
      typeof payload.emailDigest !== "string" || !/^[a-f0-9]{64}$/i.test(payload.emailDigest)
    ) return null;
    return { orderCode: payload.orderCode, emailDigest: payload.emailDigest, exp: payload.exp };
  } catch {
    return null;
  }
}

export function hasGuestOrderAccessForEmail(token: string | null | undefined, orderCode: string, email: string): boolean {
  if (!token) return false;
  const access = verifyGuestOrderAccessToken(token);
  return Boolean(
    access && access.orderCode === orderCode && safeEqual(access.emailDigest, digestOrderEmail(email))
  );
}
