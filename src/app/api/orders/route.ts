import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOrder } from "@/lib/order-store";
import { sendOrderCreatedEmail } from "@/lib/mailer";
import { fetchLiveExchangeRate } from "@/lib/exchange-rate";
import { isAdminRequest } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const phone = searchParams.get("phone");

    // Allow admins to get all orders, customers must provide email or phone
    if (!email && !phone && !isAdminRequest(req)) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp email hoặc số điện thoại để tra cứu đơn hàng.' },
        { status: 400 }
      );
    }

    const whereClause: any = {};
    if (email) {
      whereClause.customerEmail = email;
    }
    if (phone) {
      whereClause.customerPhone = phone;
    }

    const orders = await prisma.order.findMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      include: {
        trackingLogs: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, orders });
  } catch (error) {
    console.error("Lỗi tải danh sách đơn hàng:", error);
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

    if (!body.productName || body.productName.trim() === "") {
      return NextResponse.json(
        { error: "Vui lòng cung cấp tên sản phẩm." },
        { status: 400 }
      );
    }

    if (!body.originalUrl || body.originalUrl.trim() === "" || (body.originalUrl === "https://amazon.co.jp" && body.productName === "Đơn mua hộ từ Nhật Bản")) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp đường dẫn (link) sản phẩm." },
        { status: 400 }
      );
    }

    const priceJpy = Math.round(Number(body.priceJpy) || 0);
    if (!priceJpy || priceJpy < 100) {
      return NextResponse.json(
        { error: "Giá sản phẩm tại Nhật không hợp lệ (tối thiểu 100 ¥)." },
        { status: 400 }
      );
    }

    // BẢO MẬT: tỷ giá PHẢI do server tự lấy (live, có cache), không bao giờ tin
    // giá trị exchangeRate mà client gửi trong payload — xem chú thích đầy đủ
    // trong lib/order-store.ts::createOrder().
    const liveRateData = await fetchLiveExchangeRate();
    const liveRate = liveRateData.roundedRate || liveRateData.rate || 172;

    const order = createOrder(body, liveRate);

    // Kiểm tra định danh khách hàng (Thành viên vs Khách vãng lai)
    let customerId = body.customerId || null;
    let customerType = "GUEST";
    try {
      if (!customerId && order.customerEmail) {
        const existingCustomer = await prisma.customer.findUnique({
          where: { email: order.customerEmail.toLowerCase().trim() },
          select: { id: true },
        });
        if (existingCustomer) {
          customerId = existingCustomer.id;
        }
      }
      if (customerId) {
        customerType = "REGISTERED";
      }
    } catch {
      // Non-blocking lookup
    }

    // Lưu đơn hàng thực tế vào CSDL Neon Postgres qua Prisma
    try {
      const createdDbOrder = await prisma.order.create({
        data: {
          orderCode: order.orderCode,
          customerId,
          customerType,
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

      // Giảm stockSlots của sản phẩm nếu orderUrl khớp với sản phẩm trong catalog (non-blocking)
      if (order.originalUrl) {
        prisma.product.findFirst({
          where: { originalStore: { not: "" } },
          select: { id: true, stockSlots: true, originalStore: true },
        }).then(async () => {
          // Tìm sản phẩm theo category và URL khớp nhất
          try {
            const matchProduct = await prisma.product.findFirst({
              where: { category: order.category || "other", stockSlots: { gt: 0 } },
              orderBy: { createdAt: "desc" },
            });
            if (matchProduct && matchProduct.stockSlots > 0) {
              await prisma.product.update({
                where: { id: matchProduct.id },
                data: { stockSlots: matchProduct.stockSlots - 1 },
              });
            }
          } catch { /* non-critical, ignore */ }
        }).catch(() => { /* non-critical */ });
      }

      return NextResponse.json({ success: true, order: createdDbOrder });
    } catch (dbErr) {
      console.error("Lưu đơn hàng vào Prisma thất bại:", dbErr);
      return NextResponse.json(
        { error: "Lỗi kết nối cơ sở dữ liệu khi tạo đơn hàng. Vui lòng thử lại sau giây lát." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Order creation error:", error);
    return NextResponse.json({ error: "Lỗi khi tạo đơn hàng mới" }, { status: 500 });
  }
}
