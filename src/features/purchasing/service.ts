/**
 * Purchase Agent — Nhóm 3: Auto-Purchasing Agent (Phase A — API-first)
 *
 * Phase A hỗ trợ 2 platform có API chính thức:
 *   1. Amazon JP: Tự động trích xuất ASIN từ URL → tạo deeplink mua hàng
 *      (Không cần Product Advertising API key để tạo link — dùng direct Amazon URL)
 *   2. Rakuten Ichiba: Tìm sản phẩm qua Rakuten Affiliate API
 *      Cần: RAKUTEN_APP_ID trong .env
 *
 * Phase B (chưa triển khai): Mercari/Yahoo qua Playwright Browser Automation.
 *
 * NGUYÊN TẮC BẮNG BUỘC (human-in-the-loop):
 *   - Mọi task đều bắt đầu ở QUEUED → Admin phải APPROVE trước khi action
 *   - Không có hàm nào tự động thanh toán hay đặt hàng
 *   - Chỉ cung cấp: thông tin sản phẩm + deeplink để nhân viên JP thực hiện thủ công
 */

import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PurchasePlatform =
  | "amazon_jp"
  | "rakuten"
  | "mercari"
  | "yahoo_jp"
  | "unknown";

export interface PlatformProductInfo {
  platform: PurchasePlatform;
  externalProductId: string | null; // ASIN hoặc Rakuten itemCode
  platformUrl: string;              // Deeplink để nhân viên JP mua
  scrapedPriceJpy: number | null;   // Giá lấy từ API (nếu có)
  productTitle: string | null;      // Tên sản phẩm từ platform
  availability: "available" | "unknown" | "sold_out";
  notes: string[];                  // Ghi chú cảnh báo (voltage, limited...)
}

// ─── Nhận diện platform từ URL ───────────────────────────────────────────────

export function detectPlatform(url: string): PurchasePlatform {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return "unknown";
    const host = u.hostname.toLowerCase();
    const isDomainOrSubdomain = (domain: string) => host === domain || host.endsWith(`.${domain}`);
    if (isDomainOrSubdomain("amazon.co.jp") || isDomainOrSubdomain("amazon.jp")) return "amazon_jp";
    if (isDomainOrSubdomain("rakuten.co.jp") || isDomainOrSubdomain("rakuten.com")) return "rakuten";
    if (isDomainOrSubdomain("mercari.com")) return "mercari";
    if (
      isDomainOrSubdomain("auctions.yahoo.co.jp") ||
      isDomainOrSubdomain("store.yahoo.co.jp") ||
      isDomainOrSubdomain("shopping.yahoo.co.jp")
    )
      return "yahoo_jp";
    return "unknown";
  } catch {
    return "unknown";
  }
}

// ─── Amazon JP — Trích xuất ASIN và tạo deeplink ─────────────────────────────

function extractAmazonAsin(url: string): string | null {
  // Pattern phổ biến: /dp/XXXXXXXXXX hoặc /gp/product/XXXXXXXXXX hoặc ?ASIN=
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /[?&]ASIN=([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  return null;
}

async function lookupAmazonJp(url: string): Promise<PlatformProductInfo> {
  const asin = extractAmazonAsin(url);
  const notes: string[] = [];

  // Deeplink trực tiếp đến sản phẩm — nhân viên JP click vào để mua
  const cleanUrl = asin
    ? `https://www.amazon.co.jp/dp/${asin}`
    : url;

  // Thử dùng Jina AI để lấy thêm thông tin giá (nếu không có Amazon API key)
  let scrapedPriceJpy: number | null = null;
  let productTitle: string | null = null;
  let availability: "available" | "unknown" | "sold_out" = "unknown";

  try {
    const jinaRes = await fetch(
      `https://r.jina.ai/${cleanUrl}`,
      {
        headers: {
          Accept: "application/json",
          "X-Return-Format": "text",
          ...(process.env.JINA_API_KEY
            ? { Authorization: `Bearer ${process.env.JINA_API_KEY}` }
            : {}),
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (jinaRes.ok) {
      let jinaText = "";
      if (jinaRes.body) {
        const reader = jinaRes.body.getReader();
        const decoder = new TextDecoder();
        let bytes = 0;
        while (bytes < 1024 * 1024) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.length;
          jinaText += decoder.decode(value, { stream: true });
        }
        await reader.cancel().catch(() => {});
      } else {
        jinaText = await jinaRes.text();
      }

      // Trích xuất giá ¥ từ văn bản — tìm pattern "¥X,XXX" hoặc "JPY X,XXX"
      const priceMatch = jinaText.match(/[¥￥]\s*([\d,]+)/);
      if (priceMatch) {
        const priceNum = parseInt(priceMatch[1].replace(/,/g, ""), 10);
        if (!isNaN(priceNum) && priceNum > 0 && priceNum < 10_000_000) {
          scrapedPriceJpy = priceNum;
        }
      }

      // Kiểm tra hết hàng
      if (/在庫切れ|out of stock|sold out/i.test(jinaText)) {
        availability = "sold_out";
        notes.push("⚠️ Sản phẩm hiện đang HẾT HÀNG trên Amazon JP");
      } else if (/(在庫あり|在庫有り|in stock|available now)/i.test(jinaText)) {
        availability = "available";
      }

      // Cảnh báo điện áp
      if (/100V|AC100|100ボルト/i.test(jinaText)) {
        notes.push("⚡ Sản phẩm dùng điện áp 100V — cần biến áp khi dùng tại VN");
      }

      // Lấy title (dòng đầu tiên có độ dài hợp lý)
      const lines = jinaText.split("\n").filter((l) => l.trim().length > 10);
      if (lines[0]) productTitle = lines[0].trim().slice(0, 200);
    }
  } catch {
    // Jina không khả dụng — không ảnh hưởng, chỉ thiếu thông tin bổ sung
    notes.push("ℹ️ Không thể lấy thêm thông tin từ Amazon JP (Jina timeout)");
  }

  return {
    platform: "amazon_jp",
    externalProductId: asin,
    platformUrl: cleanUrl,
    scrapedPriceJpy,
    productTitle,
    availability,
    notes,
  };
}

// ─── Rakuten Ichiba — Tìm sản phẩm qua API ──────────────────────────────────
// Cần: RAKUTEN_APP_ID trong .env (đăng ký tại https://webservice.rakuten.co.jp/)

async function lookupRakuten(url: string): Promise<PlatformProductInfo> {
  const notes: string[] = [];

  // Trích xuất itemCode từ URL Rakuten
  // Pattern: /item/shop_id:item_id/ hoặc ?itemCode=xxx
  let externalProductId: string | null = null;
  const itemCodeMatch = url.match(/\/item\/([^/?&#]+)/i) ||
    url.match(/[?&]itemCode=([^&]+)/i);
  if (itemCodeMatch) externalProductId = decodeURIComponent(itemCodeMatch[1]);

  const appId = process.env.RAKUTEN_APP_ID;
  if (!appId) {
    notes.push("ℹ️ RAKUTEN_APP_ID chưa cấu hình — chỉ sử dụng URL gốc");
    return {
      platform: "rakuten",
      externalProductId,
      platformUrl: url,
      scrapedPriceJpy: null,
      productTitle: null,
      availability: "unknown",
      notes,
    };
  }

  try {
    // Rakuten Item Search API
    const searchUrl = externalProductId
      ? `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?applicationId=${appId}&itemCode=${encodeURIComponent(externalProductId)}&hits=1`
      : `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?applicationId=${appId}&keyword=${encodeURIComponent(url.split("/").pop() || "")}&hits=1`;

    const res = await fetch(searchUrl, {
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      notes.push(`⚠️ Rakuten API lỗi: ${res.status}`);
      return {
        platform: "rakuten",
        externalProductId,
        platformUrl: url,
        scrapedPriceJpy: null,
        productTitle: null,
        availability: "unknown",
        notes,
      };
    }

    const data = await res.json();
    const item = data?.Items?.[0]?.Item;

    if (!item) {
      notes.push("⚠️ Không tìm thấy sản phẩm trên Rakuten API");
      return {
        platform: "rakuten",
        externalProductId,
        platformUrl: url,
        scrapedPriceJpy: null,
        productTitle: null,
        availability: "unknown",
        notes,
      };
    }

    const itemPrice: number = item.itemPrice ?? 0;
    const availability = item.availability === 1 ? "available" : "sold_out";

    if (availability === "sold_out") {
      notes.push("⚠️ Sản phẩm hiện đang HẾT HÀNG trên Rakuten");
    }
    if (item.taxFlag === 0) {
      notes.push("ℹ️ Giá trên chưa bao gồm thuế 10% (Nhật)");
    }

    return {
      platform: "rakuten",
      externalProductId: item.itemCode ?? externalProductId,
      platformUrl: item.itemUrl ?? url,
      scrapedPriceJpy: itemPrice > 0 ? itemPrice : null,
      productTitle: item.itemName ?? null,
      availability,
      notes,
    };
  } catch (err) {
    notes.push(`⚠️ Lỗi kết nối Rakuten API: ${err instanceof Error ? err.message : "unknown"}`);
    return {
      platform: "rakuten",
      externalProductId,
      platformUrl: url,
      scrapedPriceJpy: null,
      productTitle: null,
      availability: "unknown",
      notes,
    };
  }
}

// ─── Mercari / Yahoo — Phase B (chưa triển khai) ─────────────────────────────

async function lookupMercariOrYahoo(
  url: string,
  platform: PurchasePlatform
): Promise<PlatformProductInfo> {
  return {
    platform,
    externalProductId: null,
    platformUrl: url,
    scrapedPriceJpy: null,
    productTitle: null,
    availability: "unknown",
    notes: [
      `ℹ️ ${platform === "mercari" ? "Mercari" : "Yahoo JP"} chưa hỗ trợ lookup tự động (Phase B).`,
      "👉 Nhân viên JP cần kiểm tra giá và tình trạng hàng thủ công qua link gốc.",
    ],
  };
}

// ─── Main Dispatcher ─────────────────────────────────────────────────────────

export async function lookupProductInfo(
  url: string
): Promise<PlatformProductInfo> {
  const platform = detectPlatform(url);

  switch (platform) {
    case "amazon_jp":
      return lookupAmazonJp(url);
    case "rakuten":
      return lookupRakuten(url);
    case "mercari":
    case "yahoo_jp":
      return lookupMercariOrYahoo(url, platform);
    default:
      return {
        platform: "unknown",
        externalProductId: null,
        platformUrl: url,
        scrapedPriceJpy: null,
        productTitle: null,
        availability: "unknown",
        notes: ["⚠️ Platform không được hỗ trợ tự động. Nhân viên JP kiểm tra thủ công."],
      };
  }
}

// ─── Tạo PurchaseTask từ Order ────────────────────────────────────────────────

export async function createPurchaseTask(
  orderId: string,
  adminUsername: string
): Promise<{
  task: Awaited<ReturnType<typeof prisma.purchaseTask.create>> | null;
  info: PlatformProductInfo | null;
  error?: string;
}> {
  // Lấy thông tin order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderCode: true,
      originalUrl: true,
      priceJpy: true,
      paymentStatus: true,
      status: true,
      isPriceVerified: true,
      purchaseTask: { select: { id: true, status: true } },
    },
  });

  if (!order) return { task: null, info: null, error: "Không tìm thấy đơn hàng." };
  if (!order.originalUrl) {
    return { task: null, info: null, error: "Đơn hàng chưa có link sản phẩm (originalUrl)." };
  }
  if (order.paymentStatus !== "DEPOSITED_50" && order.paymentStatus !== "PAID_100") {
    return { task: null, info: null, error: "Đơn chưa được cọc — không thể tạo purchase task." };
  }
  if (order.status !== "PURCHASING_JP") {
    return { task: null, info: null, error: "Đơn phải ở trạng thái PURCHASING_JP mới có thể tạo tác vụ mua hàng." };
  }
  if (!order.isPriceVerified) {
    return { task: null, info: null, error: "Báo giá của đơn chưa được Admin xác minh." };
  }
  if (order.purchaseTask) {
    return {
      task: null,
      info: null,
      error: `Đơn này đã có purchase task (${order.purchaseTask.status}). Không tạo thêm.`,
    };
  }

  // Lookup thông tin sản phẩm từ platform
  const info = await lookupProductInfo(order.originalUrl);

  // Tính chênh lệch giá (nếu có)
  let priceDiffPercent: number | null = null;
  if (info.scrapedPriceJpy !== null && order.priceJpy > 0) {
    priceDiffPercent =
      ((info.scrapedPriceJpy - order.priceJpy) / order.priceJpy) * 100;
  }

  // Tạo task trong DB (bắt lỗi P2002 chống double-click concurrent create - P1-16)
  let task: Awaited<ReturnType<typeof prisma.purchaseTask.create>>;
  try {
    task = await prisma.purchaseTask.create({
      data: {
        orderId: order.id,
        platform: info.platform,
        status: "QUEUED",
        externalProductId: info.externalProductId,
        platformUrl: info.platformUrl,
        scrapedPriceJpy: info.scrapedPriceJpy,
        priceDiffPercent,
        createdByAdmin: adminUsername,
        adminNote: info.notes.length > 0 ? info.notes.join("\n") : null,
      },
    });
  } catch (dbErr: any) {
    if (dbErr?.code === "P2002") {
      return { task: null, info: null, error: "Đơn hàng này đã có tác vụ mua hộ đang được tạo đồng thời." };
    }
    throw dbErr;
  }

  console.log(
    `[PurchaseAgent] ✅ Tạo task ${task.id} cho đơn ${order.orderCode} | platform: ${info.platform} | status: QUEUED`
  );

  return { task, info };
}
