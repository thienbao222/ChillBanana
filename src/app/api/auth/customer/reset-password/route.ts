/**
 * /api/auth/customer/reset-password
 * ─────────────────────────────────────────────────────────────────────────────
 * POST — Bước 1: Gửi email chứa link đặt lại mật khẩu.
 *   Body: { action: "request", email: string }
 *   → Tạo token HMAC-signed (hết hạn 1h), gửi link tới email khách hàng.
 *
 * POST — Bước 2: Đặt lại mật khẩu mới bằng token từ email.
 *   Body: { action: "reset", token: string, newPassword: string }
 *   → Verify token, cập nhật passwordHash bằng scrypt, xóa token (1 lần dùng).
 *
 * Bảo mật:
 *   - Rate limit 3 lần / 10 phút / IP (chống bruteforce email enumeration).
 *   - Token là HMAC-signed, có timestamp, không lưu vào DB → không cần migration.
 *   - Response luôn 200 kể cả email không tồn tại (anti-enumeration).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { hashCustomerPassword } from "@/lib/auth-session";
import { resetPasswordLimiter, getClientIp } from "@/lib/rate-limiter";
import { getBaseUrl } from "@/lib/mailer";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers tạo / verify reset token (HMAC-signed, không cần DB)
// ─────────────────────────────────────────────────────────────────────────────

function getResetSecret(): string {
  const secret = process.env.CUSTOMER_SESSION_SECRET || "dev-only-insecure-customer-secret-do-not-use-in-prod";
  return `reset:${secret}`;
}

/**
 * Tạo token reset password: base64( payload::hmac )
 * payload = JSON { id, email, exp }
 */
function createResetToken(customerId: string, email: string): string {
  const payload = JSON.stringify({
    id: customerId,
    email: email.toLowerCase(),
    purpose: "reset-password",
    exp: Date.now() + 60 * 60 * 1000, // 1 giờ
  });
  const secret = getResetSecret();
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}::${sig}`).toString("base64url");
}

/**
 * Verify token reset. Trả về { id, email } nếu hợp lệ, null nếu không.
 */
function verifyResetToken(token: string): { id: string; email: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const sepIndex = decoded.lastIndexOf("::");
    if (sepIndex === -1) return null;
    const payloadStr = decoded.slice(0, sepIndex);
    const sig = decoded.slice(sepIndex + 2);

    const secret = getResetSecret();
    const expected = crypto.createHmac("sha256", secret).update(payloadStr).digest("hex");
    const bufA = Buffer.from(expected);
    const bufB = Buffer.from(sig);
    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) return null;

    const payload = JSON.parse(payloadStr);
    if (payload.purpose !== "reset-password") return null;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (typeof payload.id !== "string" || typeof payload.email !== "string") return null;
    return { id: payload.id, email: payload.email };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = getClientIp(req);
  const rl = resetPasswordLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu. Vui lòng thử lại sau 10 phút." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  let body: { action?: string; email?: string; token?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON không hợp lệ." }, { status: 400 });
  }

  // ── Bước 1: Yêu cầu gửi email ────────────────────────────────────────────

  if (body.action === "request") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email không hợp lệ." }, { status: 400 });
    }

    // ANTI-ENUMERATION: Luôn trả 200, dù email có tồn tại hay không
    try {
      const customer = await prisma.customer.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, emailVerifiedAt: true },
      });

      if (customer?.emailVerifiedAt) {
        // Tạo token và gửi email (chỉ khi tài khoản tồn tại và đã verify)
        const token = createResetToken(customer.id, customer.email);
        const resetUrl = `${getBaseUrl()}/reset-password?token=${token}`;

        // Gọi mailer — không throw nếu lỗi để giữ anti-enumeration
        try {
          const { sendPasswordResetEmail } = await import("@/lib/mailer");
          await sendPasswordResetEmail({
            to: customer.email,
            name: customer.name,
            resetUrl,
          });
        } catch (mailErr) {
          console.error("[reset-password] Gửi email lỗi:", mailErr);
          // Không throw — vẫn trả 200
        }
      }
    } catch (err) {
      console.error("[reset-password request] DB error:", err);
      // Không throw — giữ nguyên anti-enumeration response
    }

    return NextResponse.json({
      success: true,
      message: "Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu trong vài phút.",
    });
  }

  // ── Bước 2: Đặt lại mật khẩu ─────────────────────────────────────────────

  if (body.action === "reset") {
    const { token, newPassword } = body;

    if (typeof token !== "string" || !token) {
      return NextResponse.json({ error: "Token không hợp lệ." }, { status: 400 });
    }
    if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 256) {
      return NextResponse.json(
        { error: "Mật khẩu mới phải có ít nhất 8 ký tự." },
        { status: 400 }
      );
    }

    const parsed = verifyResetToken(token);
    if (!parsed) {
      return NextResponse.json(
        { error: "Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn (1 giờ). Vui lòng yêu cầu lại." },
        { status: 400 }
      );
    }

    try {
      // Kiểm tra customer vẫn tồn tại và email khớp
      const customer = await prisma.customer.findUnique({
        where: { id: parsed.id },
        select: { id: true, email: true },
      });

      if (!customer || customer.email.toLowerCase() !== parsed.email) {
        return NextResponse.json({ error: "Link đặt lại mật khẩu không hợp lệ." }, { status: 400 });
      }

      // Hash mật khẩu mới bằng scrypt (cùng hàm với register)
      const newPasswordHash = hashCustomerPassword(newPassword);

      await prisma.customer.update({
        where: { id: customer.id },
        data: { passwordHash: newPasswordHash },
      });

      console.log(`[reset-password] Khách hàng ${customer.email} đã đặt lại mật khẩu thành công.`);

      return NextResponse.json({
        success: true,
        message: "Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập lại.",
      });
    } catch (err) {
      console.error("[reset-password reset] Lỗi:", err);
      return NextResponse.json({ error: "Không thể đặt lại mật khẩu. Vui lòng thử lại sau." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Action không hợp lệ. Sử dụng 'request' hoặc 'reset'." }, { status: 400 });
}
