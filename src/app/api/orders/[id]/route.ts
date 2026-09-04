import { NextRequest, NextResponse } from "next/server";
import { getOrderByCode, updateOrderStatus } from "@/lib/order-store";
import { sendOrderStatusUpdateEmail } from "@/lib/mailer";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderCode = params.id;
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
    const { status, title, description, location, jpTrack, vnTrack, weightKg } = body;

    const updated = updateOrderStatus(
      orderCode,
      status,
      title || "Cập nhật trạng thái đơn hàng",
      description || "Đơn hàng đã được chuyển sang giai đoạn mới.",
      location || "Việt Nam",
      { jpTrack, vnTrack, weightKg }
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Không thể cập nhật đơn hàng." },
        { status: 404 }
      );
    }

    // Gửi email thông báo cập nhật trạng thái
    sendOrderStatusUpdateEmail(updated, title, description).catch((err) => console.warn(err));

    return NextResponse.json({ success: true, order: updated });
  } catch (error) {
    return NextResponse.json(
      { error: "Lỗi cập nhật trạng thái đơn hàng" },
      { status: 500 }
    );
  }
}
