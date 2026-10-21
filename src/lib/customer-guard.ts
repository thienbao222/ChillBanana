import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CUSTOMER_COOKIE_NAME,
  computePasswordDigest,
  verifyCustomerSessionToken,
  verifySameOrigin,
} from "@/lib/auth-session";

export type CustomerGuardResult =
  | { ok: true; customer: { id: string; email: string; name: string } }
  | { ok: false; response: NextResponse };

/**
 * Kiểm tra phiên đăng nhập của khách hàng:
 * 1. Kiểm tra chữ ký HMAC và hạn sử dụng của cookie `cb_customer_session`.
 * 2. Đối chiếu DB: khách hàng phải còn tồn tại và email đã được xác minh (`emailVerifiedAt !== null`).
 * 3. BẢO MẬT (P1-03): Đối chiếu `pwdDigest` trong token với `passwordHash` hiện tại trong DB.
 *    Nếu khách hàng đổi mật khẩu (hoặc tài khoản bị xóa), token cũ lập tức bị thu hồi (401).
 */
export async function requireCustomer(req: NextRequest): Promise<CustomerGuardResult> {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    if (!verifySameOrigin(req)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Yêu cầu vi phạm kiểm soát nguồn gốc (CSRF protection)." },
          { status: 403 }
        ),
      };
    }
  }

  const cookie = req.cookies.get(CUSTOMER_COOKIE_NAME)?.value;
  if (!cookie) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Vui lòng đăng nhập để tiếp tục." },
        { status: 401 }
      ),
    };
  }

  const session = verifyCustomerSessionToken(cookie);
  if (!session || !session.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." },
        { status: 401 }
      ),
    };
  }

  let customer: { id: string; email: string; name: string; passwordHash: string | null; emailVerifiedAt: Date | null } | null = null;
  try {
    customer = await prisma.customer.findUnique({
      where: { id: session.id },
      select: { id: true, email: true, name: true, passwordHash: true, emailVerifiedAt: true },
    });
  } catch (err) {
    console.error("[CustomerGuard] Lỗi kết nối CSDL:", err);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Không thể xác minh thông tin khách hàng lúc này." },
        { status: 503 }
      ),
    };
  }

  if (!customer || !customer.emailVerifiedAt) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Tài khoản không tồn tại hoặc chưa xác minh email." },
        { status: 401 }
      ),
    };
  }

  // BẢO MẬT (P1-03): Thu hồi phiên ngay khi đổi mật khẩu
  if (session.pwdDigest && customer.passwordHash) {
    const expectedDigest = computePasswordDigest(customer.passwordHash);
    if (session.pwdDigest !== expectedDigest) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Phiên đăng nhập đã hết hạn do mật khẩu đã thay đổi. Vui lòng đăng nhập lại." },
          { status: 401 }
        ),
      };
    }
  }

  return {
    ok: true,
    customer: { id: customer.id, email: customer.email, name: customer.name },
  };
}

/**
 * Trả về thông tin khách hàng đã xác thực hoặc null nếu chưa đăng nhập / phiên không hợp lệ / đã bị thu hồi.
 */
export async function getVerifiedCustomerFromRequest(
  req: NextRequest
): Promise<{ id: string; email: string; name: string } | null> {
  const result = await requireCustomer(req);
  return result.ok ? result.customer : null;
}
