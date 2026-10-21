import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CUSTOMER_COOKIE_NAME,
  hashCustomerPassword as hashPassword,
  verifyCustomerPassword,
  createCustomerSessionToken as signSession,
  verifyCustomerSessionToken as verifySession,
} from "@/lib/auth-session";
import { sendCustomerEmailVerification } from "@/lib/mailer";
import { getClientIp, getMaxBlockedSeconds, recordHits, resetKey } from "@/lib/rate-limit";
import { LOGIN_FAILURES_PER_ACCOUNT, LOGIN_FAILURES_PER_IP, REGISTER_PER_IP } from "@/lib/rate-limit-core";

function tooManyRequests(waitSeconds: number, message: string) {
  return NextResponse.json({ error: message }, { status: 429, headers: { "Retry-After": String(waitSeconds) } });
}

export const dynamic = "force-dynamic";


export async function GET(req: NextRequest) {
  try {
    const customerCookie = req.cookies.get(CUSTOMER_COOKIE_NAME)?.value;
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
        emailVerifiedAt: true,
      },
    });

    if (!customer?.emailVerifiedAt) return NextResponse.json({ customer: null });
    const { emailVerifiedAt, ...safeCustomer } = customer;
    return NextResponse.json({ customer: safeCustomer });
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
      // Honeypot anti-bot: Nếu bot tự động điền trường ẩn, từ chối ngay lập tức
      if (body.website || body.honeypot || body.hpField) {
        return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
      }

      // Cloudflare Turnstile Captcha (kích hoạt khi có TURNSTILE_SECRET_KEY trong môi trường)
      const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
      if (turnstileSecret && process.env.NODE_ENV !== "test") {
        const token = body.turnstileToken || body["cf-turnstile-response"];
        if (!token || typeof token !== "string") {
          return NextResponse.json({ error: "Vui lòng hoàn tất xác thực Captcha chống spam." }, { status: 400 });
        }
        try {
          const clientIp = getClientIp(req);
          const formData = new URLSearchParams();
          formData.append("secret", turnstileSecret);
          formData.append("response", token);
          if (clientIp && clientIp !== "unknown") formData.append("remoteip", clientIp);

          const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            body: formData,
            signal: AbortSignal.timeout(5000),
          });
          const verifyData = await verifyRes.json();
          if (!verifyData.success) {
            return NextResponse.json({ error: "Xác thực Captcha không hợp lệ hoặc đã hết hạn. Vui lòng thử lại." }, { status: 400 });
          }
        } catch (captchaErr) {
          console.error("[Turnstile] Lỗi kết nối dịch vụ xác thực:", captchaErr);
        }
      }
      if (typeof email !== "string" || typeof password !== "string" || typeof name !== "string" || !email.trim() || password.length < 8 || password.length > 256 || !name.trim() || name.length > 120 || (phone !== undefined && typeof phone !== "string") || (address !== undefined && typeof address !== "string")) {
        return NextResponse.json(
          { error: "Vui lòng điền họ tên, email hợp lệ và mật khẩu tối thiểu 8 ký tự." },
          { status: 400 }
        );
      }

      const cleanEmail = email.toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return NextResponse.json({ error: "Địa chỉ email không hợp lệ." }, { status: 400 });
      }

      // Giới hạn số lần đăng ký theo IP để chống tạo tài khoản và gửi email hàng loạt.
      const registerKey = `customer-register:ip:${getClientIp(req)}`;
      const registerWait = await getMaxBlockedSeconds([registerKey]);
      if (registerWait > 0) {
        return tooManyRequests(registerWait, `Bạn đã thao tác quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(registerWait / 60)} phút.`);
      }
      await recordHits([registerKey], REGISTER_PER_IP);
      const existing = await prisma.customer.findUnique({
        where: { email: cleanEmail },
      });

      if (existing) {
        if (!existing.emailVerifiedAt) {
          // BẢO MẬT (P1-02): Chống Pre-Account Takeover.
          // Tài khoản chưa xác minh email: Cho phép cập nhật mật khẩu và thông tin mới,
          // rồi gửi lại email xác minh tới hộp thư để chủ sở hữu thực sự kích hoạt.
          const updatedCustomer = await prisma.customer.update({
            where: { id: existing.id },
            data: {
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
          try {
            await sendCustomerEmailVerification(updatedCustomer);
            return NextResponse.json({
              success: true,
              requiresEmailVerification: true,
              message: "Tài khoản đang chờ xác minh. Chúng tôi đã cập nhật thông tin và gửi lại liên kết xác minh tới email của bạn.",
            });
          } catch (error) {
            console.error("[CustomerRegistration] Không thể gửi lại email xác minh:", error);
            return NextResponse.json({ error: "Chưa gửi được email xác minh. Vui lòng thử lại sau." }, { status: 503 });
          }
        }
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
      try {
        await sendCustomerEmailVerification(customer);
      } catch (stitchErr) {
        await prisma.customer.delete({ where: { id: customer.id } });
        console.error("[CustomerRegistration] Không thể gửi email xác minh:", stitchErr);
        return NextResponse.json(
          { error: "Chưa gửi được email xác minh. Vui lòng thử lại sau hoặc liên hệ hỗ trợ." },
          { status: 503 }
        );
      }

      return NextResponse.json({
        success: true,
        requiresEmailVerification: true,
        message: "Tài khoản đã được tạo. Hãy mở email và nhấn liên kết xác minh để kích hoạt tài khoản.",
      });
    }

    // 2. ĐĂNG NHẬP (LOGIN)
    if (action === "login") {
      if (typeof email !== "string" || typeof password !== "string" || !email.trim() || password.length > 256) {
        return NextResponse.json(
          { error: "Vui lòng nhập Email và Mật khẩu." },
          { status: 400 }
        );
      }

      const cleanEmail = email.toLowerCase().trim();
      if (cleanEmail.length > 254) {
        return NextResponse.json({ error: "Tài khoản hoặc mật khẩu không chính xác." }, { status: 401 });
      }
      const accountKey = `customer-login:email:${cleanEmail}`;
      const ipKey = `customer-login:ip:${getClientIp(req)}`;
      const loginWait = await getMaxBlockedSeconds([accountKey, ipKey]);
      if (loginWait > 0) {
        return tooManyRequests(loginWait, `Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(loginWait / 60)} phút.`);
      }

      const customer = await prisma.customer.findUnique({
        where: { email: cleanEmail },
      });

      if (!customer) {
        await recordHits([accountKey], LOGIN_FAILURES_PER_ACCOUNT);
        await recordHits([ipKey], LOGIN_FAILURES_PER_IP);
        return NextResponse.json(
          { error: "Tài khoản hoặc mật khẩu không chính xác." },
          { status: 401 }
        );
      }

      const passwordCheck = verifyCustomerPassword(password, customer.passwordHash);
      if (!passwordCheck.valid) {
        await recordHits([accountKey], LOGIN_FAILURES_PER_ACCOUNT);
        await recordHits([ipKey], LOGIN_FAILURES_PER_IP);
        return NextResponse.json(
          { error: "Tài khoản hoặc mật khẩu không chính xác." },
          { status: 401 }
        );
      }

      await resetKey(accountKey);

      if (!customer.emailVerifiedAt) {
        try {
          await sendCustomerEmailVerification(customer);
        } catch (error) {
          console.error("[CustomerLogin] Không thể gửi email xác minh:", error);
          return NextResponse.json({ error: "Chưa gửi được email xác minh. Vui lòng thử lại sau." }, { status: 503 });
        }
        return NextResponse.json({ error: "Tài khoản chưa xác minh. Chúng tôi đã gửi liên kết kích hoạt tới email của bạn." }, { status: 403 });
      }

      if (passwordCheck.needsRehash) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { passwordHash: hashPassword(password) },
        });
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

        // BẢO MẬT: Chỉ gán theo email đã xác nhận (chưa có SMS OTP nên không tự động gán theo SĐT)

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

      response.cookies.set(CUSTOMER_COOKIE_NAME, sessionToken, {
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
      response.cookies.set(CUSTOMER_COOKIE_NAME, "", {
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
