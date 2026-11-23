import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock Prisma cho EmailLog và Order trong unit test
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: "mock-log-123" }),
      update: vi.fn().mockResolvedValue({ id: "mock-log-123" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    order: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { POST as vnpayCreatePost } from "@/app/api/payment/vnpay-create/route";
import {
  checkEmailSystemReadiness,
  deliverLoggedEmail,
  emailMode,
} from "@/features/notifications/email-delivery";
import {
  clearSentEmails,
  getRecentSentEmails,
  sendOrderStatusUpdateEmail,
  sendPriceApprovedEmail,
  sendPaymentSuccessEmail,
} from "@/lib/mailer";

describe("Milestone 3 (R3): CSRF Protection, EMAIL_MODE and Email Templates", () => {
  beforeEach(() => {
    clearSentEmails();
    vi.mocked(prisma.emailLog.create).mockResolvedValue({ id: "mock-log-123" } as any);
    vi.mocked(prisma.emailLog.update).mockResolvedValue({ id: "mock-log-123" } as any);
    vi.mocked(prisma.emailLog.updateMany).mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  // =========================================================================
  // 1. CSRF Protection trên API vnpay-create
  // =========================================================================
  describe("CSRF Protection: POST /api/payment/vnpay-create", () => {
    it("Test 1: Chặn đứng request có Origin từ website độc hại (https://malicious-site.com) với HTTP 403", async () => {
      const maliciousReq = new NextRequest("http://localhost:3000/api/payment/vnpay-create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://malicious-site.com",
        },
        body: JSON.stringify({ orderCode: "CB-TEST-001" }),
      });

      const res = await vnpayCreatePost(maliciousReq);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error).toBe("Yêu cầu vi phạm kiểm soát nguồn gốc (CSRF protection).");
    });

    it("Chặn đứng request có Referer từ website độc hại khi không có header Origin", async () => {
      const maliciousRefererReq = new NextRequest("http://localhost:3000/api/payment/vnpay-create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          referer: "https://evil-hacker.xyz/attack-form",
        },
        body: JSON.stringify({ orderCode: "CB-TEST-002" }),
      });

      const res = await vnpayCreatePost(maliciousRefererReq);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error).toBe("Yêu cầu vi phạm kiểm soát nguồn gốc (CSRF protection).");
    });

    it("Test 2: Cho phép request hợp lệ từ cùng nguồn gốc (http://localhost:3000) vượt qua CSRF check", async () => {
      const validReq = new NextRequest("http://localhost:3000/api/payment/vnpay-create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({}), // Thiếu orderCode để kiểm tra đã qua lớp CSRF và vào lớp validate body
      });

      const res = await vnpayCreatePost(validReq);
      // Không bị chặn 403 CSRF mà đi vào logic kiểm tra orderCode và trả về 400
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Thiếu mã đơn hàng");
    });

    it("Cho phép request từ non-browser client (không có cả Origin và Referer) vượt qua CSRF check", async () => {
      const curlReq = new NextRequest("http://localhost:3000/api/payment/vnpay-create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const res = await vnpayCreatePost(curlReq);
      expect(res.status).not.toBe(403);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Thiếu mã đơn hàng");
    });
  });

  // =========================================================================
  // 2. EMAIL_MODE & Cảnh báo [CRITICAL] khi thiếu SMTP ở Production
  // =========================================================================
  describe("EMAIL_MODE & Cảnh báo [CRITICAL]", () => {
    it("Test 3: checkEmailSystemReadiness in log [CRITICAL] khi APP_ENV=production mà thiếu SMTP credentials", () => {
      vi.stubEnv("APP_ENV", "production");
      vi.stubEnv("EMAIL_MODE", "smtp");
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = checkEmailSystemReadiness();
      expect(result.ready).toBe(false);
      expect(result.criticalError).toContain("[CRITICAL]");

      expect(consoleErrorSpy).toHaveBeenCalled();
      const criticalLog = consoleErrorSpy.mock.calls.find((call) =>
        String(call[0]).includes("[CRITICAL]")
      );
      expect(criticalLog).toBeDefined();
      expect(criticalLog![0]).toContain("[CRITICAL] [EMAIL_SYSTEM]");

      consoleErrorSpy.mockRestore();
    });

    it("checkEmailSystemReadiness in log [CRITICAL] khi NODE_ENV=production mà EMAIL_MODE !== smtp", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("EMAIL_MODE", "mock");

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = checkEmailSystemReadiness();
      expect(result.ready).toBe(false);
      expect(result.criticalError).toContain("[CRITICAL]");

      expect(consoleErrorSpy).toHaveBeenCalled();
      const criticalLog = consoleErrorSpy.mock.calls.find((call) =>
        String(call[0]).includes("[CRITICAL]")
      );
      expect(criticalLog).toBeDefined();

      consoleErrorSpy.mockRestore();
    });

    it("deliverLoggedEmail in log [CRITICAL] khi chạy ở production thiếu SMTP_USER/SMTP_PASS", async () => {
      vi.stubEnv("APP_ENV", "production");
      vi.stubEnv("EMAIL_MODE", "smtp");
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const mockTransport = { sendMail: vi.fn() };

      const sent = await deliverLoggedEmail(
        {
          emailType: "order-status-update",
          to: "user@example.com",
          subject: "Test Subject",
          html: "<p>Hello</p>",
        },
        mockTransport
      );

      expect(sent).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
      const criticalLog = consoleErrorSpy.mock.calls.find((call) =>
        String(call[0]).includes("[CRITICAL]")
      );
      expect(criticalLog).toBeDefined();
      expect(criticalLog![0]).toContain("[CRITICAL] [EMAIL_DELIVERY_FAILED]");

      consoleErrorSpy.mockRestore();
    });

    it("Hệ thống hoạt động bình thường (ready: true) khi có đầy đủ SMTP credentials ở production", () => {
      vi.stubEnv("APP_ENV", "production");
      vi.stubEnv("EMAIL_MODE", "smtp");
      vi.stubEnv("SMTP_USER", "notifications@chillbanana.vn");
      vi.stubEnv("SMTP_PASS", "super-secret-password");

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = checkEmailSystemReadiness();
      expect(result.ready).toBe(true);
      expect(result.mode).toBe("smtp");
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  // =========================================================================
  // 3. Email Templates cho 5 mốc quan trọng
  // =========================================================================
  describe("Email Templates cho 5 mốc quan trọng", () => {
    it("Mốc 1: sendPriceApprovedEmail hiển thị chi tiết giá JPY, VND, phí mua hộ và tiền cọc", async () => {
      const mockApprovedOrder = {
        id: "ord-p1",
        orderCode: "KZN-2026-P01",
        customerName: "Đặng Thị Thảo",
        customerEmail: "thao@example.com",
        productName: "Nồi cơm điện Zojirushi NP-ZX05",
        priceJpy: 28000,
        productPriceVnd: 4816000,
        serviceFeeVnd: 240800,
        shippingFeeVnd: 370000,
        totalVnd: 5426800,
        depositPercent: 70,
        depositAmountVnd: 3798760,
        weightKg: 2.0,
      };

      await sendPriceApprovedEmail(mockApprovedOrder);

      const sentList = getRecentSentEmails();
      const sent = sentList.find((e) => e.to === "thao@example.com");
      expect(sent).toBeDefined();
      expect(sent!.subject).toContain("KZN-2026-P01");
      expect(sent!.html).toContain("Báo giá đơn hàng đã được xác nhận");
      expect(sent!.html).toContain("Nồi cơm điện Zojirushi");
      expect(sent!.html).toContain("4.816.000");
      expect(sent!.html).toContain("3.798.760");
      expect(sent!.html).toContain("Xem báo giá và đơn hàng");
    });

    it("Mốc 2: sendPaymentSuccessEmail xác nhận đặt cọc thành công", async () => {
      const mockPaidOrder = {
        id: "ord-p2",
        orderCode: "KZN-2026-P02",
        customerName: "Lê Hoàng Nam",
        customerEmail: "nam@example.com",
        paymentStatus: "DEPOSITED_50",
        depositPercent: 50,
        paymentMethod: "VNPAY_QR",
        status: "PURCHASING_JP",
      };

      await sendPaymentSuccessEmail(mockPaidOrder);

      const sentList = getRecentSentEmails();
      const sent = sentList.find((e) => e.to === "nam@example.com");
      expect(sent).toBeDefined();
      expect(sent!.subject).toContain("KZN-2026-P02");
      expect(sent!.html).toContain("Đặt Cọc 50% Thành Công!");
      expect(sent!.html).toContain("Cổng thanh toán VNPAY");
    });

    it("Mốc 3: sendOrderStatusUpdateEmail khi status=WAREHOUSE_JP bổ sung cân đo, kiểm đếm ngoại quan và lịch bay Tokyo", async () => {
      const mockTokyoOrder = {
        id: "ord-jp",
        orderCode: "KZN-2026-JP03",
        customerName: "Phạm Minh Tuấn",
        customerEmail: "tuan@example.com",
        status: "WAREHOUSE_JP",
        weightKg: 2.35,
      };

      await sendOrderStatusUpdateEmail(
        mockTokyoOrder,
        "Hàng đã nhập kho Tokyo",
        "Kiện hàng đã về tới kho trung chuyển Tokyo."
      );

      const sentList = getRecentSentEmails();
      const sent = sentList.find((e) => e.to === "tuan@example.com");
      expect(sent).toBeDefined();
      expect(sent!.html).toContain("Thông tin kiện hàng tại Kho Tokyo");
      expect(sent!.html).toContain("2.35 kg");
      expect(sent!.html).toContain("Kiểm đếm ngoại quan");
      expect(sent!.html).toContain("bọc chống sốc chuyên dụng");
      expect(sent!.html).toContain("Tokyo ➔ VN");
    });

    it("Test 4: sendOrderStatusUpdateEmail khi status=WAREHOUSE_VN chứa số dư đợt 2 và link #balance-payment", async () => {
      const mockVnOrder = {
        id: "ord-vn",
        orderCode: "KZN-2026-VN04",
        customerName: "Hoàng Mai Chi",
        customerEmail: "chi@example.com",
        status: "WAREHOUSE_VN",
        totalVnd: 5000000,
        depositAmountVnd: 2500000, // Đã cọc 50%, còn thiếu 2.500.000đ
      };

      await sendOrderStatusUpdateEmail(
        mockVnOrder,
        "Đã cập cảng kho Việt Nam",
        "Kiện hàng đã hoàn tất thủ tục thông quan tại Tân Sơn Nhất."
      );

      const sentList = getRecentSentEmails();
      const sent = sentList.find((e) => e.to === "chi@example.com");
      expect(sent).toBeDefined();
      expect(sent!.html).toContain("Kiện hàng đã về đến Việt Nam — Vui lòng tất toán số dư đợt 2");
      expect(sent!.html).toContain("Số dư đợt 2 còn thiếu:");
      expect(sent!.html).toContain("2.500.000 đ");
      expect(sent!.html).toContain("#balance-payment");
      expect(sent!.html).toContain("Thanh Toán Số Dư Đợt 2 Ngay");
    });

    it("Test 4 (Bổ trợ): sendOrderStatusUpdateEmail khi status=WAREHOUSE_VN và đã thanh toán 100% hiển thị hoàn tất", async () => {
      const mockFullyPaidOrder = {
        id: "ord-vn-full",
        orderCode: "KZN-2026-VN-FULL",
        customerName: "Hoàng Mai Chi",
        customerEmail: "chi-full@example.com",
        status: "WAREHOUSE_VN",
        totalVnd: 5000000,
        depositAmountVnd: 5000000,
      };

      await sendOrderStatusUpdateEmail(
        mockFullyPaidOrder,
        "Đã cập cảng kho Việt Nam",
        "Kiện hàng đã hoàn tất thủ tục thông quan."
      );

      const sentList = getRecentSentEmails();
      const sent = sentList.find((e) => e.to === "chi-full@example.com");
      expect(sent).toBeDefined();
      expect(sent!.html).toContain("Đơn hàng đã hoàn tất thanh toán 100%");
      expect(sent!.html).not.toContain("#balance-payment");
    });

    it("Test 5: sendOrderStatusUpdateEmail khi status=LOCAL_DELIVERY chứa mã vận đơn nội địa, đối tác vận chuyển và địa chỉ", async () => {
      const mockDeliveryOrder = {
        id: "ord-local",
        orderCode: "KZN-2026-LOCAL05",
        customerName: "Vũ Đình Trọng",
        customerEmail: "trong@example.com",
        customerPhone: "0987654321",
        customerAddress: "Số 45 Ngõ 120 Hoàng Quốc Việt, Cầu Giấy, Hà Nội",
        status: "LOCAL_DELIVERY",
        vnDomesticTrack: "GHN-HN-8839210",
      };

      await sendOrderStatusUpdateEmail(
        mockDeliveryOrder,
        "Đang giao hàng tận tay",
        "Đơn hàng đã được bàn giao cho bưu tá giao hàng."
      );

      const sentList = getRecentSentEmails();
      const sent = sentList.find((e) => e.to === "trong@example.com");
      expect(sent).toBeDefined();
      expect(sent!.html).toContain("Kiện hàng đã được bàn giao cho đối tác giao hàng nội địa");
      expect(sent!.html).toContain("GHN-HN-8839210");
      expect(sent!.html).toContain("Giao Hàng Nhanh / Viettel Post");
      expect(sent!.html).toContain("Số 45 Ngõ 120 Hoàng Quốc Việt, Cầu Giấy, Hà Nội");
      expect(sent!.html).toContain("0987654321");
    });
  });
});
