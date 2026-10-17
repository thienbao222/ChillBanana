import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPaymentSuccessEmail } from "@/lib/mailer";
import { getRecordedPaymentStatus } from "@/lib/payment-policy";

export const dynamic = "force-dynamic";

/**
 * /api/payment/mock-sandbox
 * ─────────────────────────────────────────────────────────────────────────────
 * API mô phỏng kết quả cổng thanh toán Sandbox (dành cho pre-production / demo).
 * Nhận POST:
 *   { orderCode: string, action: "success" | "fail" | "cancel" }
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderCode, action } = body;

    if (!orderCode || typeof orderCode !== "string") {
      return NextResponse.json({ error: "Thiếu mã đơn hàng." }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { orderCode: orderCode.trim() },
    });

    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
    }

    // Nếu người dùng chọn Hủy hoặc Thất bại
    if (action === "cancel") {
      return NextResponse.json({
        success: false,
        message: "Giao dịch đã được hủy bởi khách hàng.",
        redirectUrl: `/tracking?orderCode=${encodeURIComponent(order.orderCode)}&payment=cancelled`,
      });
    }

    if (action === "fail") {
      return NextResponse.json({
        success: false,
        message: "Giao dịch giả lập thất bại (mô phỏng số dư không đủ / thẻ lỗi).",
        redirectUrl: `/tracking?orderCode=${encodeURIComponent(order.orderCode)}&payment=failed`,
      });
    }

    // Xử lý Thành công (action === "success")
    if (action === "success") {
      if (order.paymentStatus !== "UNPAID") {
        return NextResponse.json({
          success: true,
          message: "Đơn hàng này đã được thanh toán trước đó.",
          redirectUrl: `/tracking?orderCode=${encodeURIComponent(order.orderCode)}&payment=already_paid`,
        });
      }

      const recordedStatus = getRecordedPaymentStatus(order.depositPercent);
      const amountVnd = order.depositAmountVnd;
      const mockTxnId = `SANDBOX_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

      const updated = await prisma.$transaction(async (tx) => {
        // Cập nhật trạng thái đơn
        const claimed = await tx.order.updateMany({
          where: {
            id: order.id,
            paymentStatus: "UNPAID",
          },
          data: {
            paymentStatus: recordedStatus,
            paymentMethod: "VNPAY_SANDBOX",
            status: "PURCHASING_JP",
            reservationExpiresAt: null,
            isPriceVerified: true, // Auto-verify khi thanh toán sandbox demo
          },
        });

        if (claimed.count !== 1) return null;

        // Ghi nhận PaymentTransaction
        await tx.paymentTransaction.create({
          data: {
            orderId: order.id,
            provider: "MOCK_SANDBOX",
            amountVnd,
            providerTransactionId: mockTxnId,
            reference: `Mô phỏng thanh toán Sandbox (${order.depositPercent}%)`,
            status: "CONFIRMED",
            confirmedByAdmin: "SYSTEM_SANDBOX",
          },
        });

        // Tạo TrackingLog
        await tx.trackingLog.create({
          data: {
            orderId: order.id,
            status: "PURCHASING_JP",
            title: order.depositPercent === 100 ? "Thanh toán 100% thành công (Sandbox Demo)" : "Thanh toán cọc 50% thành công (Sandbox Demo)",
            description: `Cổng Sandbox xác nhận thanh toán ${amountVnd.toLocaleString("vi-VN")} đ (Mã GD: ${mockTxnId}). Đơn hàng tự động chuyển sang bước mua hàng tại Nhật.`,
            location: "ChillBanana Payment Sandbox",
          },
        });

        return tx.order.findUnique({ where: { id: order.id } });
      });

      if (!updated) {
        return NextResponse.json({
          error: "Không thể cập nhật trạng thái đơn hàng (có thể đơn vừa được thanh toán ở luồng khác).",
        }, { status: 409 });
      }

      // Gửi email thông báo thanh toán thành công (ghi vào cả Demo Email buffer)
      sendPaymentSuccessEmail(updated).catch((err) =>
        console.warn("[Sandbox Email Error]", err)
      );

      return NextResponse.json({
        success: true,
        message: "Xác nhận thanh toán Sandbox thành công!",
        transactionId: mockTxnId,
        redirectUrl: `/tracking?orderCode=${encodeURIComponent(order.orderCode)}&payment=success`,
      });
    }

    return NextResponse.json({ error: "Action không hợp lệ. Sử dụng 'success', 'fail' hoặc 'cancel'." }, { status: 400 });
  } catch (error) {
    console.error("[MOCK SANDBOX ERROR]", error);
    return NextResponse.json({ error: "Lỗi xử lý thanh toán Sandbox." }, { status: 500 });
  }
}
