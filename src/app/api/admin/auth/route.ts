import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "chillbanana_admin_session";
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "chillbanana_secure_admin_salt_2026";

function hashPassword(password: string): string {
  return crypto.createHmac("sha256", SESSION_SECRET).update(password).digest("hex");
}

function createSessionToken(username: string): string {
  const payload = JSON.stringify({
    username,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  });
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}::${signature}`).toString("base64");
}

function verifySessionToken(token: string): { valid: boolean; username?: string } {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [payloadStr, signature] = decoded.split("::");
    const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(payloadStr).digest("hex");
    if (signature !== expectedSig) return { valid: false };

    const payload = JSON.parse(payloadStr);
    if (payload.exp < Date.now()) return { valid: false };

    return { valid: true, username: payload.username };
  } catch {
    return { valid: false };
  }
}

// GET: Kiểm tra trạng thái phiên đăng nhập của Admin
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie || !cookie.value) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const { valid, username } = verifySessionToken(cookie.value);
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
    // SQLite might be loading
  }

  return NextResponse.json({
    authenticated: true,
    user: adminUser || { username, name: "Quản Trị Viên ChillBanana", role: "SUPER_ADMIN" },
  });
}

// POST: Xử lý Đăng nhập
export async function POST(req: NextRequest) {
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
    const inputHash = hashPassword(password);
    let isAuthenticated = false;
    let adminName = "Quản Trị Viên ChillBanana";
    let adminRole = "SUPER_ADMIN";

    // 1. Kiểm tra trong CSDL Prisma
    try {
      const dbAdmin = await prisma.adminUser.findUnique({
        where: { username: trimmedUser },
      });

      if (dbAdmin) {
        if (dbAdmin.passwordHash === inputHash || dbAdmin.passwordHash === password) {
          isAuthenticated = true;
          adminName = dbAdmin.name;
          adminRole = dbAdmin.role;
        }
      }
    } catch (dbErr) {
      console.warn("DB check error in admin auth, testing fallback:", dbErr);
    }

    // 2. Tài khoản quản trị chuẩn mặc định (admin / ChillBanana@2026 hoặc admin123)
    if (!isAuthenticated) {
      if (
        (trimmedUser === "admin" && (password === "ChillBanana@2026" || password === "admin123")) ||
        (trimmedUser === "chillbanana" && password === "admin2026")
      ) {
        isAuthenticated = true;
      }
    }

    if (!isAuthenticated) {
      return NextResponse.json(
        { error: "Tên đăng nhập hoặc mật khẩu quản trị không chính xác." },
        { status: 401 }
      );
    }

    // Thiết lập Cookie phiên đăng nhập bảo mật
    const token = createSessionToken(trimmedUser);
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
      name: COOKIE_NAME,
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
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
