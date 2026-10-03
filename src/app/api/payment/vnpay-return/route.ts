import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPaymentSuccessEmail } from "@/lib/mailer";

function sortObject(obj: Record<string, string>) {
  const sorted: Record<string, string> = {};
  const keys = Object.keys(obj).sort();
  keys.forEach((key) => {
    sorted[key] = obj[key];
  });
  return sorted;
}

function buildQueryString(params: Record<string, string>) {
  return Object.entries(params)
    .map(([key, val]) => `${key}=${encodeURIComponent(val).replace(/%20/g, "+")}`)
    .join("&");
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const hashSecret = process.env.VNPAY_HASH_SECRET!;

  // Lấy toàn bộ params VNPAY trả về
  const vnpParams: Record<string, string> = {};
  searchParams.forEach((val, key) => {
    if (key.startsWith("vnp_") && key !== "vnp_SecureHash") {
      vnpParams[key] = val;
    }
  });

  const secureHash = searchParams.get("vnp_SecureHash") || "";
  const responseCode = searchParams.get("vnp_ResponseCode") || "";
  const orderCode = searchParams.get("vnp_TxnRef") || "";

  // Xác minh chữ ký HMAC-SHA512
  const sortedParams = sortObject(vnpParams);
  const signData = buildQueryString(sortedParams);
  const hmac = crypto.createHmac("sha512", hashSecret);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  const isValidSignature = signed === secureHash;
  const isSuccess = responseCode === "00";

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  if (!isValidSignature) {
    // Chữ ký không hợp lệ — redirect về tracking với lỗi
    return NextResponse.redirect(`${appUrl}/tracking?orderCode=${orderCode}&payment=invalid`);
  }

  if (isSuccess) {
    // Thanh toán thành công — cập nhật DB
    try {
      const order = await prisma.order.findFirst({ where: { orderCode } });
      if (order) {
        // Idempotency: don't process if already paid
        if (order.paymentStatus !== 'UNPAID') {
          console.log(`[VNPAY] Order ${orderCode} already processed, skipping.`);
          return NextResponse.redirect(`${appUrl}/tracking?orderCode=${orderCode}&payment=success`);
        }

        // Verify amount matches (VNPAY sends amount * 100)
        const vnpAmountStr = searchParams.get('vnp_Amount') || '0';
        const vnpAmount = parseInt(vnpAmountStr, 10);
        const expectedAmount = order.depositAmountVnd * 100;
        if (Math.abs(vnpAmount - expectedAmount) > 100) { // allow 1 VND rounding tolerance
          console.error(`[VNPAY] Amount mismatch for ${orderCode}: got ${vnpAmount}, expected ${expectedAmount}`);
          return NextResponse.redirect(`${appUrl}/tracking?orderCode=${orderCode}&payment=invalid`);
        }
        const updatedOrder = await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: "DEPOSITED_50",
            status: "PURCHASING_JP",
          },
        });
        await prisma.trackingLog.create({
          data: {
            orderId: order.id,
            status: "PURCHASING_JP",
            title: "Thanh toán cọc thành công",
            description: "Cọc 50% đã được xác nhận qua cổng VNPAY. Đội ngũ Tokyo bắt đầu tiến hành mua hàng.",
            location: "ChillBanana - Hệ thống",
          },
        });

        // Gửi email xác nhận thanh toán cọc thành công cho khách hàng
        sendPaymentSuccessEmail(updatedOrder).catch((err) =>
          console.warn("[VNPAY Email Error]", err)
        );
      }
    } catch (err) {
      console.error("[VNPAY RETURN DB]", err);
    }
    return NextResponse.redirect(`${appUrl}/tracking?orderCode=${orderCode}&payment=success`);
  } else {
    // Người dùng hủy hoặc thất bại
    return NextResponse.redirect(`${appUrl}/tracking?orderCode=${orderCode}&payment=failed`);
  }
}
