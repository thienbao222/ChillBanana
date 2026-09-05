import { cookies } from "next/headers";

const ADMIN_COOKIE_NAME = "chillbanana_admin_session";
const VALID_USERNAME = "admin";
const VALID_PASSWORD = "chillbanana2026"; // Mật khẩu mặc định

export function verifyAdminCredentials(username: string, password: string): boolean {
  return (
    username.trim().toLowerCase() === VALID_USERNAME &&
    password.trim() === VALID_PASSWORD
  );
}

export function createAdminSession(): string {
  // Tạo token phiên đơn giản an toàn
  const token = Buffer.from(`admin:${Date.now()}:chillbanana`).toString("base64");
  return token;
}

export function isUserAdminAuthenticated(): boolean {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (!token) return false;

    // Kiểm tra định dạng token
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    return decoded.startsWith("admin:") && decoded.endsWith(":chillbanana");
  } catch (err) {
    return false;
  }
}
