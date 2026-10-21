import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendGuestOrderAccessEmail } from "@/lib/mailer";
import { checkAndRecordHit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const GENERIC_MESSAGE = "Nếu mã đơn và email khớp, ChillBanana sẽ gửi liên kết tra cứu. Vui lòng kiểm tra hộp thư và thư rác.";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req);
  try {
    const retryAfter = await checkAndRecordHit(`lookup-request:ip:${ip}`, {
      max: 5,
      windowMs: 60_000,
      blockMs: 300_000,
    });
    if (retryAfter > 0) {
      return NextResponse.json(
        { error: "Bạn yêu cầu quá nhiều lần. Vui lòng thử lại sau ít phút." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
  } catch (rateLimitErr) {
    console.error("[RateLimit] Lỗi kiểm tra giới hạn tra cứu đơn:", rateLimitErr);
  }

  const { id: orderCode } = await params;
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!orderCode || orderCode.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Vui lòng kiểm tra mã đơn và địa chỉ email." }, { status: 400 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { orderCode },
      select: { id: true, orderCode: true, customerEmail: true, customerName: true },
    });
    if (order && order.customerEmail.trim().toLowerCase() === email) {
      await sendGuestOrderAccessEmail(order);
    }
  } catch (error) {
    // Keep the same public response for matches and non-matches; details stay server-side.
    console.error("Lỗi yêu cầu liên kết tra cứu đơn:", error);
  }

  return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
}
