import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { isNextOrderStatus, getPreviousOrderStatus } from "@/features/orders/policy";
import { getDepositAmount } from "@/features/payments/policy";
import { writeAuditLog } from "@/lib/audit";
import { sendOrderStatusUpdateEmail, sendZaloTrackingNotification } from "@/lib/mailer";

export const dynamic = "force-dynamic";

// Thông tin chi tiết cho từng chặng trạng thái mô phỏng
const STATUS_METADATA: Record<string, { title: string; defaultDesc: string; location: string }> = {
  PURCHASING_JP: {
    title: "Đang mua hàng tại Tokyo",
    defaultDesc: "Nhân viên ChillBanana tại Nhật Bản đang tiến hành đặt mua sản phẩm từ sàn nội địa.",
    location: "Tokyo, Nhật Bản",
  },
  WAREHOUSE_JP: {
    title: "Hàng đã nhập kho Tokyo",
    defaultDesc: "Kiện hàng đã về tới kho trung chuyển Tokyo. Đội ngũ đã kiểm đếm ngoại quan, cân đo và bọc chống sốc chuyên dụng.",
    location: "Kho Tokyo - 2-chōme Shinjuku",
  },
  IN_TRANSIT_AIR: {
    title: "Đang bay Narita ➔ Việt Nam",
    defaultDesc: "Kiện hàng đã hoàn tất thủ tục hải quan xuất khẩu tại sân bay Narita (NRT) và đang trên chuyến bay vận chuyển về Việt Nam.",
    location: "Sân bay Quốc tế Narita (NRT)",
  },
  WAREHOUSE_VN: {
    title: "Đã cập cảng kho Việt Nam",
    defaultDesc: "Chuyến bay đã hạ cánh. Kiện hàng đã hoàn tất thông quan hải quan và đang được phân loại tại trung tâm khai thác.",
    location: "Kho phân loại Tân Sơn Nhất / Nội Bài",
  },
  LOCAL_DELIVERY: {
    title: "Đang giao hàng tận tay",
    defaultDesc: "Đơn hàng đã được bàn giao cho đối tác vận chuyển nội địa (Giao Hàng Nhanh / Viettel Post) để giao tới địa chỉ của Quý khách.",
    location: "Bưu cục phát nội địa",
  },
  COMPLETED: {
    title: "Giao hàng thành công",
    defaultDesc: "Kiện hàng đã được phát thành công tới người nhận. Cảm ơn Quý khách đã tin tưởng sử dụng dịch vụ mua hộ ChillBanana!",
    location: "Địa chỉ người nhận",
  },
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const adminUsername = guard.username;
  const { id } = await params;

  let body: { targetStatus?: string; description?: string; location?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON không hợp lệ." }, { status: 400 });
  }

  if (body.action === "rollback") {
    const order = await prisma.order.findFirst({
      where: { OR: [{ id }, { orderCode: id }] },
    });
    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
    }
    if (order.status === "PENDING_DEPOSIT" || order.status === "CANCELLED") {
      return NextResponse.json(
        { error: `Đơn hàng ở trạng thái "${order.status}" không thể hoàn tác lùi bước.` },
        { status: 400 }
      );
    }
    const origin = (order as any).fulfillmentOrigin || "JP";
    const prevStatus = getPreviousOrderStatus(order.status, origin);
    if (!prevStatus) {
      return NextResponse.json({ error: "Không tìm thấy trạng thái trước đó để hoàn tác." }, { status: 400 });
    }

    const rollbackUpdateData: any = {
      status: prevStatus,
      trackingLogs: {
        create: {
          status: prevStatus,
          title: "Hoàn tác trạng thái đơn hàng (Mock Sandbox)",
          description: `Quản trị viên hoàn tác trạng thái từ "${order.status}" về "${prevStatus}" trong Sandbox.`,
          location: "Hệ thống Quản trị ChillBanana",
        },
      },
    };

    if (order.status === "COMPLETED" && prevStatus === "LOCAL_DELIVERY" && order.depositPercent === 50) {
      rollbackUpdateData.paymentStatus = "DEPOSITED_50";
      rollbackUpdateData.depositAmountVnd = getDepositAmount(
        order.productPriceVnd + order.serviceFeeVnd,
        50
      );
    }

    const rolledBackOrder = await prisma.$transaction(async (tx) => {
      if (order.status === "COMPLETED" && prevStatus === "LOCAL_DELIVERY") {
        await tx.paymentTransaction.deleteMany({
          where: { orderId: order.id, provider: "COD_SETTLEMENT" },
        });
      }
      return tx.order.update({
        where: { id: order.id },
        data: rollbackUpdateData,
      });
    });

    await writeAuditLog({
      actor: adminUsername || "admin",
      action: "ORDER_STATUS_ROLLBACK",
      entityType: "Order",
      entityId: order.orderCode,
      summary: `[Sandbox] Hoàn tác trạng thái đơn ${order.orderCode} từ ${order.status} về ${prevStatus}.`,
      metadata: { fromStatus: order.status, toStatus: prevStatus },
      req,
    });

    return NextResponse.json({
      success: true,
      message: `Đã hoàn tác đơn #${order.orderCode} từ ${order.status} về ${prevStatus}`,
      order: rolledBackOrder,
    });
  }

  const { targetStatus, description, location } = body;
  if (!targetStatus || !STATUS_METADATA[targetStatus]) {
    return NextResponse.json(
      {
        error: `Trạng thái không hợp lệ. Chỉ chấp nhận: ${Object.keys(STATUS_METADATA).join(", ")}`,
      },
      { status: 400 }
    );
  }

  try {
    // Tìm order theo ID hoặc orderCode
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id }, { orderCode: id }],
      },
      include: {
        customer: { select: { zaloUserId: true } },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
    }

    if (order.status === "COMPLETED" || order.status === "CANCELLED") {
      return NextResponse.json(
        { error: `Đơn hàng đã ${order.status === "COMPLETED" ? "hoàn tất" : "hủy"}, không thể chuyển trạng thái.` },
        { status: 400 }
      );
    }

    const meta = STATUS_METADATA[targetStatus];
    const remainingBalanceVnd = Math.max(0, order.totalVnd - order.depositAmountVnd);
    const finalDesc = description?.trim() || (
      targetStatus === "LOCAL_DELIVERY" && remainingBalanceVnd > 0
        ? `Đơn hàng đang được giao tới Quý khách. Số tiền cần thanh toán khi nhận hàng (gồm ${order.depositPercent === 50 ? "50% giá trị đơn còn lại và " : ""}cước bay quốc tế ${order.weightKg}kg): ${remainingBalanceVnd.toLocaleString("vi-VN")} đ.`
        : targetStatus === "COMPLETED" && remainingBalanceVnd > 0
        ? `Kiện hàng đã giao thành công và thu đủ khoản tất toán cuối ${remainingBalanceVnd.toLocaleString("vi-VN")} đ. Tổng thanh toán hoàn tất 100% (${order.totalVnd.toLocaleString("vi-VN")} đ).`
        : meta.defaultDesc
    );
    const finalLocation = location?.trim() || meta.location;

    // RÀNG BUỘC STATE MACHINE: Chỉ cho phép sang đúng bước kế tiếp, không nhảy cóc
    const origin = (order as any).fulfillmentOrigin || "JP";
    if (!isNextOrderStatus(order.status, targetStatus, origin)) {
      return NextResponse.json(
        {
          error: `Không thể nhảy cóc từ "${order.status}" sang "${targetStatus}". Đơn hàng chỉ được chuyển tuần tự theo đúng quy trình 7 bước.`,
        },
        { status: 409 }
      );
    }

    // Điều kiện sang bước 2 (PURCHASING_JP): Phải đã duyệt giá và đã nhận cọc
    if (targetStatus === "PURCHASING_JP") {
      if (!order.isPriceVerified) {
        return NextResponse.json(
          { error: "Đơn hàng chưa được duyệt giá. Cần duyệt báo giá trước khi chuyển sang bước Mua Hàng Tại Tokyo." },
          { status: 409 }
        );
      }
      if (order.paymentStatus !== "DEPOSITED_50" && order.paymentStatus !== "PAID_100") {
        return NextResponse.json(
          { error: "Đơn hàng chưa thanh toán tiền cọc. Bắt buộc phải có xác nhận thanh toán trước khi chuyển sang bước Mua Hàng Tại Tokyo." },
          { status: 409 }
        );
      }
    }

    // Điều kiện xuất kho Tokyo bay về VN (IN_TRANSIT_AIR): Phải có trọng lượng thực tế
    if (targetStatus === "IN_TRANSIT_AIR" && (!order.weightKg || order.weightKg <= 0)) {
      return NextResponse.json(
        { error: "Đơn hàng chưa có trọng lượng thực tế tại kho Tokyo. Cần cập nhật cân nặng kiện hàng trước khi xuất kho bay về Việt Nam." },
        { status: 409 }
      );
    }

    const mockJpTrack = targetStatus === "WAREHOUSE_JP" && !order.jpDomesticTrack
      ? `YAMATO-${Math.floor(1000000000 + Math.random() * 9000000000)}`
      : undefined;

    const mockVnTrack = (targetStatus === "LOCAL_DELIVERY" || targetStatus === "COMPLETED") && !order.vnDomesticTrack
      ? `GHN-VN-${Math.floor(100000000 + Math.random() * 900000000)}`
      : undefined;

    // Cập nhật đơn hàng và tạo TrackingLog trong transaction (P1-12)
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: {
          status: targetStatus,
          paymentStatus: targetStatus === "COMPLETED" ? "PAID_100" : undefined,
          depositAmountVnd: targetStatus === "COMPLETED" ? order.totalVnd : undefined,
          jpDomesticTrack: mockJpTrack || undefined,
          vnDomesticTrack: mockVnTrack || undefined,
          adminNote: `[${new Date().toLocaleTimeString("vi-VN")}] Admin ${adminUsername} chuyển trạng thái sang ${targetStatus}.`,
        },
      });
      if (claimed.count !== 1) throw new Error("ORDER_UPDATE_CONFLICT");
      const updated = await tx.order.findUniqueOrThrow({ where: { id: order.id } });

      if (targetStatus === "COMPLETED" && remainingBalanceVnd > 0) {
        await tx.paymentTransaction.create({
          data: {
            orderId: order.id,
            provider: "COD_SETTLEMENT",
            amountVnd: remainingBalanceVnd,
            status: "CONFIRMED",
            reference: `Tất toán khi nhận hàng (${order.depositPercent === 50 ? "50% còn lại + " : ""}Cước bay ${order.weightKg}kg)`,
            confirmedByAdmin: adminUsername,
          },
        });
      }

      const log = await tx.trackingLog.create({
        data: {
          orderId: order.id,
          status: targetStatus,
          title: meta.title,
          description: finalDesc,
          location: finalLocation,
        },
      });

      return { updated, log };
    });

    // Kích hoạt thông báo tự động (chạy nền, không block response)
    const orderForEmail = {
      ...updatedOrder.updated,
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      productName: order.productName,
    };

    sendOrderStatusUpdateEmail(orderForEmail, meta.title, finalDesc).catch((err: unknown) =>
      console.warn("[Mock Transition Email Error]", err)
    );

    if (order.customer?.zaloUserId) {
      sendZaloTrackingNotification(
        order.customer.zaloUserId,
        order.orderCode,
        meta.title,
        finalDesc
      ).catch((err: unknown) => console.warn("[Mock Transition Zalo Error]", err));
    }

    return NextResponse.json({
      success: true,
      message: `Đã chuyển trạng thái đơn #${order.orderCode} sang ${meta.title}!`,
      order: updatedOrder.updated,
      trackingLog: updatedOrder.log,
    });
  } catch (error: any) {
    console.error("[MOCK TRANSITION ERROR]", error);
    if (error?.message === "ORDER_UPDATE_CONFLICT") {
      return NextResponse.json(
        { error: "Đơn hàng đã được cập nhật bởi một thao tác khác. Vui lòng tải lại trang." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Lỗi xử lý chuyển trạng thái vận đơn." },
      { status: 500 }
    );
  }
}
