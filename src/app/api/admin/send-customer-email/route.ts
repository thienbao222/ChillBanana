import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { sendAdminDirectEmail } from "@/lib/mailer";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const orderCode = typeof body?.orderCode === "string" ? body.orderCode.trim() : "";
    const recipientEmail = typeof body?.recipientEmail === "string" ? body.recipientEmail.trim() : "";
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

    if (!orderCode || !recipientEmail || !subject || !content) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp đầy đủ thông tin: mã đơn, email người nhận, tiêu đề và nội dung." },
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

    // Biến đổi plain-text thành HTML an toàn
    const htmlBody = content
      .split("\n\n")
      .map((p: string) => `<p style="margin: 0 0 12px 0; line-height: 1.6;">${p.replace(/\n/g, "<br/>")}</p>`)
      .join("");

    const fullHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
        <div style="margin-bottom: 20px; border-bottom: 2px solid #fbbf24; padding-bottom: 12px;">
          <h2 style="margin: 0; color: #0f172a; font-size: 20px;">ChillBanana</h2>
          <span style="font-size: 12px; color: #64748b;">Dịch vụ Mua Hộ &amp; Vận Chuyển Nhật - Việt</span>
        </div>
        <div style="font-size: 14px; color: #334155;">
          ${htmlBody}
        </div>
        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
          <p style="margin: 0;">Mã tham chiếu đơn hàng: <strong>${orderCode}</strong></p>
          <p style="margin: 4px 0 0 0;">Email này được gửi trực tiếp bởi Ban Quản Trị ChillBanana.</p>
        </div>
      </div>
    `;

    // 1. Gửi email qua hạ tầng mailer + ghi EmailLog
    const sent = await sendAdminDirectEmail({
      orderId: order.id,
      to: recipientEmail,
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

    // 2. Ghi AuditLog bắt buộc
    await writeAuditLog({
      actor: guard.username,
      actorType: "ADMIN",
      action: "ADMIN_SEND_CUSTOMER_EMAIL",
      entityType: "Order",
      entityId: order.id,
      summary: `Quản trị viên đã duyệt và gửi email [${draftType}] cho đơn #${orderCode} đến ${recipientEmail}`,
      metadata: {
        orderCode,
        recipientEmail,
        subject,
        draftType,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      message: `Đã gửi email thành công đến ${recipientEmail} và ghi nhận nhật ký kiểm toán.`,
    });
  } catch (error) {
    console.error("[SendCustomerEmail] Lỗi gửi email:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Có lỗi xảy ra khi gửi email." },
      { status: 500 }
    );
  }
}
