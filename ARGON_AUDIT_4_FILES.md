# TỔNG HỢP 4 TỆP API CHO ARGON AUDIT (CHILLBANANA)

> Tài liệu này gộp toàn bộ 4 tệp API `route.ts` vào 1 tệp văn bản duy nhất để tải lên các hệ thống AI (Argon / ChatGPT / Claude) mà không bị lỗi giải nén ZIP hay trùng tên file `route.ts`.


---

## TỆP: `src/app/api/admin/auth/route.ts`

```typescript
// Path: src/app/api/admin/auth/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_COOKIE_NAME,
  hashAdminPassword,
  verifyAdminPassword,
  createAdminSessionTokenWithRole,
  verifyAdminSessionToken,
  getAdminUsernameFromRequest,
} from "@/lib/auth-session";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp, getMaxBlockedSeconds, recordHits, resetKey } from "@/lib/rate-limit";
import { LOGIN_FAILURES_PER_ACCOUNT, LOGIN_FAILURES_PER_IP } from "@/lib/rate-limit-core";


export const dynamic = "force-dynamic";

// GET: Kiểm tra trạng thái phiên đăng nhập của Admin
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(ADMIN_COOKIE_NAME);
  if (!cookie || !cookie.value) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const { valid, username } = verifyAdminSessionToken(cookie.value);
  if (!valid || !username) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // Lấy thông tin admin từ DB
  let adminUser = null;
  try {
    adminUser = await prisma.adminUser.findUnique({
      where: { username },
      select: { id: true, username: true, name: true, role: true },
    });
  } catch (err) {
    console.error("[AdminAuth] Lỗi kết nối CSDL khi kiểm tra session:", err);
    return NextResponse.json(
      { authenticated: false, error: "Không thể xác thực lúc này." },
      { status: 503 }
    );
  }

  // BẢO MẬT: Bắt buộc tài khoản phải còn tồn tại trong cơ sở dữ liệu.
  // Tuyệt đối không fallback SUPER_ADMIN khi tài khoản đã bị xóa khỏi hệ thống.
  if (!adminUser) {
    const response = NextResponse.json(
      { authenticated: false, error: "Tài khoản không tồn tại hoặc phiên đã bị thu hồi." },
      { status: 401 }
    );
    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: "",
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  return NextResponse.json({
    authenticated: true,
    user: adminUser,
  });
}

// POST: Xử lý Đăng nhập
export async function POST(req: NextRequest) {
  // SECURITY: Only DB-based authentication allowed. No hardcoded credentials.
  // To set up admin: run `npm run prisma:seed` or create AdminUser via Prisma Studio.
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu." },
        { status: 400 }
      );
    }

    if (typeof username !== "string" || typeof password !== "string" || username.length > 100 || password.length > 256) {
      return NextResponse.json({ error: "Thông tin đăng nhập không hợp lệ." }, { status: 400 });
    }

    const trimmedUser = username.trim().toLowerCase();
    const ip = getClientIp(req);
    const userKey = `admin-login:user:${trimmedUser}`;
    const ipKey = `admin-login:ip:${ip}`;

    // Giới hạn đăng nhập sai theo tài khoản và theo IP.
    const waitSeconds = await getMaxBlockedSeconds([userKey, ipKey]);
    if (waitSeconds > 0) {
      console.warn(`[AdminAuth] Chặn đăng nhập "${trimmedUser}" từ ${ip}: còn ${waitSeconds}s.`);
      return NextResponse.json(
        { error: `Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(waitSeconds / 60)} phút.` },
        { status: 429, headers: { "Retry-After": String(waitSeconds) } }
      );
    }

    let isAuthenticated = false;
    let adminName = "Quản Trị Viên ChillBanana";
    let adminRole = "SUPER_ADMIN";

    // 1. Kiểm tra trong CSDL Prisma
    try {
      const dbAdmin = await prisma.adminUser.findUnique({
        where: { username: trimmedUser },
      });

      if (dbAdmin) {
        const check = verifyAdminPassword(password, dbAdmin.passwordHash);
        if (check.valid) {
          isAuthenticated = true;
          adminName = dbAdmin.name;
          adminRole = dbAdmin.role;
          if (check.needsRehash) {
            // Hash HMAC cũ: nâng cấp sang scrypt có salt ngay sau khi đăng nhập đúng.
            await prisma.adminUser.update({
              where: { id: dbAdmin.id },
              data: { passwordHash: hashAdminPassword(password) },
            });
            await writeAuditLog({ actor: trimmedUser, action: "ADMIN_PASSWORD_REHASHED", summary: "Nâng cấp hash mật khẩu sang scrypt.", req });
          }
        }
      } else {
        // Tài khoản không tồn tại: vẫn tốn thời gian băm tương đương để khó dò tên đăng nhập qua độ trễ.
        verifyAdminPassword(password, hashAdminPassword("dummy-password"));
      }
    } catch (dbErr) {
      console.error("[AdminAuth] Lỗi kết nối CSDL khi đăng nhập:", dbErr);
      return NextResponse.json(
        { error: "Hệ thống cơ sở dữ liệu đang bận, vui lòng thử lại sau." },
        { status: 503 }
      );
    }

    if (!isAuthenticated) {
      await recordHits([userKey], LOGIN_FAILURES_PER_ACCOUNT);
      await recordHits([ipKey], LOGIN_FAILURES_PER_IP);
      await writeAuditLog({ actor: trimmedUser, action: "ADMIN_LOGIN_FAILED", summary: "Đăng nhập quản trị thất bại.", req });
      return NextResponse.json(
        { error: "Tên đăng nhập hoặc mật khẩu quản trị không chính xác." },
        { status: 401 }
      );
    }

    await resetKey(userKey);
    await writeAuditLog({ actor: trimmedUser, action: "ADMIN_LOGIN", summary: "Đăng nhập quản trị thành công.", req });

    // Thiết lập Cookie phiên đăng nhập bảo mật — nhúng role vào token để RBAC
    const token = createAdminSessionTokenWithRole(trimmedUser, adminRole);
    const response = NextResponse.json({
      success: true,
      message: "Đăng nhập thành công!",
      user: {
        username: trimmedUser,
        name: adminName,
        role: adminRole,
      },
    });

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err) {
    console.error("Lỗi đăng nhập admin:", err);
    return NextResponse.json({ error: "Lỗi xử lý đăng nhập." }, { status: 500 });
  }
}

// DELETE: Đăng xuất
export async function DELETE(req: NextRequest) {
  const username = getAdminUsernameFromRequest(req);
  if (username) {
    await writeAuditLog({ actor: username, action: "ADMIN_LOGOUT", summary: "Đăng xuất quản trị.", req });
  }
  const response = NextResponse.json({ success: true, message: "Đã đăng xuất thành công." });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
```


---

## TỆP: `src/app/api/payment/vnpay-create/route.ts`

```typescript
// Path: src/app/api/payment/vnpay-create/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createMockPaymentAttemptToken } from "@/features/payments/mock-provider";
import { resolvePaymentMode } from "@/features/payments/provider";
import {
  getCustomerFromRequest,
  hasGuestOrderAccessForEmail,
  ORDER_ACCESS_COOKIE_NAME,
} from "@/lib/auth-session";
import { isVerifiedAdmin } from "@/lib/admin-guard";

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
    const { orderCode } = body;

    if (!orderCode) {
      return NextResponse.json({ error: 'Thiếu mã đơn hàng' }, { status: 400 });
    }

    // Fetch real amount from DB
    const order = await prisma.order.findFirst({ where: { orderCode } });
    if (!order) {
      return NextResponse.json({ error: 'Không tìm thấy đơn hàng.' }, { status: 404 });
    }

    // BẢO MẬT: Bắt buộc xác thực quyền với đơn hàng để chống Unauthenticated Order Lockout
    const isAdmin = await isVerifiedAdmin(req);
    const customer = getCustomerFromRequest(req);
    const guestAccessToken = req.cookies.get(ORDER_ACCESS_COOKIE_NAME)?.value || (typeof body.accessToken === "string" ? body.accessToken : undefined);
    const cleanReqPhone = typeof body.phone === "string" ? body.phone.replace(/\s+/g, "") : "";
    const cleanOrderPhone = (order.customerPhone || "").replace(/\s+/g, "");
    const hasGuestAccess = Boolean(
      (order.customerEmail && hasGuestOrderAccessForEmail(guestAccessToken, order.orderCode, order.customerEmail)) ||
      (!order.customerEmail && cleanReqPhone && cleanReqPhone === cleanOrderPhone)
    );

    const isAuthorized = isAdmin || (customer && order.customerId === customer.id) || hasGuestAccess;
    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Bạn không có quyền khởi tạo thanh toán cho đơn hàng này." },
        { status: 403 }
      );
    }
    if (order.paymentStatus !== 'UNPAID' || order.status !== "PENDING_DEPOSIT") {
      return NextResponse.json({ error: 'Đơn hàng này không còn ở trạng thái chờ thanh toán.' }, { status: 400 });
    }
    if (!order.isPriceVerified) {
      return NextResponse.json({ error: 'Đơn hàng đang chờ quản trị viên xác minh giá và cước phí. Vui lòng quay lại thanh toán sau.' }, { status: 403 });
    }
    const now = new Date();
    if (order.reservationExpiresAt && order.reservationExpiresAt <= now) {
      return NextResponse.json({ error: "Thời gian giữ hàng đã hết. Vui lòng liên hệ ChillBanana để kiểm tra lại tồn kho trước khi thanh toán." }, { status: 409 });
    }
    if (order.depositAmountVnd <= 0) {
      return NextResponse.json({ error: "Đơn hàng không có số tiền cần thanh toán." }, { status: 400 });
    }
    const mode = resolvePaymentMode();
    if (mode === "blocked-live") {
      return NextResponse.json({ error: "Thanh toán live đang bị khóa trong giai đoạn demo; không thể tạo giao dịch thật." }, { status: 503 });
    }
    if (mode === "misconfigured") {
      return NextResponse.json({ error: "Cấu hình thanh toán không hợp lệ. Sandbox chỉ chấp nhận URL chính thức sandbox.vnpayment.vn." }, { status: 503 });
    }
    const tmnCode = mode === "sandbox" ? process.env.VNPAY_TMN_CODE : undefined;
    const hashSecret = mode === "sandbox" ? process.env.VNPAY_HASH_SECRET : undefined;
    const vnpUrl = mode === "sandbox" ? process.env.VNPAY_URL : undefined;
    if (mode === "sandbox" && (!tmnCode || !hashSecret || !vnpUrl)) {
      return NextResponse.json({ error: "Cấu hình VNPAY sandbox chưa đầy đủ." }, { status: 503 });
    }

    // Keep catalog stock reserved through the gateway's 15-minute payment window plus a buffer.
    // BẢO MẬT: Giới hạn trần tối đa 45 phút kể từ thời điểm tạo đơn để chống giam kho vô tận (Stock Squatting)
    if (order.reservationExpiresAt) {
      const maxReservationCeiling = new Date(order.createdAt.getTime() + 45 * 60 * 1000);
      const requestedPaymentExpiry = new Date(now.getTime() + 17 * 60 * 1000);
      const paymentWindowExpiresAt = requestedPaymentExpiry > maxReservationCeiling
        ? maxReservationCeiling
        : requestedPaymentExpiry;

      if (paymentWindowExpiresAt <= now) {
        return NextResponse.json(
          { error: "Đơn hàng đã hết thời gian gia hạn giữ hàng tối đa (45 phút). Vui lòng liên hệ hỗ trợ hoặc đặt đơn mới." },
          { status: 409 }
        );
      }

      if (order.reservationExpiresAt < paymentWindowExpiresAt) {
        const extended = await prisma.order.updateMany({
          where: {
            id: order.id,
            status: "PENDING_DEPOSIT",
            paymentStatus: "UNPAID",
            isPriceVerified: true,
            AND: [
              { reservationExpiresAt: order.reservationExpiresAt },
              { reservationExpiresAt: { gt: now } },
            ],
          },
          data: { reservationExpiresAt: paymentWindowExpiresAt },
        });
        if (extended.count !== 1) {
          return NextResponse.json({ error: "Đơn vừa hết thời gian giữ hàng hoặc được xử lý ở yêu cầu khác. Vui lòng tải lại trang theo dõi." }, { status: 409 });
        }
      }
    }

    const amount = order.depositAmountVnd; // Server-side computed amount

    // Tự động phát hiện base URL: ưu tiên APP_URL, NEXT_PUBLIC_APP_URL, hoặc domain production công khai
    const baseUrl =
      process.env.APP_URL?.replace(/\/+$/, "") ||
      (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost") ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "") : null) ||
      (process.env.VERCEL || process.env.NODE_ENV === "production" ? "https://chill-banana.vercel.app" : "http://localhost:3000");

    const returnUrl = `${baseUrl}/api/payment/vnpay-return`;

    const attemptExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const createdAttempt = await prisma.$transaction(async (tx) => {
      // Serialize initiation per order so two rapid clicks cannot create two live payment sessions.
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`;
      const currentOrder = await tx.order.findUnique({
        where: { id: order.id },
        select: { status: true, paymentStatus: true, isPriceVerified: true, depositAmountVnd: true, reservationExpiresAt: true },
      });
      const currentTime = new Date();
      if (!currentOrder || currentOrder.status !== "PENDING_DEPOSIT" || currentOrder.paymentStatus !== "UNPAID" || !currentOrder.isPriceVerified || currentOrder.depositAmountVnd !== order.depositAmountVnd || (currentOrder.reservationExpiresAt && currentOrder.reservationExpiresAt <= currentTime)) {
        return { error: "Đơn hàng vừa được thanh toán hoặc không còn đủ điều kiện tạo phiên thanh toán." } as const;
      }
      await tx.paymentAttempt.updateMany({
        where: { orderId: order.id, status: { in: ["INITIATED", "PENDING"] }, expiresAt: { lte: currentTime } },
        data: { status: "EXPIRED", failureCode: "ATTEMPT_EXPIRED", completedAt: currentTime },
      });
      const activeAttempt = await tx.paymentAttempt.findFirst({
        where: { orderId: order.id, status: { in: ["INITIATED", "PENDING"] }, expiresAt: { gt: currentTime } },
        select: { id: true },
      });
      if (activeAttempt) return { error: "Đơn hàng đã có một phiên thanh toán đang chờ. Hãy hoàn tất hoặc chờ phiên đó hết hạn." } as const;
      const attempt = await tx.paymentAttempt.create({
        data: {
          orderId: order.id,
          provider: mode === "mock" ? "MOCK" : "VNPAY_SANDBOX",
          mode,
          amountVnd: order.depositAmountVnd,
          idempotencyKey: `${mode}:${order.id}:${randomUUID()}`,
          expiresAt: attemptExpiresAt,
        },
      });
      return { attempt } as const;
    });
    if ("error" in createdAttempt) return NextResponse.json({ error: createdAttempt.error }, { status: 409 });
    const attempt = createdAttempt.attempt;

    if (mode === "mock") {
      try {
        const token = createMockPaymentAttemptToken(attempt.id, attemptExpiresAt);
        const paymentUrl = new URL("/payment/mock", baseUrl);
        paymentUrl.searchParams.set("token", token);
        paymentUrl.searchParams.set("orderCode", order.orderCode);
        return NextResponse.json({ success: true, mode, paymentUrl: paymentUrl.toString(), demo: true });
      } catch (error) {
        await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "FAILED", failureCode: "MOCK_PROVIDER_CONFIG", completedAt: new Date() } });
        console.error("[Mock Payment] Provider configuration failed:", error);
        return NextResponse.json({ error: "Cấu hình chữ ký thanh toán mô phỏng chưa đầy đủ." }, { status: 503 });
      }
    }

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

    const forwardedIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const clientIp = forwardedIp || req.headers.get("x-real-ip") || "127.0.0.1";
    const params: Record<string, string> = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: tmnCode!,
      vnp_Amount: String(amountInt * 100),
      vnp_CreateDate: createDate,
      vnp_CurrCode: "VND",
      vnp_IpAddr: clientIp,
      vnp_Locale: "vn",
      vnp_OrderInfo: `Thanh toan don hang ${orderCode}`,
      vnp_OrderType: "other",
      vnp_ReturnUrl: returnUrl,
      vnp_TxnRef: `${orderCode}_${attempt.id.slice(-6)}`,
      vnp_ExpireDate: expireDate,
    };

    const sortedParams = sortObject(params);
    const signData = buildQueryString(sortedParams);
    const hmac = crypto.createHmac("sha512", hashSecret!);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    const paymentUrl = `${vnpUrl!}?${signData}&vnp_SecureHash=${signed}`;

    return NextResponse.json({ success: true, mode, paymentUrl, demo: true });
  } catch (error) {
    console.error("[VNPAY CREATE]", error);
    return NextResponse.json({ error: "Lỗi tạo URL thanh toán" }, { status: 500 });
  }
}
```


---

## TỆP: `src/app/api/admin/customers/route.ts`

```typescript
// Path: src/app/api/admin/customers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

function isPaymentRecorded(order: { paymentStatus: string; status: string }) {
  return (
    order.status !== "CANCELLED" &&
    (order.paymentStatus === "DEPOSITED_50" || order.paymentStatus === "PAID_100")
  );
}

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;

    // ====== 1. Thành viên đã đăng ký (REGISTERED) ======
    const registeredCustomers = await prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
    });

    // ====== 2. Tất cả đơn hàng để phân tích ======
    const allOrders = await prisma.order.findMany({
      select: {
        id: true,
        orderCode: true,
        customerEmail: true,
        customerPhone: true,
        customerName: true,
        customerAddress: true,
        totalVnd: true,
        depositAmountVnd: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
        customerId: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Email & Phone của thành viên đã đăng ký
    const registeredEmails = new Set(registeredCustomers.map((c) => c.email.toLowerCase().trim()));
    const registeredPhones = new Set(
      registeredCustomers.filter((c) => c.phone).map((c) => c.phone!.trim())
    );

    // ====== 3. Khách vãng lai qua đơn hàng (GUEST_ORDER) ======
    const guestOrderMap = new Map<string, any>();
    for (const ord of allOrders) {
      const email = (ord.customerEmail || "").toLowerCase().trim();
      const phone = (ord.customerPhone || "").trim();
      const isRegistered =
        (email && registeredEmails.has(email)) ||
        (phone && registeredPhones.has(phone));
      if (!isRegistered && !ord.customerId) {
        const key = email || phone || ord.customerName;
        if (!guestOrderMap.has(key)) {
          guestOrderMap.set(key, {
            id: `guest-${key}`,
            name: ord.customerName,
            email: ord.customerEmail || "",
            phone: ord.customerPhone || "Chưa cập nhật",
            address: ord.customerAddress || "Chưa cập nhật",
            customerType: "GUEST_ORDER",
            orders: [],
            createdAt: ord.createdAt,
            lastActiveAt: ord.createdAt,
          });
        }
        const guest = guestOrderMap.get(key);
        guest.orders.push(ord);
        if (new Date(ord.createdAt) > new Date(guest.lastActiveAt)) {
          guest.lastActiveAt = ord.createdAt;
        }
      }
    }

    // ====== 4. Chat sessions để làm phong phú dữ liệu ======
    let chatSessions: any[] = [];
    try {
      chatSessions = await prisma.chatSession.findMany({
        include: { messages: { take: 1, orderBy: { createdAt: "asc" } } },
        orderBy: { updatedAt: "desc" },
        take: 200,
      });
    } catch {
      // customerEmail field may not exist yet if migration pending
    }

    // ====== 5. Chat Leads (có email nhưng không phải thành viên hay khách đặt đơn) ======
    const guestEmailsInOrders = new Set(
      Array.from(guestOrderMap.values()).map((g: any) => g.email?.toLowerCase().trim()).filter(Boolean)
    );
    const chatLeadMap = new Map<string, any>();
    for (const session of chatSessions) {
      const sessionEmail = session.customerEmail;
      if (sessionEmail) {
        const email = sessionEmail.toLowerCase().trim();
        if (!registeredEmails.has(email) && !guestEmailsInOrders.has(email)) {
          if (!chatLeadMap.has(email)) {
            chatLeadMap.set(email, {
              id: `chat-${session.id}`,
              name: session.customerName || "Khách Chat Vãng Lai",
              email: sessionEmail,
              phone: session.customerPhone || "Chưa cập nhật",
              address: "Chưa cập nhật",
              customerType: "CHAT_LEAD",
              chatCount: 0,
              lastTopic: session.topic,
              lastSentiment: session.sentiment,
              createdAt: session.createdAt,
              lastActiveAt: session.updatedAt,
            });
          }
          chatLeadMap.get(email).chatCount++;
        }
      }
    }

    const anonymousSessionCount = chatSessions.filter(
      (s) => !s.customerEmail && !s.customerPhone
    ).length;

    // ====== 6. Enrich thành viên đã đăng ký ======
    let registeredWithOrders = 0;

    // Index hóa đơn hàng để tối ưu hiệu năng O(1) thay vì lặp lồng O(N x M)
    const ordersByCustomerId = new Map<string, typeof allOrders>();
    const ordersByEmail = new Map<string, typeof allOrders>();
    const ordersByPhone = new Map<string, typeof allOrders>();

    for (const ord of allOrders) {
      if (ord.customerId) {
        const list = ordersByCustomerId.get(ord.customerId) || [];
        list.push(ord);
        ordersByCustomerId.set(ord.customerId, list);
      }
      if (ord.customerEmail) {
        const email = ord.customerEmail.toLowerCase().trim();
        const list = ordersByEmail.get(email) || [];
        list.push(ord);
        ordersByEmail.set(email, list);
      }
      if (ord.customerPhone) {
        const phone = ord.customerPhone.trim();
        const list = ordersByPhone.get(phone) || [];
        list.push(ord);
        ordersByPhone.set(phone, list);
      }
    }

    const enrichedRegistered = registeredCustomers.map((c) => {
      const cleanEmail = c.email.toLowerCase().trim();
      const cleanPhone = c.phone?.trim() || "";

      // Gộp đơn theo ID hoặc email/phone chính chủ, loại bỏ trùng lặp id
      const matchedOrdersMap = new Map<string, typeof allOrders[0]>();
      if (ordersByCustomerId.has(c.id)) {
        for (const o of ordersByCustomerId.get(c.id)!) matchedOrdersMap.set(o.id, o);
      }
      if (cleanEmail && ordersByEmail.has(cleanEmail)) {
        for (const o of ordersByEmail.get(cleanEmail)!) {
          if (!o.customerId || o.customerId === c.id) matchedOrdersMap.set(o.id, o);
        }
      }
      if (cleanPhone && ordersByPhone.has(cleanPhone)) {
        for (const o of ordersByPhone.get(cleanPhone)!) {
          if (!o.customerId || o.customerId === c.id) matchedOrdersMap.set(o.id, o);
        }
      }
      const userOrders = Array.from(matchedOrdersMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const orderCount = userOrders.length;
      if (orderCount > 0) registeredWithOrders++;
      const totalSpentVnd = userOrders.reduce(
        (sum, order) => sum + (isPaymentRecorded(order) ? order.depositAmountVnd || 0 : 0),
        0
      );
      const latestOrder = userOrders[0] || null;

      const memberSessions = chatSessions.filter(
        (s) => s.customerId === c.id || s.customerEmail === c.email
      );

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone || "Chưa cập nhật",
        address: c.address || "Chưa cập nhật",
        customerType: "REGISTERED" as const,
        orderCount,
        totalSpentVnd,
        latestOrderCode: latestOrder?.orderCode || null,
        latestOrderStatus: latestOrder?.status || null,
        latestOrderDate: latestOrder?.createdAt || null,
        chatSessionCount: memberSessions.length,
        lastChatTopic: memberSessions[0]?.topic || null,
        lastActiveAt: latestOrder?.createdAt || memberSessions[0]?.updatedAt || c.createdAt,
        createdAt: c.createdAt,
      };
    });

    // Doanh thu thực tế chuẩn: Tính trực tiếp trên toàn bộ allOrders đã thanh toán và chưa bị hủy (mỗi đơn duy nhất 1 lần, tuyệt đối không cộng trùng)
    const totalRevenueVnd = allOrders
      .filter((order) => isPaymentRecorded(order))
      .reduce((sum, order) => sum + (order.depositAmountVnd || 0), 0);

    // ====== 7. Enrich khách vãng lai đặt đơn ======
    const enrichedGuestOrders = Array.from(guestOrderMap.values()).map((g: any) => {
      const orderCount = g.orders.length;
      const totalSpentVnd = g.orders.reduce(
        (sum: number, order: any) => sum + (isPaymentRecorded(order) ? order.depositAmountVnd || 0 : 0),
        0
      );
      const latestOrder = g.orders[0] || null;

      const guestSessions = chatSessions.filter(
        (s) => s.customerEmail && s.customerEmail.toLowerCase() === g.email.toLowerCase()
      );

      return {
        id: g.id,
        name: g.name,
        email: g.email,
        phone: g.phone,
        address: g.address,
        customerType: "GUEST_ORDER" as const,
        orderCount,
        totalSpentVnd,
        latestOrderCode: latestOrder?.orderCode || null,
        latestOrderStatus: latestOrder?.status || null,
        latestOrderDate: latestOrder?.createdAt || null,
        chatSessionCount: guestSessions.length,
        lastChatTopic: guestSessions[0]?.topic || null,
        lastActiveAt: g.lastActiveAt,
        createdAt: g.createdAt,
      };
    });

    // ====== 8. Enrich Chat Leads ======
    const enrichedChatLeads = Array.from(chatLeadMap.values()).map((lead: any) => ({
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      address: lead.address,
      customerType: "CHAT_LEAD" as const,
      orderCount: 0,
      totalSpentVnd: 0,
      latestOrderCode: null,
      latestOrderStatus: null,
      latestOrderDate: null,
      chatSessionCount: lead.chatCount,
      lastChatTopic: lead.lastTopic,
      lastActiveAt: lead.lastActiveAt,
      createdAt: lead.createdAt,
    }));

    // ====== 9. Gộp & sắp xếp ======
    const allCustomers = [
      ...enrichedRegistered,
      ...enrichedGuestOrders,
      ...enrichedChatLeads,
    ].sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());

    return NextResponse.json({
      success: true,
      customers: allCustomers,
      stats: {
        totalAll: allCustomers.length,
        totalRegistered: enrichedRegistered.length,
        totalGuestOrder: enrichedGuestOrders.length,
        totalChatLead: enrichedChatLeads.length,
        anonymousSessionCount,
        registeredWithOrders,
        totalRevenueVnd,
      },
    });
  } catch (error) {
    console.error("Unified Customers API error:", error);
    return NextResponse.json(
      { error: "Lỗi tải dữ liệu khách hàng hợp nhất từ CSDL." },
      { status: 500 }
    );
  }
}
```


---

## TỆP: `src/app/api/auth/customer/reset-password/route.ts`

```typescript
// Path: src/app/api/auth/customer/reset-password/route.ts
/**
 * /api/auth/customer/reset-password
 * ─────────────────────────────────────────────────────────────────────────────
 * POST — Bước 1: Gửi email chứa link đặt lại mật khẩu.
 *   Body: { action: "request", email: string }
 *   → Tạo token HMAC-signed (hết hạn 1h), gửi link tới email khách hàng.
 *
 * POST — Bước 2: Đặt lại mật khẩu mới bằng token từ email.
 *   Body: { action: "reset", token: string, newPassword: string }
 *   → Verify token, cập nhật passwordHash bằng scrypt, xóa token (1 lần dùng).
 *
 * Bảo mật:
 *   - Rate limit 3 lần / 10 phút / IP (chống bruteforce email enumeration).
 *   - Token là HMAC-signed, có timestamp, không lưu vào DB → không cần migration.
 *   - Response luôn 200 kể cả email không tồn tại (anti-enumeration).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { hashCustomerPassword } from "@/lib/auth-session";
import { resetPasswordLimiter, getClientIp } from "@/lib/rate-limiter";
import { getBaseUrl } from "@/lib/mailer";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers tạo / verify reset token (HMAC-signed, không cần DB)
// ─────────────────────────────────────────────────────────────────────────────

function getResetSecret(): string {
  const secret = process.env.CUSTOMER_SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CUSTOMER_SESSION_SECRET is required in production");
    }
    return "reset:dev-only-insecure-customer-secret-do-not-use-in-prod";
  }
  return `reset:${secret}`;
}

/**
 * Tạo token reset password: base64( payload::hmac )
 * payload = JSON { id, email, pwdDigest, exp }
 */
function createResetToken(customerId: string, email: string, passwordHash: string): string {
  const pwdDigest = crypto.createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
  const payload = JSON.stringify({
    id: customerId,
    email: email.toLowerCase(),
    pwdDigest,
    purpose: "reset-password",
    exp: Date.now() + 60 * 60 * 1000, // 1 giờ
  });
  const secret = getResetSecret();
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}::${sig}`).toString("base64url");
}

/**
 * Verify token reset. Trả về { id, email, pwdDigest } nếu hợp lệ, null nếu không.
 */
function verifyResetToken(token: string): { id: string; email: string; pwdDigest: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const sepIndex = decoded.lastIndexOf("::");
    if (sepIndex === -1) return null;
    const payloadStr = decoded.slice(0, sepIndex);
    const sig = decoded.slice(sepIndex + 2);

    const secret = getResetSecret();
    const expected = crypto.createHmac("sha256", secret).update(payloadStr).digest("hex");
    const bufA = Buffer.from(expected);
    const bufB = Buffer.from(sig);
    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) return null;

    const payload = JSON.parse(payloadStr);
    if (payload.purpose !== "reset-password") return null;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (typeof payload.id !== "string" || typeof payload.email !== "string" || typeof payload.pwdDigest !== "string") return null;
    return { id: payload.id, email: payload.email, pwdDigest: payload.pwdDigest };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = getClientIp(req);
  const rl = resetPasswordLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu. Vui lòng thử lại sau 10 phút." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  let body: { action?: string; email?: string; token?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON không hợp lệ." }, { status: 400 });
  }

  // ── Bước 1: Yêu cầu gửi email ────────────────────────────────────────────

  if (body.action === "request") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email không hợp lệ." }, { status: 400 });
    }

    // ANTI-ENUMERATION: Luôn trả 200, dù email có tồn tại hay không
    try {
      try {
        getResetSecret();
      } catch (secErr) {
        console.error("[reset-password] Lỗi cấu hình bí mật phiên:", secErr);
        return NextResponse.json({ error: "Lỗi cấu hình hệ thống xác thực." }, { status: 500 });
      }

      const customer = await prisma.customer.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, emailVerifiedAt: true, passwordHash: true },
      });

      if (customer?.passwordHash) {
        // Tạo token và gửi email (cho phép đặt lại mật khẩu kể cả khi chưa kịp xác minh email)
        const token = createResetToken(customer.id, customer.email, customer.passwordHash);
        const resetUrl = `${getBaseUrl()}/reset-password?token=${token}`;

        // Gọi mailer — không throw nếu lỗi để giữ anti-enumeration
        try {
          const { sendPasswordResetEmail } = await import("@/lib/mailer");
          await sendPasswordResetEmail({
            to: customer.email,
            name: customer.name,
            resetUrl,
          });
        } catch (mailErr) {
          console.error("[reset-password] Gửi email lỗi:", mailErr);
          // Không throw — vẫn trả 200
        }
      }
    } catch (err) {
      console.error("[reset-password request] DB error:", err);
      // Không throw — giữ nguyên anti-enumeration response
    }

    return NextResponse.json({
      success: true,
      message: "Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu trong vài phút.",
    });
  }

  // ── Bước 2: Đặt lại mật khẩu ─────────────────────────────────────────────

  if (body.action === "reset") {
    const { token, newPassword } = body;

    if (typeof token !== "string" || !token) {
      return NextResponse.json({ error: "Token không hợp lệ." }, { status: 400 });
    }
    if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 256) {
      return NextResponse.json(
        { error: "Mật khẩu mới phải có ít nhất 8 ký tự." },
        { status: 400 }
      );
    }

    try {
      getResetSecret();
    } catch (secErr) {
      console.error("[reset-password] Lỗi cấu hình bí mật phiên:", secErr);
      return NextResponse.json({ error: "Lỗi cấu hình hệ thống xác thực." }, { status: 500 });
    }

    const parsed = verifyResetToken(token);
    if (!parsed) {
      return NextResponse.json(
        { error: "Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn (1 giờ). Vui lòng yêu cầu lại." },
        { status: 400 }
      );
    }

    try {
      // Kiểm tra customer vẫn tồn tại và email khớp
      const customer = await prisma.customer.findUnique({
        where: { id: parsed.id },
        select: { id: true, email: true, passwordHash: true },
      });

      if (!customer || customer.email.toLowerCase() !== parsed.email) {
        return NextResponse.json({ error: "Link đặt lại mật khẩu không hợp lệ." }, { status: 400 });
      }

      const currentDigest = crypto.createHash("sha256").update(customer.passwordHash).digest("hex").slice(0, 16);
      if (parsed.pwdDigest !== currentDigest) {
        return NextResponse.json(
          { error: "Link đặt lại mật khẩu này đã được sử dụng. Vui lòng yêu cầu link mới." },
          { status: 400 }
        );
      }

      // Hash mật khẩu mới bằng scrypt (cùng hàm với register)
      const newPasswordHash = hashCustomerPassword(newPassword);

      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          passwordHash: newPasswordHash,
          emailVerifiedAt: new Date(), // Tự động xác thực email vì người dùng đã chứng minh quyền truy cập hộp thư
        },
      });

      console.log(`[reset-password] Khách hàng ${customer.email} đã đặt lại mật khẩu thành công.`);

      return NextResponse.json({
        success: true,
        message: "Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập lại.",
      });
    } catch (err) {
      console.error("[reset-password reset] Lỗi:", err);
      return NextResponse.json({ error: "Không thể đặt lại mật khẩu. Vui lòng thử lại sau." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Action không hợp lệ. Sử dụng 'request' hoặc 'reset'." }, { status: 400 });
}
```

