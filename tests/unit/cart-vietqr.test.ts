import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { getAllowedDepositOptions } from "@/context/CartContext";
import { calculateDepositV2 } from "@/features/payments/policy";
import { POST } from "@/app/api/admin/orders/[id]/payments/route";
import { prisma } from "@/lib/prisma";
import { makeRequest } from "../helpers/request";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    $transaction: vi.fn(),
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

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/mailer", () => ({
  sendPaymentSuccessEmail: vi.fn(async () => true),
}));

describe("Milestone 3 (R3) - Giỏ hàng 3 bậc & Xử lý thanh toán VietQR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Tính toán 3 bậc đặt cọc đồng bộ giữa máy chủ và giỏ hàng", () => {
    it("Đơn hàng < 1.000.000 VND: chỉ cho phép thanh toán 100% (bậc LOW)", () => {
      const amounts = [0, 100_000, 500_000, 999_999];
      for (const amount of amounts) {
        const policy = calculateDepositV2(amount);
        expect(policy.tier).toBe("LOW");
        expect(policy.depositPercent).toBe(100);

        const options = getAllowedDepositOptions(amount);
        expect(options).toEqual([100]);
      }
    });

    it("Đơn hàng từ 1.000.000 VND đến 10.000.000 VND: cho phép cọc 70% hoặc 100% (bậc STANDARD)", () => {
      const amounts = [1_000_000, 3_500_000, 5_000_000, 10_000_000];
      for (const amount of amounts) {
        const policy = calculateDepositV2(amount);
        expect(policy.tier).toBe("STANDARD");
        expect(policy.depositPercent).toBe(70);

        const options = getAllowedDepositOptions(amount);
        expect(options).toEqual([70, 100]);
      }
    });

    it("Đơn hàng > 10.000.000 VND: cho phép cọc 50%, 70% hoặc 100% (bậc HIGH)", () => {
      const amounts = [10_000_001, 15_000_000, 50_000_000];
      for (const amount of amounts) {
        const policy = calculateDepositV2(amount);
        expect(policy.tier).toBe("HIGH");
        expect(policy.depositPercent).toBe(50);

        const options = getAllowedDepositOptions(amount);
        expect(options).toEqual([50, 70, 100]);
      }
    });
  });

  describe("2. Kiểm tra loại bỏ số tài khoản VietQR tĩnh ('0901234567')", () => {
    it("Không còn bất kỳ xuất hiện nào của số '0901234567' trong toàn bộ thư mục src", () => {
      const srcDir = path.resolve(process.cwd(), "src");
      const foundMatches: string[] = [];

      function scanDir(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scanDir(fullPath);
          } else if (entry.isFile()) {
            const content = fs.readFileSync(fullPath, "utf-8");
            if (content.includes("0901234567")) {
              foundMatches.push(fullPath);
            }
          }
        }
      }

      scanDir(srcDir);
      expect(foundMatches).toEqual([]);
    });
  });

  describe("3. Luồng duyệt thanh toán VietQR tự động chuyển trạng thái đơn hàng", () => {
    it("Đơn hàng bay từ Nhật (fulfillmentOrigin = 'JP'): tự động chuyển sang PURCHASING_JP", async () => {
      const mockOrder = {
        id: "order-jp-1",
        orderCode: "CB-JP-001",
        status: "PENDING_DEPOSIT",
        paymentStatus: "UNPAID",
        isPriceVerified: true,
        depositAmountVnd: 700_000,
        depositPercent: 70,
        reservationExpiresAt: null,
        fulfillmentOrigin: "JP",
      };

      vi.mocked(prisma.order.findFirst).mockResolvedValueOnce(mockOrder as any);

      let updatePayload: any = null;
      let trackingPayload: any = null;

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: any) => {
        const tx = {
          order: {
            updateMany: vi.fn(async (params) => {
              updatePayload = params;
              return { count: 1 };
            }),
            findUniqueOrThrow: vi.fn(async () => ({
              ...mockOrder,
              status: "PURCHASING_JP",
              paymentStatus: "DEPOSITED_70",
            })),
          },
          paymentTransaction: {
            create: vi.fn(async () => ({})),
          },
          trackingLog: {
            create: vi.fn(async (params) => {
              trackingPayload = params;
              return {};
            }),
          },
        };
        return callback(tx);
      });

      const req = makeRequest("POST", "/api/admin/orders/CB-JP-001/payments", {
        json: {
          amountVnd: 700_000,
          reference: "FT260012345678",
        },
      });

      const res = await POST(req, { params: Promise.resolve({ id: "CB-JP-001" }) });
      expect(res.status).toBe(200);

      // Xác nhận order được cập nhật sang PURCHASING_JP và DEPOSITED_70
      expect(updatePayload).not.toBeNull();
      expect(updatePayload.data.status).toBe("PURCHASING_JP");
      expect(updatePayload.data.paymentStatus).toBe("DEPOSITED_70");
      expect(updatePayload.data.paymentMethod).toBe("VIETQR");

      // Xác nhận trackingLog ghi nhận PURCHASING_JP
      expect(trackingPayload).not.toBeNull();
      expect(trackingPayload.data.status).toBe("PURCHASING_JP");
      expect(trackingPayload.data.title).toBe("Đã ghi nhận tiền cọc 70%");
      expect(trackingPayload.data.description).toContain("PURCHASING_JP");
    });

    it("Đơn hàng sẵn tại kho VN (fulfillmentOrigin = 'VN'): tự động chuyển sang WAREHOUSE_VN", async () => {
      const mockOrder = {
        id: "order-vn-1",
        orderCode: "CB-VN-001",
        status: "PENDING_DEPOSIT",
        paymentStatus: "UNPAID",
        isPriceVerified: true,
        depositAmountVnd: 1_000_000,
        depositPercent: 100,
        reservationExpiresAt: null,
        fulfillmentOrigin: "VN",
      };

      vi.mocked(prisma.order.findFirst).mockResolvedValueOnce(mockOrder as any);

      let updatePayload: any = null;
      let trackingPayload: any = null;

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: any) => {
        const tx = {
          order: {
            updateMany: vi.fn(async (params) => {
              updatePayload = params;
              return { count: 1 };
            }),
            findUniqueOrThrow: vi.fn(async () => ({
              ...mockOrder,
              status: "WAREHOUSE_VN",
              paymentStatus: "PAID_100",
            })),
          },
          paymentTransaction: {
            create: vi.fn(async () => ({})),
          },
          trackingLog: {
            create: vi.fn(async (params) => {
              trackingPayload = params;
              return {};
            }),
          },
        };
        return callback(tx);
      });

      const req = makeRequest("POST", "/api/admin/orders/CB-VN-001/payments", {
        json: {
          amountVnd: 1_000_000,
          reference: "FT260087654321",
        },
      });

      const res = await POST(req, { params: Promise.resolve({ id: "CB-VN-001" }) });
      expect(res.status).toBe(200);

      // Xác nhận order được cập nhật sang WAREHOUSE_VN và PAID_100
      expect(updatePayload).not.toBeNull();
      expect(updatePayload.data.status).toBe("WAREHOUSE_VN");
      expect(updatePayload.data.paymentStatus).toBe("PAID_100");

      // Xác nhận trackingLog ghi nhận WAREHOUSE_VN
      expect(trackingPayload).not.toBeNull();
      expect(trackingPayload.data.status).toBe("WAREHOUSE_VN");
      expect(trackingPayload.data.title).toBe("Đã ghi nhận thanh toán 100%");
      expect(trackingPayload.data.description).toContain("kho Việt Nam");
    });
  });
});
