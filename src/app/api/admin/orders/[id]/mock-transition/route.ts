import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest, getAdminUsernameFromRequest } from "@/lib/auth-session";
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
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const adminUsername = getAdminUsernameFromRequest(req) || "admin";

  let body: { targetStatus?: string; description?: string; location?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON không hợp lệ." }, { status: 400 });
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

  const meta = STATUS_METADATA[targetStatus];
  const finalDesc = description?.trim() || meta.defaultDesc;
  const finalLocation = location?.trim() || meta.location;

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

    const mockJpTrack = targetStatus === "WAREHOUSE_JP" && !order.jpDomesticTrack
      ? `YAMATO-${Math.floor(1000000000 + Math.random() * 9000000000)}`
      : undefined;

    const mockVnTrack = (targetStatus === "LOCAL_DELIVERY" || targetStatus === "COMPLETED") && !order.vnDomesticTrack
      ? `GHN-VN-${Math.floor(100000000 + Math.random() * 900000000)}`
      : undefined;

    // Cập nhật đơn hàng và tạo TrackingLog trong transaction
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: targetStatus,
          paymentStatus: targetStatus === "COMPLETED" && order.paymentStatus === "DEPOSITED_50" ? "PAID_100" : undefined,
          jpDomesticTrack: mockJpTrack || undefined,
          vnDomesticTrack: mockVnTrack || undefined,
          adminNote: `[${new Date().toLocaleTimeString("vi-VN")}] Admin ${adminUsername} tua nhanh sang ${targetStatus}.`,
        },
      });

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
  } catch (error) {
    console.error("[MOCK TRANSITION ERROR]", error);
    return NextResponse.json(
      { error: "Lỗi xử lý chuyển trạng thái vận đơn." },
      { status: 500 }
    );
  }
}
