import nodemailer from "nodemailer";
import { createCustomerEmailVerificationToken, createGuestOrderAccessToken } from "@/lib/auth-session";
import { deliverLoggedEmail } from "@/features/notifications/email-delivery";
import { resolvePaymentMode } from "@/features/payments/provider";
import { prisma } from "@/lib/prisma";
import { parseOrderItemSource } from "@/features/orders/item-source";

export function getBaseUrl(): string {
  // 1. Ưu tiên APP_URL do người dùng cài đặt
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");

  // 2. NEXT_PUBLIC_APP_URL nếu không phải localhost
  if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }

  // 3. Môi trường Production / Vercel: Dùng trực tiếp domain chính thức công khai
  // TUYỆT ĐỐI KHÔNG dùng process.env.VERCEL_URL vì đây là URL preview deployment nội bộ,
  // Vercel sẽ tự động bật Deployment Protection và bắt người dùng phải đăng nhập tài khoản Vercel!
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return "https://chill-banana.vercel.app";
  }

  // 4. Môi trường Local development
  return "http://localhost:3000";
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]!);
}

function buildGuestOrderTrackingUrl(order: { orderCode: string; customerEmail?: string | null }): string {
  const code = encodeURIComponent(order.orderCode);
  const token = order.customerEmail
    ? `&access=${encodeURIComponent(createGuestOrderAccessToken(order.orderCode, order.customerEmail))}`
    : "";
  return `${getBaseUrl()}/tracking?orderCode=${code}${token}`;
}

export async function sendGuestOrderAccessEmail(order: { id?: string; orderCode: string; customerEmail: string; customerName?: string | null }, logId?: string): Promise<boolean> {
  const trackingUrl = escapeHtml(buildGuestOrderTrackingUrl(order));
  const orderCode = escapeHtml(order.orderCode);
  const customerName = escapeHtml(order.customerName || "Quý khách");
  return deliverLoggedEmail({
    emailType: "guest-order-access",
    orderId: order.id,
    logId,
    to: order.customerEmail,
    subject: `[ChillBanana] Liên kết tra cứu đơn #${orderCode}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1e293b;line-height:1.6"><h2>Tra cứu đơn hàng ChillBanana</h2><p>Xin chào ${customerName},</p><p>Bạn vừa yêu cầu truy cập đơn <strong>#${orderCode}</strong>. Bấm liên kết bên dưới để xem trạng thái đơn trong 7 ngày:</p><p><a href="${trackingUrl}" style="display:inline-block;background:#0f172a;color:#fbbf24;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Mở đơn hàng</a></p><p>Nếu bạn không yêu cầu liên kết này, hãy bỏ qua email.</p></div>`,
  }, getTransporter());
}

// Cấu hình transporter Nodemailer cho ChillBanana
function getTransporter() {
  const host = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");

  // Nếu dùng Gmail
  const isGmail = host.includes("gmail") || user.endsWith("@gmail.com");

  if (isGmail && user && pass) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }

  // Cấu hình SMTP tiêu chuẩn
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo Email Queue — Lưu 50 email gần nhất trong bộ nhớ phục vụ Sandbox Admin
// ─────────────────────────────────────────────────────────────────────────────

export interface SentEmailRecord {
  id: string;
  to: string;
  subject: string;
  html: string;
  type: "ORDER_CREATED" | "PAYMENT_SUCCESS" | "TRACKING_UPDATE" | "VERIFY_EMAIL" | "RESET_PASSWORD" | "PRICE_APPROVED" | "ZALO_NOTIFICATION" | "ADMIN_NEW_ORDER" | "ORDER_ROLLBACK";
  sentAt: string; // ISO string
  isSimulated: boolean; // true nếu chưa cấu hình SMTP thật
}

// Global buffer trên NodeJS globalThis để giữ qua module reloads
const globalEmailStore = globalThis as unknown as { __chillbanana_emails?: SentEmailRecord[] };
if (!globalEmailStore.__chillbanana_emails) {
  globalEmailStore.__chillbanana_emails = [];
}

export function recordSentEmail(record: Omit<SentEmailRecord, "id" | "sentAt">): void {
  // BẢO MẬT: Tuyệt đối không lưu email reset password và email verify chứa link/token bí mật vào demo buffer
  if (record.type === "RESET_PASSWORD" || record.type === "VERIFY_EMAIL") {
    return;
  }
  // BẢO MẬT (P1-05): Tẩy sạch bearer access token khỏi HTML trước khi lưu vào demo memory
  const sanitizedHtml = typeof record.html === "string"
    ? record.html.replace(/(&|\?)access=[^"'&\s]+/g, "$1access=[REDACTED]")
    : record.html;

  const list = globalEmailStore.__chillbanana_emails!;
  const newRecord: SentEmailRecord = {
    ...record,
    html: sanitizedHtml,
    id: `email_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    sentAt: new Date().toISOString(),
  };
  list.unshift(newRecord);
  if (list.length > 50) {
    list.pop();
  }
}

export function getRecentSentEmails(): SentEmailRecord[] {
  return [...(globalEmailStore.__chillbanana_emails || [])];
}

export function clearSentEmails(): void {
  globalEmailStore.__chillbanana_emails = [];
}

export async function sendCustomerEmailVerification(customer: {
  id: string;
  email: string;
  name: string;
}): Promise<{ sent: boolean; verificationUrl: string; token: string }> {
  const token = createCustomerEmailVerificationToken({ id: customer.id, email: customer.email });
  const verificationUrl = `${getBaseUrl()}/api/auth/customer/verify?token=${encodeURIComponent(token)}`;
  const name = escapeHtml(customer.name);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1e293b;line-height:1.6;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
      <div style="background:#0f172a;color:#fbbf24;padding:20px;text-align:center">
        <h2 style="margin:0">🍌 ChillBanana — Xác minh tài khoản</h2>
      </div>
      <div style="padding:24px">
        <p>Xin chào <strong>${name}</strong>,</p>
        <p>Để kích hoạt tài khoản thành viên và tự động kết nối các đơn hàng cũ của bạn (Identity Stitching), vui lòng xác minh địa chỉ email trong vòng 24 giờ:</p>
        <p style="text-align:center;margin:28px 0">
          <a href="${verificationUrl}" style="background:#f59e0b;color:#0f172a;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block">
            ✅ Xác Minh Email & Kích Hoạt Tài Khoản
          </a>
        </p>
        <p style="font-size:12px;color:#64748b">Nếu bạn không tạo tài khoản này, hãy bỏ qua email.</p>
      </div>
    </div>`;

  recordSentEmail({
    to: customer.email,
    subject: "[ChillBanana] Xác minh địa chỉ email",
    html,
    type: "VERIFY_EMAIL",
    isSimulated: !Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
  });

  const sent = await deliverLoggedEmail(
    {
      emailType: "customer-email-verification",
      to: customer.email,
      subject: "[ChillBanana] Xác minh địa chỉ email",
      html,
    },
    getTransporter()
  );

  const isTestEnv = process.env.NODE_ENV === "test" || process.env.VITEST === "true" || process.env.APP_ENV === "test";
  if (!sent && isTestEnv) {
    throw new Error("EMAIL_VERIFICATION_NOT_SENT");
  }

  return { sent: Boolean(sent), verificationUrl, token };
}

/**
 * 1. Email xác nhận tạo đơn hàng mới (Chờ đặt cọc)
 */
export async function sendOrderCreatedEmail(order: any, logId?: string): Promise<boolean> {
  if (!order.customerEmail) {
    console.warn("[Mailer] Đơn hàng không có customerEmail, bỏ qua gửi email.");
    return false;
  }

  const trackingUrl = escapeHtml(buildGuestOrderTrackingUrl(order));
  const orderCode = escapeHtml(String(order.orderCode || ""));
  const customerName = escapeHtml(String(order.customerName || "Quý khách"));
  const productName = escapeHtml(String(order.productName || "Sản phẩm"));
  const isPriceVerified = order.isPriceVerified === true;
  const depositPercent = order.depositPercent === 100 ? 100 : 50;
  const paymentMode = resolvePaymentMode();
  const paymentInstructions = !isPriceVerified
    ? `<div style="background-color:#FFF7ED;border:1px solid #FED7AA;padding:16px;border-radius:12px;margin:20px 0;font-size:13px;color:#7C2D12"><p style="margin:0 0 8px;font-weight:bold">Đơn hàng đang chờ ChillBanana kiểm tra và xác nhận báo giá.</p><p style="margin:4px 0">Vui lòng chưa thanh toán. Khi báo giá được duyệt, trang theo dõi sẽ hiển thị hướng dẫn phù hợp.</p></div>`
    : `<div style="background-color:#FFF8E6;border:1px solid #F4D27D;padding:16px;border-radius:12px;margin:20px 0;font-size:13px;color:#713F12"><p style="margin:0 0 8px;font-weight:bold">Luồng thanh toán hiện chỉ dành cho kiểm thử.</p><p style="margin:4px 0">${paymentMode === "sandbox" ? "VNPAY sandbox" : "Thanh toán mô phỏng"} không thu tiền thật. Không chuyển khoản thật; kết quả thử nghiệm không xác nhận đơn đã thanh toán hay bắt đầu mua hàng.</p></div>`;

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); color: white; padding: 28px; text-align: center;">
        <h1 style="margin: 0; font-size: 26px; color: #FBBF24; font-family: Georgia, serif;">🍌 ChillBanana</h1>
        <p style="margin: 8px 0 0 0; font-size: 14px; color: #94A3B8;">Xác nhận đơn đặt mua hộ hàng nội địa Nhật Bản</p>
      </div>
      
      <div style="padding: 32px 28px; color: #1E293B; line-height: 1.6;">
        <p style="font-size: 15px;">Kính chào <strong>${customerName}</strong>,</p>
        <p style="font-size: 14px; color: #475569;">ChillBanana đã tiếp nhận yêu cầu mua hộ hàng Nhật của Quý khách với thông tin chi tiết:</p>
        
        <div style="background-color: #FEFCE8; border-left: 4px solid #F59E0B; padding: 18px; margin: 20px 0; border-radius: 10px;">
          <p style="margin: 6px 0; font-size: 14px;"><strong>Mã đơn hàng:</strong> <span style="color: #B45309; font-weight: bold; font-size: 16px; font-family: monospace;">${orderCode}</span></p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Sản phẩm:</strong> ${productName}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Giá gốc tại Nhật:</strong> ${order.priceJpy?.toLocaleString()} ¥</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Tổng giá trị đơn (VND):</strong> <strong>${order.totalVnd?.toLocaleString("vi-VN")} đ</strong></p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>${isPriceVerified ? `Số tiền cần thanh toán (${depositPercent}%):` : `Mức thanh toán tạm tính (${depositPercent}%):`}</strong> <span style="color: #D97706; font-weight: bold; font-size: 16px;">${order.depositAmountVnd?.toLocaleString("vi-VN")} đ</span></p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Trạng thái:</strong> <span style="color: #D97706; font-weight: 600;">${isPriceVerified ? "Chờ thanh toán" : "Chờ xác nhận báo giá"}</span></p>
        </div>
        ${paymentInstructions}
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${trackingUrl}" style="background-color: #0F172A; color: #FBBF24; padding: 14px 32px; text-decoration: none; border-radius: 14px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 10px rgba(15, 23, 42, 0.2);">
            🔍 Tra Cứu Tiến Độ Đơn Hàng (7 Bước)
          </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94A3B8; text-align: center; margin: 0;">
          Trân trọng cảm ơn Quý khách đã tin tưởng ChillBanana!<br/>
          Hotline hỗ trợ: 1900 6868 | Văn phòng: Tokyo - Hà Nội - TP.HCM
        </p>
      </div>
    </div>
  `;

  const subject = `[ChillBanana] Xác nhận đơn mua hộ #${order.orderCode} - ${String(order.productName || "Sản phẩm").slice(0, 100)}`;

  recordSentEmail({
    to: order.customerEmail,
    subject,
    html,
    type: "ORDER_CREATED",
    isSimulated: !Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
  });

  return deliverLoggedEmail({
    emailType: "order-created",
    orderId: order.id,
    logId,
    to: order.customerEmail,
    subject,
    html,
  }, getTransporter());
}

/**
 * 1b. Email thông báo đơn hàng mới cho Ban Quản Trị
 */
export async function sendAdminNewOrderEmail(order: any, logId?: string): Promise<boolean> {
  const adminEmailsRaw = (process.env.ADMIN_NOTIFY_EMAIL || "").trim();
  const adminEmails = adminEmailsRaw
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && e.includes("@"));

  if (adminEmails.length === 0) {
    return false;
  }

  // Dùng EmailLog tránh gửi trùng cho cùng một đơn
  if (!logId && order.id) {
    const existing = await prisma.emailLog.findFirst({
      where: {
        orderId: order.id,
        emailType: "admin-new-order",
        status: { in: ["SENT", "SIMULATED", "PENDING"] },
      },
    });
    if (existing) {
      return false;
    }
  }

  const orderCode = escapeHtml(String(order.orderCode || ""));
  const isPriceVerified = order.isPriceVerified === true;
  const subject = isPriceVerified
    ? `[Đơn mới] ${order.orderCode}`
    : `[CẦN DUYỆT GIÁ] Đơn ${order.orderCode}`;

  const orderCreatedAt = order.createdAt ? new Date(order.createdAt) : new Date();
  const createdTimeVn = escapeHtml(
    new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(orderCreatedAt)
  );

  const customerName = escapeHtml(String(order.customerName || ""));
  const customerPhone = escapeHtml(String(order.customerPhone || ""));
  const customerEmail = escapeHtml(String(order.customerEmail || ""));
  const customerAddress = escapeHtml(String(order.customerAddress || ""));
  const customerNote = escapeHtml(String(order.customerNote || "Không có"));
  const totalVndStr = escapeHtml(Number(order.totalVnd || 0).toLocaleString("vi-VN") + " đ");

  // Lấy danh sách sản phẩm
  let orderItems: any[] = Array.isArray(order.orderItems) && order.orderItems.length > 0 ? order.orderItems : [];
  if (orderItems.length === 0 && order.id) {
    try {
      const dbOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: {
          orderItems: {
            include: {
              product: {
                select: { name: true, imageUrl: true, originalStore: true },
              },
            },
          },
        },
      });
      if (dbOrder?.orderItems?.length) {
        orderItems = dbOrder.orderItems;
      }
    } catch {
      // Bỏ qua lỗi query phụ
    }
  }

  if (orderItems.length === 0) {
    orderItems = [
      {
        productName: order.productName,
        quantity: 1,
        priceJpy: order.priceJpy,
        weightKg: order.weightKg,
        itemType: "EXTERNAL",
      },
    ];
  }

  const tableRows = orderItems.map((item: any) => {
    const parsed = parseOrderItemSource(item, order);
    const cleanName = escapeHtml(parsed.cleanName);
    const quantity = Number(item.quantity || 1);
    const priceJpyStr = Number(item.priceJpy || 0).toLocaleString() + " ¥";
    const weightStr = item.weightKg ? `${escapeHtml(String(item.weightKg))} kg` : "Chưa cân";

    let sourceCell = "";
    let linkCell = "";
    if (parsed.itemType === "CATALOG") {
      sourceCell = `Catalog (${escapeHtml(parsed.originalStore || "Kho nội địa")})`;
      linkCell = `<span style="color:#64748b;font-style:italic">Hàng Catalog</span>`;
    } else {
      sourceCell = escapeHtml(parsed.marketplace);
      if (parsed.url && parsed.url.startsWith("https://")) {
        const safeUrl = escapeHtml(parsed.url);
        linkCell = `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;font-weight:600">Xem link ↗</a>`;
      } else {
        linkCell = `<span style="color:#dc2626;font-style:italic">Không có link</span>`;
      }
    }

    return `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 12px;font-size:13px;color:#1e293b;">${cleanName}</td>
        <td style="padding:10px 12px;font-size:13px;text-align:center;color:#1e293b;">${quantity}</td>
        <td style="padding:10px 12px;font-size:13px;text-align:right;color:#1e293b;font-family:monospace;">${priceJpyStr}</td>
        <td style="padding:10px 12px;font-size:13px;text-align:center;color:#64748b;">${weightStr}</td>
        <td style="padding:10px 12px;font-size:13px;color:#1e293b;"><span style="background:#f1f5f9;padding:2px 8px;border-radius:6px;font-size:12px;">${sourceCell}</span></td>
        <td style="padding:10px 12px;font-size:13px;text-align:center;">${linkCell}</td>
      </tr>`;
  }).join("");

  const adminUrl = `${getBaseUrl()}/admin`;

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:650px;margin:0 auto;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;background:#ffffff;">
      <div style="background:#0f172a;color:#ffffff;padding:24px 28px;text-align:center;">
        <h2 style="margin:0;font-size:22px;color:#fbbf24;">🍌 Thông Báo Đơn Hàng Mới Cho Quản Trị</h2>
        <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">${isPriceVerified ? "Đơn hàng mới đã được xác minh giá" : "Đơn hàng ngoài catalog — CẦN DUYỆT GIÁ"}</p>
      </div>

      <div style="padding:24px 28px;color:#1e293b;line-height:1.6;">
        <div style="background:${isPriceVerified ? "#ecfdf5" : "#fff7ed"};border-left:4px solid ${isPriceVerified ? "#10b981" : "#f59e0b"};padding:14px 18px;margin-bottom:20px;border-radius:8px;">
          <p style="margin:4px 0;font-size:14px;"><strong>Mã đơn hàng:</strong> <span style="font-family:monospace;font-weight:bold;color:#b45309;font-size:15px;">#${orderCode}</span></p>
          <p style="margin:4px 0;font-size:14px;"><strong>Thời gian tạo:</strong> ${createdTimeVn} (Giờ Việt Nam)</p>
          <p style="margin:4px 0;font-size:14px;"><strong>Tổng tạm tính:</strong> <strong style="color:#b45309;font-size:16px;">${totalVndStr}</strong></p>
        </div>

        <h3 style="font-size:15px;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin:20px 0 12px;">👤 Thông tin khách hàng</h3>
        <p style="margin:4px 0;font-size:14px;"><strong>Họ và tên:</strong> ${customerName}</p>
        <p style="margin:4px 0;font-size:14px;"><strong>Số điện thoại:</strong> ${customerPhone}</p>
        <p style="margin:4px 0;font-size:14px;"><strong>Email:</strong> ${customerEmail}</p>
        <p style="margin:4px 0;font-size:14px;"><strong>Địa chỉ nhận hàng:</strong> ${customerAddress}</p>
        <p style="margin:4px 0;font-size:14px;"><strong>Ghi chú của khách:</strong> <em style="color:#475569;">${customerNote}</em></p>

        <h3 style="font-size:15px;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin:24px 0 12px;">📦 Danh sách sản phẩm</h3>
        <table style="width:100%;border-collapse:collapse;margin:12px 0 20px;">
          <thead>
            <tr style="background:#f8fafc;border-bottom:2px solid #cbd5e1;text-align:left;">
              <th style="padding:8px 12px;font-size:12px;color:#475569;">Tên sản phẩm</th>
              <th style="padding:8px 12px;font-size:12px;color:#475569;text-align:center;">SL</th>
              <th style="padding:8px 12px;font-size:12px;color:#475569;text-align:right;">Giá gốc</th>
              <th style="padding:8px 12px;font-size:12px;color:#475569;text-align:center;">Cân nặng</th>
              <th style="padding:8px 12px;font-size:12px;color:#475569;">Nguồn / Sàn</th>
              <th style="padding:8px 12px;font-size:12px;color:#475569;text-align:center;">Link</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div style="text-align:center;margin:30px 0 10px;">
          <a href="${escapeHtml(adminUrl)}" target="_blank" rel="noopener noreferrer" style="background:#0f172a;color:#fbbf24;padding:12px 28px;text-decoration:none;border-radius:10px;font-weight:bold;font-size:14px;display:inline-block;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
            Mở bảng duyệt giá ↗
          </a>
        </div>
      </div>
    </div>`;

  const recipients = adminEmails.join(", ");

  recordSentEmail({
    to: recipients,
    subject,
    html,
    type: "ADMIN_NEW_ORDER",
    isSimulated: !Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
  });

  return deliverLoggedEmail({
    emailType: "admin-new-order",
    orderId: order.id,
    logId,
    to: recipients,
    subject,
    html,
  }, getTransporter());
}


/** Gửi báo giá đã được admin xác nhận; trả false khi không thể gửi thật. */
export async function sendPriceApprovedEmail(order: any, logId?: string): Promise<boolean> {
  if (!order.customerEmail) {
    console.warn("[Mailer] Không gửi email duyệt giá: đơn không có email khách hàng.");
    return false;
  }

  const trackingUrl = escapeHtml(buildGuestOrderTrackingUrl(order));
  const money = (value: number) => Number(value || 0).toLocaleString("vi-VN");
  const customerName = escapeHtml(String(order.customerName || "Quý khách"));
  const productName = escapeHtml(String(order.productName || "Sản phẩm"));
  const orderCode = escapeHtml(String(order.orderCode));
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;line-height:1.6">
      <div style="background:#0f172a;color:#fbbf24;padding:24px;text-align:center;border-radius:16px 16px 0 0">
        <h1 style="margin:0">🍌 ChillBanana</h1><p style="margin:6px 0 0;color:#cbd5e1">Báo giá đơn hàng đã được xác nhận</p>
      </div>
      <div style="padding:24px;border:1px solid #e2e8f0;border-radius:0 0 16px 16px">
        <p>Xin chào <strong>${customerName}</strong>,</p>
        <p>ChillBanana đã kiểm tra và xác nhận báo giá cho yêu cầu mua hộ của bạn.</p>
        <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:16px;margin:20px 0">
          <p><strong>Mã đơn:</strong> #${orderCode}</p>
          <p><strong>Sản phẩm:</strong> ${productName}</p>
          <p><strong>Giá tại Nhật:</strong> ${money(order.priceJpy)} ¥</p>
          <p><strong>Quy đổi sản phẩm:</strong> ${money(order.productPriceVnd)} đ</p>
          <p><strong>Phí dịch vụ:</strong> ${money(order.serviceFeeVnd)} đ</p>
          <p><strong>Phí vận chuyển tạm tính:</strong> ${money(order.shippingFeeVnd)} đ${order.weightKg ? ` (${escapeHtml(String(order.weightKg))} kg)` : " (chưa cân)"}</p>
          <p><strong>Tổng tạm tính:</strong> ${money(order.totalVnd)} đ</p>
          <p style="font-size:18px;color:#b45309"><strong>${order.depositPercent === 100 ? "Số tiền thanh toán (100%)" : "Tiền cọc cần thanh toán (50%)"}:</strong> ${money(order.depositAmountVnd)} đ</p>
        </div>
        <p>Vui lòng kiểm tra lại thông tin và tiến hành đặt cọc trên trang theo dõi đơn hàng.</p>
        <p style="text-align:center;margin:28px 0"><a href="${trackingUrl}" style="background:#0f172a;color:#fbbf24;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Xem báo giá và đơn hàng</a></p>
        <p style="font-size:12px;color:#64748b">Nếu bạn không tạo yêu cầu này, vui lòng bỏ qua email và liên hệ bộ phận hỗ trợ.</p>
      </div>
    </div>`;

  const subject = `[ChillBanana] Báo giá đơn #${order.orderCode} đã được xác nhận`;

  recordSentEmail({
    to: order.customerEmail,
    subject,
    html,
    type: "PRICE_APPROVED",
    isSimulated: !Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
  });

  return deliverLoggedEmail({
    emailType: "price-approved",
    orderId: order.id,
    logId,
    to: order.customerEmail,
    subject,
    html,
  }, getTransporter());
}

/**
 * 2. Email xác nhận thanh toán thành công (VNPAY hoặc nhân viên xác nhận chuyển khoản)
 */
export async function sendPaymentSuccessEmail(order: any, logId?: string): Promise<boolean> {
  if (!order.customerEmail) {
    console.warn("[Mailer] Đơn hàng không có customerEmail, bỏ qua gửi email thanh toán.");
    return false;
  }

  const trackingUrl = escapeHtml(buildGuestOrderTrackingUrl(order));
  const customerName = escapeHtml(String(order.customerName || "Quý khách"));
  const productName = escapeHtml(String(order.productName || "Sản phẩm"));
  const orderCode = escapeHtml(String(order.orderCode || ""));
  const isFullPayment = order.paymentStatus === "PAID_100";
  const paymentTitle = isFullPayment ? "Thanh Toán 100% Thành Công!" : "Đặt Cọc 50% Thành Công!";
  const paymentMethod = order.paymentMethod?.startsWith("VNPAY") ? "Cổng thanh toán VNPAY" : "Chuyển khoản ngân hàng đã được xác nhận";
  const isPurchasing = order.status === "PURCHASING_JP";

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="background: linear-gradient(135deg, #065F46 0%, #0F172A 100%); color: white; padding: 28px; text-align: center;">
        <h1 style="margin: 0; font-size: 26px; color: #34D399; font-family: Georgia, serif;">✅ ${paymentTitle}</h1>
        <p style="margin: 8px 0 0 0; font-size: 14px; color: #A7F3D0;">ChillBanana đã nhận được thanh toán cho đơn #${orderCode}</p>
      </div>
      
      <div style="padding: 32px 28px; color: #1E293B; line-height: 1.6;">
        <p style="font-size: 15px;">Kính chào <strong>${customerName}</strong>,</p>
        <p style="font-size: 14px; color: #475569;">Giao dịch thanh toán của Quý khách đã được xác nhận thành công:</p>
        
        <div style="background-color: #ECFDF5; border-left: 4px solid #10B981; padding: 18px; margin: 20px 0; border-radius: 10px;">
          <p style="margin: 6px 0; font-size: 14px;"><strong>Mã đơn hàng:</strong> <span style="color: #065F46; font-weight: bold; font-size: 16px; font-family: monospace;">${orderCode}</span></p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Sản phẩm:</strong> ${productName}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Số tiền đã nhận:</strong> <span style="color: #059669; font-weight: bold; font-size: 16px;">${order.depositAmountVnd?.toLocaleString("vi-VN")} đ</span></p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Phương thức:</strong> ${paymentMethod}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Tiến độ hiện tại:</strong> <span style="background-color: #10B981; color: white; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: bold;">${isPurchasing ? "Đang mua hàng tại Tokyo" : "Chờ nhân viên bắt đầu xử lý"}</span></p>
        </div>
        
        <p style="font-size: 14px; color: #334155;">${isPurchasing ? "Nhân viên ChillBanana đang tiến hành đặt hàng tại Nhật. Quý khách có thể theo dõi tiến độ qua đường link dưới đây:" : "Nhân viên ChillBanana sẽ kiểm tra giao dịch và cập nhật bước mua hàng trên trang theo dõi đơn."}</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${trackingUrl}" style="background-color: #059669; color: white; padding: 14px 32px; text-decoration: none; border-radius: 14px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 10px rgba(5, 150, 105, 0.25);">
            📦 Xem Tiến Độ Mua Hàng Tại Nhật
          </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94A3B8; text-align: center; margin: 0;">
          Cảm ơn Quý khách! Đội ngũ ChillBanana luôn nỗ lực giao hàng nhanh nhất.<br/>
          Hotline hỗ trợ: 1900 6868
        </p>
      </div>
    </div>
  `;

  const subject = `[ChillBanana] ✅ Xác nhận thanh toán thành công đơn hàng #${order.orderCode}`;

  recordSentEmail({
    to: order.customerEmail,
    subject,
    html,
    type: "PAYMENT_SUCCESS",
    isSimulated: !Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
  });

  return deliverLoggedEmail({
    emailType: "payment-success",
    orderId: order.id,
    logId,
    to: order.customerEmail,
    subject,
    html,
  }, getTransporter());
}


/**
 * 3. Email cập nhật tiến độ vận đơn (7 Bước) hoặc Hủy đơn
 */
export async function sendOrderStatusUpdateEmail(order: any, newStatusTitle: string, description: string, logId?: string): Promise<boolean> {
  if (!order.customerEmail) {
    console.warn("[Mailer] Đơn hàng không có customerEmail, bỏ qua gửi email cập nhật.");
    return false;
  }

  const trackingUrl = escapeHtml(buildGuestOrderTrackingUrl(order));
  const safeOrderCode = escapeHtml(String(order.orderCode || ""));
  const safeCustomerName = escapeHtml(String(order.customerName || "Quý khách"));
  const safeTitle = escapeHtml(String(newStatusTitle || ""));
  const safeDescription = escapeHtml(String(description || ""));
  const safeWeight = order.weightKg ? escapeHtml(String(order.weightKg)) : "";

  const isCancelled = order.status === "CANCELLED";
  const headerBg = isCancelled
    ? "linear-gradient(135deg, #881337 0%, #0F172A 100%)"
    : "linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)";
  const accentColor = isCancelled ? "#F43F5E" : "#38BDF8";

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="background: ${headerBg}; color: white; padding: 28px; text-align: center;">
        <h1 style="margin: 0; font-size: 26px; color: ${accentColor}; font-family: Georgia, serif;">🍌 ChillBanana</h1>
        <p style="margin: 8px 0 0 0; font-size: 14px; color: #E2E8F0;">Cập nhật tiến độ đơn hàng #${safeOrderCode}</p>
      </div>
      
      <div style="padding: 32px 28px; color: #1E293B; line-height: 1.6;">
        <p style="font-size: 15px;">Kính chào <strong>${safeCustomerName}</strong>,</p>
        <p style="font-size: 14px; color: #475569;">Đơn hàng <strong>#${safeOrderCode}</strong> của Quý khách vừa có cập nhật trạng thái mới nhất:</p>
        
        <div style="background-color: ${isCancelled ? "#FFF1F2" : "#F0F9FF"}; border-left: 4px solid ${isCancelled ? "#E11D48" : "#0284C7"}; padding: 18px; margin: 20px 0; border-radius: 10px;">
          <p style="margin: 0; font-size: 16px; font-weight: bold; color: ${isCancelled ? "#9F1239" : "#075985"};">${safeTitle}</p>
          <p style="margin: 8px 0 0 0; font-size: 13px; color: ${isCancelled ? "#BE123C" : "#0369A1"};">${safeDescription}</p>
          ${safeWeight ? `<p style="margin: 6px 0 0 0; font-size: 12px; color: #475569;"><strong>Trọng lượng thực tế:</strong> ${safeWeight} kg</p>` : ""}
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${trackingUrl}" style="background-color: #0F172A; color: ${accentColor}; padding: 14px 32px; text-decoration: none; border-radius: 14px; font-weight: bold; font-size: 14px; display: inline-block;">
            🔍 Xem Chi Tiết Hành Trình 7 Bước
          </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94A3B8; text-align: center; margin: 0;">
          Trân trọng,<br/>Đội ngũ vận hành ChillBanana Tokyo - Hà Nội - TP.HCM
        </p>
      </div>
    </div>
  `;

  const subject = `[ChillBanana] Cập nhật đơn hàng #${safeOrderCode}: ${safeTitle}`;

  recordSentEmail({
    to: order.customerEmail,
    subject,
    html,
    type: "TRACKING_UPDATE",
    isSimulated: !Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
  });

  return deliverLoggedEmail({
    emailType: "order-status-update",
    orderId: order.id,
    payload: { title: newStatusTitle.slice(0, 100) },
    logId,
    to: order.customerEmail,
    subject: `[ChillBanana] Cập nhật đơn hàng #${safeOrderCode}: ${safeTitle}`,
    html,
  }, getTransporter());
}

/**
 * 3b. Email thông báo hoàn tác / điều chỉnh trạng thái đơn hàng gửi khách
 */
export async function sendOrderRollbackEmail(
  order: any,
  params: {
    fromLabel: string;
    toLabel: string;
    reason: string;
    isFromCompleted?: boolean;
  },
  logId?: string
): Promise<boolean> {
  if (!order.customerEmail) {
    return false;
  }

  const orderCode = escapeHtml(String(order.orderCode || ""));
  const customerName = escapeHtml(String(order.customerName || "Quý khách"));
  const fromLabel = escapeHtml(params.fromLabel);
  const toLabel = escapeHtml(params.toLabel);
  const reason = escapeHtml(params.reason);
  const isFromCompleted = Boolean(params.isFromCompleted);

  const subject = isFromCompleted
    ? `[ChillBanana] Điều chỉnh: đơn ${order.orderCode} CHƯA hoàn tất`
    : `[ChillBanana] Thông báo điều chỉnh trạng thái đơn hàng #${order.orderCode}`;

  const trackingUrl = escapeHtml(buildGuestOrderTrackingUrl(order));

  const explanation = isFromCompleted
    ? `<div style="background-color:#FFF7ED;border-left:4px solid #F59E0B;padding:16px;margin:20px 0;border-radius:8px;">
        <p style="margin:0 0 6px;font-weight:bold;color:#B45309;">⚠️ Đính chính thông tin hoàn tất đơn hàng</p>
        <p style="margin:0;font-size:14px;color:#78350F;">
          ChillBanana xin chân thành cáo lỗi cùng Quý khách: Email thông báo hoàn tất đơn hàng gửi trước đó là <strong>nhầm lẫn trong khâu cập nhật vận hành</strong>. Đơn hàng của Quý khách <strong>hiện tại vẫn đang trong quá trình xử lý/giao hàng</strong> (trạng thái: <strong>${toLabel}</strong>).
        </p>
      </div>`
    : `<div style="background-color:#F8FAFC;border-left:4px solid #64748B;padding:16px;margin:20px 0;border-radius:8px;">
        <p style="margin:0 0 6px;font-weight:bold;color:#334155;">Thông tin điều chỉnh tiến độ</p>
        <p style="margin:0;font-size:14px;color:#475569;">
          Do cập nhật nhầm trạng thái trong quá trình vận hành, chúng tôi xin phép điều chỉnh lại trạng thái đơn hàng từ <strong>${fromLabel}</strong> về <strong>${toLabel}</strong>.
        </p>
      </div>`;

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;background:#ffffff;">
      <div style="background:#0f172a;color:#ffffff;padding:24px 28px;text-align:center;">
        <h2 style="margin:0;font-size:22px;color:#fbbf24;">🍌 ChillBanana</h2>
        <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">Thông báo điều chỉnh tiến độ đơn hàng</p>
      </div>

      <div style="padding:28px;color:#1e293b;line-height:1.6;">
        <p style="font-size:15px;">Kính chào <strong>${customerName}</strong>,</p>
        <p style="font-size:14px;color:#334155;">
          ChillBanana rất tiếc phải thông báo và xin chân thành cáo lỗi với Quý khách về sự bất tiện này:
        </p>

        ${explanation}

        <div style="background-color:#F1F5F9;padding:16px;border-radius:10px;margin:20px 0;font-size:14px;">
          <p style="margin:4px 0;"><strong>Mã đơn hàng:</strong> <span style="font-family:monospace;font-weight:bold;color:#0F172A;">#${orderCode}</span></p>
          <p style="margin:4px 0;"><strong>Trạng thái hiện tại:</strong> <span style="color:#2563EB;font-weight:bold;">${toLabel}</span></p>
          <p style="margin:4px 0;"><strong>Lý do điều chỉnh:</strong> ${reason}</p>
        </div>

        <p style="font-size:14px;color:#475569;">
          Đội ngũ ChillBanana đang tiếp tục theo dõi sát sao kiện hàng và sẽ cập nhật tiến độ chính xác nhất tới Quý khách ngay khi có thông tin mới.
        </p>

        <div style="text-align:center;margin:30px 0;">
          <a href="${trackingUrl}" target="_blank" rel="noopener noreferrer" style="background:#0f172a;color:#fbbf24;padding:12px 28px;text-decoration:none;border-radius:10px;font-weight:bold;font-size:14px;display:inline-block;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
            🔍 Tra cứu tiến độ đơn hàng
          </a>
        </div>

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
        <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0;">
          Một lần nữa, ChillBanana thành thật xin lỗi Quý khách về sự bất tiện này.<br/>
          Hotline hỗ trợ: 1900 6868 | Email: support@chillbanana.vn
        </p>
      </div>
    </div>`;

  recordSentEmail({
    to: order.customerEmail,
    subject,
    html,
    type: "ORDER_ROLLBACK",
    isSimulated: !Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
  });

  return deliverLoggedEmail({
    emailType: "order-rollback",
    orderId: order.id,
    payload: {
      fromLabel: params.fromLabel,
      toLabel: params.toLabel,
      reason: params.reason,
      isFromCompleted: Boolean(isFromCompleted),
    },
    logId,
    to: order.customerEmail,
    subject,
    html,
  }, getTransporter());
}

/** Retry a failed transactional email by re-rendering its template from the current order snapshot. */
export async function retryEmailLog(logId: string): Promise<boolean> {
  const log = await prisma.emailLog.findUnique({ where: { id: logId }, include: { order: true } });
  if (!log || !log.order || log.status !== "FAILED") return false;
  const payload = log.payload && typeof log.payload === "object" && !Array.isArray(log.payload)
    ? log.payload as Record<string, unknown>
    : {};
  switch (log.emailType) {
    case "guest-order-access":
      return sendGuestOrderAccessEmail(log.order, log.id);
    case "order-created":
      return sendOrderCreatedEmail(log.order, log.id);
    case "admin-new-order":
      return sendAdminNewOrderEmail(log.order, log.id);
    case "price-approved":
      return sendPriceApprovedEmail(log.order, log.id);
    case "payment-success":
      return sendPaymentSuccessEmail(log.order, log.id);
    case "order-status-update":
      return sendOrderStatusUpdateEmail(log.order, String(payload.title || "Cập nhật trạng thái"), "Đơn hàng đã có cập nhật mới.", log.id);
    case "order-rollback":
      return sendOrderRollbackEmail(
        log.order,
        {
          fromLabel: String(payload.fromLabel || "Trước điều chỉnh"),
          toLabel: String(payload.toLabel || "Sau điều chỉnh"),
          reason: String(payload.reason || "Điều chỉnh vận hành"),
          isFromCompleted: Boolean(payload.isFromCompleted),
        },
        log.id
      );
    default:
      return false;
  }
}

/**
 * 4. Zalo OA — Gửi tin nhắn thông báo cho khách qua Zalo Official Account
 *
 * Cần cấu hình:
 *   ZALO_OA_ACCESS_TOKEN — Access token của Zalo OA (lấy từ developers.zalo.me)
 *
 * Lưu ý: Zalo OA chỉ gửi được cho user đã Follow OA và đồng ý nhận tin.
 * Nếu chưa có token → log giả lập, không crash.
 */
export async function sendZaloTrackingNotification(
  zaloUserId: string,
  orderCode: string,
  statusTitle: string,
  description: string
): Promise<void> {
  const token = process.env.ZALO_OA_ACCESS_TOKEN;

  const safeZaloUserId = escapeHtml(String(zaloUserId));
  const safeOrderCode = escapeHtml(String(orderCode));
  const safeStatusTitle = escapeHtml(String(statusTitle));
  const safeDesc = escapeHtml(String(description));

  // Luôn ghi nhận vào buffer để Admin kiểm tra xem thông báo Zalo trông ra sao
  recordSentEmail({
    to: `Zalo ID: ${safeZaloUserId}`,
    subject: `[Zalo OA] Cập nhật đơn hàng #${safeOrderCode}: ${safeStatusTitle}`,
    html: `
      <div style="font-family:sans-serif;padding:16px;background:#f0f7ff;border-radius:12px;border:1px solid #bae0ff">
        <h3 style="color:#0050b3;margin-top:0">🍌 Thông báo qua Zalo OA</h3>
        <p><strong>Người nhận (Zalo User ID):</strong> ${safeZaloUserId}</p>
        <p><strong>Đơn hàng:</strong> #${safeOrderCode}</p>
        <p><strong>Trạng thái:</strong> ${safeStatusTitle}</p>
        <p style="background:#fff;padding:12px;border-radius:8px;border:1px dashed #91caff">${safeDesc}</p>
        <p style="color:#888;font-size:12px;margin-bottom:0">Đường dẫn: https://chill-banana.vercel.app/tracking?orderCode=${safeOrderCode}</p>
      </div>`,
    type: "ZALO_NOTIFICATION",
    isSimulated: !token,
  });

  if (!token) {
    console.log(
      `[ZaloOA Sim] ℹ️ ZALO_OA_ACCESS_TOKEN chưa cấu hình. Đã ghi nhận mô phỏng Zalo cho ${zaloUserId} | ${orderCode}: ${statusTitle}`
    );
    return;
  }

  // Zalo OA v3 Message API — gửi text template
  const message = {
    recipient: { user_id: zaloUserId },
    message: {
      text: `🍌 *ChillBanana* — Cập nhật đơn hàng #${orderCode}\n\n📦 ${statusTitle}\n${description}\n\nXem chi tiết: https://chill-banana.vercel.app/tracking?orderCode=${orderCode}`,
    },
  };

  try {
    const res = await fetch("https://openapi.zalo.me/v3.0/oa/message/cs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: token,
      },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.warn(`[ZaloOA] ⚠️ Lỗi gửi tin Zalo (${res.status}): ${errBody}`);
    } else {
      const data = await res.json();
      if (data.error === 0) {
        console.log(`[ZaloOA] ✅ Đã gửi tin Zalo cho userId=${zaloUserId} | ${orderCode}: ${statusTitle}`);
      } else {
        console.warn(`[ZaloOA] ⚠️ Zalo OA trả lỗi ${data.error}: ${data.message}`);
      }
    }
  } catch (err) {
    console.warn("[ZaloOA] ⚠️ Không thể gửi tin Zalo:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gửi email đặt lại mật khẩu
// ─────────────────────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
}: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<void> {
  const transporter = getTransporter();
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(resetUrl);
  const hasAuth = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

  const html = `
  <!DOCTYPE html>
  <html lang="vi">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
  <body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px;">
    <table style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
      <tr>
        <td style="background:linear-gradient(135deg,#FFD700 0%,#FFA500 100%);padding:32px 40px;text-align:center;">
          <h1 style="color:#1a1a1a;font-size:28px;margin:0;font-weight:800;">🍌 ChillBanana</h1>
          <p style="color:#333;margin:8px 0 0;font-size:14px;">Mua hàng Nhật Bản — Giao tận tay Việt Nam</p>
        </td>
      </tr>
      <tr>
        <td style="padding:40px;">
          <h2 style="color:#1a1a1a;font-size:22px;margin:0 0 16px;">Đặt lại mật khẩu</h2>
          <p style="color:#444;line-height:1.6;margin:0 0 24px;">
            Xin chào <strong>${safeName}</strong>,<br>
            Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản ChillBanana của bạn.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${safeUrl}"
               style="background:linear-gradient(135deg,#FFD700,#FFA500);color:#1a1a1a;padding:16px 36px;
                      border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block;">
              🔑 Đặt lại mật khẩu
            </a>
          </div>
          <p style="color:#888;font-size:13px;line-height:1.5;border-top:1px solid #eee;padding-top:16px;margin-top:24px;">
            ⏰ Link có hiệu lực trong <strong>1 giờ</strong>.<br>
            Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này — tài khoản của bạn vẫn an toàn.<br><br>
            Hoặc copy link sau vào trình duyệt:<br>
            <span style="word-break:break-all;color:#FFA500;">${safeUrl}</span>
          </p>
        </td>
      </tr>
      <tr>
        <td style="background:#f9f9f9;padding:20px 40px;text-align:center;">
          <p style="color:#bbb;font-size:12px;margin:0;">
            © 2026 ChillBanana.vn — Đây là email tự động, vui lòng không trả lời.
          </p>
        </td>
      </tr>
    </table>
  </body>
  </html>`;

  recordSentEmail({
    to,
    subject: "🔑 Đặt lại mật khẩu ChillBanana của bạn",
    html,
    type: "RESET_PASSWORD",
    isSimulated: !hasAuth,
  });


  await deliverLoggedEmail({
    emailType: "password-reset",
    to,
    subject: "🔑 Đặt lại mật khẩu ChillBanana của bạn",
    html,
  }, transporter);
}

export async function sendAdminDirectEmail(params: {
  orderId?: string;
  to: string;
  subject: string;
  html: string;
  emailType?: string;
  payload?: Record<string, unknown>;
}): Promise<boolean> {
  return deliverLoggedEmail({
    emailType: params.emailType || "admin-custom-email",
    orderId: params.orderId,
    to: params.to,
    subject: params.subject,
    html: params.html,
    payload: params.payload,
  }, getTransporter());
}

