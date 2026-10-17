import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppUrl } from "@/lib/env";
import { PaymentProviderConfigError, getPaymentProvider } from "@/features/payments/providers";

// ========== POST: Tạo URL thanh toán VNPAY ==========
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderCode } = body;

    if (!orderCode) {
      return NextResponse.json({ error: 'Thiếu mã đơn hàng' }, { status: 400 });
    }

    // Fetch real amount from DB
    const order = await prisma.order.findFirst({ where: { orderCode } });
    if (!order) {
      return NextResponse.json({ error: 'Không tìm thấy đơn hàng.' }, { status: 404 });
    }
    if (order.paymentStatus !== 'UNPAID' || order.status !== "PENDING_DEPOSIT") {
      return NextResponse.json({ error: 'Đơn hàng này không còn ở trạng thái chờ thanh toán.' }, { status: 400 });
    }
    if (!order.isPriceVerified) {
      return NextResponse.json({ error: 'Đơn hàng đang chờ quản trị viên xác minh giá và cước phí. Vui lòng quay lại thanh toán sau.' }, { status: 403 });
    }
    const now = new Date();
    if (order.reservationExpiresAt && order.reservationExpiresAt <= now) {
      return NextResponse.json({ error: "Thời gian giữ hàng đã hết. Vui lòng liên hệ ChillBanana để kiểm tra lại tồn kho trước khi thanh toán." }, { status: 409 });
    }
    if (order.depositAmountVnd <= 0) {
      return NextResponse.json({ error: "Đơn hàng không có số tiền cần thanh toán." }, { status: 400 });
    }
    // Keep catalog stock reserved through the gateway's 15-minute payment window plus a buffer.
    if (order.reservationExpiresAt) {
      const paymentWindowExpiresAt = new Date(now.getTime() + 17 * 60 * 1000);
      if (order.reservationExpiresAt < paymentWindowExpiresAt) {
        const extended = await prisma.order.updateMany({
          where: {
            id: order.id,
            status: "PENDING_DEPOSIT",
            paymentStatus: "UNPAID",
            isPriceVerified: true,
            AND: [
              { reservationExpiresAt: order.reservationExpiresAt },
              { reservationExpiresAt: { gt: now } },
            ],
          },
          data: { reservationExpiresAt: paymentWindowExpiresAt },
        });
        if (extended.count !== 1) {
          return NextResponse.json({ error: "Đơn vừa hết thời gian giữ hàng hoặc được xử lý ở yêu cầu khác. Vui lòng tải lại trang theo dõi." }, { status: 409 });
        }
      }
    }

    const provider = getPaymentProvider();
    const forwardedIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const created = await provider.createPayment({
      orderCode,
      amountVnd: order.depositAmountVnd, // Số tiền do server tính, không nhận từ client
      ipAddress: forwardedIp || req.headers.get("x-real-ip") || "127.0.0.1",
      returnUrl: `${getAppUrl()}/api/payment/vnpay-return`,
    });

    return NextResponse.json({ success: true, paymentUrl: created.paymentUrl, provider: created.provider, simulated: created.isSimulated, providerReference: created.providerReference });
  } catch (error) {
    if (error instanceof PaymentProviderConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("[VNPAY CREATE]", error);
    return NextResponse.json({ error: "Lỗi tạo URL thanh toán" }, { status: 500 });
  }
}
