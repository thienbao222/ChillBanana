/**
 * pii-masker.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Bộ khử trùng và che giấu dữ liệu định danh cá nhân (PII Masking)
 * Đảm bảo thông tin nhạy cảm của khách hàng không bị truyền sang các nhà cung cấp AI bên thứ 3.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Regex nhận diện số điện thoại VN và Nhật Bản
const PHONE_REGEX = /(\+?84|0[35789]|0[1-9]\d{1,2}|(\+?81\s?[789]0)|0[789]0)\s?\d{3,4}\s?\d{3,4}/g;

// Regex nhận diện địa chỉ email
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Regex nhận diện số nhà / đường / mansion chi tiết
const ADDRESS_PATTERNS = /(số\s+\d+|ngõ\s+\d+|ngách\s+\d+|hẻm\s+\d+|tầng\s+\d+|\d+\s*-\s*\d+\s*-\s*\d+)/gi;

export function maskPiiBeforeAi(text: string): string {
  if (typeof text !== "string") return "";

  return text
    .replace(EMAIL_REGEX, "[EMAIL_MASKED]")
    .replace(PHONE_REGEX, "[PHONE_MASKED]")
    .replace(ADDRESS_PATTERNS, "[ADDRESS_MASKED]");
}

export function maskEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return "***@***";
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length <= 2 ? `${name[0]}*` : `${name.slice(0, 2)}***${name.slice(-1)}`;
  return `${maskedName}@${domain}`;
}

export function maskPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  return `${digits.slice(0, 3)}****${digits.slice(-3)}`;
}

