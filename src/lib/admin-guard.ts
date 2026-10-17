import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUsernameFromRequest } from "@/lib/auth-session";

// Kiểm tra quyền admin ở backend: ngoài việc cookie hợp lệ, còn đối chiếu với bảng AdminUser
// để tài khoản đã bị xóa mất quyền ngay và để kiểm tra được vai trò (role).

export type AdminRole = "SUPER_ADMIN" | "OPERATOR";

export type AdminGuardResult =
  | { ok: true; username: string; role: string }
  | { ok: false; response: NextResponse };

export async function requireAdmin(req: NextRequest, options: { roles?: AdminRole[] } = {}): Promise<AdminGuardResult> {
  const username = getAdminUsernameFromRequest(req);
  if (!username) {
    return { ok: false, response: NextResponse.json({ error: "Không có quyền truy cập quản trị." }, { status: 401 }) };
  }

  let admin: { username: string; role: string } | null;
  try {
    admin = await prisma.adminUser.findUnique({ where: { username }, select: { username: true, role: true } });
  } catch (error) {
    console.error("[AdminGuard] Không kiểm tra được tài khoản quản trị:", error);
    return { ok: false, response: NextResponse.json({ error: "Không thể xác minh quyền quản trị lúc này." }, { status: 503 }) };
  }

  if (!admin) {
    return { ok: false, response: NextResponse.json({ error: "Không có quyền truy cập quản trị." }, { status: 401 }) };
  }
  if (options.roles && !options.roles.includes(admin.role as AdminRole)) {
    return { ok: false, response: NextResponse.json({ error: "Tài khoản của bạn không đủ quyền cho thao tác này." }, { status: 403 }) };
  }
  return { ok: true, username: admin.username, role: admin.role };
}

/** Dùng cho route dùng chung (khách và admin): true chỉ khi cookie hợp lệ VÀ tài khoản admin còn tồn tại trong database. */
export async function isVerifiedAdmin(req: NextRequest): Promise<boolean> {
  return (await requireAdmin(req)).ok;
}
