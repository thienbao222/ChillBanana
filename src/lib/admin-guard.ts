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

export type AdminRole = "SUPER_ADMIN" | "OPERATOR";

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

  if (options.roles && !options.roles.includes(admin.role as AdminRole)) {
    return { ok: false, response: NextResponse.json({ error: "Tài khoản của bạn không đủ quyền cho thao tác này." }, { status: 403 }) };
  }
  return {
    ok: true,
    username: admin.username,
    role: admin.role,
    admin: { username: admin.username, role: admin.role },
  };
}

/** Dùng cho route dùng chung (khách và admin): true chỉ khi cookie hợp lệ VÀ tài khoản admin còn tồn tại trong database. */
export async function isVerifiedAdmin(req: NextRequest): Promise<boolean> {
  const result = await requireAdmin(req);
  return result.ok;
}
