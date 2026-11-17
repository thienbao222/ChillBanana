import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_COOKIE_NAME,
  computePasswordDigest,
  verifyAdminSessionTokenFull,
  verifySameOrigin as verifySameOriginCore,
} from "@/lib/auth-session";

// Kiểm tra quyền admin ở backend: ngoài việc cookie hợp lệ, còn đối chiếu với bảng AdminUser
// để tài khoản đã bị xóa mất quyền ngay và để kiểm tra được vai trò (role).

export type AdminRole =
  | "SUPER_ADMIN"
  | "OPERATOR"
  | "PURCHASER"
  | "WAREHOUSE"
  | "ACCOUNTANT"
  | "SUPPORT";

export type AdminGuardResult =
  | { ok: true; username: string; role: string; admin: { username: string; role: string } }
  | { ok: false; response: NextResponse };

export function verifySameOrigin(req: NextRequest): NextResponse | null {
  if (!verifySameOriginCore(req)) {
    return NextResponse.json(
      { success: false, error: "Yêu cầu vi phạm kiểm soát nguồn gốc (CSRF protection)." },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Kiểm tra tính hợp lệ của vai trò (WP7.1 - RBAC Matrix).
 * - SUPER_ADMIN luôn luôn có toàn quyền tối cao.
 * - OPERATOR cũ được tự động ánh xạ sang PURCHASER, WAREHOUSE và SUPPORT để không gián đoạn vận hành.
 */
export function hasRequiredRole(adminRole: string, allowedRoles?: AdminRole[]): boolean {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  if (adminRole === "SUPER_ADMIN") return true;

  const effectiveRoles: string[] = [adminRole];
  if (adminRole === "OPERATOR") {
    effectiveRoles.push("PURCHASER", "WAREHOUSE", "SUPPORT");
  }

  return allowedRoles.some((r) => effectiveRoles.includes(r));
}

export async function requireAdmin(req: NextRequest, options: { roles?: AdminRole[] } = {}): Promise<AdminGuardResult> {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const csrfErr = verifySameOrigin(req);
    if (csrfErr) {
      return {
        ok: false,
        response: csrfErr,
      };
    }
  }

  const cookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!cookie) {
    return { ok: false, response: NextResponse.json({ error: "Không có quyền truy cập quản trị." }, { status: 401 }) };
  }

  const session = verifyAdminSessionTokenFull(cookie);
  if (!session.valid || !session.username) {
    return { ok: false, response: NextResponse.json({ error: "Không có quyền truy cập quản trị." }, { status: 401 }) };
  }

  const username = session.username;

  let admin: { username: string; role: string; passwordHash: string } | null;
  try {
    admin = await prisma.adminUser.findUnique({
      where: { username },
      select: { username: true, role: true, passwordHash: true },
    });
  } catch (error) {
    console.error("[AdminGuard] Không kiểm tra được tài khoản quản trị:", error);
    return { ok: false, response: NextResponse.json({ error: "Không thể xác minh quyền quản trị lúc này." }, { status: 503 }) };
  }

  if (!admin) {
    return { ok: false, response: NextResponse.json({ error: "Không có quyền truy cập quản trị." }, { status: 401 }) };
  }

  // BẢO MẬT (P1-03): Đối chiếu pwdDigest nếu có trong token (thu hồi phiên khi đã đổi password)
  if (session.pwdDigest) {
    const expectedDigest = computePasswordDigest(admin.passwordHash);
    if (session.pwdDigest !== expectedDigest) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Phiên quản trị đã hết hạn do mật khẩu đã thay đổi. Vui lòng đăng nhập lại." },
          { status: 401 }
        ),
      };
    }
  }

  if (options.roles && !hasRequiredRole(admin.role, options.roles)) {
    return { ok: false, response: NextResponse.json({ error: "Tài khoản của bạn không đủ quyền cho thao tác này." }, { status: 403 }) };
  }

  return {
    ok: true,
    username: admin.username,
    role: admin.role,
    admin: { username: admin.username, role: admin.role },
  };
}

/**
 * Hàm kiểm tra quyền theo vai trò thống nhất (WP7.1)
 */
export async function requireRole(req: NextRequest, allowedRoles: AdminRole[]): Promise<AdminGuardResult> {
  return requireAdmin(req, { roles: allowedRoles });
}

/** Dùng cho route dùng chung (khách và admin): true chỉ khi cookie hợp lệ VÀ tài khoản admin còn tồn tại trong database. */
export async function isVerifiedAdmin(req: NextRequest): Promise<boolean> {
  const result = await requireAdmin(req);
  return result.ok;
}
