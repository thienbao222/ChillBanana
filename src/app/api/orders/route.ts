import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAllOrders, createOrder } from "@/lib/order-store";
import { sendOrderCreatedEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Lấy toàn bộ đơn hàng thực tế từ CSDL Prisma (SQLite)
    try {
      const dbOrders = await prisma.order.findMany({
        include: {
          trackingLogs: {
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ success: true, orders: dbOrders });
    } catch (dbErr) {
      console.warn("Truy vấn Prisma Order thất bại, chuyển sang store:", dbErr);
    }

    // 2. Fallback sang store
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

    // Lưu đơn hàng thực tế vào CSDL SQLite Prisma
    try {
      const createdDbOrder = await prisma.order.create({
        data: {
          orderCode: order.orderCode,
          customerName: order.customerName,
          customerEmail: order.customerEmail || "",
          customerPhone: order.customerPhone,
          customerAddress: order.customerAddress || "",
          originalUrl: order.originalUrl || "",
          productName: order.productName,
          category: order.category || "other",
          priceJpy: order.priceJpy,
          weightKg: order.weightKg,
          exchangeRate: order.exchangeRate,
          productPriceVnd: order.productPriceVnd,
          serviceFeeVnd: order.serviceFeeVnd,
          shippingFeeVnd: order.shippingFeeVnd,
          totalVnd: order.totalVnd,
          depositAmountVnd: order.depositAmountVnd,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          isGroupBuy: order.isGroupBuy,
          groupBuyCode: order.groupBuyCode || null,
          status: order.status,
          customerNote: order.customerNote || null,
          adminNote: order.adminNote || null,
          trackingLogs: {
            create: [
              {
                status: "PENDING_DEPOSIT",
                title: "Khởi tạo đơn hàng & Chờ đặt cọc",
                description: "Khách hàng đã tạo đơn mua hộ qua công cụ tính giá tự động của ChillBanana.",
                location: "Hệ thống ChillBanana",
              },
            ],
          },
        },
        include: {
          trackingLogs: true,
        },
      });

      // Gửi email xác nhận
      sendOrderCreatedEmail(createdDbOrder as any).catch((err) => console.warn(err));

      return NextResponse.json({ success: true, order: createdDbOrder });
    } catch (dbErr) {
      console.warn("Lưu đơn hàng vào Prisma thất bại:", dbErr);
    }

    // Gửi email xác nhận fallback
    sendOrderCreatedEmail(order).catch((err) => console.warn(err));

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error("Order creation error:", error);
    return NextResponse.json({ error: "Lỗi khi tạo đơn hàng mới" }, { status: 500 });
  }
}
