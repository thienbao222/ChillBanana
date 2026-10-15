import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusUpdateEmail, sendPriceApprovedEmail } from "@/lib/mailer";
import {
  getCustomerFromRequest,
  hasGuestOrderAccessForEmail,
  isAdminRequest,
  getAdminUsernameFromRequest,
  ORDER_ACCESS_COOKIE_NAME,
  verifyGuestOrderAccessToken,
} from "@/lib/auth-session";
import { isNextOrderStatus } from "@/features/orders/policy";
import { getDepositAmount } from "@/features/payments/policy";
import { writeAuditLog } from "@/lib/audit";

function isAdmin(req: NextRequest): boolean {
  return isAdminRequest(req);
}

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderCode } = await params;
    const customerSession = getCustomerFromRequest(req);
    const adminSession = isAdminRequest(req);
    const accessToken = req.cookies.get(ORDER_ACCESS_COOKIE_NAME)?.value;
    const guestAccess = verifyGuestOrderAccessToken(accessToken || "");
    if (!adminSession && !customerSession && guestAccess?.orderCode !== orderCode) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng hoặc cần xác minh quyền truy cập." }, { status: 404 });
    }

    const dbOrder = await prisma.order.findFirst({
      where: { orderCode },
      select: {
        customerId: true,
        customerEmail: true,
        orderCode: true,
        productName: true,
        category: true,
        originalUrl: true,
        priceJpy: true,
        weightKg: true,
        exchangeRate: true,
        productPriceVnd: true,
        serviceFeeVnd: true,
        shippingFeeVnd: true,
        totalVnd: true,
        depositAmountVnd: true,
        depositPercent: true,
        paymentStatus: true,
        paymentMethod: true,
        isPriceVerified: true,
        reservationExpiresAt: true,
        isGroupBuy: true,
        groupBuyCode: true,
        status: true,
        jpDomesticTrack: true,
        vnDomesticTrack: true,
        createdAt: true,
        trackingLogs: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!dbOrder) {
      return NextResponse.json(
        { error: "Không tìm thấy đơn hàng với mã này." },
        { status: 404 }
      );
    }

    const authorized = adminSession ||
      Boolean(customerSession && dbOrder.customerId === customerSession.id) ||
      hasGuestOrderAccessForEmail(accessToken, orderCode, dbOrder.customerEmail);
    if (!authorized) {
      // Same response for unknown codes and unauthorized users to avoid order-code enumeration.
      return NextResponse.json({ error: "Không tìm thấy đơn hàng hoặc cần xác minh quyền truy cập." }, { status: 404 });
    }

    const publicOrder = { ...dbOrder, customerId: undefined, customerEmail: undefined };
    return NextResponse.json({
      success: true,
      order: {
        ...publicOrder,
        canCancel: Boolean(customerSession && dbOrder.customerId === customerSession.id && dbOrder.status === "PENDING_DEPOSIT" && dbOrder.paymentStatus === "UNPAID"),
      },
    });
  } catch (error) {
    console.error("Lỗi tra cứu đơn hàng:", error);
    return NextResponse.json(
      { error: "Lỗi khi tra cứu thông tin đơn hàng" },
      { status: 500 }
    );
  }
}

/** Exchange a signed email link for a short-lived HttpOnly cookie. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderCode } = await params;
    const body = await req.json().catch(() => null);
    const token = body && typeof body.accessToken === "string" ? body.accessToken : "";
    const access = verifyGuestOrderAccessToken(token);
    if (!access || access.orderCode !== orderCode) {
      return NextResponse.json({ error: "Liên kết xác minh không hợp lệ hoặc đã hết hạn." }, { status: 401 });
    }

    const order = await prisma.order.findUnique({
      where: { orderCode },
      select: { customerEmail: true },
    });
    if (!order || !hasGuestOrderAccessForEmail(token, orderCode, order.customerEmail)) {
      return NextResponse.json({ error: "Liên kết xác minh không hợp lệ hoặc đã hết hạn." }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(ORDER_ACCESS_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api",
      expires: new Date(access.exp),
    });
    return response;
  } catch (error) {
    console.error("Lỗi xác minh quyền truy cập đơn hàng:", error);
    return NextResponse.json({ error: "Không thể xác minh liên kết đơn hàng." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderCode } = await params;
    const body = await req.json();

    let {
      status,
      title,
      description,
      location,
      jpTrack,
      vnTrack,
      weightKg,
      action,
      by,
      reason,
      paymentStatus,
      isPriceVerified,
      priceJpy,
      productPriceVnd,
      serviceFeeVnd,
      shippingFeeVnd,
      totalVnd,
      depositAmountVnd,
    } = body;

    const allowedStatuses = new Set(["PENDING_DEPOSIT", "PURCHASING_JP", "WAREHOUSE_JP", "IN_TRANSIT_AIR", "WAREHOUSE_VN", "LOCAL_DELIVERY", "COMPLETED", "CANCELLED"]);
    if (status !== undefined && !allowedStatuses.has(status)) {
      return NextResponse.json({ error: "Trạng thái đơn hàng không hợp lệ." }, { status: 400 });
    }
    if (status === "CANCELLED" && action !== "cancel") {
      return NextResponse.json({ error: "Hãy dùng thao tác hủy đơn để hoàn kho và ghi nhận lý do hủy." }, { status: 400 });
    }
    if (paymentStatus !== undefined && !(action === "cancel" && paymentStatus === "REFUNDED")) {
      return NextResponse.json({ error: "Trạng thái thanh toán chỉ được thay đổi trong thao tác xác nhận hoàn tiền khi hủy đơn." }, { status: 400 });
    }

    // Tìm đơn hàng trong Prisma — kèm OrderItems để hoàn kho khi hủy
    const existingOrder = await prisma.order.findFirst({
      where: {
        OR: [{ orderCode }, { id: orderCode }],
      },
      include: { orderItems: true },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: "Không tìm thấy đơn hàng với mã này." },
        { status: 404 }
      );
    }

    const isAdminUser = isAdmin(req);
    const customerInfo = getCustomerFromRequest(req);
    const priceWasJustApproved = isAdminUser && isPriceVerified === true && !existingOrder.isPriceVerified;

    if (!isAdminUser) {
      if (!customerInfo) {
        return NextResponse.json({ error: "Không có quyền thực hiện." }, { status: 401 });
      }
      if (existingOrder.customerId !== customerInfo.id) {
        return NextResponse.json({ error: "Không có quyền thực hiện." }, { status: 401 });
      }
    }

    // Không cho phép thay đổi nếu đơn hàng đã hoàn tất hoặc đã hủy
    if (existingOrder.status === "COMPLETED" || existingOrder.status === "CANCELLED") {
      return NextResponse.json(
        { error: `Đơn hàng đã ${existingOrder.status === "COMPLETED" ? "hoàn tất" : "hủy"}, không thể thay đổi trạng thái.` },
        { status: 400 }
      );
    }

    if (existingOrder.paymentStatus !== "UNPAID" && (isPriceVerified !== undefined || [priceJpy, productPriceVnd, serviceFeeVnd, shippingFeeVnd, totalVnd, depositAmountVnd].some((value) => value !== undefined))) {
      return NextResponse.json({ error: "Không thể thay đổi báo giá sau khi đơn đã được thanh toán." }, { status: 409 });
    }

    if (!isAdminUser) {
      if (action !== 'cancel' || by !== 'CUSTOMER') {
        return NextResponse.json({ error: "Khách hàng chỉ có quyền hủy đơn." }, { status: 401 });
      }
      if (existingOrder.status !== "PENDING_DEPOSIT" || existingOrder.paymentStatus !== "UNPAID") {
        return NextResponse.json({ error: "Chỉ có thể tự hủy đơn chưa thanh toán và chưa được mua hộ." }, { status: 409 });
      }
    }

    // Hỗ trợ hành động HỦY ĐƠN (từ Khách hàng hoặc Admin)
    if (action === "cancel") {
      status = "CANCELLED";
      if (!title) {
        title =
          by === "CUSTOMER"
            ? "Khách hàng đã hủy đơn hàng"
            : "Quản trị viên đã hủy đơn hàng";
      }
      if (!description) {
        description = reason
          ? `Lý do hủy: ${reason}`
          : by === "CUSTOMER"
          ? "Khách hàng đã chủ động hủy đơn hàng trên hệ thống."
          : "Đơn hàng đã được nhân viên quản trị hủy trên hệ thống.";
      }
      if (!location) {
        location =
          by === "CUSTOMER" ? "Khách hàng" : "Hệ thống Quản trị ChillBanana";
      }

    }

    const requestedStatus = status || existingOrder.status;
    if (requestedStatus !== existingOrder.status && requestedStatus !== "CANCELLED" && !isNextOrderStatus(existingOrder.status, requestedStatus)) {
      return NextResponse.json({ error: "Đơn chỉ được chuyển sang bước kế tiếp trong quy trình. Hãy kiểm tra lại trạng thái hiện tại." }, { status: 409 });
    }
    if (existingOrder.status === "PENDING_DEPOSIT" && requestedStatus === "PURCHASING_JP" && !existingOrder.isPriceVerified) {
      return NextResponse.json({ error: "Cần xác minh báo giá trước khi chuyển đơn sang bước mua hàng." }, { status: 409 });
    }
    if (existingOrder.status === "PENDING_DEPOSIT" && requestedStatus === "PURCHASING_JP") {
      if (existingOrder.paymentStatus !== "DEPOSITED_50" && existingOrder.paymentStatus !== "PAID_100") {
        return NextResponse.json({ error: "Cần xác nhận đã nhận tiền cọc trước khi chuyển đơn sang bước mua hàng." }, { status: 409 });
      }
    }

    const logStatus = status || existingOrder.status;
    const logTitle =
      title ||
      (action === "cancel"
        ? "Hủy đơn hàng"
        : "Cập nhật tiến độ đơn hàng");
    const logDescription =
      description ||
      (action === "cancel"
        ? "Đơn hàng đã bị hủy trên hệ thống."
        : "Đơn hàng đã chuyển sang giai đoạn mới.");
    const logLocation = location || "Việt Nam";

    const updateData: any = {
      status: logStatus,
      trackingLogs: {
        create: {
          status: logStatus,
          title: logTitle,
          description: logDescription,
          location: logLocation,
        },
      },
    };

    if (isAdminUser) {
      if (paymentStatus !== undefined) {
        updateData.paymentStatus = paymentStatus;
      }
      if (isPriceVerified !== undefined) {
        if (typeof isPriceVerified !== "boolean") {
          return NextResponse.json({ error: "Giá trị xác minh báo giá không hợp lệ." }, { status: 400 });
        }
        updateData.isPriceVerified = isPriceVerified;
        if (isPriceVerified && !existingOrder.isPriceVerified) {
          updateData.priceVerifiedAt = new Date();
        }
        if (!isPriceVerified) updateData.priceVerifiedAt = null;
      }
      if (isPriceVerified === true && !existingOrder.isPriceVerified) {
        const finalPriceJpy = Number(priceJpy);
        const finalWeightKg = Number(weightKg);
        if (!Number.isSafeInteger(finalPriceJpy) || finalPriceJpy < 100 || !Number.isFinite(finalWeightKg) || finalWeightKg < 0 || finalWeightKg > 100) {
          return NextResponse.json({ error: "Để duyệt giá, vui lòng nhập giá JPY hợp lệ và cân nặng từ 0 đến 100 kg." }, { status: 400 });
        }
        const finalProductPriceVnd = Math.round(finalPriceJpy * existingOrder.exchangeRate);
        const finalServiceFeeVnd = Math.max(20000, Math.round(finalProductPriceVnd * 0.04));
        const shipRate = existingOrder.isGroupBuy && finalWeightKg <= 0.5 ? Math.round(185000 * 0.75) : 185000;
        const finalShippingFeeVnd = finalWeightKg > 0 ? Math.round(finalWeightKg * shipRate) : 0;
        const finalTotalVnd = finalProductPriceVnd + finalServiceFeeVnd + finalShippingFeeVnd;
        updateData.priceJpy = finalPriceJpy;
        updateData.weightKg = finalWeightKg;
        updateData.productPriceVnd = finalProductPriceVnd;
        updateData.serviceFeeVnd = finalServiceFeeVnd;
        updateData.shippingFeeVnd = finalShippingFeeVnd;
        updateData.totalVnd = finalTotalVnd;
        updateData.depositAmountVnd = getDepositAmount(
          finalProductPriceVnd + finalServiceFeeVnd,
          existingOrder.depositPercent === 100 ? 100 : 50
        );
        if (existingOrder.orderItems.some((item) => item.itemType === "CATALOG" && item.productId)) {
          // Start the customer payment hold only once a mixed catalog/quote order is payable.
          updateData.reservationExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
        }
      } else {
        if ([priceJpy, productPriceVnd, serviceFeeVnd, shippingFeeVnd, totalVnd, depositAmountVnd].some((value) => value !== undefined)) {
          return NextResponse.json({ error: "Báo giá phải được cập nhật đồng thời với thao tác duyệt giá." }, { status: 400 });
        }
      }
    }

    if (isAdminUser && jpTrack !== undefined) {
      updateData.jpDomesticTrack = jpTrack;
    }
    if (isAdminUser && vnTrack !== undefined) {
      updateData.vnDomesticTrack = vnTrack;
    }
    if (isAdminUser && weightKg !== undefined && weightKg !== null && weightKg !== "" && !updateData.weightKg) {
      updateData.weightKg = typeof weightKg === "number" ? weightKg : parseFloat(weightKg) || 0;
    }

    // Cancellation, inventory restoration and audit log commit atomically once.
    const updated = action === "cancel"
      ? await prisma.$transaction(async (tx) => {
          const scalarData = { ...updateData };
          delete scalarData.trackingLogs;
          const claimed = await tx.order.updateMany({
            where: { id: existingOrder.id, status: existingOrder.status, paymentStatus: existingOrder.paymentStatus },
            data: scalarData,
          });
          if (claimed.count !== 1) throw new Error("ORDER_CANCEL_CONFLICT");

          if (existingOrder.status === "PENDING_DEPOSIT") {
            for (const item of existingOrder.orderItems) {
              if (item.itemType === "CATALOG" && item.productId) {
                await tx.product.updateMany({
                  where: { id: item.productId },
                  data: { stockSlots: { increment: item.quantity } },
                });
              }
            }
            if (existingOrder.orderItems.some((item) => item.itemType === "CATALOG" && item.productId)) {
              await tx.order.update({
                where: { id: existingOrder.id },
                data: { reservationReleasedAt: new Date(), reservationExpiresAt: null },
              });
            }
          }
          await tx.trackingLog.create({
            data: { orderId: existingOrder.id, status: logStatus, title: logTitle, description: logDescription, location: logLocation },
          });
          return tx.order.findUnique({
            where: { id: existingOrder.id },
            include: { trackingLogs: { orderBy: { createdAt: "desc" } } },
          });
        })
      : await prisma.order.update({
          where: { id: existingOrder.id },
          data: updateData,
          include: { trackingLogs: { orderBy: { createdAt: "desc" } } },
        });

    if (isAdminUser) {
      await writeAuditLog({
        actor: getAdminUsernameFromRequest(req) ?? "admin",
        action: priceWasJustApproved ? "ORDER_PRICE_APPROVED" : action === "cancel" ? "ORDER_CANCELLED" : "ORDER_UPDATED",
        entityType: "Order",
        entityId: existingOrder.orderCode,
        summary: `Cập nhật đơn ${existingOrder.orderCode}${status ? ` → ${status}` : ""}.`,
        metadata: {
          fromStatus: existingOrder.status,
          toStatus: status ?? null,
          priceApproved: priceWasJustApproved,
          changedFields: Object.keys(updateData).filter((k) => k !== "trackingLogs"),
        },
        req,
      });
    }

    // Duyệt báo giá cần email riêng, có kết quả để giao diện báo chính xác cho admin.
    // Các thay đổi trạng thái khác tiếp tục gửi email cập nhật tiến độ như trước.
    if (priceWasJustApproved) {
      const emailSent = await sendPriceApprovedEmail(updated);
      return NextResponse.json({ success: true, order: updated, emailSent });
    }

    sendOrderStatusUpdateEmail(updated, logTitle, logDescription).catch(
      (err) => console.warn("Lỗi gửi email cập nhật đơn hàng:", err)
    );

    return NextResponse.json({ success: true, order: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_CANCEL_CONFLICT") {
      return NextResponse.json({ error: "Đơn vừa được xử lý ở yêu cầu khác. Hãy tải lại danh sách." }, { status: 409 });
    }
    console.error("Lỗi cập nhật trạng thái đơn hàng:", error);
    return NextResponse.json({ error: "Lỗi cập nhật trạng thái đơn hàng" }, { status: 500 });
  }
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Hệ thống không xóa vĩnh viễn đơn hàng để bảo toàn lịch sử và tồn kho. Hãy hủy đơn nếu cần dừng xử lý." },
    { status: 405, headers: { Allow: "GET, PATCH" } }
  );
}
