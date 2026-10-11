import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CUSTOMER_COOKIE_NAME,
  createCustomerSessionToken,
  verifyCustomerEmailVerificationToken,
} from "@/lib/auth-session";

export const dynamic = "force-dynamic";

function getBaseUrl() {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  const usable = configured && !(process.env.NODE_ENV === "production" && configured.includes("localhost"))
    ? configured
    : process.env.NODE_ENV === "production" ? "https://chill-banana.vercel.app" : "http://localhost:3000";
  return usable.replace(/\/+$/, "");
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  return NextResponse.redirect(`${getBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`);
}

export async function POST(req: NextRequest) {
  let token = "";
  try {
    const body = await req.json();
    token = typeof body.token === "string" ? body.token : "";
  } catch {
    return NextResponse.json({ error: "Liên kết xác minh không hợp lệ." }, { status: 400 });
  }
  const identity = verifyCustomerEmailVerificationToken(token);
  if (!identity) {
    return NextResponse.json({ error: "Liên kết xác minh không hợp lệ hoặc đã hết hạn." }, { status: 400 });
  }

  try {
    const customer = await prisma.customer.findFirst({
      where: { id: identity.id, email: identity.email },
      select: { id: true, email: true, emailVerifiedAt: true },
    });
    if (!customer) return NextResponse.json({ error: "Không tìm thấy tài khoản." }, { status: 404 });
    if (customer.emailVerifiedAt) return NextResponse.json({ error: "Tài khoản đã được xác minh. Hãy đăng nhập." }, { status: 409 });

    const result = await prisma.$transaction(async (tx) => {
      const verified = await tx.customer.updateMany({
        where: { id: customer.id, email: customer.email, emailVerifiedAt: null },
        data: { emailVerifiedAt: new Date() },
      });
      if (verified.count !== 1) return false;

      await tx.order.updateMany({
        where: { customerEmail: customer.email, customerId: null },
        data: { customerId: customer.id, customerType: "REGISTERED" },
      });
      await tx.chatSession.updateMany({
        where: { customerEmail: customer.email, customerId: null },
        data: { customerId: customer.id, customerType: "REGISTERED" },
      });
      return true;
    });

    if (!result) return NextResponse.json({ error: "Liên kết đã được sử dụng. Hãy đăng nhập." }, { status: 409 });

    const response = NextResponse.json({ success: true, message: "Email đã xác minh, tài khoản đã được kích hoạt." });
    response.cookies.set(CUSTOMER_COOKIE_NAME, createCustomerSessionToken(identity), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("[CustomerEmailVerification] Failed:", error);
    return NextResponse.json({ error: "Không thể xác minh email lúc này. Vui lòng thử lại." }, { status: 500 });
  }
}
