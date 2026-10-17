import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ORDER_ACCESS_COOKIE_NAME,
  hasGuestOrderAccessForEmail,
  verifyGuestOrderAccessToken,
} from "@/lib/auth-session";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/[id]/access
 * ─────────────────────────────────────────────────────────────────────────────
 * Đổi accessToken nhận từ link email (URL param ?access=...) lấy HttpOnly cookie
 * cb_order_access để khách vãng lai xem được chi tiết đơn hàng của mình.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const orderCode = decodeURIComponent(rawId || "").trim();
    const body = await req.json().catch(() => null);
    const token = body && typeof body.accessToken === "string" ? body.accessToken.trim() : "";

    if (!token || !orderCode) {
      return NextResponse.json(
        { error: "Thiếu mã đơn hàng hoặc token xác thực." },
        { status: 400 }
      );
    }

    const access = verifyGuestOrderAccessToken(token);
    if (!access || access.orderCode !== orderCode) {
      return NextResponse.json(
        { error: "Liên kết xác minh không hợp lệ hoặc đã hết hạn." },
        { status: 401 }
      );
    }

    const order = await prisma.order.findFirst({
      where: {
        OR: [{ orderCode }, { id: orderCode }],
      },
      select: { orderCode: true, customerEmail: true },
    });

    if (!order || !hasGuestOrderAccessForEmail(token, order.orderCode, order.customerEmail)) {
      return NextResponse.json(
        { error: "Liên kết xác minh không hợp lệ hoặc đã hết hạn." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true, orderCode: order.orderCode });
    response.cookies.set(ORDER_ACCESS_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(access.exp),
    });

    return response;
  } catch (error) {
    console.error("[orders/[id]/access] Lỗi xác minh quyền truy cập đơn hàng:", error);
    return NextResponse.json(
      { error: "Không thể xác minh liên kết đơn hàng. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
