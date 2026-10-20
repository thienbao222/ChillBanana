import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createMockPaymentAttemptToken } from "@/features/payments/mock-provider";
import { resolvePaymentMode } from "@/features/payments/provider";
import {
  getCustomerFromRequest,
  hasGuestOrderAccessForEmail,
  ORDER_ACCESS_COOKIE_NAME,
} from "@/lib/auth-session";
import { isVerifiedAdmin } from "@/lib/admin-guard";

// ========== Helpers ==========
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

    // BẢO MẬT: Bắt buộc xác thực quyền với đơn hàng để chống Unauthenticated Order Lockout
    const isAdmin = await isVerifiedAdmin(req);
    const customer = getCustomerFromRequest(req);
    const guestAccessToken = req.cookies.get(ORDER_ACCESS_COOKIE_NAME)?.value || (typeof body.accessToken === "string" ? body.accessToken : undefined);
    const cleanReqPhone = typeof body.phone === "string" ? body.phone.replace(/\s+/g, "") : "";
    const cleanOrderPhone = (order.customerPhone || "").replace(/\s+/g, "");
    const hasGuestAccess = Boolean(
      (order.customerEmail && hasGuestOrderAccessForEmail(guestAccessToken, order.orderCode, order.customerEmail)) ||
      (!order.customerEmail && cleanReqPhone && cleanReqPhone === cleanOrderPhone)
    );

    const isAuthorized = isAdmin || (customer && order.customerId === customer.id) || hasGuestAccess;
    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Bạn không có quyền khởi tạo thanh toán cho đơn hàng này." },
        { status: 403 }
      );
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
    const mode = resolvePaymentMode();
    if (mode === "blocked-live") {
      return NextResponse.json({ error: "Thanh toán live đang bị khóa trong giai đoạn demo; không thể tạo giao dịch thật." }, { status: 503 });
    }
    if (mode === "misconfigured") {
      return NextResponse.json({ error: "Cấu hình thanh toán không hợp lệ. Sandbox chỉ chấp nhận URL chính thức sandbox.vnpayment.vn." }, { status: 503 });
    }
    const tmnCode = mode === "sandbox" ? process.env.VNPAY_TMN_CODE : undefined;
    const hashSecret = mode === "sandbox" ? process.env.VNPAY_HASH_SECRET : undefined;
    const vnpUrl = mode === "sandbox" ? process.env.VNPAY_URL : undefined;
    if (mode === "sandbox" && (!tmnCode || !hashSecret || !vnpUrl)) {
      return NextResponse.json({ error: "Cấu hình VNPAY sandbox chưa đầy đủ." }, { status: 503 });
    }

    // Keep catalog stock reserved through the gateway's 15-minute payment window plus a buffer.
    // BẢO MẬT: Giới hạn trần tối đa 45 phút kể từ thời điểm tạo đơn để chống giam kho vô tận (Stock Squatting)
    if (order.reservationExpiresAt) {
      const maxReservationCeiling = new Date(order.createdAt.getTime() + 45 * 60 * 1000);
      const requestedPaymentExpiry = new Date(now.getTime() + 17 * 60 * 1000);
      const paymentWindowExpiresAt = requestedPaymentExpiry > maxReservationCeiling
        ? maxReservationCeiling
        : requestedPaymentExpiry;

      if (paymentWindowExpiresAt <= now) {
        return NextResponse.json(
          { error: "Đơn hàng đã hết thời gian gia hạn giữ hàng tối đa (45 phút). Vui lòng liên hệ hỗ trợ hoặc đặt đơn mới." },
          { status: 409 }
        );
      }

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

    const amount = order.depositAmountVnd; // Server-side computed amount

    // Tự động phát hiện base URL: ưu tiên APP_URL, NEXT_PUBLIC_APP_URL, hoặc domain production công khai
    const baseUrl =
      process.env.APP_URL?.replace(/\/+$/, "") ||
      (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost") ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "") : null) ||
      (process.env.VERCEL || process.env.NODE_ENV === "production" ? "https://chill-banana.vercel.app" : "http://localhost:3000");

    const returnUrl = `${baseUrl}/api/payment/vnpay-return`;

    const attemptExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const createdAttempt = await prisma.$transaction(async (tx) => {
      // Serialize initiation per order so two rapid clicks cannot create two live payment sessions.
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`;
      const currentOrder = await tx.order.findUnique({
        where: { id: order.id },
        select: { status: true, paymentStatus: true, isPriceVerified: true, depositAmountVnd: true, reservationExpiresAt: true },
      });
      const currentTime = new Date();
      if (!currentOrder || currentOrder.status !== "PENDING_DEPOSIT" || currentOrder.paymentStatus !== "UNPAID" || !currentOrder.isPriceVerified || currentOrder.depositAmountVnd !== order.depositAmountVnd || (currentOrder.reservationExpiresAt && currentOrder.reservationExpiresAt <= currentTime)) {
        return { error: "Đơn hàng vừa được thanh toán hoặc không còn đủ điều kiện tạo phiên thanh toán." } as const;
      }
      await tx.paymentAttempt.updateMany({
        where: { orderId: order.id, status: { in: ["INITIATED", "PENDING"] }, expiresAt: { lte: currentTime } },
        data: { status: "EXPIRED", failureCode: "ATTEMPT_EXPIRED", completedAt: currentTime },
      });
      const activeAttempt = await tx.paymentAttempt.findFirst({
        where: { orderId: order.id, status: { in: ["INITIATED", "PENDING"] }, expiresAt: { gt: currentTime } },
        select: { id: true },
      });
      if (activeAttempt) return { error: "Đơn hàng đã có một phiên thanh toán đang chờ. Hãy hoàn tất hoặc chờ phiên đó hết hạn." } as const;
      const attempt = await tx.paymentAttempt.create({
        data: {
          orderId: order.id,
          provider: mode === "mock" ? "MOCK" : "VNPAY_SANDBOX",
          mode,
          amountVnd: order.depositAmountVnd,
          idempotencyKey: `${mode}:${order.id}:${randomUUID()}`,
          expiresAt: attemptExpiresAt,
        },
      });
      return { attempt } as const;
    });
    if ("error" in createdAttempt) return NextResponse.json({ error: createdAttempt.error }, { status: 409 });
    const attempt = createdAttempt.attempt;

    if (mode === "mock") {
      try {
        const token = createMockPaymentAttemptToken(attempt.id, attemptExpiresAt);
        const paymentUrl = new URL("/payment/mock", baseUrl);
        paymentUrl.searchParams.set("token", token);
        paymentUrl.searchParams.set("orderCode", order.orderCode);
        return NextResponse.json({ success: true, mode, paymentUrl: paymentUrl.toString(), demo: true });
      } catch (error) {
        await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "FAILED", failureCode: "MOCK_PROVIDER_CONFIG", completedAt: new Date() } });
        console.error("[Mock Payment] Provider configuration failed:", error);
        return NextResponse.json({ error: "Cấu hình chữ ký thanh toán mô phỏng chưa đầy đủ." }, { status: 503 });
      }
    }

    // Múi giờ Vietnam (GMT+7)
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
    const createDate = `${get("year")}${get("month")}${get("day")}${get("hour")}${get("minute")}${get("second")}`;
    const expireDate = (() => {
      const exp = new Date(now.getTime() + 15 * 60 * 1000);
      const p2 = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false,
      }).formatToParts(exp);
      const g = (t: string) => p2.find((x) => x.type === t)?.value ?? "00";
      return `${g("year")}${g("month")}${g("day")}${g("hour")}${g("minute")}${g("second")}`;
    })();

    // VNPAY yêu cầu số tiền * 100 (đơn vị: đồng -> làm tròn)
    const amountInt = Math.round(Number(amount));

    const forwardedIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const clientIp = forwardedIp || req.headers.get("x-real-ip") || "127.0.0.1";
    const params: Record<string, string> = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: tmnCode!,
      vnp_Amount: String(amountInt * 100),
      vnp_CreateDate: createDate,
      vnp_CurrCode: "VND",
      vnp_IpAddr: clientIp,
      vnp_Locale: "vn",
      vnp_OrderInfo: `Thanh toan don hang ${orderCode}`,
      vnp_OrderType: "other",
      vnp_ReturnUrl: returnUrl,
      vnp_TxnRef: `${orderCode}_${attempt.id.slice(-6)}`,
      vnp_ExpireDate: expireDate,
    };

    const sortedParams = sortObject(params);
    const signData = buildQueryString(sortedParams);
    const hmac = crypto.createHmac("sha512", hashSecret!);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    const paymentUrl = `${vnpUrl!}?${signData}&vnp_SecureHash=${signed}`;

    return NextResponse.json({ success: true, mode, paymentUrl, demo: true });
  } catch (error) {
    console.error("[VNPAY CREATE]", error);
    return NextResponse.json({ error: "Lỗi tạo URL thanh toán" }, { status: 500 });
  }
}
