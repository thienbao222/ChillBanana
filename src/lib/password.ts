import crypto from "crypto";

// Hash mật khẩu dùng chung cho Admin và Customer: scrypt có salt ngẫu nhiên riêng.
// Định dạng lưu trữ: scrypt$<salt hex>$<hash hex>
// Module này chỉ phụ thuộc node:crypto để có thể kiểm thử độc lập.

const KEY_LENGTH = 64;
const SCRYPT_PREFIX = "scrypt$";

export type PasswordCheck = { valid: boolean; needsRehash: boolean };

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${SCRYPT_PREFIX}${salt}$${hash}`;
}

export function isScryptHash(stored: string): boolean {
  return stored.startsWith(SCRYPT_PREFIX);
}

/** Trả về true nếu mật khẩu khớp hash scrypt đã lưu. Không ném lỗi với dữ liệu hỏng. */
export function verifyScryptPassword(password: string, stored: string): boolean {
  if (!isScryptHash(stored)) return false;
  const [, salt, expectedHex] = stored.split("$");
  if (!salt || !expectedHex || !/^[a-f0-9]+$/i.test(expectedHex)) return false;
  const expected = Buffer.from(expectedHex, "hex");
  if (expected.length !== KEY_LENGTH) return false;
  const actual = crypto.scryptSync(password, salt, KEY_LENGTH);
  return crypto.timingSafeEqual(actual, expected);
}

/**
 * Hash admin cũ: HMAC-SHA256(mật khẩu) bằng ADMIN_SESSION_SECRET, không salt.
 * Chỉ giữ để xác minh lần đăng nhập đầu tiên rồi nâng cấp sang scrypt.
 */
export function legacyAdminHmac(password: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(password).digest("hex");
}

export function verifyAdminPassword(password: string, stored: string, legacySecret: string | undefined): PasswordCheck {
  if (isScryptHash(stored)) {
    return { valid: verifyScryptPassword(password, stored), needsRehash: false };
  }
  if (!legacySecret || !/^[a-f0-9]{64}$/i.test(stored)) return { valid: false, needsRehash: false };
  const expected = Buffer.from(stored, "hex");
  const actual = Buffer.from(legacyAdminHmac(password, legacySecret), "hex");
  const valid = expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
  return { valid, needsRehash: valid };
}

/** Hash khách hàng đời đầu: SHA-256(mật khẩu + salt cố định). Chỉ để nâng cấp sau khi đăng nhập. */
export function verifyLegacyCustomerSha256(password: string, stored: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(stored)) return false;
  const legacy = crypto.createHash("sha256").update(password + "chillbanana-secret-salt-2026").digest();
  const expected = Buffer.from(stored, "hex");
  return legacy.length === expected.length && crypto.timingSafeEqual(legacy, expected);
}
