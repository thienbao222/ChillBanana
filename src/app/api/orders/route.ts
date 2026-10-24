import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderCreatedEmail, sendAdminNewOrderEmail } from "@/lib/mailer";
import { fetchLiveExchangeRate } from "@/features/pricing/exchange-rate";
import {
  createGuestOrderAccessToken,
  ORDER_ACCESS_COOKIE_NAME,
  verifySameOrigin,
} from "@/lib/auth-session";
import { getVerifiedCustomerFromRequest } from "@/lib/customer-guard";
import { isVerifiedAdmin } from "@/lib/admin-guard";
import { getDepositAmount, parseDepositPercent } from "@/features/payments/policy";
import { calculateOrderPrice } from "@/features/pricing/calculator";
import { getCurrentPricingConfig } from "@/features/pricing/config";
import { checkAndRecordHit, getClientIp } from "@/lib/rate-limit";
import { isPrivateHost } from "@/lib/ssrf";

export const dynamic = "force-dynamic";

const ORDER_CREATE_RATE_LIMIT = { max: 15, windowMs: 2 * 60_000, blockMs: 5 * 60_000 };

const ALLOWED_DOMAINS = [
  'amazon.co.jp', 'amazon.com', 'amzn.asia', 'amzn.to',
  'mercari.com', 'jp.mercari.com',
  'rakuten.co.jp', 'a.r10.to',
  'yahoo.co.jp', 'auctions.yahoo.co.jp', 'shopping.yahoo.co.jp',
  'page.auctions.yahoo.co.jp', 'paypayfleamarket.yahoo.co.jp',
  'uniqlo.com', 'suruga-ya.jp', 'biccamera.com', 'yodobashi.com'
];

import { releaseExpiredOrderReservations } from "@/features/orders/reservations";

export async function GET(req: NextRequest) {
  try {
    // Hỗ trợ môi trường Vercel Hobby: Chủ động giải phóng đơn giữ kho quá hạn 30 phút khi khách truy cập đơn
    const isTest = process.env.APP_ENV === "test" || process.env.NODE_ENV === "test";
    if (!isTest) {
      await releaseExpiredOrderReservations(20).catch(() => {});
    }

    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const phone = searchParams.get("phone");

    const isAdmin = await isVerifiedAdmin(req);
    const customerSession = await getVerifiedCustomerFromRequest(req);

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
      take: 200,
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
  try {
    const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
    if (!isTest) {
      const clientIp = getClientIp(req);
      const retryAfter = await checkAndRecordHit(`orders-create:ip:${clientIp}`, ORDER_CREATE_RATE_LIMIT);
      if (retryAfter > 0) {
        return NextResponse.json(
          { error: "Bạn tạo đơn quá nhanh. Vui lòng chờ ít phút rồi thử lại." },
          { status: 429, headers: { "Retry-After": String(retryAfter) } }
        );
      }
    }

    // Hỗ trợ môi trường Vercel Hobby: Chủ động giải phóng đơn giữ kho quá hạn 30 phút trước khi kiểm tra stock
    if (!isTest) {
      await releaseExpiredOrderReservations(20).catch(() => {});
    }

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
      const fallbackPrice = Number(body.priceJpy);
      const fallbackWeight = Number(body.weightKg);
      if (!Number.isSafeInteger(fallbackPrice) || fallbackPrice < 1 || fallbackPrice > 10_000_000 || !Number.isFinite(fallbackWeight) || fallbackWeight < 0 || fallbackWeight > 1000) {
        return NextResponse.json({ error: "Giá sản phẩm (tối đa 10M ¥) hoặc cân nặng (tối đa 1000kg) không hợp lệ." }, { status: 400 });
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
        if (!Number.isSafeInteger(itemPrice) || itemPrice < 100 || itemPrice > 10_000_000 || !Number.isFinite(itemWeight) || itemWeight < 0 || itemWeight > 1000) {
          return NextResponse.json({ error: "Giá sản phẩm (tối đa 10M ¥) hoặc cân nặng (tối đa 1000kg) không hợp lệ." }, { status: 400 });
        }
        if (typeof item.originalUrl === "string" && item.originalUrl.trim() !== "") {
          const itemUrl = item.originalUrl.trim();
          let parsed;
          try {
            parsed = new URL(itemUrl);
          } catch {
            return NextResponse.json({ error: "Link sản phẩm không đúng định dạng URL." }, { status: 400 });
          }
          if (parsed.protocol !== "https:" || isPrivateHost(parsed.hostname) || !ALLOWED_DOMAINS.some((d: string) => parsed.hostname === d || parsed.hostname.endsWith("." + d))) {
            return NextResponse.json({ error: "Link sản phẩm không thuộc website được hỗ trợ hoặc vi phạm bảo mật." }, { status: 400 });
          }
        }
      }
    }
    const isOnlyCatalogItems = items.length > 0 && items.every((it: any) => it.id && !it.id.startsWith("calc-"));

    let validatedOriginalUrl = "";
    if (typeof body.originalUrl === "string" && body.originalUrl.trim() !== "") {
      const trimmedUrl = body.originalUrl.trim();
      if (!isOnlyCatalogItems && (trimmedUrl === "https://amazon.co.jp" && body.productName === "Đơn mua hộ từ Nhật Bản")) {
        return NextResponse.json(
          { error: "Vui lòng cung cấp đường dẫn (link) sản phẩm." },
          { status: 400 }
        );
      }

      // SSRF & Phishing Protection: Validate URL domain (strict hostname match)
      try {
        const parsedUrl = new URL(trimmedUrl);
        if (parsedUrl.protocol !== "https:") {
          return NextResponse.json({ error: "Chỉ chấp nhận đường dẫn bảo mật bắt đầu bằng https://" }, { status: 400 });
        }
        const hostname = parsedUrl.hostname.toLowerCase();

        // Block internal / loopback / private / metadata addresses (SSRF)
        if (isPrivateHost(hostname)) {
          return NextResponse.json({ error: "URL không hợp lệ." }, { status: 400 });
        }


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
        validatedOriginalUrl = trimmedUrl;
      } catch (_err) {
        return NextResponse.json({ error: "URL không hợp lệ." }, { status: 400 });
      }
    } else if (!isOnlyCatalogItems) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp đường dẫn (link) sản phẩm." },
        { status: 400 }
      );
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
    const pricingConfig = await getCurrentPricingConfig();
    const minimumBaseOrderVnd = pricingConfig.values.minimumBaseOrderVnd;

    // Khởi tạo mã đơn hàng
    const timestamp = Date.now().toString(36).toUpperCase();
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const orderCode = `CB-${new Date().getFullYear()}-${timestamp}-${randomSuffix}`;

    // Chỉ gắn đơn vào tài khoản lấy từ cookie đã xác thực; email/ID gửi từ client không chứng minh quyền sở hữu.
    const customerSession = await getVerifiedCustomerFromRequest(req);
    const customerId = customerSession?.id || null;
    const customerType = customerSession ? "REGISTERED" : "GUEST";
    const customerEmail = customerSession?.email || submittedEmail;

    if (!customerEmail) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp địa chỉ email để nhận vận đơn và bảo mật tra cứu." },
        { status: 400 }
      );
    }

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

        // BẢO MẬT (P1-11): Gộp trùng và sắp xếp productId tăng dần để chống Deadlock trên PostgreSQL
        const catalogItemsMap = new Map<string, { id: string; quantity: number }>();
        for (const item of items) {
          if (item.id && !item.id.startsWith("calc-")) {
            const current = catalogItemsMap.get(item.id);
            const qty = Number(item.quantity) || 1;
            if (current) {
              current.quantity += qty;
            } else {
              catalogItemsMap.set(item.id, { id: item.id, quantity: qty });
            }
          }
        }
        const sortedCatalogItems = Array.from(catalogItemsMap.values()).sort((a, b) => a.id.localeCompare(b.id));

        const catalogProductsMap = new Map<string, any>();
        for (const catItem of sortedCatalogItems) {
          const product = await tx.product.findUnique({ where: { id: catItem.id } });
          if (!product) throw new Error(`PRODUCT_NOT_FOUND:${catItem.id}`);
          catalogProductsMap.set(catItem.id, product);

          const updated = await tx.product.updateMany({
            where: {
              id: catItem.id,
              stockSlots: { gte: catItem.quantity },
            },
            data: {
              stockSlots: { decrement: catItem.quantity },
            },
          });

          if (updated.count === 0) {
            throw new Error(`INSUFFICIENT_STOCK:${catItem.id}:${product.name}`);
          }
        }

        // Xử lý thông tin và xác minh giá
        let verifiedProductName = "";

        for (const item of items) {
          const qty = Number(item.quantity);

          if (item.id && !item.id.startsWith("calc-")) {
            const product = catalogProductsMap.get(item.id);
            if (!product) throw new Error(`PRODUCT_NOT_FOUND:${item.id}`);

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

            const itemOriginalUrl = typeof item.originalUrl === "string" && item.originalUrl.trim() ? item.originalUrl.trim() : null;
            const itemDisplayName = itemOriginalUrl
              ? `${(item.name || body.productName || "Sản phẩm Nhật Bản").slice(0, 150)} [${itemOriginalUrl.slice(0, 300)}]`
              : (item.name || body.productName || "Sản phẩm Nhật Bản");

            orderItemsData.push({
              productId: null,
              itemType: "EXTERNAL",
              productName: itemDisplayName,
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
        const price = calculateOrderPrice(verifiedPriceJpy, verifiedWeightKg, liveRate, !!body.isGroupBuy, pricingConfig.values);
        const { productPriceVnd, serviceFeeVnd, baseOrderCostVnd, shippingFeeVnd, totalVnd } = price;
        if (baseOrderCostVnd < minimumBaseOrderVnd) {
          throw new Error(`ORDER_BELOW_MINIMUM:${minimumBaseOrderVnd}`);
        }
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
            originalUrl: validatedOriginalUrl,
            productName: verifiedProductName,
            category: ["cosmetics", "health", "gadgets", "anime", "fashion", "food", "luxury", "other"].includes(body.category) ? body.category : "other",
            priceJpy: verifiedPriceJpy,
            weightKg: verifiedWeightKg,
            exchangeRate: liveRate,
            pricingConfigVersion: pricingConfig.version || null,
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
            adminNote: null, // Bảo mật #10: Không cho phép client tự chèn adminNote
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
          include: {
            trackingLogs: true,
            orderItems: {
              include: {
                product: {
                  select: { name: true, imageUrl: true, originalStore: true },
                },
              },
            },
          },
        });
      });

      // Gửi email xác nhận
      sendOrderCreatedEmail(createdDbOrder as any).catch((err) => console.warn(err));
      sendAdminNewOrderEmail(createdDbOrder as any).catch((err) => console.warn(err));

      const guestAccessToken = (!customerId && customerEmail)
        ? createGuestOrderAccessToken(orderCode, customerEmail)
        : undefined;

      const response = NextResponse.json({
        success: true,
        order: createdDbOrder,
        accessToken: guestAccessToken,
      });

      if (guestAccessToken) {
        response.cookies.set(
          ORDER_ACCESS_COOKIE_NAME,
          guestAccessToken,
          {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
          }
        );
      }
      return response;
    } catch (dbErr: any) {
      console.error("Lưu đơn hàng vào Prisma thất bại:", dbErr);
      if (dbErr?.message?.startsWith("PRODUCT_NOT_FOUND:")) {
        return NextResponse.json({ error: "Sản phẩm không còn tồn tại trong kho." }, { status: 404 });
      }
      if (dbErr.message === "ORDER_PRICE_TOO_LOW") {
        return NextResponse.json({ error: "Tổng giá sản phẩm phải từ 100 ¥ trở lên." }, { status: 400 });
      }
      if (dbErr.message === `ORDER_BELOW_MINIMUM:${minimumBaseOrderVnd}`) {
        return NextResponse.json({ error: `Giá trị tiền hàng và phí dịch vụ phải đạt tối thiểu ${minimumBaseOrderVnd.toLocaleString("vi-VN")}đ (chưa gồm vận chuyển).` }, { status: 400 });
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
