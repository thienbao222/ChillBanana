import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { calculateWarehouseVnBalance } from "@/features/payments/policy";
import { confirmVnpayPayment } from "@/lib/vnpay-payment";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    paymentAttempt: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    paymentTransaction: {
      create: vi.fn(),
    },
    trackingLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/mailer", () => ({
  sendPaymentSuccessEmail: vi.fn().mockResolvedValue(undefined),
}));

describe("Milestone 1 (R1): Luồng thu số dư đợt 2 (Balance Settlement) tại WAREHOUSE_VN", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_ENV = "demo";
    process.env.PAYMENT_MODE = "sandbox";
    process.env.VNPAY_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    process.env.PAYMENT_AUTO_CONFIRM_ORDER = "true";
  });

  describe("1. Policy calculateWarehouseVnBalance", () => {
    it("tính chính xác số dư hàng hóa còn lại cho đơn cọc 50%", () => {
      const result = calculateWarehouseVnBalance({
        totalVnd: 4_000_000,
        depositAmountVnd: 2_000_000,
      });

      expect(result.remainingGoodsBalanceVnd).toBe(2_000_000);
      expect(result.totalRemainingVnd).toBe(2_000_000);
      expect(result.balanceVnd).toBe(2_000_000);
      expect(result.actionNeeded).toBe("COLLECT_BALANCE");
      expect(result.isFullySettled).toBe(false);
    });

    it("tính chính xác số dư hàng hóa còn lại cho đơn cọc 70% kèm cước ship nội địa", () => {
      const result = calculateWarehouseVnBalance({
        totalVnd: 5_000_000,
        paidAmountVnd: 3_500_000,
        domesticShippingVnd: 35_000,
      });

      expect(result.remainingGoodsBalanceVnd).toBe(1_500_000);
      expect(result.totalRemainingVnd).toBe(1_535_000);
      expect(result.actionNeeded).toBe("COLLECT_BALANCE");
      expect(result.isFullySettled).toBe(false);
    });

    it("đánh dấu isFullySettled = true khi đã thanh toán đủ 100%", () => {
      const result = calculateWarehouseVnBalance({
        totalVnd: 3_000_000,
        depositAmountVnd: 3_000_000,
      });

      expect(result.remainingGoodsBalanceVnd).toBe(0);
      expect(result.totalRemainingVnd).toBe(0);
      expect(result.balanceVnd).toBe(0);
      expect(result.actionNeeded).toBe("NONE");
      expect(result.isFullySettled).toBe(true);
    });

    it("phát hiện thừa tiền (REFUND) khi số tiền nộp vượt quá tổng đơn", () => {
      const result = calculateWarehouseVnBalance({
        totalVnd: 2_000_000,
        totalPaidVnd: 2_300_000,
      });

      expect(result.remainingGoodsBalanceVnd).toBe(0);
      expect(result.balanceVnd).toBe(-300_000);
      expect(result.actionNeeded).toBe("REFUND");
      expect(result.isFullySettled).toBe(true);
    });
  });

  describe("2. VNPAY confirmVnpayPayment cho loại giao dịch BALANCE", () => {
    it("xác nhận thanh toán số dư đợt 2 thành công cho đơn ở WAREHOUSE_VN", async () => {
      const mockOrder = {
        id: "order-1",
        orderCode: "CB-TEST-BAL-1",
        status: "WAREHOUSE_VN",
        paymentStatus: "DEPOSITED_50",
        totalVnd: 2_000_000,
        depositAmountVnd: 1_000_000,
        depositPercent: 50,
        isPriceVerified: true,
      };

      const mockAttempt = {
        id: "attempt-1",
        orderId: "order-1",
        provider: "VNPAY_SANDBOX",
        amountVnd: 1_000_000,
        status: "INITIATED",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any);
      vi.mocked(prisma.paymentAttempt.findFirst).mockResolvedValue(mockAttempt as any);

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          paymentAttempt: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUnique: vi.fn().mockResolvedValue({ ...mockAttempt, status: "CONFIRMED" }),
          },
          order: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          paymentTransaction: {
            create: vi.fn().mockResolvedValue({ id: "tx-1" }),
          },
          trackingLog: {
            create: vi.fn().mockResolvedValue({ id: "log-1" }),
          },
        };
        return callback(tx);
      });

      // Số tiền minor VNPAY: 1.000.000 VND * 100 = 100000000
      const result = await confirmVnpayPayment("CB-TEST-BAL-1", "100000000", "VNPAY-12345", "CB-TEST-BAL-1_attempt-1");

      expect(result.result).toBe("confirmed");
      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ORDER_BALANCE_SETTLED",
          entityType: "Order",
          entityId: "CB-TEST-BAL-1",
        })
      );
    });

    it("chặn xác nhận nếu số tiền không khớp với số dư còn lại", async () => {
      const mockOrder = {
        id: "order-2",
        orderCode: "CB-TEST-BAL-2",
        status: "WAREHOUSE_VN",
        paymentStatus: "DEPOSITED_50",
        totalVnd: 2_000_000,
        depositAmountVnd: 1_000_000,
        depositPercent: 50,
      };

      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any);

      // Gửi số tiền sai: 500.000 VND thay vì 1.000.000 VND
      const result = await confirmVnpayPayment("CB-TEST-BAL-2", "50000000", "VNPAY-12345");

      expect(result.result).toBe("invalid_amount");
    });

    it("trả về already_paid nếu đơn đã được tất toán PAID_100", async () => {
      const mockOrder = {
        id: "order-3",
        orderCode: "CB-TEST-BAL-3",
        status: "WAREHOUSE_VN",
        paymentStatus: "PAID_100",
        totalVnd: 2_000_000,
        depositAmountVnd: 2_000_000,
      };

      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any);

      const result = await confirmVnpayPayment("CB-TEST-BAL-3", "100000000", "VNPAY-12345");

      expect(result.result).toBe("already_paid");
    });
  });

  describe("3. Static Architecture & Integrity Verification", () => {
    it("vnpay-create hỗ trợ tham số paymentType BALANCE cho đơn WAREHOUSE_VN", () => {
      const fileContent = fs.readFileSync(
        path.resolve("src/app/api/payment/vnpay-create/route.ts"),
        "utf-8"
      );

      expect(fileContent).toContain('paymentType === "BALANCE"');
      expect(fileContent).toContain('order.status !== "WAREHOUSE_VN"');
      expect(fileContent).toContain("remainingGoodsBalanceVnd");
    });

    it("mock-sandbox hỗ trợ ghi nhận thanh toán BALANCE và ghi AuditLog ORDER_BALANCE_SETTLED", () => {
      const fileContent = fs.readFileSync(
        path.resolve("src/app/api/payment/mock-sandbox/route.ts"),
        "utf-8"
      );

      expect(fileContent).toContain('isBalanceSettlement');
      expect(fileContent).toContain('kind: "BALANCE"');
      expect(fileContent).toContain('action: "ORDER_BALANCE_SETTLED"');
      expect(fileContent).toContain('paymentStatus: "PAID_100"');
    });

    it("admin payments route hỗ trợ tất toán số dư tại WAREHOUSE_VN", () => {
      const fileContent = fs.readFileSync(
        path.resolve("src/app/api/admin/orders/[id]/payments/route.ts"),
        "utf-8"
      );

      expect(fileContent).toContain('isBalanceSettlement');
      expect(fileContent).toContain('kind: "BALANCE"');
      expect(fileContent).toContain('action: isBalanceSettlement ? "ORDER_BALANCE_SETTLED" : "ORDER_PAYMENT_RECORDED"');
    });

    it("trang tracking hiển thị giao diện tất toán đợt 2 kèm VietQR và nút VNPAY BALANCE", () => {
      const fileContent = fs.readFileSync(
        path.resolve("src/app/tracking/page.tsx"),
        "utf-8"
      );

      expect(fileContent).toContain('order.status === "WAREHOUSE_VN" && order.paymentStatus !== "PAID_100"');
      expect(fileContent).toContain("Kiện hàng đã về kho Việt Nam. Quý khách vui lòng thanh toán số dư còn lại để xuất kho giao hàng tận nơi.");
      expect(fileContent).toContain('handlePayVnpay("BALANCE")');
      expect(fileContent).toContain("Thanh toán số dư qua VNPAY");
    });

    it("OrderManagementTab hiển thị trạng thái thu số dư và kiểm soát mở khóa nút LOCAL_DELIVERY", () => {
      const fileContent = fs.readFileSync(
        path.resolve("src/app/admin/components/OrderManagementTab.tsx"),
        "utf-8"
      );

      expect(fileContent).toContain('ord.status === "WAREHOUSE_VN" && ord.paymentStatus !== "PAID_100"');
      expect(fileContent).toContain("Chờ thu số dư:");
      expect(fileContent).toContain("Chờ Tất Toán 100% Để Bàn Giao");
      expect(fileContent).toContain("Bàn Giao Shipper (Đã Đủ 100%)");
      expect(fileContent).toContain('disabled={ord.status === "WAREHOUSE_VN" && ord.paymentStatus !== "PAID_100"}');
    });
  });
});
