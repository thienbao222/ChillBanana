import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { sendAdminDirectEmail, escapeHtml } from "@/lib/mailer";
import { writeAuditLog } from "@/lib/audit";
import { checkAndRecordHit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const ADMIN_SEND_EMAIL_LIMIT = { max: 20, windowMs: 10 * 60_000, blockMs: 10 * 60_000 };

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN", "OPERATOR"] });
  if (!guard.ok) return guard.response;

  try {
    // 1. Giới hạn tần suất gửi email theo tài khoản admin (20 email / 10 phút)
    const retryAfter = await checkAndRecordHit(`admin_send_email:${guard.username}`, ADMIN_SEND_EMAIL_LIMIT).catch(() => 0);
    if (retryAfter > 0) {
      return NextResponse.json(
        { error: "Thao tác gửi email vượt quá tần suất cho phép (tối đa 20 email/10 phút). Vui lòng thử lại sau." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const body = await req.json();
    const orderCode = typeof body?.orderCode === "string" ? body.orderCode.trim() : "";
    const clientRecipientEmail = typeof body?.recipientEmail === "string" ? body.recipientEmail.trim() : "";
    const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
    const content = typeof body?.body === "string" ? body.body.trim() : "";
    const draftType = typeof body?.draftType === "string" ? body.draftType.trim() : "custom";
    const confirmSend = Boolean(body?.confirmSend);

    if (!confirmSend) {
      return NextResponse.json(
        { error: "Thao tác gửi email bắt buộc phải được Quản trị viên xác nhận rõ ràng (AI không được tự gửi)." },
        { status: 400 }
      );
    }

    if (!orderCode || !subject || !content) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp đầy đủ thông tin: mã đơn, tiêu đề và nội dung." },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { orderCode },
      select: { id: true, orderCode: true, customerEmail: true },
    });

    if (!order) {
      return NextResponse.json({ error: `Không tìm thấy đơn hàng #${orderCode}` }, { status: 404 });
    }

    // 2. KHÔNG lấy email người nhận từ body request. Lấy trực tiếp từ order.customerEmail trong cơ sở dữ liệu
    const targetEmail = typeof order.customerEmail === "string" ? order.customerEmail.trim() : "";
    if (!targetEmail) {
      return NextResponse.json(
        { error: `Đơn hàng #${orderCode} không có thông tin email khách hàng để gửi.` },
        { status: 400 }
      );
    }

    // Nếu client gửi kèm recipientEmail nhưng khác với email trong đơn thì từ chối ngay (400)
    if (clientRecipientEmail && clientRecipientEmail.toLowerCase() !== targetEmail.toLowerCase()) {
      return NextResponse.json(
        { error: `Email người nhận (${clientRecipientEmail}) không khớp với email đã lưu trong đơn hàng (${targetEmail}).` },
        { status: 400 }
      );
    }

    // 3. Escape HTML toàn bộ nội dung trước khi dựng HTML
    const safeContent = escapeHtml(content);
    const safeSubject = escapeHtml(subject);
    const safeOrderCode = escapeHtml(orderCode);

    // Chỉ sau khi escape mới đổi \n thành <br/>
    const htmlBody = safeContent
      .split("\n\n")
      .map((p: string) => `<p style="margin: 0 0 12px 0; line-height: 1.6;">${p.replace(/\n/g, "<br/>")}</p>`)
      .join("");

    const fullHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
        <div style="margin-bottom: 20px; border-bottom: 2px solid #fbbf24; padding-bottom: 12px;">
          <h2 style="margin: 0; color: #0f172a; font-size: 20px;">ChillBanana</h2>
          <span style="font-size: 12px; color: #64748b;">Dịch vụ Mua Hộ &amp; Vận Chuyển Nhật - Việt</span>
        </div>
        <div style="margin-bottom: 16px;">
          <h3 style="margin: 0; color: #0f172a; font-size: 16px;">${safeSubject}</h3>
        </div>
        <div style="font-size: 14px; color: #334155;">
          ${htmlBody}
        </div>
        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
          <p style="margin: 0;">Mã tham chiếu đơn hàng: <strong>${safeOrderCode}</strong></p>
          <p style="margin: 4px 0 0 0;">Email này được gửi trực tiếp bởi Ban Quản Trị ChillBanana.</p>
        </div>
      </div>
    `;

    // 4. Gửi email qua hạ tầng mailer + ghi EmailLog
    const sent = await sendAdminDirectEmail({
      orderId: order.id,
      to: targetEmail,
      subject,
      html: fullHtml,
      emailType: `admin-controlled-${draftType}`,
      payload: {
        orderCode,
        draftType,
        sentByAdmin: guard.username,
      },
    });

    if (!sent) {
      throw new Error("Không thể gửi email qua máy chủ SMTP / Mock Transport.");
    }

    // 5. Ghi AuditLog bắt buộc
    await writeAuditLog({
      actor: guard.username,
      actorType: "ADMIN",
      action: "ADMIN_SEND_CUSTOMER_EMAIL",
      entityType: "Order",
      entityId: order.id,
      summary: `Quản trị viên đã duyệt và gửi email [${draftType}] cho đơn #${orderCode} đến ${targetEmail}`,
      metadata: {
        orderCode,
        recipientEmail: targetEmail,
        subject,
        draftType,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      message: `Đã gửi email thành công đến ${targetEmail} và ghi nhận nhật ký kiểm toán.`,
    });
  } catch (error) {
    console.error("[SendCustomerEmail] Lỗi gửi email:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Có lỗi xảy ra khi gửi email." },
      { status: 500 }
    );
  }
}
