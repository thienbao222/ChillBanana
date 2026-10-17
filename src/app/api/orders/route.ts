import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderCreatedEmail } from "@/lib/mailer";
import { fetchLiveExchangeRate } from "@/lib/exchange-rate";
import { isAdminRequest, getCustomerFromRequest } from "@/lib/auth-session";
import { MIN_ORDER_THRESHOLD_VND } from "@/lib/order-policy";
import { getDepositAmount, parseDepositPercent } from "@/lib/payment-policy";
import { getSystemConfig } from "@/lib/system-config";
import { orderCreateLimiter, getClientIp } from "@/lib/rate-limiter";



export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const phone = searchParams.get("phone");

    const isAdmin = isAdminRequest(req);
    const customerSession = getCustomerFromRequest(req);

    if (!isAdmin && !customerSession) {
      return NextResponse.json(
        { error: 'Unauthorized. Vui lòng đăng nhập để tra cứu danh sách đơn hàng.' },
        { status: 401 }
      );
    }

    const whereClause: any = {};
    if (!isAdmin) {
      whereClause.customerId = customerSession!.id;
    } else {
      if (email) {
        whereClause.customerEmail = email;
      }
      if (phone) {
        whereClause.customerPhone = phone;
      }
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

    const customerId = customerSession?.id;
    const visibleOrders = orders.map((order) => ({
      ...order,
      canCancel: Boolean(customerId && order.customerId === customerId && order.status === "PENDING_DEPOSIT" && order.paymentStatus === "UNPAID"),
    }));
    return NextResponse.json({ success: true, orders: visibleOrders });
  } catch (error) {
    console.error("Lỗi tải danh sách đơn hàng:", error);
    return NextResponse.json({ error: "Lỗi tải danh sách đơn hàng" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Rate limiting: max 5 đơn hàng mỗi 2 phút từ cùng IP (chống spam đặt đơn)
  const ip = getClientIp(req);
  const rl = orderCreateLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Bạn đang đặt đơn quá nhanh. Vui lòng chờ vài phút rồi thử lại." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  try {
    const body = await req.json();
    const depositPercent = body.depositPercent === undefined ? 50 : parseDepositPercent(body.depositPercent);
    if (depositPercent === null) {
      return NextResponse.json({ error: "Mức đặt cọc chỉ được chọn 50% hoặc 100%." }, { status: 400 });
    }
    if (typeof body.customerName !== "string" || !body.customerName.trim() || typeof body.customerPhone !== "string" || !body.customerPhone.trim() || typeof body.customerAddress !== "string" || !body.customerAddress.trim()) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp đầy đủ thông tin khách hàng." },
        { status: 400 }
      );
    }

    const phoneDigits = body.customerPhone.replace(/\D/g, "");
    if (body.customerName.trim().length > 120 || phoneDigits.length < 8 || phoneDigits.length > 15 || body.customerAddress.trim().length > 500) {
      return NextResponse.json({ error: "Tên, số điện thoại hoặc địa chỉ không hợp lệ." }, { status: 400 });
    }

    if (body.direction === "VN_TO_JP") {
      return NextResponse.json(
        { error: "Đơn hàng gửi từ Việt Nam sang Nhật Bản cần nhân viên tư vấn trực tiếp. Vui lòng liên hệ qua Zalo/Facebook." },
        { status: 400 }
      );
    }
    if (body.isGroupBuy !== undefined && typeof body.isGroupBuy !== "boolean") {
      return NextResponse.json({ error: "Lựa chọn gộp đơn không hợp lệ." }, { status: 400 });
    }

    if (typeof body.productName !== "string" || body.productName.trim() === "") {
      return NextResponse.json(
        { error: "Vui lòng cung cấp tên sản phẩm." },
        { status: 400 }
      );
    }
    if (body.productName.trim().length > 200 || (body.customerNote !== undefined && (typeof body.customerNote !== "string" || body.customerNote.length > 2000))) {
      return NextResponse.json({ error: "Tên sản phẩm hoặc ghi chú vượt quá giới hạn cho phép." }, { status: 400 });
    }
    if (body.customerEmail !== undefined && typeof body.customerEmail !== "string") {
      return NextResponse.json({ error: "Email không hợp lệ." }, { status: 400 });
    }
    const submittedEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim().toLowerCase() : "";
    if (submittedEmail && (submittedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submittedEmail))) {
      return NextResponse.json({ error: "Email không hợp lệ." }, { status: 400 });
    }

    if (body.items !== undefined && !Array.isArray(body.items)) {
      return NextResponse.json({ error: "Danh sách sản phẩm không hợp lệ." }, { status: 400 });
    }
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length > 50) return NextResponse.json({ error: "Mỗi đơn tối đa 50 dòng sản phẩm." }, { status: 400 });
    if (items.length === 0) {
      const fallbackWeight = Number(body.weightKg);
      if (!Number.isFinite(fallbackWeight) || fallbackWeight < 0 || fallbackWeight > 100) {
        return NextResponse.json({ error: "Cân nặng sản phẩm không hợp lệ." }, { status: 400 });
      }
    }
    for (const item of items) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return NextResponse.json({ error: "Thông tin sản phẩm không hợp lệ." }, { status: 400 });
      }
      const quantity = Number(item.quantity);
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
        return NextResponse.json({ error: "Số lượng mỗi sản phẩm phải là số nguyên từ 1 đến 99." }, { status: 400 });
      }
      if (item.id !== undefined && (typeof item.id !== "string" || item.id.length > 100)) {
        return NextResponse.json({ error: "Mã sản phẩm không hợp lệ." }, { status: 400 });
      }
      if (!item.id || item.id.startsWith("calc-")) {
        if (typeof item.name !== "string" || !item.name.trim() || item.name.length > 200) {
          return NextResponse.json({ error: "Tên sản phẩm không hợp lệ." }, { status: 400 });
        }
        const itemPrice = Number(item.priceJpy);
        const itemWeight = Number(item.weightKg);
        if (!Number.isSafeInteger(itemPrice) || itemPrice < 1 || !Number.isFinite(itemWeight) || itemWeight < 0 || itemWeight > 100) {
          return NextResponse.json({ error: "Giá hoặc cân nặng sản phẩm không hợp lệ." }, { status: 400 });
        }
      }
    }
    const isOnlyCatalogItems = items.length > 0 && items.every((it: any) => it.id && !it.id.startsWith("calc-"));

    if (!isOnlyCatalogItems) {
      if (typeof body.originalUrl !== "string" || body.originalUrl.trim() === "" || (body.originalUrl === "https://amazon.co.jp" && body.productName === "Đơn mua hộ từ Nhật Bản")) {
        return NextResponse.json(
          { error: "Vui lòng cung cấp đường dẫn (link) sản phẩm." },
          { status: 400 }
        );
      }

      // SSRF & Phishing Protection: Validate URL domain (strict hostname match)
      try {
        const parsedUrl = new URL(body.originalUrl);
        const hostname = parsedUrl.hostname.toLowerCase();

        // Block internal / loopback addresses (SSRF)
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname === '0.0.0.0' ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.endsWith('.internal')
        ) {
          return NextResponse.json({ error: "URL không hợp lệ." }, { status: 400 });
        }

        const ALLOWED_DOMAINS = [
          'amazon.co.jp', 'amazon.com', 'mercari.com', 'jp.mercari.com',
          'rakuten.co.jp', 'yahoo.co.jp', 'auctions.yahoo.co.jp',
          'uniqlo.com', 'suruga-ya.jp', 'biccamera.com', 'yodobashi.com'
        ];
        // Use exact match OR subdomain match with dot prefix to prevent:
        //   notrakuten.co.jp matching rakuten.co.jp (via naive endsWith)
        const isAllowed = ALLOWED_DOMAINS.some(
          domain => hostname === domain || hostname.endsWith('.' + domain)
        );
        if (!isAllowed) {
          return NextResponse.json(
            { error: "Nền tảng này hiện chưa được hỗ trợ mua hộ. Vui lòng thử link từ Amazon, Mercari, Rakuten..." },
            { status: 400 }
          );
        }
      } catch (err) {
        return NextResponse.json({ error: "URL không hợp lệ." }, { status: 400 });
      }
    }

    // BẢO MẬT: tỷ giá PHẢI do server tự lấy (live, có cache), không bao giờ tin
    // giá trị exchangeRate mà client gửi trong payload.
    const liveRateData = await fetchLiveExchangeRate();
    if (liveRateData.isStale) {
      return NextResponse.json(
        { error: "Chưa lấy được tỷ giá mới để lập báo giá chính xác. Vui lòng thử lại sau ít phút." },
        { status: 503 }
      );
    }
    const liveRate = liveRateData.roundedRate || liveRateData.rate || 172;

    // Khởi tạo mã đơn hàng
    const timestamp = Date.now().toString(36).toUpperCase();
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const orderCode = `CB-${new Date().getFullYear()}-${timestamp}-${randomSuffix}`;

    // Chỉ gắn đơn vào tài khoản lấy từ cookie đã xác thực; email/ID gửi từ client không chứng minh quyền sở hữu.
    const customerSession = getCustomerFromRequest(req);
    const customerId = customerSession?.id || null;
    const customerType = customerSession ? "REGISTERED" : "GUEST";
    const customerEmail = customerSession?.email || submittedEmail;

    try {
      // Sử dụng Transaction: Tất cả cập nhật hoặc bị rollback hoàn toàn
      const createdDbOrder = await prisma.$transaction(async (tx) => {
        let verifiedPriceJpy = 0;
        let verifiedWeightKg = 0;

        // Snapshot từng dòng hàng để lưu vào OrderItem
        const orderItemsData: {
          productId: string | null;
          itemType: string;
          productName: string;
          quantity: number;
          priceJpy: number;
          weightKg: number;
        }[] = [];

        if (items.length === 0) {
          // Fallback: Nếu frontend cũ (chưa update items array)
          verifiedPriceJpy = Math.max(0, Math.round(Number(body.priceJpy) || 0));
          verifiedWeightKg = Number(body.weightKg);
          // Ghi lại 1 dòng EXTERNAL duy nhất
          orderItemsData.push({
            productId: null,
            itemType: "EXTERNAL",
            productName: body.productName.trim() || "Đơn mua hộ từ Nhật Bản",
            quantity: 1,
            priceJpy: verifiedPriceJpy,
            weightKg: verifiedWeightKg,
          });
        }

        // Xử lý tồn kho và xác minh giá
        let verifiedProductName = "";

        for (const item of items) {
          const qty = Number(item.quantity);

          if (item.id && !item.id.startsWith("calc-")) {
            // Hàng từ catalog: Khóa cập nhật và lấy giá thật
            const product = await tx.product.findUnique({ where: { id: item.id } });
            if (!product) throw new Error(`PRODUCT_NOT_FOUND:${item.id}`);

            // Cập nhật nguyên tử có điều kiện: stockSlots phải đủ lớn
            const updated = await tx.product.updateMany({
              where: {
                id: item.id,
                stockSlots: { gte: qty },
              },
              data: {
                stockSlots: { decrement: qty },
              },
            });

            // Nếu update trả về count = 0, tức là tồn kho âm (hoặc ai đó vừa mua xong)
            if (updated.count === 0) {
              throw new Error(`INSUFFICIENT_STOCK:${item.id}:${product.name}`);
            }

            verifiedPriceJpy += product.priceJpy * qty;
            verifiedWeightKg += product.weightKg * qty;
            verifiedProductName += `${product.name} (x${qty}), `;

            orderItemsData.push({
              productId: product.id,
              itemType: "CATALOG",
              productName: product.name,
              quantity: qty,
              priceJpy: product.priceJpy,
              weightKg: product.weightKg,
            });
          } else {
            // Hàng ngoài catalog tự dán link: Tin cậy giá người dùng cào
            const itemPrice = Number(item.priceJpy);
            const itemWeight = Number(item.weightKg);
            verifiedPriceJpy += itemPrice * qty;
            verifiedWeightKg += itemWeight * qty;
            verifiedProductName += `${item.name || body.productName || "Sản phẩm Nhật Bản"} (x${qty}), `;

            orderItemsData.push({
              productId: null,
              itemType: "EXTERNAL",
              productName: item.name || body.productName || "Sản phẩm Nhật Bản",
              quantity: qty,
              priceJpy: itemPrice,
              weightKg: itemWeight,
            });
          }
        }

        // Làm sạch tên sản phẩm
        verifiedProductName = verifiedProductName.trim();
        if (verifiedProductName.endsWith(",")) {
          verifiedProductName = verifiedProductName.slice(0, -1);
        }
        if (!verifiedProductName) {
          verifiedProductName = body.productName || "Đơn mua hộ từ Nhật Bản";
        }

        if (!Number.isSafeInteger(verifiedPriceJpy) || verifiedPriceJpy < 100) {
          throw new Error("ORDER_PRICE_TOO_LOW");
        }

        // Tính toán toàn bộ chi phí phía Server, tránh tin tưởng client gửi lên
        // Đọc phí động từ SystemConfig (có cache 5 phút, fallback về hardcode nếu DB lỗi)
        const sysConfig = await getSystemConfig();
        const serviceFeePercent = sysConfig.service_fee_percent / 100; // Ví dụ: 4 → 0.04
        const minServiceFeeVnd = sysConfig.min_service_fee_vnd;        // Ví dụ: 20000
        const airShippingPerKg = sysConfig.air_shipping_per_kg_vnd;    // Ví dụ: 185000
        const groupBuyDiscountPct = sysConfig.group_buy_discount_percent / 100; // Ví dụ: 25 → 0.25

        const productPriceVnd = Math.round(verifiedPriceJpy * liveRate);
        const serviceFeeVnd = productPriceVnd > 0
          ? Math.max(minServiceFeeVnd, Math.round(productPriceVnd * serviceFeePercent))
          : 0;
        const baseOrderCostVnd = productPriceVnd + serviceFeeVnd;
        if (baseOrderCostVnd < MIN_ORDER_THRESHOLD_VND) {
          throw new Error(`ORDER_BELOW_MINIMUM:${MIN_ORDER_THRESHOLD_VND}`);
        }

        let shippingRate = airShippingPerKg;
        if (body.isGroupBuy && verifiedWeightKg <= 0.5) {
          shippingRate = Math.round(airShippingPerKg * (1 - groupBuyDiscountPct));
        }

        const shippingFeeVnd = verifiedWeightKg > 0 ? Math.round(verifiedWeightKg * shippingRate) : 0;

        const totalVnd = productPriceVnd + serviceFeeVnd + shippingFeeVnd;

        const depositAmountVnd = getDepositAmount(baseOrderCostVnd, depositPercent);
        const hasCatalogReservation = orderItemsData.some((item) => item.itemType === "CATALOG");
        const reservationExpiresAt = hasCatalogReservation && isOnlyCatalogItems
          ? new Date(Date.now() + 30 * 60 * 1000)
          : null;

        // Tạo đơn hàng + OrderItems trong cùng một transaction
        return await tx.order.create({
          data: {
            orderCode,
            customerId,
            customerType,
            customerName: body.customerName.trim(),
            customerEmail,
            customerPhone: body.customerPhone.trim(),
            customerAddress: body.customerAddress.trim(),
            originalUrl: typeof body.originalUrl === "string" ? body.originalUrl.trim() : "",
            productName: verifiedProductName,
            category: ["cosmetics", "health", "gadgets", "anime", "other"].includes(body.category) ? body.category : "other",
            priceJpy: verifiedPriceJpy,
            weightKg: verifiedWeightKg,
            exchangeRate: liveRate,
            productPriceVnd,
            serviceFeeVnd,
            shippingFeeVnd,
            totalVnd,
            depositAmountVnd,
            depositPercent,
            paymentStatus: "UNPAID",
            paymentMethod: body.paymentMethod === "VNPAY" ? "VNPAY" : "VIETQR",
            isGroupBuy: !!body.isGroupBuy,
            groupBuyCode: body.groupBuyCode || null,
            status: "PENDING_DEPOSIT",
            customerNote: typeof body.customerNote === "string" ? body.customerNote.trim() || null : null,
            adminNote: body.adminNote || null,
            isPriceVerified: isOnlyCatalogItems,
            priceVerifiedAt: isOnlyCatalogItems ? new Date() : null,
            reservationExpiresAt,
            orderItems: {
              create: orderItemsData,
            },
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
          include: { trackingLogs: true, orderItems: true },
        });
      });

      // Gửi email xác nhận
      sendOrderCreatedEmail(createdDbOrder as any).catch((err) => console.warn(err));

      return NextResponse.json({ success: true, order: createdDbOrder });
    } catch (dbErr: any) {
      console.error("Lưu đơn hàng vào Prisma thất bại:", dbErr);
      if (dbErr.message === "ORDER_PRICE_TOO_LOW") {
        return NextResponse.json({ error: "Tổng giá sản phẩm phải từ 100 ¥ trở lên." }, { status: 400 });
      }
      if (dbErr.message === `ORDER_BELOW_MINIMUM:${MIN_ORDER_THRESHOLD_VND}`) {
        return NextResponse.json({ error: `Giá trị tiền hàng và phí dịch vụ phải đạt tối thiểu ${MIN_ORDER_THRESHOLD_VND.toLocaleString("vi-VN")}đ (chưa gồm vận chuyển).` }, { status: 400 });
      }
      if (dbErr.message && dbErr.message.startsWith("INSUFFICIENT_STOCK:")) {
        const productName = dbErr.message.split(":")[2] || "Sản phẩm này";
        return NextResponse.json(
          { error: `${productName} đã hết hàng hoặc số lượng trong kho không đủ để đặt hàng. Vui lòng giảm số lượng.` },
          { status: 400 }
        );
      }
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
