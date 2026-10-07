import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_COOKIE_NAME,
  hashAdminPassword,
  createAdminSessionToken,
  verifyAdminSessionToken,
} from "@/lib/auth-session";

export const dynamic = "force-dynamic";

// GET: Kiểm tra trạng thái phiên đăng nhập của Admin
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(ADMIN_COOKIE_NAME);
  if (!cookie || !cookie.value) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const { valid, username } = verifyAdminSessionToken(cookie.value);
  if (!valid || !username) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // Lấy thông tin admin từ DB hoặc tài khoản mặc định
  let adminUser = null;
  try {
    adminUser = await prisma.adminUser.findUnique({
      where: { username },
      select: { id: true, username: true, name: true, role: true },
    });
  } catch (err) {
    // Postgres/Neon connection issue
  }

  return NextResponse.json({
    authenticated: true,
    user: adminUser || { username, name: "Quản Trị Viên ChillBanana", role: "SUPER_ADMIN" },
  });
}

// POST: Xử lý Đăng nhập
export async function POST(req: NextRequest) {
  // SECURITY: Only DB-based authentication allowed. No hardcoded credentials.
  // To set up admin: run `npm run prisma:seed` or create AdminUser via Prisma Studio.
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu." },
        { status: 400 }
      );
    }

    const trimmedUser = username.trim().toLowerCase();
    const inputHash = hashAdminPassword(password);
    let isAuthenticated = false;
    let adminName = "Quản Trị Viên ChillBanana";
    let adminRole = "SUPER_ADMIN";

    // 1. Kiểm tra trong CSDL Prisma
    try {
      const dbAdmin = await prisma.adminUser.findUnique({
        where: { username: trimmedUser },
      });

      if (dbAdmin) {
        if (dbAdmin.passwordHash === inputHash) {
          isAuthenticated = true;
          adminName = dbAdmin.name;
          adminRole = dbAdmin.role;
        }
      }
    } catch (dbErr) {
      console.warn("DB check error in admin auth, testing fallback:", dbErr);
    }

    if (!isAuthenticated) {
      return NextResponse.json(
        { error: "Tên đăng nhập hoặc mật khẩu quản trị không chính xác." },
        { status: 401 }
      );
    }

    // Thiết lập Cookie phiên đăng nhập bảo mật
    const token = createAdminSessionToken(trimmedUser);
    const response = NextResponse.json({
      success: true,
      message: "Đăng nhập thành công!",
      user: {
        username: trimmedUser,
        name: adminName,
        role: adminRole,
      },
    });

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err) {
    console.error("Lỗi đăng nhập admin:", err);
    return NextResponse.json({ error: "Lỗi xử lý đăng nhập." }, { status: 500 });
  }
}

// DELETE: Đăng xuất
export async function DELETE() {
  const response = NextResponse.json({ success: true, message: "Đã đăng xuất thành công." });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
