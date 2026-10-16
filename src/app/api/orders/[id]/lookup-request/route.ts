import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendGuestOrderAccessEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const attemptsByIp = new Map<string, { count: number; resetAt: number }>();
const GENERIC_MESSAGE = "Nếu mã đơn và email khớp, ChillBanana sẽ gửi liên kết tra cứu. Vui lòng kiểm tra hộp thư và thư rác.";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const forwardedIps = req.headers.get("x-forwarded-for")?.split(",").map((value) => value.trim()).filter(Boolean) || [];
  const ip = req.headers.get("x-real-ip")?.trim() || forwardedIps.at(-1) || "unknown";
  const now = Date.now();
  if (attemptsByIp.size > 2_000) {
    for (const [address, entry] of attemptsByIp) if (entry.resetAt <= now) attemptsByIp.delete(address);
  }
  const current = attemptsByIp.get(ip);
  if (current && current.resetAt > now && current.count >= 5) {
    return NextResponse.json({ error: "Bạn yêu cầu quá nhiều lần. Vui lòng thử lại sau ít phút." }, { status: 429 });
  }
  if (!current || current.resetAt <= now) attemptsByIp.set(ip, { count: 1, resetAt: now + 60_000 });
  else current.count += 1;

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
