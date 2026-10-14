import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUsernameFromRequest, isAdminRequest } from "@/lib/auth-session";
import { sendPaymentSuccessEmail } from "@/lib/mailer";
import { getRecordedPaymentStatus } from "@/features/payments/policy";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Bạn cần đăng nhập quản trị để xác nhận thanh toán." }, { status: 401 });
  }

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
      select: { id: true, orderCode: true, status: true, paymentStatus: true, isPriceVerified: true, depositAmountVnd: true, depositPercent: true, reservationExpiresAt: true },
    });
    if (!existingOrder) return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
    if (existingOrder.status !== "PENDING_DEPOSIT" || existingOrder.paymentStatus !== "UNPAID" || !existingOrder.isPriceVerified) {
      return NextResponse.json({ error: "Chỉ ghi nhận thanh toán cho đơn đang chờ cọc và đã được duyệt giá." }, { status: 409 });
    }
    if (existingOrder.reservationExpiresAt && existingOrder.reservationExpiresAt <= new Date()) {
      return NextResponse.json({ error: "Thời gian giữ hàng đã hết. Hãy kiểm tra tồn kho và xử lý lại đơn trước khi ghi nhận tiền." }, { status: 409 });
    }
    if (amountVnd !== existingOrder.depositAmountVnd) {
      return NextResponse.json({ error: `Số tiền phải khớp chính xác với ${existingOrder.depositAmountVnd.toLocaleString("vi-VN")} đ.` }, { status: 400 });
    }

    const paymentStatus = getRecordedPaymentStatus(existingOrder.depositPercent);
    const username = getAdminUsernameFromRequest(req);
    const recordedAt = new Date();
    const order = await prisma.$transaction(async (tx) => {
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
        data: { paymentStatus, paymentMethod: "VIETQR", reservationExpiresAt: null },
      });
      if (claimed.count !== 1) throw new Error("PAYMENT_RECORD_CONFLICT");

      await tx.paymentTransaction.create({
        data: {
          orderId: existingOrder.id,
          provider: "MANUAL_BANK_TRANSFER",
          amountVnd,
          reference,
          confirmedByAdmin: username,
        },
      });
      await tx.trackingLog.create({
        data: {
          orderId: existingOrder.id,
          status: "PENDING_DEPOSIT",
          title: paymentStatus === "PAID_100" ? "Đã ghi nhận thanh toán 100%" : "Đã ghi nhận tiền cọc 50%",
          description: `Quản trị viên đã xác nhận chuyển khoản ${amountVnd.toLocaleString("vi-VN")} đ. Đơn chờ nhân viên bắt đầu xử lý mua hàng.`,
          location: "Hệ thống Quản trị ChillBanana",
        },
      });
      return tx.order.findUniqueOrThrow({ where: { id: existingOrder.id } });
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
