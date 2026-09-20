import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrderByCode } from "@/lib/order-store";
import { sendOrderStatusUpdateEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderCode = params.id;

    // 1. Kiểm tra CSDL Prisma
    try {
      const dbOrder = await prisma.order.findFirst({
        where: {
          OR: [{ orderCode }, { id: orderCode }],
        },
        include: {
          trackingLogs: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (dbOrder) {
        return NextResponse.json({ success: true, order: dbOrder });
      }
    } catch (dbErr) {
      console.warn("Lỗi tra cứu Prisma Order:", dbErr);
    }

    // 2. Fallback sang store
    const order = getOrderByCode(orderCode);
    if (!order) {
      return NextResponse.json(
        { error: "Không tìm thấy đơn hàng với mã này." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, order });
  } catch (error) {
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
    } = body;

    // Tìm đơn hàng trong Prisma
    const existingOrder = await prisma.order.findFirst({
      where: {
        OR: [{ orderCode }, { id: orderCode }],
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: "Không tìm thấy đơn hàng với mã này." },
        { status: 404 }
      );
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

    if (paymentStatus !== undefined) {
      updateData.paymentStatus = paymentStatus;
    }
    if (jpTrack !== undefined) {
      updateData.jpDomesticTrack = jpTrack;
    }
    if (vnTrack !== undefined) {
      updateData.vnDomesticTrack = vnTrack;
    }
    if (weightKg !== undefined && weightKg !== null && weightKg !== "") {
      updateData.weightKg =
        typeof weightKg === "number" ? weightKg : parseFloat(weightKg) || 0;
    }

    // Cập nhật trong CSDL Prisma
    const updated = await prisma.order.update({
      where: { id: existingOrder.id },
      data: updateData,
      include: {
        trackingLogs: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // Gửi email thông báo cập nhật trạng thái
    sendOrderStatusUpdateEmail(updated, logTitle, logDescription).catch(
      (err) => console.warn("Lỗi gửi email cập nhật đơn hàng:", err)
    );

    return NextResponse.json({ success: true, order: updated });
  } catch (error) {
    console.error("Lỗi cập nhật trạng thái đơn hàng:", error);
    return NextResponse.json(
      { error: "Lỗi cập nhật trạng thái đơn hàng" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderCode = params.id;

    // Xóa trong CSDL Prisma (TrackingLog sẽ cascade xóa tự động)
    const existingOrder = await prisma.order.findFirst({
      where: {
        OR: [{ orderCode }, { id: orderCode }],
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: "Không tìm thấy đơn hàng để xóa." },
        { status: 404 }
      );
    }

    await prisma.order.delete({
      where: { id: existingOrder.id },
    });

    return NextResponse.json({
      success: true,
      message: `Đã xóa vĩnh viễn đơn hàng #${existingOrder.orderCode} thành công.`,
    });
  } catch (error) {
    console.error("Lỗi khi xóa đơn hàng khỏi hệ thống:", error);
    return NextResponse.json(
      { error: "Lỗi khi xóa đơn hàng khỏi hệ thống" },
      { status: 500 }
    );
  }
}
