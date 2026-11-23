import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  calculateOrderPrice,
  DEFAULT_PRICING_CONFIG,
  PricingConfigValues,
} from "@/features/pricing/calculator";
import { validatePricingConfig } from "@/features/pricing/config";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/mailer", () => ({
  sendOrderStatusUpdateEmail: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/prisma";
import {
  releaseExpiredOrderReservations,
  lazyReleaseExpiredReservations,
} from "@/features/orders/reservations";

describe("WP1.2: groupBuyEnabled và tính cước gộp đơn", () => {
  it("khi groupBuyEnabled=false, tick isGroupBuy=true KHÔNG được giảm cước", () => {
    const configWithGroupBuyDisabled: PricingConfigValues = {
      ...DEFAULT_PRICING_CONFIG,
      groupBuyEnabled: false,
    };

    const solo = calculateOrderPrice(10_000, 0.5, 170, false, configWithGroupBuyDisabled);
    const checkedGroupBuy = calculateOrderPrice(10_000, 0.5, 170, true, configWithGroupBuyDisabled);

    // Cước phải bằng nhau, không được giảm khi tính năng gộp đơn bị tắt
    expect(checkedGroupBuy.shippingFeeVnd).toBe(solo.shippingFeeVnd);
    expect(checkedGroupBuy.shippingFeeVnd).toBe(92_500);
  });

  it("khi groupBuyEnabled=true, tick isGroupBuy=true ĐƯỢC giảm 25% cước cho kiện ≤ 0.5kg", () => {
    const configWithGroupBuyEnabled: PricingConfigValues = {
      ...DEFAULT_PRICING_CONFIG,
      groupBuyEnabled: true,
    };

    const solo = calculateOrderPrice(10_000, 0.5, 170, false, configWithGroupBuyEnabled);
    const checkedGroupBuy = calculateOrderPrice(10_000, 0.5, 170, true, configWithGroupBuyEnabled);

    expect(checkedGroupBuy.shippingFeeVnd).toBeLessThan(solo.shippingFeeVnd);
    expect(checkedGroupBuy.shippingFeeVnd).toBe(
      Math.round(0.5 * Math.round(configWithGroupBuyEnabled.airShippingPerKgVnd * 0.75))
    );
  });

  it("validatePricingConfig chấp nhận và giữ nguyên cờ groupBuyEnabled", () => {
    const raw = {
      ...DEFAULT_PRICING_CONFIG,
      groupBuyEnabled: true,
    };
    const validated = validatePricingConfig(raw);
    expect("values" in validated && validated.values.groupBuyEnabled).toBe(true);
  });
});

describe("WP1.2: Giải phóng kho quá hạn quoteHoldExpiresAt cho giỏ hỗn hợp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("quét cả đơn quá hạn reservationExpiresAt VÀ quoteHoldExpiresAt", async () => {
    const mockOrder = {
      id: "order-mixed-1",
      orderCode: "CB-MIXED-1",
      status: "PENDING_DEPOSIT",
      paymentStatus: "UNPAID",
      quoteHoldExpiresAt: new Date(Date.now() - 1000), // đã quá hạn
      reservationExpiresAt: null,
      reservationReleasedAt: null,
      orderItems: [
        { itemType: "CATALOG", productId: "prod-1", quantity: 2 },
      ],
    };

    vi.mocked(prisma.order.findMany).mockResolvedValue([mockOrder as any]);

    const txMock = {
      order: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...mockOrder,
          status: "CANCELLED",
          trackingLogs: [],
        }),
      },
      product: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      trackingLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      return callback(txMock);
    });

    const result = await releaseExpiredOrderReservations(20, true);

    expect(result.released).toBe(1);
    expect(txMock.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CANCELLED",
          quoteHoldExpiresAt: null,
          reservationExpiresAt: null,
        }),
      })
    );
    // Suất kho được hoàn trả
    expect(txMock.product.updateMany).toHaveBeenCalledWith({
      where: { id: "prod-1" },
      data: { stockSlots: { increment: 2 } },
    });
    // Tiêu đề log ghi nhận đúng do hết hạn chờ duyệt giá
    expect(txMock.trackingLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Hết thời gian giữ hàng chờ duyệt giá",
        }),
      })
    );
  });

  it("idempotent: không hoàn suất 2 lần nếu claimed.count !== 1 (tranh chấp)", async () => {
    const mockOrder = {
      id: "order-2",
      orderCode: "CB-2",
      quoteHoldExpiresAt: new Date(Date.now() - 1000),
      orderItems: [{ itemType: "CATALOG", productId: "prod-1", quantity: 1 }],
    };

    vi.mocked(prisma.order.findMany).mockResolvedValue([mockOrder as any]);

    const txMock = {
      order: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }), // Bị tiến trình khác tranh chấp cập nhật trước
      },
      product: {
        updateMany: vi.fn(),
      },
      trackingLog: {
        create: vi.fn(),
      },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      return callback(txMock);
    });

    const result = await releaseExpiredOrderReservations(20, true);

    expect(result.released).toBe(0);
    expect(result.conflicts).toBe(1);
    expect(txMock.product.updateMany).not.toHaveBeenCalled();
  });
});
