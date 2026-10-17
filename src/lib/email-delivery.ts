import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

// Gửi email có ghi nhật ký (EmailLog) và thử lại khi lỗi tạm thời.
// Trạng thái trung thực: SIMULATED = chưa cấu hình SMTP nên KHÔNG có email nào được gửi; SENT = SMTP đã nhận;
// FAILED = hết số lần thử. Không bao giờ báo "đã gửi" khi mới chỉ ghi log.

export type EmailStatus = "SIMULATED" | "SENT" | "FAILED";

export type OutgoingEmail = {
  type: string; // ORDER_CREATED, PRICE_APPROVED, PAYMENT_SUCCESS, ORDER_STATUS, CUSTOMER_VERIFICATION, GUEST_ORDER_ACCESS
  to: string;
  subject: string;
  html: string;
  orderCode?: string;
};

export type MailTransport = {
  sendMail(options: { from: string; to: string; subject: string; html: string }): Promise<unknown>;
};

export type DeliveryOptions = {
  /** Mặc định: dựng từ biến SMTP_*. Truyền vào để test. */
  transport?: MailTransport | null;
  maxAttempts?: number;
  /** Chờ giữa các lần thử (ms), nhân lên theo số lần. */
  retryDelayMs?: number;
};

export function isSmtpConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.SMTP_USER && env.SMTP_PASS);
}

export function createSmtpTransport(): MailTransport {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const isGmail = host.includes("gmail") || user.endsWith("@gmail.com");
  if (isGmail && user && pass) {
    return nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  }
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: user && pass ? { user, pass } : undefined });
}

async function writeLog(entry: { email: OutgoingEmail; status: EmailStatus; attempts: number; error?: string }): Promise<void> {
  try {
    await prisma.emailLog.create({
      data: {
        type: entry.email.type.slice(0, 60),
        recipient: entry.email.to.slice(0, 200),
        subject: entry.email.subject.slice(0, 300),
        status: entry.status,
        attempts: entry.attempts,
        error: entry.error?.slice(0, 500),
        orderCode: entry.email.orderCode?.slice(0, 80),
      },
    });
  } catch (error) {
    console.error("[EmailLog] Không ghi được nhật ký email:", error);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function deliverEmail(
  email: OutgoingEmail,
  options: DeliveryOptions = {}
): Promise<{ status: EmailStatus; attempts: number; error?: string }> {
  const transport = options.transport !== undefined ? options.transport : isSmtpConfigured() ? createSmtpTransport() : null;

  if (!transport) {
    console.log(`[Mailer Sim] Chưa cấu hình SMTP: KHÔNG gửi email "${email.subject}" tới ${email.to}.`);
    await writeLog({ email, status: "SIMULATED", attempts: 0 });
    return { status: "SIMULATED", attempts: 0 };
  }

  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const retryDelayMs = options.retryDelayMs ?? 700;
  const from = process.env.SMTP_FROM || `"ChillBanana" <${process.env.SMTP_USER}>`;
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await transport.sendMail({ from, to: email.to, subject: email.subject, html: email.html });
      await writeLog({ email, status: "SENT", attempts: attempt });
      return { status: "SENT", attempts: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.warn(`[Mailer] Lần thử ${attempt}/${maxAttempts} gửi "${email.subject}" thất bại: ${lastError}`);
      if (attempt < maxAttempts) await sleep(retryDelayMs * attempt);
    }
  }

  await writeLog({ email, status: "FAILED", attempts: maxAttempts, error: lastError });
  return { status: "FAILED", attempts: maxAttempts, error: lastError };
}
