import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/admin/send-customer-email/route";
import { makeRequest } from "../helpers/request";
import { prisma } from "@/lib/prisma";
import { sendAdminDirectEmail, escapeHtml } from "@/lib/mailer";
import { writeAuditLog } from "@/lib/audit";
import { checkAndRecordHit } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/admin-guard";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/admin-guard", () => ({
  requireAdmin: vi.fn(async () => ({
    ok: true,
    username: "test_admin",
    role: "SUPER_ADMIN",
    admin: { username: "test_admin", role: "SUPER_ADMIN" },
  })),
}));

vi.mock("@/lib/mailer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mailer")>();
  return {
    ...actual,
    sendAdminDirectEmail: vi.fn(async () => true),
  };
});

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkAndRecordHit: vi.fn(async () => 0),
}));

describe("POST /api/admin/send-customer-email - Bảo mật & Kiểm soát gửi email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Từ chối 400 khi client gửi recipientEmail lạ không khớp với email của đơn hàng", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
      id: "order-123",
      orderCode: "CB-2026-0001",
      customerEmail: "real_customer@gmail.com",
    } as any);

    const req = makeRequest("POST", "/api/admin/send-customer-email", {
      json: {
        orderCode: "CB-2026-0001",
        recipientEmail: "attacker@gmail.com", // Email khác với đơn hàng
        subject: "Xác nhận giá",
        body: "Xin chào quý khách",
        confirmSend: true,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("không khớp với email đã lưu trong đơn hàng");
    expect(sendAdminDirectEmail).not.toHaveBeenCalled();
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it("Từ chối 400 khi đơn hàng trong cơ sở dữ liệu không có email khách hàng", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
      id: "order-no-mail",
      orderCode: "CB-2026-0002",
      customerEmail: null,
    } as any);

    const req = makeRequest("POST", "/api/admin/send-customer-email", {
      json: {
        orderCode: "CB-2026-0002",
        subject: "Thông báo đơn hàng",
        body: "Nội dung",
        confirmSend: true,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("không có thông tin email");
    expect(sendAdminDirectEmail).not.toHaveBeenCalled();
  });

  it("Escape HTML toàn bộ nội dung: <script>, <a href>, thẻ HTML độc hại được escape trước khi dựng HTML", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
      id: "order-xss",
      orderCode: "CB-2026-XSS",
      customerEmail: "customer_xss@example.com",
    } as any);

    const maliciousBody = 'Xin chào <script>alert("hacked")</script>\n\nXem tại <a href="http://malicious.site">click here</a> & "cẩn thận"';
    const maliciousSubject = 'Cập nhật giá <script>bad()</script> & "đặc biệt"';

    const req = makeRequest("POST", "/api/admin/send-customer-email", {
      json: {
        orderCode: "CB-2026-XSS",
        recipientEmail: "customer_xss@example.com",
        subject: maliciousSubject,
        body: maliciousBody,
        confirmSend: true,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(sendAdminDirectEmail).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(sendAdminDirectEmail).mock.calls[0][0];

    // Kiểm tra recipient lấy từ customerEmail của đơn hàng
    expect(callArgs.to).toBe("customer_xss@example.com");

    // Kiểm tra HTML đã được escape đầy đủ, không còn thẻ thô độc hại
    const html = callArgs.html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(&quot;hacked&quot;)&lt;/script&gt;");
    expect(html).not.toContain('<a href="http://malicious.site">');
    expect(html).toContain("&lt;a href=&quot;http://malicious.site&quot;&gt;click here&lt;/a&gt;");
    expect(html).toContain("&amp; &quot;cẩn thận&quot;");
    expect(html).toContain("&lt;script&gt;bad()&lt;/script&gt; &amp; &quot;đặc biệt&quot;");
  });

  it("Gửi hợp lệ thành công: lấy email từ order.customerEmail và ghi AuditLog", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
      id: "order-valid-1",
      orderCode: "CB-2026-OK",
      customerEmail: "valid.customer@chillbanana.vn",
    } as any);

    const req = makeRequest("POST", "/api/admin/send-customer-email", {
      json: {
        orderCode: "CB-2026-OK",
        subject: "Báo giá đơn hàng",
        body: "Đơn hàng của bạn đã có giá.",
        draftType: "price_verification",
        confirmSend: true,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    expect(sendAdminDirectEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-valid-1",
        to: "valid.customer@chillbanana.vn",
        subject: "Báo giá đơn hàng",
        emailType: "admin-controlled-price_verification",
      })
    );

    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "test_admin",
        actorType: "ADMIN",
        action: "ADMIN_SEND_CUSTOMER_EMAIL",
        entityType: "Order",
        entityId: "order-valid-1",
        metadata: expect.objectContaining({
          orderCode: "CB-2026-OK",
          recipientEmail: "valid.customer@chillbanana.vn",
          draftType: "price_verification",
        }),
      })
    );
  });

  it("Từ chối 400 nếu Quản trị viên chưa bấm xác nhận confirmSend", async () => {
    const req = makeRequest("POST", "/api/admin/send-customer-email", {
      json: {
        orderCode: "CB-2026-0001",
        subject: "Xác nhận giá",
        body: "Nội dung",
        confirmSend: false,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("xác nhận rõ ràng");
    expect(sendAdminDirectEmail).not.toHaveBeenCalled();
  });

  it("Trả về HTTP 429 khi vượt quá rate limit gửi email của admin", async () => {
    vi.mocked(checkAndRecordHit).mockResolvedValueOnce(180); // Còn 180s

    const req = makeRequest("POST", "/api/admin/send-customer-email", {
      json: {
        orderCode: "CB-2026-0001",
        subject: "Xác nhận giá",
        body: "Nội dung",
        confirmSend: true,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("180");
    const json = await res.json();
    expect(json.error).toContain("vượt quá tần suất cho phép");
  });
});
