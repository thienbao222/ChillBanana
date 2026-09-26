import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// ========== Helpers ==========
function sortObject(obj: Record<string, string>) {
  const sorted: Record<string, string> = {};
  const keys = Object.keys(obj).sort();
  keys.forEach((key) => {
    sorted[key] = obj[key];
  });
  return sorted;
}

function buildQueryString(params: Record<string, string>) {
  return Object.entries(params)
    .map(([key, val]) => `${key}=${encodeURIComponent(val).replace(/%20/g, "+")}`)
    .join("&");
}

// ========== POST: Tạo URL thanh toán VNPAY ==========
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderCode, amount, orderInfo } = body;

    if (!orderCode || !amount) {
      return NextResponse.json({ error: "Thiếu thông tin đơn hàng" }, { status: 400 });
    }

    const tmnCode = process.env.VNPAY_TMN_CODE!;
    const hashSecret = process.env.VNPAY_HASH_SECRET!;
    const vnpUrl = process.env.VNPAY_URL!;

    // Tự động phát hiện base URL: ưu tiên env var, sau dùng VERCEL_URL (Vercel tự set), cuối cùng dùng localhost
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const returnUrl = `${baseUrl}/api/payment/vnpay-return`;

    const now = new Date();
    // Múi giờ Vietnam (GMT+7)
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
    const createDate = `${get("year")}${get("month")}${get("day")}${get("hour")}${get("minute")}${get("second")}`;
    const expireDate = (() => {
      const exp = new Date(now.getTime() + 15 * 60 * 1000);
      const p2 = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false,
      }).formatToParts(exp);
      const g = (t: string) => p2.find((x) => x.type === t)?.value ?? "00";
      return `${g("year")}${g("month")}${g("day")}${g("hour")}${g("minute")}${g("second")}`;
    })();

    // VNPAY yêu cầu số tiền * 100 (đơn vị: đồng -> làm tròn)
    const amountInt = Math.round(Number(amount));

    const params: Record<string, string> = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: tmnCode,
      vnp_Amount: String(amountInt * 100),
      vnp_CreateDate: createDate,
      vnp_CurrCode: "VND",
      vnp_IpAddr: "127.0.0.1",
      vnp_Locale: "vn",
      vnp_OrderInfo: orderInfo || `Dat coc don hang ${orderCode}`,
      vnp_OrderType: "other",
      vnp_ReturnUrl: returnUrl,
      vnp_TxnRef: orderCode,
      vnp_ExpireDate: expireDate,
    };

    const sortedParams = sortObject(params);
    const signData = buildQueryString(sortedParams);
    const hmac = crypto.createHmac("sha512", hashSecret);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    const paymentUrl = `${vnpUrl}?${signData}&vnp_SecureHash=${signed}`;

    return NextResponse.json({ success: true, paymentUrl });
  } catch (error) {
    console.error("[VNPAY CREATE]", error);
    return NextResponse.json({ error: "Lỗi tạo URL thanh toán" }, { status: 500 });
  }
}
