import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPaymentSuccessEmail } from "@/lib/mailer";
import { getRecordedPaymentStatus } from "@/features/payments/policy";
import { enforceMockSandboxAllowed } from "@/features/payments/sandbox-guard";
import { requireAdmin } from "@/lib/admin-guard";
import { getVerifiedCustomerFromRequest } from "@/lib/customer-guard";
import { ORDER_ACCESS_COOKIE_NAME, hasGuestOrderAccessForEmail } from "@/lib/auth-session";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * /api/payment/mock-sandbox
 * ─────────────────────────────────────────────────────────────────────────────
 * API mô phỏng kết quả cổng thanh toán Sandbox.
 * Cho phép khách có quyền với đơn (hasCustomerAccessToOrder) hoặc Admin (OPERATOR / SUPER_ADMIN).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function POST(req: NextRequest) {
  const guardResponse = enforceMockSandboxAllowed();
  if (guardResponse) return guardResponse;

  try {
    const body = await req.json().catch(() => null);
    const { orderCode, action } = body || {};

    if (!orderCode || typeof orderCode !== "string") {
      return NextResponse.json({ error: "Thiếu mã đơn hàng." }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { orderCode: orderCode.trim() },
    });

    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
    }

    // Kiểm tra quyền: Admin (OPERATOR hoặc SUPER_ADMIN) hoặc Khách hàng sở hữu đơn
    const adminGuard = await requireAdmin(req, { roles: ["SUPER_ADMIN", "OPERATOR"] });
    let isAuthorized = adminGuard.ok;
    let actorName = adminGuard.ok ? adminGuard.username : "";

    if (!isAuthorized) {
      const customer = await getVerifiedCustomerFromRequest(req);
      if (customer && order.customerId === customer.id) {
        isAuthorized = true;
        actorName = customer.email;
      } else {
        const accessToken = req.cookies.get(ORDER_ACCESS_COOKIE_NAME)?.value;
        if (hasGuestOrderAccessForEmail(accessToken, order.orderCode, order.customerEmail)) {
          isAuthorized = true;
          actorName = order.customerEmail;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác trên đơn hàng này." },
        { status: 403 }
      );
    }

    if (action === "cancel") {
      return NextResponse.json({
        success: false,
        message: "Giao dịch đã được hủy bởi người dùng.",
        redirectUrl: `/tracking?code=${encodeURIComponent(order.orderCode)}&payment=cancelled`,
      });
    }

    if (action === "fail") {
      return NextResponse.json({
        success: false,
        message: "Giao dịch giả lập thất bại (mô phỏng số dư không đủ / thẻ lỗi).",
        redirectUrl: `/tracking?code=${encodeURIComponent(order.orderCode)}&payment=failed`,
      });
    }

    if (action === "success") {
      if (order.paymentStatus !== "UNPAID") {
        return NextResponse.json({
          success: true,
          message: "Đơn hàng này đã được thanh toán trước đó.",
          redirectUrl: `/tracking?code=${encodeURIComponent(order.orderCode)}&payment=already_paid`,
        });
      }

      if (order.status !== "PENDING_DEPOSIT" || !order.isPriceVerified) {
        return NextResponse.json(
          { error: "Đơn hàng không ở trạng thái chờ cọc hoặc chưa được duyệt giá." },
          { status: 409 }
        );
      }

      const recordedStatus = getRecordedPaymentStatus(order.depositPercent);
      const amountVnd = order.depositAmountVnd;
      const mockTxnId = `SANDBOX_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

      const updated = await prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: {
            id: order.id,
            status: "PENDING_DEPOSIT",
            paymentStatus: "UNPAID",
            isPriceVerified: true,
          },
          data: {
            paymentStatus: recordedStatus,
            paymentMethod: "VNPAY_SANDBOX",
            status: "PURCHASING_JP",
            reservationExpiresAt: null,
            isPriceVerified: true,
            isSandbox: true,
          },
        });

        if (claimed.count !== 1) return null;

        await tx.paymentTransaction.create({
          data: {
            orderId: order.id,
            provider: "MOCK_SANDBOX",
            amountVnd,
            providerTransactionId: mockTxnId,
            reference: `Mô phỏng thanh toán Sandbox (${order.depositPercent}%)`,
            status: "CONFIRMED",
            confirmedByAdmin: adminGuard.ok ? adminGuard.username : "CUSTOMER_SANDBOX",
          },
        });

        await tx.trackingLog.create({
          data: {
            orderId: order.id,
            status: "PURCHASING_JP",
            title: order.depositPercent === 100 ? "Thanh toán 100% thành công (Sandbox)" : "Thanh toán cọc 50% thành công (Sandbox)",
            description: adminGuard.ok
              ? `Admin ${adminGuard.username} xác nhận thanh toán Sandbox ${amountVnd.toLocaleString("vi-VN")} đ (Mã GD: ${mockTxnId}). Đơn hàng chuyển sang bước mua hàng tại Nhật.`
              : `Khách hàng hoàn tất thanh toán Sandbox ${amountVnd.toLocaleString("vi-VN")} đ (Mã GD: ${mockTxnId}). Đơn hàng chuyển sang bước mua hàng tại Nhật.`,
            location: "ChillBanana Payment Gateway",
          },
        });

        return tx.order.findUnique({ where: { id: order.id } });
      });

      if (!updated) {
        return NextResponse.json({
          error: "Không thể cập nhật trạng thái đơn hàng (có thể đơn vừa được thanh toán ở luồng khác).",
        }, { status: 409 });
      }

      await writeAuditLog({
        actor: actorName || "customer",
        action: "ORDER_PAYMENT_RECORDED",
        entityType: "Order",
        entityId: order.orderCode,
        summary: `Thanh toán Sandbox cho đơn ${order.orderCode}`,
        metadata: { amountVnd, transactionId: mockTxnId, mode: adminGuard.ok ? "ADMIN_SANDBOX" : "CUSTOMER_SANDBOX" },
      });

      sendPaymentSuccessEmail(updated).catch((err) =>
        console.warn("[Sandbox Email Error]", err)
      );

      return NextResponse.json({
        success: true,
        message: "Xác nhận thanh toán Sandbox thành công!",
        transactionId: mockTxnId,
        redirectUrl: `/tracking?code=${encodeURIComponent(order.orderCode)}&payment=success`,
      });
    }

    return NextResponse.json({ error: "Action không hợp lệ. Sử dụng 'success', 'fail' hoặc 'cancel'." }, { status: 400 });
  } catch (error) {
    console.error("[MOCK SANDBOX ERROR]", error);
    return NextResponse.json({ error: "Lỗi xử lý thanh toán Sandbox." }, { status: 500 });
  }
}
