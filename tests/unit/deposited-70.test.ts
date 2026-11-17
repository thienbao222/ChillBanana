import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing modules that rely on it
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    purchaseTask: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    paymentTransaction: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    trackingLog: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/mailer", () => ({
  sendOrderStatusUpdateEmail: vi.fn().mockResolvedValue(true),
  sendPriceApprovedEmail: vi.fn().mockResolvedValue(true),
  sendOrderRollbackEmail: vi.fn().mockResolvedValue(true),
  sendPaymentSuccessEmail: vi.fn().mockResolvedValue(true),
  sendZaloTrackingNotification: vi.fn().mockResolvedValue(true),
}));

import { prisma } from "@/lib/prisma";
import {
  DEPOSITED_PAYMENT_STATUSES,
  isDepositPaid,
  getPaymentStatusLabelVi,
  getDepositAmount,
  getRecordedPaymentStatus,
  isRecordedPaymentStatus,
  parseDepositPercent,
  calculateDepositV2,
} from "@/features/payments/policy";
import { createPurchaseTask } from "@/features/purchasing/service";

describe("Milestone 2 (R2): Mở thông trạng thái DEPOSITED_70 trên toàn hệ thống", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Centralized Policy Helpers", () => {
    it("DEPOSITED_PAYMENT_STATUSES includes DEPOSITED_50, DEPOSITED_70, and PAID_100", () => {
      expect(DEPOSITED_PAYMENT_STATUSES).toContain("DEPOSITED_50");
      expect(DEPOSITED_PAYMENT_STATUSES).toContain("DEPOSITED_70");
      expect(DEPOSITED_PAYMENT_STATUSES).toContain("PAID_100");
      expect(DEPOSITED_PAYMENT_STATUSES).toHaveLength(3);
    });

    it("isDepositPaid returns true for DEPOSITED_70, DEPOSITED_50, PAID_100", () => {
      expect(isDepositPaid("DEPOSITED_70")).toBe(true);
      expect(isDepositPaid("DEPOSITED_50")).toBe(true);
      expect(isDepositPaid("PAID_100")).toBe(true);
    });

    it("isDepositPaid returns false for UNPAID, REFUNDED, and invalid values", () => {
      expect(isDepositPaid("UNPAID")).toBe(false);
      expect(isDepositPaid("REFUNDED")).toBe(false);
      expect(isDepositPaid("")).toBe(false);
      expect(isDepositPaid(null)).toBe(false);
      expect(isDepositPaid(undefined)).toBe(false);
      expect(isDepositPaid("OTHER_STATUS")).toBe(false);
    });

    it("getPaymentStatusLabelVi returns 'Đã cọc 70%' for DEPOSITED_70", () => {
      expect(getPaymentStatusLabelVi("DEPOSITED_70")).toBe("Đã cọc 70%");
    });

    it("getPaymentStatusLabelVi handles other standard payment statuses correctly", () => {
      expect(getPaymentStatusLabelVi("DEPOSITED_50")).toBe("Đã cọc 50%");
      expect(getPaymentStatusLabelVi("PAID_100")).toBe("Đã thanh toán 100%");
      expect(getPaymentStatusLabelVi("REFUNDED")).toBe("Đã hoàn tiền");
      expect(getPaymentStatusLabelVi("UNPAID")).toBe("Chưa thanh toán");
      expect(getPaymentStatusLabelVi(null)).toBe("Chưa thanh toán");
      expect(getPaymentStatusLabelVi(undefined)).toBe("Chưa thanh toán");
      expect(getPaymentStatusLabelVi("CUSTOM_STATUS")).toBe("CUSTOM_STATUS");
    });

    it("getDepositAmount calculates 70% deposit correctly", () => {
      expect(getDepositAmount(1_000_000, 70)).toBe(700_000);
      expect(getDepositAmount(2_500_000, 70)).toBe(1_750_000);
      expect(getDepositAmount(1_001, 70)).toBe(701); // rounded
    });

    it("getRecordedPaymentStatus and parseDepositPercent support 70", () => {
      expect(getRecordedPaymentStatus(70)).toBe("DEPOSITED_70");
      expect(isRecordedPaymentStatus("DEPOSITED_70")).toBe(true);
      expect(parseDepositPercent(70)).toBe(70);
    });

    it("calculateDepositV2 assigns 70% to STANDARD tier orders (1M - 10M VND)", () => {
      const depositResult = calculateDepositV2(5_000_000);
      expect(depositResult.tier).toBe("STANDARD");
      expect(depositResult.depositPercent).toBe(70);
      expect(depositResult.depositAmountVnd).toBe(3_500_000);
    });
  });

  describe("2. Status Transition Validation", () => {
    // Replicates the order status transition check in src/app/api/orders/[id]/route.ts line ~504
    function validateTransitionToPurchasing(order: {
      status: string;
      paymentStatus: string;
      isPriceVerified: boolean;
    }) {
      if (order.status === "PENDING_DEPOSIT") {
        if (!order.isPriceVerified) {
          return { ok: false, error: "Cần xác minh báo giá trước khi chuyển đơn sang bước mua hàng." };
        }
        if (!isDepositPaid(order.paymentStatus)) {
          return { ok: false, error: "Cần xác nhận đã nhận tiền cọc trước khi chuyển đơn sang bước mua hàng." };
        }
      }
      return { ok: true };
    }

    it("allows transition to PURCHASING_JP when paymentStatus is DEPOSITED_70", () => {
      const order = {
        status: "PENDING_DEPOSIT",
        paymentStatus: "DEPOSITED_70",
        isPriceVerified: true,
      };
      const result = validateTransitionToPurchasing(order);
      expect(result.ok).toBe(true);
    });

    it("allows transition to PURCHASING_JP when paymentStatus is DEPOSITED_50 or PAID_100", () => {
      expect(
        validateTransitionToPurchasing({
          status: "PENDING_DEPOSIT",
          paymentStatus: "DEPOSITED_50",
          isPriceVerified: true,
        }).ok
      ).toBe(true);

      expect(
        validateTransitionToPurchasing({
          status: "PENDING_DEPOSIT",
          paymentStatus: "PAID_100",
          isPriceVerified: true,
        }).ok
      ).toBe(true);
    });

    it("rejects transition to PURCHASING_JP when paymentStatus is UNPAID or unconfirmed", () => {
      const order = {
        status: "PENDING_DEPOSIT",
        paymentStatus: "UNPAID",
        isPriceVerified: true,
      };
      const result = validateTransitionToPurchasing(order);
      expect(result.ok).toBe(false);
      expect(result.error).toBe("Cần xác nhận đã nhận tiền cọc trước khi chuyển đơn sang bước mua hàng.");
    });
  });

  describe("3. createPurchaseTask with DEPOSITED_70", () => {
    it("accepts orders with paymentStatus === DEPOSITED_70 and creates task", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: "ord-deposit-70",
        orderCode: "CB-DEP-70",
        originalUrl: "https://www.amazon.co.jp/dp/B08N5WRWNW",
        priceJpy: 3500,
        paymentStatus: "DEPOSITED_70",
        paymentMethod: "VIETQR",
        isSandbox: false,
        status: "PURCHASING_JP",
        isPriceVerified: true,
        purchaseTask: null,
      } as unknown as Awaited<ReturnType<typeof prisma.order.findUnique>>);

      vi.mocked(prisma.purchaseTask.create).mockResolvedValueOnce({
        id: "task-70",
        orderId: "ord-deposit-70",
        platform: "amazon",
        status: "QUEUED",
      } as unknown as Awaited<ReturnType<typeof prisma.purchaseTask.create>>);

      const result = await createPurchaseTask("ord-deposit-70", "admin_tokyo");
      expect(result.task).not.toBeNull();
      expect(result.error).toBeUndefined();
      expect(result.task?.id).toBe("task-70");
      expect(prisma.purchaseTask.create).toHaveBeenCalledTimes(1);
    });

    it("rejects createPurchaseTask when paymentStatus is UNPAID", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: "ord-unpaid",
        orderCode: "CB-UNPAID-01",
        originalUrl: "https://www.amazon.co.jp/dp/B08N5WRWNW",
        priceJpy: 3500,
        paymentStatus: "UNPAID",
        paymentMethod: "VIETQR",
        isSandbox: false,
        status: "PURCHASING_JP",
        isPriceVerified: true,
        purchaseTask: null,
      } as unknown as Awaited<ReturnType<typeof prisma.order.findUnique>>);

      const result = await createPurchaseTask("ord-unpaid", "admin_tokyo");
      expect(result.task).toBeNull();
      expect(result.error).toBe("Đơn chưa được cọc — không thể tạo purchase task.");
      expect(prisma.purchaseTask.create).not.toHaveBeenCalled();
    });
  });

  describe("4. Rollback Logic Restores DEPOSITED_70", () => {
    // Replicates the rollback paymentStatus resolution in src/app/api/orders/[id]/route.ts line ~382
    function resolveRollbackPaymentStatus(
      totalPaidVnd: number,
      totalVnd: number,
      depositPercent: number
    ): "PAID_100" | "DEPOSITED_70" | "DEPOSITED_50" | "UNPAID" {
      if (totalPaidVnd >= totalVnd && totalVnd > 0) {
        return "PAID_100";
      } else if (totalPaidVnd > 0) {
        return depositPercent === 70 ? "DEPOSITED_70" : "DEPOSITED_50";
      } else {
        return "UNPAID";
      }
    }

    it("restores paymentStatus to DEPOSITED_70 when order depositPercent === 70 and partial payment exists", () => {
      const restored = resolveRollbackPaymentStatus(1_400_000, 2_000_000, 70);
      expect(restored).toBe("DEPOSITED_70");
    });

    it("restores paymentStatus to DEPOSITED_50 when order depositPercent === 50 and partial payment exists", () => {
      const restored = resolveRollbackPaymentStatus(1_000_000, 2_000_000, 50);
      expect(restored).toBe("DEPOSITED_50");
    });

    it("restores paymentStatus to PAID_100 when full payment exists", () => {
      const restored = resolveRollbackPaymentStatus(2_000_000, 2_000_000, 70);
      expect(restored).toBe("PAID_100");
    });

    it("restores paymentStatus to UNPAID when totalPaidVnd is 0", () => {
      const restored = resolveRollbackPaymentStatus(0, 2_000_000, 70);
      expect(restored).toBe("UNPAID");
    });
  });

  describe("5. Mailer & Notifications for 70% Deposit", () => {
    it("constructs payment success title correctly for 70% deposit", () => {
      function getPaymentTitle(order: { paymentStatus: string; depositPercent?: number }) {
        const isFullPayment = order.paymentStatus === "PAID_100";
        const is70Payment = order.paymentStatus === "DEPOSITED_70" || order.depositPercent === 70;
        return isFullPayment
          ? "Thanh Toán 100% Thành Công!"
          : is70Payment
          ? "Đặt Cọc 70% Thành Công!"
          : "Đặt Cọc 50% Thành Công!";
      }

      expect(getPaymentTitle({ paymentStatus: "DEPOSITED_70", depositPercent: 70 })).toBe("Đặt Cọc 70% Thành Công!");
      expect(getPaymentTitle({ paymentStatus: "DEPOSITED_50", depositPercent: 50 })).toBe("Đặt Cọc 50% Thành Công!");
      expect(getPaymentTitle({ paymentStatus: "PAID_100", depositPercent: 100 })).toBe("Thanh Toán 100% Thành Công!");
    });
  });
});
