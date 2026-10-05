import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const CUSTOMER_SESSION_SECRET = process.env.CUSTOMER_SESSION_SECRET || (() => { console.error('[SECURITY] CUSTOMER_SESSION_SECRET not set! Set it in Vercel env vars.'); return 'INSECURE_PLACEHOLDER_SET_CUSTOMER_SESSION_SECRET_ENV'; })();

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

      // ============================================================
      // SPRINT 4 — IDENTITY STITCHING
      // Tự động gán đơn hàng cũ & phiên chat cũ cho tài khoản mới
      // Dựa theo email (và phone nếu có)
      // ============================================================
      let stitchedOrders = 0;
      let stitchedSessions = 0;
      try {
        const phoneVal = phone ? phone.trim() : null;

        // Gán đơn hàng cũ của khách vãng lai (cùng email)
        const orderUpdate = await prisma.order.updateMany({
          where: {
            customerEmail: cleanEmail,
            customerId: null,  // Chưa được gán cho tài khoản nào
          },
          data: {
            customerId: customer.id,
            customerType: "REGISTERED",
          },
        });
        stitchedOrders += orderUpdate.count;

        // Gán thêm theo số điện thoại nếu có
        if (phoneVal) {
          const phoneOrderUpdate = await prisma.order.updateMany({
            where: {
              customerPhone: phoneVal,
              customerId: null,
            },
            data: {
              customerId: customer.id,
              customerType: "REGISTERED",
            },
          });
          stitchedOrders += phoneOrderUpdate.count;
        }

        // Gán phiên chat AI cũ (cùng email)
        const sessionUpdate = await prisma.chatSession.updateMany({
          where: {
            customerEmail: cleanEmail,
            customerId: null,
          },
          data: {
            customerId: customer.id,
            customerType: "REGISTERED",
          },
        });
        stitchedSessions += sessionUpdate.count;

        // Gán phiên chat theo số điện thoại nếu có
        if (phoneVal) {
          const phoneSessionUpdate = await prisma.chatSession.updateMany({
            where: {
              customerPhone: phoneVal,
              customerId: null,
            },
            data: {
              customerId: customer.id,
              customerType: "REGISTERED",
            },
          });
          stitchedSessions += phoneSessionUpdate.count;
        }

        if (stitchedOrders > 0 || stitchedSessions > 0) {
          console.log(`[IdentityStitching] Tài khoản ${cleanEmail}: Gán ${stitchedOrders} đơn hàng + ${stitchedSessions} phiên chat cũ.`);
        }
      } catch (stitchErr) {
        console.warn("[IdentityStitching] Lỗi khi gán dữ liệu cũ:", stitchErr);
      }

      const response = NextResponse.json({
        success: true,
        message: stitchedOrders > 0
          ? `Đăng ký thành công! Chúng tôi đã tự động khôi phục ${stitchedOrders} đơn hàng trước đây của bạn.`
          : "Đăng ký tài khoản thành công!",
        customer,
        stitched: { orders: stitchedOrders, sessions: stitchedSessions },
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

      // ============================================================
      // SPRINT 4 — IDENTITY STITCHING ON LOGIN
      // Khi đăng nhập, kiểm tra và gán lại những dữ liệu cũ chưa liên kết
      // ============================================================
      let loginStitchedOrders = 0;
      let loginStitchedSessions = 0;
      try {
        const loginOrderUpdate = await prisma.order.updateMany({
          where: { customerEmail: cleanEmail, customerId: null },
          data: { customerId: customer.id, customerType: "REGISTERED" },
        });
        loginStitchedOrders = loginOrderUpdate.count;

        if (customer.phone) {
          const phoneLoginUpdate = await prisma.order.updateMany({
            where: { customerPhone: customer.phone, customerId: null },
            data: { customerId: customer.id, customerType: "REGISTERED" },
          });
          loginStitchedOrders += phoneLoginUpdate.count;
        }

        const loginSessionUpdate = await prisma.chatSession.updateMany({
          where: { customerEmail: cleanEmail, customerId: null },
          data: { customerId: customer.id, customerType: "REGISTERED" },
        });
        loginStitchedSessions = loginSessionUpdate.count;

        if (loginStitchedOrders > 0 || loginStitchedSessions > 0) {
          console.log(`[IdentityStitching/Login] ${cleanEmail}: +${loginStitchedOrders} đơn, +${loginStitchedSessions} chat.`);
        }
      } catch (stitchErr) {
        console.warn("[IdentityStitching/Login] Lỗi:", stitchErr);
      }

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
        message: loginStitchedOrders > 0
          ? `Chào mừng ${customer.name}! Chúng tôi đã kết nối thêm ${loginStitchedOrders} đơn hàng cũ vào tài khoản của bạn.`
          : `Chào mừng ${customer.name} trở lại ChillBanana!`,
        customer: sanitized,
        stitched: { orders: loginStitchedOrders, sessions: loginStitchedSessions },
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
