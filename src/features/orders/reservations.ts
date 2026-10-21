import { prisma } from "@/lib/prisma";
import { sendOrderStatusUpdateEmail } from "@/lib/mailer";

let lastReservationSweepAt = 0;

export async function releaseExpiredOrderReservations(limit = 100, force = false) {
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
  const nowMs = Date.now();
  if (!force && !isTest && nowMs - lastReservationSweepAt < 60_000) {
    return { success: true, found: 0, released: 0, conflicts: 0, errors: 0 };
  }
  lastReservationSweepAt = nowMs;
  const now = new Date();
  const expiredOrders = await prisma.order.findMany({
    where: {
      status: "PENDING_DEPOSIT",
      paymentStatus: "UNPAID",
      reservationExpiresAt: { lte: now },
      reservationReleasedAt: null,
    },
    orderBy: { reservationExpiresAt: "asc" },
    take: limit,
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

        // BẢO MẬT (P1-11): Sắp xếp productId tăng dần chống Deadlock
        const catalogItems = order.orderItems
          .filter((item) => item.itemType === "CATALOG" && item.productId)
          .sort((a, b) => (a.productId || "").localeCompare(b.productId || ""));
        for (const item of catalogItems) {
          await tx.product.updateMany({
            where: { id: item.productId! },
            data: { stockSlots: { increment: item.quantity } },
          });
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

  return {
    success: errors === 0,
    found: expiredOrders.length,
    released,
    conflicts,
    errors,
  };
}
