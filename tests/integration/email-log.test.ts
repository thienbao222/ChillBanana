import { describe, expect, it, vi } from "vitest";
import { deliverEmail, type MailTransport } from "@/lib/email-delivery";
import { prisma } from "../helpers/db";

const email = { type: "ORDER_CREATED", to: "khach@example.test", subject: "Xác nhận đơn", html: "<p>Xin chào</p>", orderCode: "CB-1" };

describe("deliverEmail + EmailLog", () => {
  it("chưa cấu hình SMTP: SIMULATED, không gửi gì, ghi log trung thực", async () => {
    const r = await deliverEmail(email); // setup đã xóa SMTP_USER/SMTP_PASS
    expect(r).toEqual({ status: "SIMULATED", attempts: 0 });
    const log = await prisma.emailLog.findFirstOrThrow();
    expect(log).toMatchObject({ type: "ORDER_CREATED", recipient: "khach@example.test", status: "SIMULATED", attempts: 0, orderCode: "CB-1" });
  });

  it("gửi thành công ngay lần đầu: SENT, attempts = 1", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    const r = await deliverEmail(email, { transport: { sendMail } as MailTransport, retryDelayMs: 0 });
    expect(r).toEqual({ status: "SENT", attempts: 1 });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: "khach@example.test", subject: "Xác nhận đơn" });
    expect((await prisma.emailLog.findFirstOrThrow()).status).toBe("SENT");
  });

  it("lỗi tạm thời rồi thành công: thử lại, SENT với attempts = 2", async () => {
    const sendMail = vi.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValue({});
    const r = await deliverEmail(email, { transport: { sendMail } as MailTransport, retryDelayMs: 0 });
    expect(r).toEqual({ status: "SENT", attempts: 2 });
    expect(await prisma.emailLog.count()).toBe(1); // một dòng cho cả chuỗi thử lại
  });

  it("lỗi liên tục: FAILED sau số lần thử tối đa, lưu lý do lỗi", async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error("SMTP 535 auth failed"));
    const r = await deliverEmail(email, { transport: { sendMail } as MailTransport, retryDelayMs: 0, maxAttempts: 3 });
    expect(r).toMatchObject({ status: "FAILED", attempts: 3 });
    expect(sendMail).toHaveBeenCalledTimes(3);
    const log = await prisma.emailLog.findFirstOrThrow();
    expect(log).toMatchObject({ status: "FAILED", attempts: 3 });
    expect(log.error).toContain("535");
  });

  it("không lưu nội dung email (có thể chứa liên kết truy cập đơn)", async () => {
    await deliverEmail({ ...email, html: "<a href='https://x/?access=SECRET'>x</a>" });
    expect(JSON.stringify(await prisma.emailLog.findMany())).not.toContain("SECRET");
  });
});
