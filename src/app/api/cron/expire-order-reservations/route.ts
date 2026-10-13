import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusUpdateEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

function hasValidCronSecret(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  const supplied = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || !supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Cron secret is not configured." }, { status: 503 });
  }
  if (!hasValidCronSecret(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const now = new Date();
  const expiredOrders = await prisma.order.findMany({
    where: {
      status: "PENDING_DEPOSIT",
      paymentStatus: "UNPAID",
      reservationExpiresAt: { lte: now },
      reservationReleasedAt: null,
    },
    orderBy: { reservationExpiresAt: "asc" },
    take: 100,
    include: { orderItems: true },
  });

  let released = 0;
  let conflicts = 0;
  let errors = 0;

  for (const order of expiredOrders) {
    try {
      const expiredOrder = await prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: {
            id: order.id,
            status: "PENDING_DEPOSIT",
            paymentStatus: "UNPAID",
            reservationExpiresAt: { lte: now },
            reservationReleasedAt: null,
          },
          data: { status: "CANCELLED", reservationReleasedAt: now, reservationExpiresAt: null },
        });
        if (claimed.count !== 1) return null;

        for (const item of order.orderItems) {
          if (item.itemType === "CATALOG" && item.productId) {
            await tx.product.updateMany({
              where: { id: item.productId },
              data: { stockSlots: { increment: item.quantity } },
            });
          }
        }
        await tx.trackingLog.create({
          data: {
            orderId: order.id,
            status: "CANCELLED",
            title: "Hết thời gian giữ hàng chưa thanh toán",
            description: "Đơn chưa được thanh toán trong thời gian giữ hàng 30 phút. Hệ thống đã hủy đơn và trả số lượng về kho.",
            location: "Hệ thống ChillBanana",
          },
        });
        return tx.order.findUniqueOrThrow({
          where: { id: order.id },
          include: { trackingLogs: { orderBy: { createdAt: "desc" } } },
        });
      });

      if (!expiredOrder) {
        conflicts += 1;
        continue;
      }
      released += 1;
      sendOrderStatusUpdateEmail(
        expiredOrder,
        "Đơn hàng đã hết thời gian giữ hàng",
        "Đơn chưa được thanh toán trong 30 phút nên đã được hệ thống hủy. Số lượng sản phẩm đã được trả về kho."
      ).catch((error) => console.warn(`[Reservation Expiry Email Error] ${order.orderCode}`, error));
    } catch (error) {
      errors += 1;
      console.error(`[Reservation Expiry Error] ${order.orderCode}`, error);
    }
  }

  const success = errors === 0;
  return NextResponse.json(
    { success, found: expiredOrders.length, released, conflicts, errors },
    { status: success ? 200 : 500 }
  );
}
