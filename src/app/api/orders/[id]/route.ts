import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusUpdateEmail } from "@/lib/mailer";
import { isAdminRequest, getCustomerFromRequest } from "@/lib/auth-session";
import { isNextOrderStatus } from "@/lib/order-policy";

function isAdmin(req: NextRequest): boolean {
  return isAdminRequest(req);
}

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderCode = params.id;

    const dbOrder = await prisma.order.findFirst({
      where: { orderCode },
      select: {
        customerId: true,
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
        paymentStatus: true,
        paymentMethod: true,
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

    const customerSession = getCustomerFromRequest(req);
    const { customerId, ...publicOrder } = dbOrder;
    return NextResponse.json({
      success: true,
      order: {
        ...publicOrder,
        canCancel: Boolean(customerSession && customerId === customerSession.id && dbOrder.status === "PENDING_DEPOSIT" && dbOrder.paymentStatus === "UNPAID"),
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderCode = params.id;
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
    if (paymentStatus !== undefined && !["UNPAID", "DEPOSITED_50", "PAID_100", "REFUNDED"].includes(paymentStatus)) {
      return NextResponse.json({ error: "Trạng thái thanh toán không hợp lệ." }, { status: 400 });
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
        if (paymentStatus === "REFUNDED" && action !== "cancel") {
          return NextResponse.json({ error: "Chỉ ghi nhận hoàn tiền trong thao tác hủy đơn." }, { status: 400 });
        }
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
        updateData.depositAmountVnd = Math.round((finalProductPriceVnd + finalServiceFeeVnd) * 0.5);
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

    // Gửi email thông báo cập nhật trạng thái
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
