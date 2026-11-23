import { describe, it, expect, vi, beforeEach } from "vitest";
import { maskPiiBeforeAi, maskEmail, maskPhoneNumber } from "@/features/privacy/pii-masker";
import { anonymizeCustomerProfile } from "@/features/privacy/anonymization";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    order: {
      update: vi.fn(),
    },
    vnJpShipment: {
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(prisma)),
  },
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue({}),
}));

describe("WP6.2 — Xuất tờ khai CN23 & Tuân thủ bảo vệ dữ liệu cá nhân", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Khử trùng dữ liệu PII trước khi gửi sang AI (maskPiiBeforeAi)", () => {
    it("che toàn bộ email trong câu hỏi của khách", () => {
      const text = "Tôi muốn kiểm tra đơn hàng gửi về email customer.test_99@gmail.com ngay.";
      const masked = maskPiiBeforeAi(text);

      expect(masked).not.toContain("customer.test_99@gmail.com");
      expect(masked).toContain("[EMAIL_MASKED]");
    });

    it("che toàn bộ số điện thoại VN và Nhật Bản", () => {
      const text = "SĐT của tôi là 0912345678 và số Nhật là 08012345678, liên hệ sớm.";
      const masked = maskPiiBeforeAi(text);

      expect(masked).not.toContain("0912345678");
      expect(masked).not.toContain("08012345678");
      expect(masked).toContain("[PHONE_MASKED]");
    });

    it("hàm maskEmail và maskPhoneNumber định dạng hiển thị nhẹ nhàng cho người dùng", () => {
      expect(maskEmail("nguyenvana@gmail.com")).toBe("ng***a@gmail.com");
      expect(maskPhoneNumber("0987654321")).toBe("098****321");
    });
  });

  describe("Quy trình ẩn danh hóa hồ sơ (anonymizeCustomerProfile)", () => {
    it("BẤT BIẾN: Ẩn danh thông tin cá nhân nhưng KHÔNG XÓA CỨNG bản ghi tài chính", async () => {
      const mockCustomer = {
        id: "cust-123456",
        name: "Nguyễn Văn Thật",
        email: "real.email@gmail.com",
        phone: "0901234567",
        address: "Số 10 phố Huế, Hà Nội",
        orders: [
          { id: "ord-1", paymentTransactions: [{ id: "pt-1" }] },
          { id: "ord-2", paymentTransactions: [{ id: "pt-2" }, { id: "pt-3" }] },
        ],
        vnJpShipments: [
          { id: "ship-1" },
        ],
      };

      vi.mocked(prisma.customer.findUnique).mockResolvedValue(mockCustomer as any);

      const result = await anonymizeCustomerProfile("cust-123456", "admin-tester");

      expect(result.success).toBe(true);
      expect(result.retainedFinancialRecordsCount.orders).toBe(2);
      expect(result.retainedFinancialRecordsCount.paymentTransactions).toBe(3);

      // Customer update
      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "cust-123456" },
          data: expect.objectContaining({
            phone: null,
            address: null,
            email: expect.stringContaining("@privacy.chillbanana.local"),
          }),
        })
      );

      // Orders update
      expect(prisma.order.update).toHaveBeenCalledTimes(2);
    });
  });
});

