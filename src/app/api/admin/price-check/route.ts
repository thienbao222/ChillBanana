import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { POST as scrapeLinkHandler } from "@/app/api/scrape-link/route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_DOMAINS = [
  "amazon.co.jp",
  "amazon.com",
  "amzn.asia",
  "amzn.to",
  "mercari.com",
  "jp.mercari.com",
  "rakuten.co.jp",
  "a.r10.to",
  "yahoo.co.jp",
  "auctions.yahoo.co.jp",
  "shopping.yahoo.co.jp",
  "page.auctions.yahoo.co.jp",
  "paypayfleamarket.yahoo.co.jp",
  "uniqlo.com",
  "suruga-ya.jp",
  "biccamera.com",
  "yodobashi.com",
];

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN", "OPERATOR"] });
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const orderCode = typeof body?.orderCode === "string" ? body.orderCode.trim() : "";

    if (!orderCode) {
      return NextResponse.json({ error: "Thiếu mã đơn hàng." }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { orderCode },
      select: {
        id: true,
        orderCode: true,
        productName: true,
        originalUrl: true,
        priceJpy: true,
        weightKg: true,
        isPriceVerified: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: `Không tìm thấy đơn hàng #${orderCode}` }, { status: 404 });
    }

    const warnings: string[] = [];

    // 1. Cảnh báo cân nặng 0
    if ((order.weightKg || 0) <= 0) {
      warnings.push("Cân nặng hiện tại là 0 kg. Cần nhập cân nặng ước tính hoặc cân thực tế tại kho JP trước khi bay.");
    }

    // 2. Cảnh báo thiếu link
    if (!order.originalUrl) {
      warnings.push("Đơn hàng không có link sản phẩm gốc từ sàn Nhật Bản. Không thể bóc tách giá bằng AI.");
      return NextResponse.json({
        success: true,
        orderCode: order.orderCode,
        productName: order.productName,
        customerPriceJpy: order.priceJpy,
        scrapedPriceJpy: null,
        diffJpy: null,
        diffPercent: null,
        storeName: null,
        warnings,
        suggestedJpy: order.priceJpy,
        isScraped: false,
      });
    }

    // 3. Kiểm tra sàn hỗ trợ
    let isSupported = false;
    let hostname = "";
    try {
      hostname = new URL(order.originalUrl).hostname.toLowerCase();
      isSupported = ALLOWED_DOMAINS.some((d) => hostname === d || hostname.endsWith("." + d));
    } catch {
      warnings.push("Đường link sản phẩm không hợp lệ.");
    }

    if (!isSupported) {
      warnings.push(`Sàn "${hostname || "không xác định"}" chưa nằm trong danh mục hỗ trợ bóc tách tự động. Vui lòng mở link kiểm tra thủ công.`);
      return NextResponse.json({
        success: true,
        orderCode: order.orderCode,
        productName: order.productName,
        customerPriceJpy: order.priceJpy,
        scrapedPriceJpy: null,
        diffJpy: null,
        diffPercent: null,
        storeName: null,
        warnings,
        suggestedJpy: order.priceJpy,
        isScraped: false,
      });
    }

    // 4. Bóc tách giá qua scrape-link handler
    let scrapedPriceJpy: number | null = null;
    let storeName: string | null = null;

    try {
      const dummyReq = new NextRequest("http://localhost/api/scrape-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: order.originalUrl }),
      });

      const scrapeRes = await scrapeLinkHandler(dummyReq);
      const scrapeData = await scrapeRes.json();

      if (scrapeRes.ok && scrapeData?.success && scrapeData?.data) {
        storeName = scrapeData.data.storeName || null;
        if (typeof scrapeData.data.priceJpy === "number" && scrapeData.data.priceJpy > 0) {
          scrapedPriceJpy = Math.round(scrapeData.data.priceJpy);
        }
      } else {
        warnings.push(
          `Sàn từ chối hoặc không tìm thấy giá rõ ràng (${scrapeData?.error || "Không phát hiện giá"}). Vui lòng bấm "Mở link" để kiểm tra thủ công.`
        );
      }
    } catch (scrapeErr) {
      console.warn("[PriceCheck] Lỗi bóc tách link:", scrapeErr);
      warnings.push("Lỗi kết nối khi quét trang gốc. Vui lòng kiểm tra lại thủ công.");
    }

    let diffJpy: number | null = null;
    let diffPercent: number | null = null;

    if (scrapedPriceJpy !== null) {
      diffJpy = scrapedPriceJpy - order.priceJpy;
      diffPercent = order.priceJpy > 0 ? Math.round((diffJpy / order.priceJpy) * 100) : 0;

      if (Math.abs(diffPercent) >= 5) {
        const sign = diffPercent > 0 ? "+" : "";
        warnings.push(
          `Giá sàn thực tế (${scrapedPriceJpy.toLocaleString()} ¥) chênh lệch ${sign}${diffPercent}% so với giá khách đã lưu (${order.priceJpy.toLocaleString()} ¥).`
        );
      }
    }

    return NextResponse.json({
      success: true,
      orderCode: order.orderCode,
      productName: order.productName,
      customerPriceJpy: order.priceJpy,
      scrapedPriceJpy,
      diffJpy,
      diffPercent,
      storeName,
      warnings,
      suggestedJpy: scrapedPriceJpy ?? order.priceJpy,
      isScraped: Boolean(scrapedPriceJpy),
    });
  } catch (error) {
    console.error("[PriceCheck] Lỗi kiểm tra giá:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Có lỗi xảy ra khi kiểm tra giá." },
      { status: 500 }
    );
  }
}
