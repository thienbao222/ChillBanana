import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN", "OPERATOR"] });
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const adminUsername = guard.username || "admin";

  try {
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id }, { orderCode: id }],
      },
      include: {
        orderItems: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
    }

    if (order.isPriceVerified) {
      return NextResponse.json({ error: "Đơn hàng này đã được nhân viên duyệt giá trước đó." }, { status: 400 });
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // 1. Cập nhật mọi dòng sản phẩm
      await tx.orderItem.updateMany({
        where: { orderId: order.id },
        data: {
          quoteVerifiedAt: now,
          quoteVerifiedBy: adminUsername,
        },
      });

      // 2. Đánh dấu order đã duyệt giá
      await tx.order.update({
        where: { id: order.id },
        data: {
          isPriceVerified: true,
          priceVerifiedAt: now,
        },
      });

      // 3. Ghi TrackingLog
      await tx.trackingLog.create({
        data: {
          orderId: order.id,
          status: order.status,
          title: "Báo giá đơn hàng đã được phê duyệt",
          description: `Nhân viên [${adminUsername}] đã xác minh và phê duyệt mức giá chi tiết cho đơn hàng.`,
          location: "Hệ thống Quản trị ChillBanana",
        },
      });
    });

    await writeAuditLog({
      actor: adminUsername,
      action: "QUOTE_VERIFIED",
      entityType: "Order",
      entityId: order.orderCode,
      summary: `Nhân viên ${adminUsername} duyệt báo giá cho đơn ${order.orderCode} (${order.orderItems.length} sản phẩm).`,
      metadata: { orderCode: order.orderCode, itemsCount: order.orderItems.length },
      req,
    });

    return NextResponse.json({
      success: true,
      message: `Đã phê duyệt báo giá cho đơn hàng #${order.orderCode}.`,
    });
  } catch (error) {
    console.error("[VerifyQuote] Lỗi duyệt báo giá:", error);
    return NextResponse.json({ error: "Lỗi hệ thống khi duyệt báo giá." }, { status: 500 });
  }
}
