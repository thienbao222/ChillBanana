import { prisma } from "@/lib/prisma";
import { sendOrderStatusUpdateEmail } from "@/lib/mailer";

let lastReservationSweepAt = 0;

export async function releaseExpiredOrderReservations(limit = 100, isCron = false): Promise<{
  success: boolean;
  found: number;
  released: number;
  conflicts: number;
  errors: number;
}> {
  lastReservationSweepAt = Date.now();
  const now = new Date();

  // WP1.2: Quét cả reservationExpiresAt (giỏ catalog thuần) VÀ quoteHoldExpiresAt (giỏ hỗn hợp)
  const expiredOrders = await prisma.order.findMany({
    where: {
      status: "PENDING_DEPOSIT",
      paymentStatus: "UNPAID",
      OR: [
        {
          reservationExpiresAt: { lte: now },
          reservationReleasedAt: null,
        },
        {
          quoteHoldExpiresAt: { lte: now },
          reservationReleasedAt: null,
        },
      ],
    },
    select: {
      id: true,
      orderCode: true,
      reservationExpiresAt: true,
      quoteHoldExpiresAt: true,
      customerName: true,
      customerEmail: true,
      orderItems: {
        where: { itemType: "CATALOG", productId: { not: null } },
        select: { productId: true, quantity: true },
      },
    },
    take: Math.min(limit, 200),
  });

  let released = 0;
  let conflicts = 0;
  let errors = 0;

  for (const order of expiredOrders) {
    try {
      const isQuoteHoldExpired = order.quoteHoldExpiresAt && order.quoteHoldExpiresAt <= now;
      const logTitle = isQuoteHoldExpired
        ? "Hết thời gian giữ hàng chờ duyệt giá"
        : "Đơn hàng đã hết thời gian giữ hàng (30 phút)";
      const logDescription = isQuoteHoldExpired
        ? "Đơn hàng chứa sản phẩm ngoài catalog chưa được hoàn tất duyệt giá và thanh toán trong 24 giờ. Hệ thống tự động giải phóng suất tồn kho sản phẩm catalog có sẵn."
        : "Đơn hàng chưa được thanh toán trong 30 phút. Hệ thống tự động giải phóng suất giữ hàng để nhường cơ hội mua cho khách hàng khác.";

      const expiredOrder = await prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: {
            id: order.id,
            status: "PENDING_DEPOSIT",
            paymentStatus: "UNPAID",
            reservationReleasedAt: null,
          },
          data: {
            status: "CANCELLED",
            paymentStatus: "UNPAID",
            reservationReleasedAt: new Date(),
            reservationExpiresAt: null,
            quoteHoldExpiresAt: null,
            adminNote: `[Tự động] Hủy đơn và giải phóng tồn kho do quá hạn (${isQuoteHoldExpired ? "24h chờ duyệt" : "30 phút thanh toán"}).`,
          },
        });

        if (claimed.count !== 1) {
          return null;
        }

        // Hoàn lại stockSlots cho sản phẩm catalog
        const sortedItems = [...order.orderItems].sort((a, b) =>
          (a.productId || "").localeCompare(b.productId || "")
        );
        for (const item of sortedItems) {
          if (!item.productId) continue;
          await tx.product.updateMany({
            where: { id: item.productId },
            data: { stockSlots: { increment: item.quantity } },
          });
        }

        // Ghi AuditLog an toàn
        if ((tx as any).auditLog?.create) {
          await (tx as any).auditLog.create({
            data: {
              actor: isCron ? "SYSTEM_CRON" : "SYSTEM_LAZY",
              action: "ORDER_RESERVATION_RELEASED",
              entityType: "Order",
              entityId: order.orderCode,
              summary: `Giải phóng tồn kho và hủy đơn #${order.orderCode} do hết hạn giữ chỗ`,
              metadata: {
                orderCode: order.orderCode,
                orderId: order.id,
                itemsCount: order.orderItems.length,
                expiredReason: isQuoteHoldExpired ? "QUOTE_HOLD_EXPIRED_24H" : "RESERVATION_EXPIRED_30M",
              },
            },
          });
        }

        await tx.trackingLog.create({
          data: {
            orderId: order.id,
            status: "CANCELLED",
            title: logTitle,
            description: logDescription,
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
        "Đơn chưa được thanh toán trong thời hạn nên đã được hệ thống hủy. Số lượng sản phẩm đã được trả về kho."
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

/**
 * Lazy cleanup chạy ngầm không chặn (fire-and-forget), tối đa 1 lần/phút, quét tối đa 20 đơn.
 */
export function lazyReleaseExpiredReservations(): void {
  const nowMs = Date.now();
  if (nowMs - lastReservationSweepAt < 60_000) return;
  releaseExpiredOrderReservations(20, false).catch((err) => {
    console.warn("[LazyReservationCleanup] Lỗi dọn dẹp kho ngầm:", err);
  });
}

/**
 * WP3.3: Quét các đơn đã về WAREHOUSE_VN nhưng chưa thanh toán số dư đợt 2 (PAID_100).
 * Nhắc thanh toán số dư theo lịch; quá hạn chỉ ghi nhận thông báo nhắc nhở và AuditLog,
 * TUYỆT ĐỐI KHÔNG tự hủy hay tự ý xử lý hàng hóa của khách.
 */
export async function remindOverdueWarehouseVnBalances(limit = 50): Promise<{
  scanned: number;
  reminded: number;
}> {
  try {
    const overdueOrders = await prisma.order.findMany({
      where: {
        status: "WAREHOUSE_VN",
        paymentStatus: { in: ["DEPOSITED_50", "DEPOSITED_70", "UNPAID", "PENDING_RECONCILE"] },
      },
      select: {
        id: true,
        orderCode: true,
        customerName: true,
        customerEmail: true,
        totalVnd: true,
        depositAmountVnd: true,
        updatedAt: true,
      },
      take: Math.min(limit, 100),
    });

    let reminded = 0;
    for (const order of overdueOrders) {
      const remainingBalanceVnd = Math.max(0, order.totalVnd - order.depositAmountVnd);
      if (remainingBalanceVnd > 0) {
        reminded++;
        await prisma.auditLog.create({
          data: {
            actor: "SYSTEM_CRON",
            action: "WAREHOUSE_VN_BALANCE_REMINDER_LOGGED",
            entityType: "Order",
            entityId: order.orderCode,
            summary: `Nhắc số dư đợt 2 cho đơn #${order.orderCode} (${remainingBalanceVnd.toLocaleString("vi-VN")} đ) lưu kho VN.`,
            metadata: {
              orderCode: order.orderCode,
              remainingBalanceVnd,
            },
          },
        });
      }
    }

    return { scanned: overdueOrders.length, reminded };
  } catch (err) {
    console.error("[remindOverdueWarehouseVnBalances] Lỗi quét số dư quá hạn:", err);
    return { scanned: 0, reminded: 0 };
  }
}
