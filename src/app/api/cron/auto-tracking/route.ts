/**
 * Cron Handler — Auto Tracking Agent (Nhóm 2.1)
 *
 * Chạy định kỳ (khuyến nghị: mỗi 2h qua Vercel Cron / cron-job.org).
 * Với mỗi đơn đang vận chuyển có mã tracking:
 *   1. Gọi logistics-api lấy trạng thái mới nhất
 *   2. So sánh với TrackingLog cuối cùng
 *   3. Nếu có thay đổi → tạo TrackingLog mới + gửi email khách
 *   4. Nếu đơn "stuck" > 3 ngày → log warning để Admin xem xét
 *
 * Bảo mật: Yêu cầu CRON_SECRET giống cron hiện có.
 * Vercel cron.json: path="/api/cron/auto-tracking", schedule="0 slash-star-2 * * *" (mỗi 2 giờ)
 */

import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasTrackingStatusChanged, queryTrackingStatus, shouldCompleteOrder } from "@/features/logistics/tracking-service";
import { sendOrderStatusUpdateEmail, sendZaloTrackingNotification } from "@/lib/mailer";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Tracking có thể mất thời gian, cần timeout dài hơn

function hasValidCronSecret(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  const supplied = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || !supplied) return false;
  const expectedBuf = Buffer.from(expected);
  const suppliedBuf = Buffer.from(supplied);
  return expectedBuf.length === suppliedBuf.length && timingSafeEqual(expectedBuf, suppliedBuf);
}

// Trạng thái đơn cần theo dõi tracking (không track PENDING, COMPLETED, CANCELLED)
const TRACKABLE_STATUSES = [
  "PURCHASING_JP",
  "WAREHOUSE_JP",
  "IN_TRANSIT_AIR",
  "WAREHOUSE_VN",
  "LOCAL_DELIVERY",
];

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET chưa được cấu hình." }, { status: 503 });
  }
  if (!hasValidCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const startTime = Date.now();
  let checked = 0;
  let updated = 0;
  let stuck = 0;
  let errors = 0;
  const log: string[] = [];

  try {
    // Lấy đơn hàng đang trong quá trình vận chuyển, có ít nhất 1 mã tracking
    const orders = await prisma.order.findMany({
      where: {
        status: { in: TRACKABLE_STATUSES },
        OR: [
          { jpDomesticTrack: { not: null } },
          { vnDomesticTrack: { not: null } },
        ],
      },
      select: {
        id: true,
        orderCode: true,
        status: true,
        customerEmail: true,
        customerName: true,
        customerId: true,
        jpDomesticTrack: true,
        vnDomesticTrack: true,
        customer: { select: { zaloUserId: true } },
      },
      orderBy: { updatedAt: "asc" }, // Ưu tiên đơn lâu chưa được cập nhật nhất để tránh bỏ sót đơn thứ 51+
      take: 50, // Giới hạn 50 đơn mỗi lần chạy để tránh timeout
    });

    log.push(`[AutoTracking] Tìm thấy ${orders.length} đơn cần kiểm tra tracking.`);

    for (const order of orders) {
      checked++;

      // Ưu tiên tracking VN (chặng cuối) rồi mới JP
      const trackCodes = [
        order.vnDomesticTrack ? { code: order.vnDomesticTrack, leg: "VN" } : null,
        order.jpDomesticTrack ? { code: order.jpDomesticTrack, leg: "JP" } : null,
      ].filter(Boolean) as { code: string; leg: string }[];

      for (const { code, leg } of trackCodes) {
        try {
          const result = await queryTrackingStatus(code, leg as "JP" | "VN");
          if (!result) continue; // API key chưa có hoặc hãng không nhận dạng được

          // Kiểm tra "stuck" — không có cập nhật > 3 ngày
          if (result.isStuck) {
            stuck++;
            console.warn(
              `[AutoTracking] ⚠️ ĐƠN KẸT: ${order.orderCode} | ${leg} | ${code} | ${result.statusLabel} | Không cập nhật > 3 ngày`
            );
            log.push(`STUCK: ${order.orderCode} (${leg}) — ${result.statusLabel}`);
          }

          // So sánh với log cuối cùng — chỉ tạo log mới nếu trạng thái thay đổi
          const trackingMarker = `Mã vận đơn: ${code}.`;
          const lastLogForCode = await prisma.trackingLog.findFirst({
            where: { orderId: order.id, description: { contains: trackingMarker } },
            orderBy: { createdAt: "desc" },
            select: { title: true, description: true },
          });
          if (!hasTrackingStatusChanged(lastLogForCode ? [lastLogForCode] : [], code, result.statusLabel)) continue;

          // Tạo TrackingLog mới
          const locationLabel = leg === "JP"
            ? (result.location.includes("Nhật") ? result.location : `${result.location} (Nhật Bản)`)
            : result.location;

          const shouldComplete = shouldCompleteOrder(leg as "JP" | "VN", order.status, result.isDelivered);
          const shouldArriveJpWarehouse = leg === "JP" && order.status === "PURCHASING_JP" && result.isDelivered;
          let orderWasCompleted = false;
          let orderArrivedJp = false;

          await prisma.$transaction(async (tx) => {
            if (shouldComplete) {
              const completion = await tx.order.updateMany({
                where: { id: order.id, status: "LOCAL_DELIVERY" },
                data: { status: "COMPLETED" },
              });
              orderWasCompleted = completion.count === 1;
            } else if (shouldArriveJpWarehouse) {
              const arrival = await tx.order.updateMany({
                where: { id: order.id, status: "PURCHASING_JP" },
                data: { status: "WAREHOUSE_JP" },
              });
              orderArrivedJp = arrival.count === 1;
            } else {
              // Touch updatedAt để xoay vòng thứ tự kiểm tra trong các lần chạy cron tiếp theo
              await tx.order.update({
                where: { id: order.id },
                data: { updatedAt: new Date() },
              });
            }

            const nextRecordedStatus = orderWasCompleted
              ? "COMPLETED"
              : orderArrivedJp
              ? "WAREHOUSE_JP"
              : order.status;

            await tx.trackingLog.create({
              data: {
                orderId: order.id,
                status: nextRecordedStatus,
                title: result.statusLabel,
                description: `[${result.provider}] ${result.rawEvent || result.statusLabel}. Mã vận đơn: ${code}.`,
                location: locationLabel,
              },
            });

            if (orderWasCompleted) {
              log.push(`AUTO-COMPLETE: ${order.orderCode} → COMPLETED`);
            } else if (orderArrivedJp) {
              log.push(`AUTO-WAREHOUSE-JP: ${order.orderCode} → WAREHOUSE_JP`);
            }
          });

          updated++;
          log.push(`UPDATED: ${order.orderCode} (${leg}) | ${result.statusLabel}`);

          // Gửi email + Zalo thông báo khách — fire & forget
          if (order.customerEmail) {
            const updatedOrder = await prisma.order.findUnique({
              where: { id: order.id },
              include: { trackingLogs: { orderBy: { createdAt: "desc" } } },
            });
            if (updatedOrder) {
              const notificationTasks: Promise<unknown>[] = [sendOrderStatusUpdateEmail(
                updatedOrder,
                `Cập nhật đơn hàng: ${result.statusLabel}`,
                `Hệ thống đã ghi nhận cập nhật mới nhất cho đơn hàng #${order.orderCode} từ ${result.provider}.`
              )];

              // Zalo OA — gửi nếu khách đã liên kết Zalo
              const zaloUserId = order.customer?.zaloUserId;
              if (zaloUserId) {
                notificationTasks.push(sendZaloTrackingNotification(
                  zaloUserId,
                  order.orderCode,
                  result.statusLabel,
                  `Cập nhật từ ${result.provider}. Vị trí: ${result.location}.`
                ));
              }

              const notificationResults = await Promise.allSettled(notificationTasks);
              notificationResults.forEach((notification, index) => {
                if (notification.status === "rejected") {
                  const channel = index === 0 ? "Email" : "Zalo";
                  console.warn(`[AutoTracking] ${channel} error ${order.orderCode}:`, notification.reason);
                }
              });
            }
          }
        } catch (trackErr) {
          errors++;
          console.error(`[AutoTracking] Error tracking ${code} (${order.orderCode}):`, trackErr);
        }
      }
    }
  } catch (err) {
    console.error("[AutoTracking] Fatal error:", err);
    return NextResponse.json({ error: "Lỗi hệ thống." }, { status: 500 });
  }

  const durationMs = Date.now() - startTime;
  const summary = { checked, updated, stuck, errors, durationMs };
  log.forEach((l) => console.log(l));
  console.log(`[AutoTracking] Hoàn tất:`, summary);

  return NextResponse.json({ success: errors === 0, ...summary, log }, {
    status: errors > 0 && updated === 0 ? 500 : 200,
  });
}
