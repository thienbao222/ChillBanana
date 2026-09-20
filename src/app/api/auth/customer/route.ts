import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const CUSTOMER_SESSION_SECRET = process.env.CUSTOMER_SESSION_SECRET || "chillbanana-customer-session-secret-2026";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "chillbanana-secret-salt-2026").digest("hex");
}

function signSession(data: { id: string; email: string }): string {
  const payload = JSON.stringify(data);
  const signature = crypto.createHmac("sha256", CUSTOMER_SESSION_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}::${signature}`).toString("base64");
}

function verifySession(cookie: string): { id: string; email: string } | null {
  try {
    const decoded = Buffer.from(cookie, "base64").toString("utf-8");
    const [payloadStr, signature] = decoded.split("::");
    if (!payloadStr || !signature) return null;
    const expectedSig = crypto.createHmac("sha256", CUSTOMER_SESSION_SECRET).update(payloadStr).digest("hex");
    if (signature !== expectedSig) return null;
    return JSON.parse(payloadStr);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const customerCookie = req.cookies.get("cb_customer_session")?.value;
    if (!customerCookie) {
      return NextResponse.json({ customer: null });
    }

    const parsed = verifySession(customerCookie);
    if (!parsed || !parsed.id) {
      return NextResponse.json({ customer: null });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: parsed.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        address: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ customer: customer || null });
  } catch (error) {
    console.error("Auth GET error:", error);
    return NextResponse.json({ customer: null });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, email, password, name, phone, address } = body;

    // 1. ĐĂNG KÝ (REGISTER)
    if (action === "register") {
      if (!email || !password || !name) {
        return NextResponse.json(
          { error: "Vui lòng điền đầy đủ Họ tên, Email và Mật khẩu." },
          { status: 400 }
        );
      }

      const cleanEmail = email.toLowerCase().trim();
      const existing = await prisma.customer.findUnique({
        where: { email: cleanEmail },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác." },
          { status: 400 }
        );
      }

      const customer = await prisma.customer.create({
        data: {
          email: cleanEmail,
          passwordHash: hashPassword(password),
          name: name.trim(),
          phone: phone ? phone.trim() : null,
          address: address ? address.trim() : null,
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          address: true,
          createdAt: true,
        },
      });

      const sessionToken = signSession({ id: customer.id, email: customer.email });

      const response = NextResponse.json({
        success: true,
        message: "Đăng ký tài khoản thành công!",
        customer,
      });

      response.cookies.set("cb_customer_session", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      });

      return response;
    }

    // 2. ĐĂNG NHẬP (LOGIN)
    if (action === "login") {
      if (!email || !password) {
        return NextResponse.json(
          { error: "Vui lòng nhập Email và Mật khẩu." },
          { status: 400 }
        );
      }

      const cleanEmail = email.toLowerCase().trim();
      const customer = await prisma.customer.findUnique({
        where: { email: cleanEmail },
      });

      if (!customer) {
        return NextResponse.json(
          { error: "Tài khoản hoặc mật khẩu không chính xác." },
          { status: 401 }
        );
      }

      const hash = hashPassword(password);
      if (customer.passwordHash !== hash) {
        return NextResponse.json(
          { error: "Tài khoản hoặc mật khẩu không chính xác." },
          { status: 401 }
        );
      }

      const sessionToken = signSession({ id: customer.id, email: customer.email });

      const sanitized = {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        createdAt: customer.createdAt,
      };

      const response = NextResponse.json({
        success: true,
        message: `Chào mừng ${customer.name} trở lại ChillBanana!`,
        customer: sanitized,
      });

      response.cookies.set("cb_customer_session", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      });

      return response;
    }

    // 3. ĐĂNG XUẤT (LOGOUT)
    if (action === "logout") {
      const response = NextResponse.json({
        success: true,
        message: "Đăng xuất thành công.",
      });
      response.cookies.set("cb_customer_session", "", {
        maxAge: 0,
        path: "/",
      });
      return response;
    }

    return NextResponse.json({ error: "Thao tác không hợp lệ." }, { status: 400 });
  } catch (error) {
    console.error("Customer Auth POST error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi máy chủ trong quá trình xác thực." },
      { status: 500 }
    );
  }
}
