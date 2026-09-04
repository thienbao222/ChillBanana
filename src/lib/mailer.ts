import nodemailer from "nodemailer";

// Cấu hình transporter Nodemailer cho ChillBanana
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.ethereal.email",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "support@chillbanana.vn",
    pass: process.env.SMTP_PASS || "demopassword",
  },
});

export async function sendOrderCreatedEmail(order: any) {
  try {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: #0F172A; color: white; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; color: #F59E0B; font-family: Georgia, serif;">🍌 ChillBanana (chillbanana.vn)</h1>
          <p style="margin: 6px 0 0 0; font-size: 13px; color: #E2E8F0;">Xác nhận đơn đặt mua hộ hàng nội địa Nhật Bản</p>
        </div>
        
        <div style="padding: 28px; color: #1E293B; line-height: 1.6;">
          <p>Kính chào <strong>${order.customerName}</strong>,</p>
          <p>ChillBanana đã nhận được yêu cầu đặt mua hộ hàng Nhật Bản của Quý khách với thông tin chi tiết như sau:</p>
          
          <div style="background-color: #FFFBEB; border-left: 4px solid #F59E0B; padding: 16px; margin: 18px 0; border-radius: 8px;">
            <p style="margin: 4px 0;"><strong>Mã đơn hàng:</strong> <span style="color: #B45309; font-weight: bold; font-size: 15px;">${order.orderCode}</span></p>
            <p style="margin: 4px 0;"><strong>Sản phẩm:</strong> ${order.productName}</p>
            <p style="margin: 4px 0;"><strong>Giá gốc tại Nhật:</strong> ${order.priceJpy.toLocaleString()} ¥</p>
            <p style="margin: 4px 0;"><strong>Tổng giá trị đơn (VND):</strong> <strong>${order.totalVnd.toLocaleString("vi-VN")} đ</strong></p>
            <p style="margin: 4px 0;"><strong>Số tiền cần thanh toán/cọc:</strong> <span style="color: #D97706; font-weight: bold;">${order.depositAmountVnd.toLocaleString("vi-VN")} đ</span></p>
          </div>
          
          <p>Quý khách vui lòng quét mã <strong>VietQR Napas 247</strong> hoặc chuyển khoản theo cú pháp nội dung <strong>${order.orderCode}</strong> để đội ngũ nhân viên tại Tokyo tiến hành mua hàng ngay ạ.</p>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="http://localhost:3000/tracking?code=${order.orderCode}" style="background-color: #0F172A; color: #F59E0B; padding: 12px 28px; text-decoration: none; border-radius: 12px; font-weight: bold; display: inline-block;">
              Tra Cứu Tiến Độ Đơn Hàng (7 Bước)
            </a>
          </div>
          
          <p style="font-size: 12px; color: #64748B;">Trân trọng cảm ơn Quý khách đã tin tưởng ChillBanana!<br/>Hotline hỗ trợ 24/7: 1900 6868</p>
        </div>
      </div>
    `;

    if (process.env.SMTP_USER) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"ChillBanana" <support@chillbanana.vn>',
        to: order.customerEmail,
        subject: `[ChillBanana] Xác nhận đơn mua hộ #${order.orderCode} - ${order.productName}`,
        html,
      });
      console.log(`[Email Sent] Confirmation email sent to ${order.customerEmail}`);
    } else {
      console.log(`[Email Simulated] Confirmation email generated for order ${order.orderCode} to ${order.customerEmail}`);
    }
  } catch (err) {
    console.warn("Could not send email (running in simulated mode):", err);
  }
}

export async function sendOrderStatusUpdateEmail(order: any, newStatusTitle: string, description: string) {
  try {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: #0F172A; color: white; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; color: #F59E0B; font-family: Georgia, serif;">🍌 ChillBanana (chillbanana.vn)</h1>
          <p style="margin: 6px 0 0 0; font-size: 13px; color: #10B981;">Cập nhật tiến độ đơn hàng</p>
        </div>
        
        <div style="padding: 28px; color: #1E293B; line-height: 1.6;">
          <p>Kính chào <strong>${order.customerName}</strong>,</p>
          <p>Đơn hàng <strong>#${order.orderCode}</strong> của Quý khách vừa có cập nhật mới:</p>
          
          <div style="background-color: #ECFDF5; border-left: 4px solid #10B981; padding: 16px; margin: 18px 0; border-radius: 8px;">
            <p style="margin: 0; font-size: 16px; font-weight: bold; color: #065F46;">${newStatusTitle}</p>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #047857;">${description}</p>
          </div>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="http://localhost:3000/tracking?code=${order.orderCode}" style="background-color: #0F172A; color: #F59E0B; padding: 12px 28px; text-decoration: none; border-radius: 12px; font-weight: bold; display: inline-block;">
              Xem Chi Tiết Hành Trình 7 Bước
            </a>
          </div>
          
          <p style="font-size: 12px; color: #64748B;">Trân trọng,<br/>Đội ngũ vận hành ChillBanana Tokyo - Hà Nội - TP.HCM</p>
        </div>
      </div>
    `;

    if (process.env.SMTP_USER) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"ChillBanana" <support@chillbanana.vn>',
        to: order.customerEmail,
        subject: `[ChillBanana] Cập nhật đơn hàng #${order.orderCode}: ${newStatusTitle}`,
        html,
      });
    } else {
      console.log(`[Email Simulated] Status update email for ${order.orderCode}: ${newStatusTitle}`);
    }
  } catch (err) {
    console.warn("Could not send email update (running in simulated mode):", err);
  }
}
