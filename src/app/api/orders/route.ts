import { NextRequest, NextResponse } from "next/server";
import { getAllOrders, createOrder } from "@/lib/order-store";
import { sendOrderCreatedEmail } from "@/lib/mailer";

export async function GET() {
  try {
    const orders = getAllOrders();
    return NextResponse.json({ success: true, orders });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi tải danh sách đơn hàng" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.customerName || !body.customerPhone) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp đầy đủ thông tin khách hàng." },
        { status: 400 }
      );
    }

    const order = createOrder(body);

    // Gửi email xác nhận (không làm nghẽn luồng tạo đơn)
    sendOrderCreatedEmail(order).catch((err) => console.warn(err));

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error("Order creation error:", error);
    return NextResponse.json({ error: "Lỗi khi tạo đơn hàng mới" }, { status: 500 });
  }
}
