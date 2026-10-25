import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusUpdateEmail, sendPriceApprovedEmail, sendOrderRollbackEmail } from "@/lib/mailer";
import {
  hasGuestOrderAccessForEmail,
  getAdminUsernameFromRequest,
  ORDER_ACCESS_COOKIE_NAME,
  verifyGuestOrderAccessToken,
  verifySameOrigin,
} from "@/lib/auth-session";
import { getVerifiedCustomerFromRequest } from "@/lib/customer-guard";
import { isVerifiedAdmin, requireAdmin } from "@/lib/admin-guard";
import { isNextOrderStatus, getPreviousOrderStatus, ORDER_STATUS_LABELS_VI } from "@/features/orders/policy";
import { getDepositAmount } from "@/features/payments/policy";
import { writeAuditLog } from "@/lib/audit";
import { calculateOrderPrice } from "@/features/pricing/calculator";
import { getCurrentPricingConfig } from "@/features/pricing/config";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderCode } = await params;
    const isTestEnv =
      process.env.NODE_ENV === "test" ||
      process.env.VITEST === "true" ||
      process.env.APP_ENV === "test";

    // Cho phép tra cứu công khai đối với các mã đơn mẫu (-DEMO-) hoặc khi bật DEMO_PUBLIC_ORDER_TRACKING="true" trên Vercel
    const isPublicDemoLookup =
      !isTestEnv &&
      (orderCode.toUpperCase().includes("-DEMO-") ||
        process.env.DEMO_PUBLIC_ORDER_TRACKING === "true");

    const customerSession = await getVerifiedCustomerFromRequest(req);
    const adminSession = await isVerifiedAdmin(req);
    const accessToken = req.cookies.get(ORDER_ACCESS_COOKIE_NAME)?.value;
    const guestAccess = verifyGuestOrderAccessToken(accessToken || "");
    if (!isPublicDemoLookup && !adminSession && !customerSession && guestAccess?.orderCode !== orderCode) {
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

    const authorized =
      isPublicDemoLookup ||
      adminSession ||
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
      path: "/",
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
    if (!verifySameOrigin(req)) {
      return NextResponse.json({ error: "Yêu cầu vi phạm kiểm soát nguồn gốc (CSRF protection)." }, { status: 403 });
    }
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

    // BẢO MẬT (P1-19): Kiểm tra chặt chẽ kiểu string và độ dài tối đa chống Prisma crash
    if (title !== undefined && (typeof title !== "string" || title.length > 200)) {
      return NextResponse.json({ error: "Tiêu đề không hợp lệ." }, { status: 400 });
    }
    if (description !== undefined && (typeof description !== "string" || description.length > 2000)) {
      return NextResponse.json({ error: "Mô tả không hợp lệ." }, { status: 400 });
    }
    if (location !== undefined && (typeof location !== "string" || location.length > 200)) {
      return NextResponse.json({ error: "Vị trí không hợp lệ." }, { status: 400 });
    }
    if (reason !== undefined && (typeof reason !== "string" || reason.length > 500)) {
      return NextResponse.json({ error: "Lý do không hợp lệ." }, { status: 400 });
    }
    if (jpTrack !== undefined && (typeof jpTrack !== "string" || jpTrack.length > 100)) {
      return NextResponse.json({ error: "Mã vận đơn JP không hợp lệ." }, { status: 400 });
    }
    if (vnTrack !== undefined && (typeof vnTrack !== "string" || vnTrack.length > 100)) {
      return NextResponse.json({ error: "Mã vận đơn VN không hợp lệ." }, { status: 400 });
    }

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

    const isAdminUser = await isVerifiedAdmin(req);
    const customerInfo = await getVerifiedCustomerFromRequest(req);
    const priceWasJustApproved = isAdminUser && isPriceVerified === true && !existingOrder.isPriceVerified;

    if (!isAdminUser) {
      if (!customerInfo) {
        return NextResponse.json({ error: "Không có quyền thực hiện." }, { status: 401 });
      }
      if (existingOrder.customerId !== customerInfo.id) {
        return NextResponse.json({ error: "Không có quyền thực hiện." }, { status: 401 });
      }
    }

    // Hỗ trợ hành động HOÀN TÁC / LÙI 1 BƯỚC (chỉ dành cho Quản trị viên)
    if (action === "rollback") {
      const adminGuard = await requireAdmin(req);
      if (!adminGuard.ok) {
        return adminGuard.response;
      }

      const rollbackReason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (rollbackReason.length < 5) {
        return NextResponse.json(
          { error: "Vui lòng cung cấp lý do hoàn tác (tối thiểu 5 ký tự)." },
          { status: 400 }
        );
      }

      if (existingOrder.status === "PENDING_DEPOSIT" || existingOrder.status === "CANCELLED") {
        return NextResponse.json({ error: `Đơn hàng ở trạng thái "${existingOrder.status}" không thể hoàn tác lùi bước.` }, { status: 400 });
      }

      if (existingOrder.status === "COMPLETED" && adminGuard.role !== "SUPER_ADMIN") {
        return NextResponse.json(
          { error: "Chỉ Quản trị viên cấp cao (SUPER_ADMIN) mới có quyền hoàn tác đơn hàng đã hoàn tất (COMPLETED)." },
          { status: 403 }
        );
      }

      const prevStatus = getPreviousOrderStatus(existingOrder.status);
      if (!prevStatus) {
        return NextResponse.json({ error: "Không tìm thấy trạng thái trước đó để hoàn tác." }, { status: 400 });
      }

      if (prevStatus === "PENDING_DEPOSIT" && existingOrder.paymentStatus !== "UNPAID") {
        return NextResponse.json(
          { error: "Không thể hoàn tác về trạng thái Chờ cọc (PENDING_DEPOSIT) khi khách đã thanh toán/đặt cọc. Vui lòng dùng chức năng hủy/hoàn tiền." },
          { status: 400 }
        );
      }

      const fromLabel = ORDER_STATUS_LABELS_VI[existingOrder.status] || existingOrder.status;
      const toLabel = ORDER_STATUS_LABELS_VI[prevStatus] || prevStatus;

      const rollbackTitle = "Điều chỉnh tiến độ đơn hàng";
      const rollbackDesc = `Chúng tôi vừa điều chỉnh lại tiến độ đơn hàng (${fromLabel} → ${toLabel}) do cập nhật nhầm: ${rollbackReason}`;
      const rollbackLocation = "Hệ thống Quản trị ChillBanana";

      const rollbackUpdateData: any = {
        status: prevStatus,
        trackingLogs: {
          create: {
            status: prevStatus,
            title: rollbackTitle,
            description: rollbackDesc,
            location: rollbackLocation,
          },
        },
      };

      let deletedCodTransactions: Array<{
        id: string;
        amountVnd: number;
        provider: string;
        createdAt: Date;
      }> = [];

      // Nếu lùi từ COMPLETED về LOCAL_DELIVERY
      if (existingOrder.status === "COMPLETED" && prevStatus === "LOCAL_DELIVERY") {
        if (existingOrder.depositPercent === 50) {
          rollbackUpdateData.paymentStatus = "DEPOSITED_50";
          rollbackUpdateData.depositAmountVnd = getDepositAmount(
            existingOrder.productPriceVnd + existingOrder.serviceFeeVnd,
            50
          );
        }
        deletedCodTransactions = await prisma.paymentTransaction.findMany({
          where: {
            orderId: existingOrder.id,
            provider: "COD_SETTLEMENT",
          },
          select: {
            id: true,
            amountVnd: true,
            provider: true,
            createdAt: true,
          },
        });
      }

      const rolledBackOrder = await prisma.$transaction(async (tx) => {
        if (existingOrder.status === "COMPLETED" && prevStatus === "LOCAL_DELIVERY") {
          await tx.paymentTransaction.deleteMany({
            where: {
              orderId: existingOrder.id,
              provider: "COD_SETTLEMENT",
            },
          });
        }
        const scalarData = { ...rollbackUpdateData };
        delete scalarData.trackingLogs;
        const claimed = await tx.order.updateMany({
          where: { id: existingOrder.id, status: existingOrder.status },
          data: scalarData,
        });
        if (claimed.count !== 1) throw new Error("ORDER_ROLLBACK_CONFLICT");

        if (rollbackUpdateData.trackingLogs?.create) {
          await tx.trackingLog.create({
            data: {
              orderId: existingOrder.id,
              ...rollbackUpdateData.trackingLogs.create,
            },
          });
        }
        return tx.order.findUnique({
          where: { id: existingOrder.id },
          include: { trackingLogs: { orderBy: { createdAt: "desc" } } },
        });
      });

      if (!rolledBackOrder) {
        throw new Error("ORDER_ROLLBACK_FAILED");
      }

      await writeAuditLog({
        actor: adminGuard.username || getAdminUsernameFromRequest(req) || "admin",
        action: "ORDER_STATUS_ROLLBACK",
        entityType: "Order",
        entityId: existingOrder.orderCode,
        summary: `Hoàn tác trạng thái đơn ${existingOrder.orderCode} từ ${fromLabel} (${existingOrder.status}) về ${toLabel} (${prevStatus}). Lý do: ${rollbackReason}`,
        metadata: {
          fromStatus: existingOrder.status,
          toStatus: prevStatus,
          fromLabel,
          toLabel,
          reason: rollbackReason,
          deletedCodTransactions: deletedCodTransactions.map((tx) => ({
            id: tx.id,
            amountVnd: tx.amountVnd,
            provider: tx.provider,
            createdAt: tx.createdAt.toISOString(),
          })),
        },
        req,
      });

      const isFromCompleted = existingOrder.status === "COMPLETED";
      let emailQueued = false;
      try {
        emailQueued = await sendOrderRollbackEmail(rolledBackOrder, {
          fromLabel,
          toLabel,
          reason: rollbackReason,
          isFromCompleted,
        });
      } catch (emailErr) {
        console.error("[Mailer] Lỗi gửi email hoàn tác trạng thái:", emailErr);
      }

      return NextResponse.json({ success: true, order: rolledBackOrder, emailQueued });
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
    const origin = (existingOrder as { fulfillmentOrigin?: string }).fulfillmentOrigin || "JP";
    if (requestedStatus !== existingOrder.status && requestedStatus !== "CANCELLED" && !isNextOrderStatus(existingOrder.status, requestedStatus, origin)) {
      return NextResponse.json({ error: "Đơn chỉ được chuyển sang bước kế tiếp trong quy trình. Hãy kiểm tra lại trạng thái hiện tại." }, { status: 409 });
    }
    if (existingOrder.status === "PENDING_DEPOSIT" && requestedStatus === "PURCHASING_JP" && !existingOrder.isPriceVerified) {
      return NextResponse.json({ error: "Cần xác minh báo giá trước khi chuyển đơn sang bước mua hàng." }, { status: 409 });
    }
    if (existingOrder.status === "PENDING_DEPOSIT" && (requestedStatus === "PURCHASING_JP" || requestedStatus === "WAREHOUSE_VN")) {
      if (existingOrder.paymentStatus !== "DEPOSITED_50" && existingOrder.paymentStatus !== "PAID_100") {
        return NextResponse.json({ error: "Cần xác nhận đã nhận tiền cọc trước khi chuyển đơn sang bước mua hàng." }, { status: 409 });
      }
    }
    const effectiveWeightKg =
      weightKg !== undefined && weightKg !== null && weightKg !== ""
        ? Number(weightKg)
        : existingOrder.weightKg;
    if (requestedStatus === "IN_TRANSIT_AIR" && (!Number.isFinite(effectiveWeightKg) || effectiveWeightKg <= 0)) {
      return NextResponse.json(
        { error: "Đơn hàng chưa có trọng lượng thực tế tại kho Tokyo. Cần cập nhật cân nặng kiện hàng (> 0 kg) trước khi xuất kho bay về Việt Nam." },
        { status: 409 }
      );
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

    if (logStatus === "LOCAL_DELIVERY") {
      const remainingBalanceVnd = Math.max(0, existingOrder.totalVnd - existingOrder.depositAmountVnd);
      if (!description && remainingBalanceVnd > 0) {
        updateData.trackingLogs.create.description =
          `Đơn hàng đang được giao tới Quý khách. Số tiền cần thanh toán khi nhận hàng (gồm ${existingOrder.depositPercent === 50 ? "50% giá trị đơn còn lại và " : ""}cước bay quốc tế ${existingOrder.weightKg}kg): ${remainingBalanceVnd.toLocaleString("vi-VN")} đ.`;
      }
    }

    if (logStatus === "COMPLETED") {
      const remainingBalanceVnd = Math.max(0, existingOrder.totalVnd - existingOrder.depositAmountVnd);
      const remainingBaseVnd = Math.max(
        0,
        existingOrder.productPriceVnd + existingOrder.serviceFeeVnd - existingOrder.depositAmountVnd
      );
      const shippingVnd = existingOrder.shippingFeeVnd || 0;

      updateData.paymentStatus = "PAID_100";
      updateData.depositAmountVnd = existingOrder.totalVnd;

      if (!description && remainingBalanceVnd > 0) {
        const breakdownParts: string[] = [];
        if (remainingBaseVnd > 0) {
          breakdownParts.push(`50% tiền hàng & phí còn lại (${remainingBaseVnd.toLocaleString("vi-VN")} đ)`);
        }
        if (shippingVnd > 0) {
          breakdownParts.push(`cước bay quốc tế ${existingOrder.weightKg}kg (${shippingVnd.toLocaleString("vi-VN")} đ)`);
        }
        const detailText = breakdownParts.length > 0 ? ` gồm ${breakdownParts.join(" + ")}` : "";
        updateData.trackingLogs.create.description =
          `Kiện hàng đã giao thành công và thu đủ khoản tất toán cuối ${remainingBalanceVnd.toLocaleString("vi-VN")} đ${detailText}. Tổng thanh toán hoàn tất 100% (${existingOrder.totalVnd.toLocaleString("vi-VN")} đ).`;
      }

      if (remainingBalanceVnd > 0) {
        updateData.paymentTransactions = {
          create: {
            provider: "COD_SETTLEMENT",
            amountVnd: remainingBalanceVnd,
            status: "CONFIRMED",
            reference: `Tất toán khi nhận hàng (${existingOrder.depositPercent === 50 ? "50% còn lại + " : ""}Cước bay ${existingOrder.weightKg}kg)`,
            confirmedByAdmin: getAdminUsernameFromRequest(req) ?? "admin",
          },
        };
      }
    }

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
        if (!Number.isSafeInteger(finalPriceJpy) || finalPriceJpy < 100 || finalPriceJpy > 10_000_000 || !Number.isFinite(finalWeightKg) || finalWeightKg < 0 || finalWeightKg > 1000) {
          return NextResponse.json({ error: "Để duyệt giá, vui lòng nhập giá JPY hợp lệ (tối đa 10,000,000 ¥) và cân nặng từ 0 đến 1000 kg." }, { status: 400 });
        }
        const pricingConfig = await getCurrentPricingConfig();
        const finalPrice = calculateOrderPrice(finalPriceJpy, finalWeightKg, existingOrder.exchangeRate, existingOrder.isGroupBuy, pricingConfig.values);
        const { productPriceVnd: finalProductPriceVnd, serviceFeeVnd: finalServiceFeeVnd, shippingFeeVnd: finalShippingFeeVnd, totalVnd: finalTotalVnd } = finalPrice;
        updateData.priceJpy = finalPriceJpy;
        updateData.weightKg = finalWeightKg;
        updateData.productPriceVnd = finalProductPriceVnd;
        updateData.serviceFeeVnd = finalServiceFeeVnd;
        updateData.shippingFeeVnd = finalShippingFeeVnd;
        updateData.totalVnd = finalTotalVnd;
        updateData.pricingConfigVersion = pricingConfig.version || null;
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
    } else if (isAdminUser && status === "WAREHOUSE_JP" && !existingOrder.jpDomesticTrack && existingOrder.fulfillmentOrigin !== "VN") {
      updateData.jpDomesticTrack = `YAMATO-${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    }

    if (isAdminUser && vnTrack !== undefined) {
      updateData.vnDomesticTrack = vnTrack;
    } else if (isAdminUser && status === "LOCAL_DELIVERY" && !existingOrder.vnDomesticTrack) {
      updateData.vnDomesticTrack = `GHN-VN${Math.floor(10000000 + Math.random() * 90000000)}`;
    }
    if (isAdminUser && weightKg !== undefined && weightKg !== null && weightKg !== "" && !updateData.weightKg) {
      const parsedWeightKg = typeof weightKg === "number" ? weightKg : parseFloat(String(weightKg));
      if (!Number.isFinite(parsedWeightKg) || parsedWeightKg < 0 || parsedWeightKg > 100) {
        return NextResponse.json({ error: "Trọng lượng kiện hàng không hợp lệ (cần từ 0 đến 100 kg)." }, { status: 400 });
      }
      updateData.weightKg = parsedWeightKg;
      if (parsedWeightKg > 0) {
        const pricingConfig = await getCurrentPricingConfig();
        const recalc = calculateOrderPrice(
          existingOrder.priceJpy,
          parsedWeightKg,
          existingOrder.exchangeRate,
          existingOrder.isGroupBuy,
          pricingConfig.values
        );
        updateData.shippingFeeVnd = recalc.shippingFeeVnd;
        updateData.totalVnd = existingOrder.productPriceVnd + existingOrder.serviceFeeVnd + recalc.shippingFeeVnd;
      }
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
            // BẢO MẬT (P1-11): Sắp xếp productId tăng dần chống Deadlock khi hoàn kho
            const catalogItems = existingOrder.orderItems
              .filter((item) => item.itemType === "CATALOG" && item.productId)
              .sort((a, b) => (a.productId || "").localeCompare(b.productId || ""));
            for (const item of catalogItems) {
              await tx.product.updateMany({
                where: { id: item.productId! },
                data: { stockSlots: { increment: item.quantity } },
              });
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
      : await prisma.$transaction(async (tx) => {
          // BẢO MẬT (P1-12): Cập nhật có điều kiện trạng thái hiện tại chống race condition (Double-Click)
          const scalarData = { ...updateData };
          delete scalarData.trackingLogs;
          delete scalarData.paymentTransactions;

          const claimed = await tx.order.updateMany({
            where: {
              id: existingOrder.id,
              status: existingOrder.status,
              paymentStatus: existingOrder.paymentStatus,
            },
            data: scalarData,
          });
          if (claimed.count !== 1) throw new Error("ORDER_UPDATE_CONFLICT");

          if (updateData.trackingLogs?.create) {
            await tx.trackingLog.create({
              data: {
                orderId: existingOrder.id,
                ...updateData.trackingLogs.create,
              },
            });
          }
          if (updateData.paymentTransactions?.create) {
            await tx.paymentTransaction.create({
              data: {
                orderId: existingOrder.id,
                ...updateData.paymentTransactions.create,
              },
            });
          }
          return tx.order.findUnique({
            where: { id: existingOrder.id },
            include: { trackingLogs: { orderBy: { createdAt: "desc" } } },
          });
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
  } catch (error: any) {
    if (error instanceof Error && (error.message === "ORDER_CANCEL_CONFLICT" || error.message === "ORDER_UPDATE_CONFLICT" || error.message === "ORDER_ROLLBACK_CONFLICT")) {
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
