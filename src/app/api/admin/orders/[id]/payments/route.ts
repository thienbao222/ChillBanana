import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { writeAuditLog } from "@/lib/audit";
import { sendPaymentSuccessEmail } from "@/lib/mailer";
import { getRecordedPaymentStatus } from "@/features/payments/policy";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN", "OPERATOR"] });
  if (!guard.ok) return guard.response;

  try {
    const { id: orderId } = await params;
    const body = await req.json();
    const amountVnd = Number(body?.amountVnd);
    const reference = typeof body?.reference === "string" ? body.reference.trim() : "";
    if (!Number.isSafeInteger(amountVnd) || amountVnd <= 0 || reference.length < 4 || reference.length > 120) {
      return NextResponse.json({ error: "Vui lòng nhập số tiền hợp lệ và mã tham chiếu chuyển khoản từ 4 đến 120 ký tự." }, { status: 400 });
    }

    const existingOrder = await prisma.order.findFirst({
      where: { OR: [{ orderCode: orderId }, { id: orderId }] },
      select: {
        id: true,
        orderCode: true,
        status: true,
        paymentStatus: true,
        isPriceVerified: true,
        depositAmountVnd: true,
        depositPercent: true,
        totalVnd: true,
        reservationExpiresAt: true,
        fulfillmentOrigin: true,
      },
    });
    if (!existingOrder) return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });

    const isBalanceSettlement =
      existingOrder.status === "WAREHOUSE_VN" &&
      (existingOrder.paymentStatus === "DEPOSITED_50" || existingOrder.paymentStatus === "DEPOSITED_70");

    if (!isBalanceSettlement) {
      if (existingOrder.status !== "PENDING_DEPOSIT" || existingOrder.paymentStatus !== "UNPAID" || !existingOrder.isPriceVerified) {
        return NextResponse.json({ error: "Chỉ ghi nhận thanh toán cho đơn đang chờ cọc và đã được duyệt giá hoặc đơn tại kho VN chờ thu số dư." }, { status: 409 });
      }
      if (existingOrder.reservationExpiresAt && existingOrder.reservationExpiresAt <= new Date()) {
        return NextResponse.json({ error: "Thời gian giữ hàng đã hết. Hãy kiểm tra tồn kho và xử lý lại đơn trước khi ghi nhận tiền." }, { status: 409 });
      }
      if (amountVnd !== existingOrder.depositAmountVnd) {
        return NextResponse.json({ error: `Số tiền phải khớp chính xác với ${existingOrder.depositAmountVnd.toLocaleString("vi-VN")} đ.` }, { status: 400 });
      }
    } else {
      const remainingGoodsBalanceVnd = Math.max(0, existingOrder.totalVnd - (existingOrder.depositAmountVnd || 0));
      if (amountVnd !== remainingGoodsBalanceVnd) {
        return NextResponse.json({ error: `Số tiền tất toán phải khớp chính xác với số dư còn lại: ${remainingGoodsBalanceVnd.toLocaleString("vi-VN")} đ.` }, { status: 400 });
      }
    }

    const paymentStatus = isBalanceSettlement ? "PAID_100" : getRecordedPaymentStatus(existingOrder.depositPercent);
    const nextStatus = isBalanceSettlement ? "WAREHOUSE_VN" : (existingOrder.fulfillmentOrigin === "VN" ? "WAREHOUSE_VN" : "PURCHASING_JP");
    const username = guard.username;
    const recordedAt = new Date();
    const order = await prisma.$transaction(async (tx) => {
      if (isBalanceSettlement) {
        const claimed = await tx.order.updateMany({
          where: {
            id: existingOrder.id,
            status: "WAREHOUSE_VN",
            paymentStatus: { in: ["DEPOSITED_50", "DEPOSITED_70"] },
          },
          data: {
            paymentStatus: "PAID_100",
            depositAmountVnd: existingOrder.totalVnd,
            paymentMethod: "VIETQR",
          },
        });
        if (claimed.count !== 1) throw new Error("PAYMENT_RECORD_CONFLICT");

        await tx.paymentTransaction.create({
          data: {
            orderId: existingOrder.id,
            kind: "BALANCE",
            provider: "MANUAL_BANK_TRANSFER",
            amountVnd,
            reference,
            confirmedByAdmin: username,
          },
        });
        await tx.trackingLog.create({
          data: {
            orderId: existingOrder.id,
            status: "WAREHOUSE_VN",
            title: "Đã ghi nhận tất toán số dư 100%",
            description: `Quản trị viên đã xác nhận chuyển khoản tất toán số dư ${amountVnd.toLocaleString("vi-VN")} đ. Đơn hàng hoàn tất thanh toán 100%, sẵn sàng giao nội địa.`,
            location: "Hệ thống Quản trị ChillBanana",
          },
        });
      } else {
        const claimed = await tx.order.updateMany({
          where: {
            id: existingOrder.id,
            status: "PENDING_DEPOSIT",
            paymentStatus: "UNPAID",
            isPriceVerified: true,
            depositAmountVnd: amountVnd,
            OR: [
              { reservationExpiresAt: null },
              { reservationExpiresAt: { gt: recordedAt } },
            ],
          },
          data: {
            status: nextStatus,
            paymentStatus,
            paymentMethod: "VIETQR",
            reservationExpiresAt: null,
          },
        });
        if (claimed.count !== 1) throw new Error("PAYMENT_RECORD_CONFLICT");

        await tx.paymentTransaction.create({
          data: {
            orderId: existingOrder.id,
            kind: "DEPOSIT",
            provider: "MANUAL_BANK_TRANSFER",
            amountVnd,
            reference,
            confirmedByAdmin: username,
          },
        });
        await tx.trackingLog.create({
          data: {
            orderId: existingOrder.id,
            status: nextStatus,
            title:
              paymentStatus === "PAID_100"
                ? "Đã ghi nhận thanh toán 100%"
                : paymentStatus === "DEPOSITED_70"
                ? "Đã ghi nhận tiền cọc 70%"
                : "Đã ghi nhận tiền cọc 50%",
            description:
              nextStatus === "WAREHOUSE_VN"
                ? `Quản trị viên đã xác nhận chuyển khoản ${amountVnd.toLocaleString("vi-VN")} đ. Đơn hàng chuyển sang trạng thái sẵn sàng tại kho Việt Nam.`
                : `Quản trị viên đã xác nhận chuyển khoản ${amountVnd.toLocaleString("vi-VN")} đ. Đơn hàng đã tự động chuyển sang hàng đợi mua hàng tại Tokyo (PURCHASING_JP).`,
            location: "Hệ thống Quản trị ChillBanana",
          },
        });
      }
      return tx.order.findUniqueOrThrow({ where: { id: existingOrder.id } });
    });

    await writeAuditLog({
      actor: username,
      action: isBalanceSettlement ? "ORDER_BALANCE_SETTLED" : "ORDER_PAYMENT_RECORDED",
      entityType: "Order",
      entityId: existingOrder.orderCode,
      summary: isBalanceSettlement
        ? `Ghi nhận chuyển khoản tất toán số dư ${amountVnd.toLocaleString("vi-VN")} đ (PAID_100) cho đơn ${existingOrder.orderCode}.`
        : `Ghi nhận chuyển khoản ${amountVnd.toLocaleString("vi-VN")} đ (${paymentStatus}). Trạng thái đơn tự động chuyển sang ${nextStatus}.`,
      metadata: { amountVnd, paymentStatus: isBalanceSettlement ? "PAID_100" : paymentStatus, reference, nextStatus },
      req,
    });
    sendPaymentSuccessEmail(order).catch((error) => console.warn("[Manual Payment Email Error]", error));
    return NextResponse.json({ success: true, order });
  } catch (error) {
    if (error instanceof Error && error.message === "PAYMENT_RECORD_CONFLICT") {
      return NextResponse.json({ error: "Đơn hàng vừa được thanh toán hoặc cập nhật. Hãy tải lại danh sách." }, { status: 409 });
    }
    console.error("Lỗi ghi nhận chuyển khoản thủ công:", error);
    return NextResponse.json({ error: "Không thể ghi nhận thanh toán lúc này." }, { status: 500 });
  }
}
