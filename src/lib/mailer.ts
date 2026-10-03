import nodemailer from "nodemailer";

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

// Cấu hình transporter Nodemailer cho ChillBanana
function getTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";

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

/**
 * 1. Email xác nhận tạo đơn hàng mới (Chờ đặt cọc)
 */
export async function sendOrderCreatedEmail(order: any) {
  if (!order.customerEmail) {
    console.warn("[Mailer] Đơn hàng không có customerEmail, bỏ qua gửi email.");
    return;
  }

  const baseUrl = getBaseUrl();
  const trackingUrl = `${baseUrl}/tracking?orderCode=${order.orderCode}`;

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); color: white; padding: 28px; text-align: center;">
        <h1 style="margin: 0; font-size: 26px; color: #FBBF24; font-family: Georgia, serif;">🍌 ChillBanana</h1>
        <p style="margin: 8px 0 0 0; font-size: 14px; color: #94A3B8;">Xác nhận đơn đặt mua hộ hàng nội địa Nhật Bản</p>
      </div>
      
      <div style="padding: 32px 28px; color: #1E293B; line-height: 1.6;">
        <p style="font-size: 15px;">Kính chào <strong>${order.customerName}</strong>,</p>
        <p style="font-size: 14px; color: #475569;">ChillBanana đã tiếp nhận yêu cầu mua hộ hàng Nhật của Quý khách với thông tin chi tiết:</p>
        
        <div style="background-color: #FEFCE8; border-left: 4px solid #F59E0B; padding: 18px; margin: 20px 0; border-radius: 10px;">
          <p style="margin: 6px 0; font-size: 14px;"><strong>Mã đơn hàng:</strong> <span style="color: #B45309; font-weight: bold; font-size: 16px; font-family: monospace;">${order.orderCode}</span></p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Sản phẩm:</strong> ${order.productName}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Giá gốc tại Nhật:</strong> ${order.priceJpy?.toLocaleString()} ¥</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Tổng giá trị đơn (VND):</strong> <strong>${order.totalVnd?.toLocaleString("vi-VN")} đ</strong></p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Tiền cọc cần thanh toán (50%):</strong> <span style="color: #D97706; font-weight: bold; font-size: 16px;">${order.depositAmountVnd?.toLocaleString("vi-VN")} đ</span></p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Trạng thái:</strong> <span style="color: #D97706; font-weight: 600;">Chờ đặt cọc</span></p>
        </div>
        
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; padding: 16px; border-radius: 12px; margin: 20px 0; font-size: 13px; color: #475569;">
          <p style="margin: 0 0 8px 0; font-weight: bold; color: #0F172A;">💳 Hướng dẫn thanh toán cọc:</p>
          <p style="margin: 4px 0;">• <strong>Cổng VNPAY:</strong> Quý khách có thể bấm nút "Thanh toán cọc qua VNPAY" trực tiếp trên website để thanh toán tự động.</p>
          <p style="margin: 4px 0;">• <strong>Chuyển khoản VietQR:</strong> Nội dung chuyển khoản ghi đúng mã đơn: <strong style="color: #B45309;">${order.orderCode}</strong></p>
        </div>
        
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

  try {
    const transporter = getTransporter();
    const hasAuth = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

    if (hasAuth) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"ChillBanana" <${process.env.SMTP_USER}>`,
        to: order.customerEmail,
        subject: `[ChillBanana] Xác nhận đơn mua hộ #${order.orderCode} - ${order.productName}`,
        html,
      });
      console.log(`[Mailer] ✅ Đã gửi email xác nhận tạo đơn tới ${order.customerEmail}`);
    } else {
      console.log(`[Mailer Sim] ℹ️ Đã tạo nội dung email cho đơn #${order.orderCode} gửi tới ${order.customerEmail} (Chưa cấu hình SMTP_USER & SMTP_PASS trong .env)`);
    }
  } catch (err) {
    console.warn("[Mailer] Lỗi khi gửi email xác nhận tạo đơn:", err);
  }
}

/**
 * 2. Email xác nhận thanh toán đặt cọc thành công (Qua VNPAY hoặc Admin duyệt)
 */
export async function sendPaymentSuccessEmail(order: any) {
  if (!order.customerEmail) {
    console.warn("[Mailer] Đơn hàng không có customerEmail, bỏ qua gửi email thanh toán.");
    return;
  }

  const baseUrl = getBaseUrl();
  const trackingUrl = `${baseUrl}/tracking?orderCode=${order.orderCode}`;

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="background: linear-gradient(135deg, #065F46 0%, #0F172A 100%); color: white; padding: 28px; text-align: center;">
        <h1 style="margin: 0; font-size: 26px; color: #34D399; font-family: Georgia, serif;">✅ Đặt Cọc Thành Công!</h1>
        <p style="margin: 8px 0 0 0; font-size: 14px; color: #A7F3D0;">ChillBanana đã nhận được tiền cọc cho đơn #${order.orderCode}</p>
      </div>
      
      <div style="padding: 32px 28px; color: #1E293B; line-height: 1.6;">
        <p style="font-size: 15px;">Kính chào <strong>${order.customerName}</strong>,</p>
        <p style="font-size: 14px; color: #475569;">Giao dịch thanh toán tiền cọc của Quý khách đã được hệ thống xác nhận thành công:</p>
        
        <div style="background-color: #ECFDF5; border-left: 4px solid #10B981; padding: 18px; margin: 20px 0; border-radius: 10px;">
          <p style="margin: 6px 0; font-size: 14px;"><strong>Mã đơn hàng:</strong> <span style="color: #065F46; font-weight: bold; font-size: 16px; font-family: monospace;">${order.orderCode}</span></p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Sản phẩm:</strong> ${order.productName}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Số tiền cọc đã nhận:</strong> <span style="color: #059669; font-weight: bold; font-size: 16px;">${order.depositAmountVnd?.toLocaleString("vi-VN")} đ</span></p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Phương thức:</strong> Cổng thanh toán VNPAY</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Tiến độ hiện tại:</strong> <span style="background-color: #10B981; color: white; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: bold;">Đang mua hàng tại Tokyo</span></p>
        </div>
        
        <p style="font-size: 14px; color: #334155;">
          🚀 Nhân viên văn phòng ChillBanana tại Tokyo đang tiến hành order hàng trực tiếp từ người bán/sàn Nhật Bản. Quý khách có thể theo dõi tiến độ kiện hàng qua đường link dưới đây:
        </p>
        
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

  try {
    const transporter = getTransporter();
    const hasAuth = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

    if (hasAuth) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"ChillBanana" <${process.env.SMTP_USER}>`,
        to: order.customerEmail,
        subject: `[ChillBanana] ✅ Xác nhận đặt cọc thành công đơn hàng #${order.orderCode}`,
        html,
      });
      console.log(`[Mailer] ✅ Đã gửi email xác nhận thanh toán cọc tới ${order.customerEmail}`);
    } else {
      console.log(`[Mailer Sim] ℹ️ Đã tạo nội dung email thanh toán thành công cho đơn #${order.orderCode} gửi tới ${order.customerEmail}`);
    }
  } catch (err) {
    console.warn("[Mailer] Lỗi khi gửi email xác nhận thanh toán:", err);
  }
}

/**
 * 3. Email cập nhật tiến độ vận đơn (7 Bước) hoặc Hủy đơn
 */
export async function sendOrderStatusUpdateEmail(order: any, newStatusTitle: string, description: string) {
  if (!order.customerEmail) {
    console.warn("[Mailer] Đơn hàng không có customerEmail, bỏ qua gửi email cập nhật.");
    return;
  }

  const baseUrl = getBaseUrl();
  const trackingUrl = `${baseUrl}/tracking?orderCode=${order.orderCode}`;

  const isCancelled = order.status === "CANCELLED";
  const headerBg = isCancelled
    ? "linear-gradient(135deg, #881337 0%, #0F172A 100%)"
    : "linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)";
  const accentColor = isCancelled ? "#F43F5E" : "#38BDF8";

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="background: ${headerBg}; color: white; padding: 28px; text-align: center;">
        <h1 style="margin: 0; font-size: 26px; color: ${accentColor}; font-family: Georgia, serif;">🍌 ChillBanana</h1>
        <p style="margin: 8px 0 0 0; font-size: 14px; color: #E2E8F0;">Cập nhật tiến độ đơn hàng #${order.orderCode}</p>
      </div>
      
      <div style="padding: 32px 28px; color: #1E293B; line-height: 1.6;">
        <p style="font-size: 15px;">Kính chào <strong>${order.customerName}</strong>,</p>
        <p style="font-size: 14px; color: #475569;">Đơn hàng <strong>#${order.orderCode}</strong> của Quý khách vừa có cập nhật trạng thái mới nhất:</p>
        
        <div style="background-color: ${isCancelled ? "#FFF1F2" : "#F0F9FF"}; border-left: 4px solid ${isCancelled ? "#E11D48" : "#0284C7"}; padding: 18px; margin: 20px 0; border-radius: 10px;">
          <p style="margin: 0; font-size: 16px; font-weight: bold; color: ${isCancelled ? "#9F1239" : "#075985"};">${newStatusTitle}</p>
          <p style="margin: 8px 0 0 0; font-size: 13px; color: ${isCancelled ? "#BE123C" : "#0369A1"};">${description}</p>
          ${order.weightKg ? `<p style="margin: 6px 0 0 0; font-size: 12px; color: #475569;"><strong>Trọng lượng thực tế:</strong> ${order.weightKg} kg</p>` : ""}
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

  try {
    const transporter = getTransporter();
    const hasAuth = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

    if (hasAuth) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"ChillBanana" <${process.env.SMTP_USER}>`,
        to: order.customerEmail,
        subject: `[ChillBanana] Cập nhật đơn hàng #${order.orderCode}: ${newStatusTitle}`,
        html,
      });
      console.log(`[Mailer] ✅ Đã gửi email cập nhật trạng thái tới ${order.customerEmail}`);
    } else {
      console.log(`[Mailer Sim] ℹ️ Đã tạo nội dung email cập nhật đơn #${order.orderCode}: ${newStatusTitle} cho ${order.customerEmail}`);
    }
  } catch (err) {
    console.warn("[Mailer] Lỗi khi gửi email cập nhật trạng thái:", err);
  }
}
