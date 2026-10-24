import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  evaluateActionItemRules,
  ActionRuleInput,
} from "@/features/ai/admin/action-items";
import {
  interpolateEmailTemplate,
  FALLBACK_EMAIL_TEMPLATES,
  ControlledDraftType,
} from "@/features/ai/admin/controlled-email";
import { detectModulesByKeywords } from "@/features/ai/admin/module-router";
import { getAdminAiModuleSnapshot } from "@/features/ai/admin/snapshots";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      findUnique: vi.fn(),
    },
    chatSession: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    customer: {
      count: vi.fn(),
    },
    product: {
      count: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    vnJpShipment: {
      count: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    emailLog: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/features/pricing/exchange-rate", () => ({
  fetchLiveExchangeRate: vi.fn(async () => ({
    rate: 171.8,
    roundedRate: 172,
    previousRate: 171.5,
    changePercent: 0.17,
    updatedAt: new Date().toISOString(),
    source: "Vietcombank Live",
    isFallback: false,
    isStale: false,
    isVolatile: false,
  })),
}));

describe("Admin AI - Deterministic Action Item Rules (Việc cần làm hôm nay)", () => {
  const now = new Date("2026-10-25T10:00:00.000Z");

  it("Rule 1: Đơn chờ duyệt giá > 4 giờ được gắn nhãn ưu tiên CAO và deep link đúng", () => {
    const input: ActionRuleInput = {
      unverifiedOrders: [
        {
          orderCode: "KZN-OVER-4H",
          createdAt: new Date("2026-10-25T04:00:00.000Z"), // 6 hours ago
          weightKg: 0,
        },
        {
          orderCode: "KZN-FRESH-1H",
          createdAt: new Date("2026-10-25T09:00:00.000Z"), // 1 hour ago
          weightKg: 1.2,
        },
      ],
      pendingDepositOrders: [],
      stalledOrders: [],
      failedEmails: [],
    };

    const items = evaluateActionItemRules(input, now);
    const unverifiedItem = items.find((i) => i.id === "unverified-over-4h");

    expect(unverifiedItem).toBeDefined();
    expect(unverifiedItem?.priority).toBe("high");
    expect(unverifiedItem?.itemCount).toBe(1);
    expect(unverifiedItem?.orderCodes).toEqual(["KZN-OVER-4H"]);
    expect(unverifiedItem?.deepLink).toBe("/admin?tab=orders&filter=unverified");
  });

  it("Rule 2: Đơn chờ cọc sắp hết hạn trong 24 giờ được gắn nhãn ưu tiên CAO", () => {
    const input: ActionRuleInput = {
      unverifiedOrders: [],
      pendingDepositOrders: [
        {
          orderCode: "KZN-EXPIRING-SOON",
          createdAt: new Date("2026-10-24T12:00:00.000Z"),
          reservationExpiresAt: new Date("2026-10-25T18:00:00.000Z"), // in 8 hours
        },
        {
          orderCode: "KZN-SAFE-DEPOSIT",
          createdAt: new Date("2026-10-25T08:00:00.000Z"),
          reservationExpiresAt: new Date("2026-10-28T12:00:00.000Z"), // in 3 days
        },
      ],
      stalledOrders: [],
      failedEmails: [],
    };

    const items = evaluateActionItemRules(input, now);
    const depositItem = items.find((i) => i.id === "expiring-reservations");

    expect(depositItem).toBeDefined();
    expect(depositItem?.priority).toBe("high");
    expect(depositItem?.itemCount).toBe(1);
    expect(depositItem?.orderCodes).toEqual(["KZN-EXPIRING-SOON"]);
    expect(depositItem?.deepLink).toBe("/admin?tab=orders&status=PENDING_DEPOSIT");
  });

  it("Rule 3: Đơn hàng kẹt ở kho hoặc đứng yên > 3 ngày được gắn nhãn ưu tiên TRUNG BÌNH", () => {
    const input: ActionRuleInput = {
      unverifiedOrders: [],
      pendingDepositOrders: [],
      stalledOrders: [
        { orderCode: "KZN-STALLED-4D", status: "WAREHOUSE_JP", daysStalled: 4 },
        { orderCode: "KZN-STALLED-5D", status: "IN_TRANSIT_AIR", daysStalled: 5 },
        { orderCode: "KZN-FRESH-1D", status: "WAREHOUSE_VN", daysStalled: 1 },
      ],
      failedEmails: [],
    };

    const items = evaluateActionItemRules(input, now);
    const stalledItem = items.find((i) => i.id === "stalled-warehouse-over-3d");

    expect(stalledItem).toBeDefined();
    expect(stalledItem?.priority).toBe("medium");
    expect(stalledItem?.itemCount).toBe(2);
    expect(stalledItem?.orderCodes).toEqual(["KZN-STALLED-4D", "KZN-STALLED-5D"]);
    expect(stalledItem?.deepLink).toBe("/admin?tab=operations");
  });

  it("Rule 4: Email thất bại gửi lại được gắn nhãn ưu tiên TRUNG BÌNH và gom mã đơn", () => {
    const input: ActionRuleInput = {
      unverifiedOrders: [],
      pendingDepositOrders: [],
      stalledOrders: [],
      failedEmails: [
        { id: "log-1", orderCode: "KZN-MAIL-FAIL-1", lastErrorCode: "SMTP_TIMEOUT" },
        { id: "log-2", orderCode: "KZN-MAIL-FAIL-1", lastErrorCode: "RETRY_LIMIT" },
        { id: "log-3", orderCode: null, lastErrorCode: "AUTH_ERROR" },
      ],
    };

    const items = evaluateActionItemRules(input, now);
    const emailItem = items.find((i) => i.id === "failed-emails-retry");

    expect(emailItem).toBeDefined();
    expect(emailItem?.priority).toBe("medium");
    expect(emailItem?.itemCount).toBe(3);
    expect(emailItem?.orderCodes).toEqual(["KZN-MAIL-FAIL-1"]);
    expect(emailItem?.deepLink).toBe("/admin?tab=audit&filter=emails");
  });

  it("Rule 5: Vận đơn VN→JP có kiểm dịch MAFF được phát hiện và cảnh báo", () => {
    const input: ActionRuleInput = {
      unverifiedOrders: [],
      pendingDepositOrders: [],
      stalledOrders: [],
      failedEmails: [],
      maffShipments: [
        { trackingCode: "VNJP-2026-FOOD1", cargoType: "food" },
        { trackingCode: "VNJP-2026-FOOD2", cargoType: "food" },
      ],
    };

    const items = evaluateActionItemRules(input, now);
    const maffItem = items.find((i) => i.id === "maff-quarantine-check");

    expect(maffItem).toBeDefined();
    expect(maffItem?.priority).toBe("high");
    expect(maffItem?.itemCount).toBe(2);
    expect(maffItem?.orderCodes).toEqual(["VNJP-2026-FOOD1", "VNJP-2026-FOOD2"]);
    expect(maffItem?.deepLink).toBe("/admin?tab=vn_jp_dispatch");
  });

  it("Trả về danh sách rỗng khi không có vấn đề nào vượt ngưỡng", () => {
    const emptyInput: ActionRuleInput = {
      unverifiedOrders: [],
      pendingDepositOrders: [],
      stalledOrders: [{ orderCode: "KZN-1", status: "PURCHASING_JP", daysStalled: 1 }],
      failedEmails: [],
    };

    const items = evaluateActionItemRules(emptyInput, now);
    expect(items).toEqual([]);
  });
});

describe("Admin AI - Snapshot PII Hygiene (Không rò rỉ thông tin định danh cá nhân)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Approvals snapshot: Không chứa tên khách, email, số điện thoại hay địa chỉ", async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValueOnce([
      {
        orderCode: "KZN-2026-SECRET-1",
        productName: "Mô hình RG Gundam",
        originalUrl: "https://amazon.co.jp/dp/test",
        weightKg: 0.5,
        totalVnd: 500000,
        createdAt: new Date(),
        _count: { orderItems: 1 },
      } as any,
    ]).mockResolvedValueOnce([
      {
        orderCode: "KZN-2026-SECRET-2",
        productName: "Trà xanh Uji",
        totalVnd: 300000,
        depositAmountVnd: 0,
        reservationExpiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      } as any,
    ]);

    const snapshot = await getAdminAiModuleSnapshot("approvals");
    const jsonStr = JSON.stringify(snapshot);

    // Kiểm tra không chứa các trường PII
    expect(jsonStr).not.toContain("customerName");
    expect(jsonStr).not.toContain("customerEmail");
    expect(jsonStr).not.toContain("customerPhone");
    expect(jsonStr).not.toContain("customerAddress");
    expect(jsonStr).toContain("KZN-2026-SECRET-1");
  });

  it("Logistics snapshot: Không chứa tên, SĐT hay địa chỉ cá nhân người gửi/người nhận", async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValueOnce([
      {
        orderCode: "KZN-LOGISTICS-1",
        status: "WAREHOUSE_JP",
        updatedAt: new Date(),
        createdAt: new Date(),
        trackingLogs: [{ createdAt: new Date(), status: "WAREHOUSE_JP", title: "Nhập kho Tokyo" }],
      } as any,
    ]);
    vi.mocked(prisma.vnJpShipment.groupBy).mockResolvedValueOnce([
      { status: "WAREHOUSE_VN_INSPECTED", _count: { _all: 3 } } as any,
    ]);
    vi.mocked(prisma.vnJpShipment.findMany).mockResolvedValueOnce([
      {
        trackingCode: "VNJP-8891",
        cargoType: "food",
        cargoDetails: "Bánh đậu xanh Hải Dương",
        status: "PENDING_CONFIRMATION",
        maffAgreement: true,
        createdAt: new Date(),
      } as any,
    ]);

    const snapshot = await getAdminAiModuleSnapshot("logistics");
    const jsonStr = JSON.stringify(snapshot);

    expect(jsonStr).not.toContain("senderName");
    expect(jsonStr).not.toContain("senderPhone");
    expect(jsonStr).not.toContain("receiverName");
    expect(jsonStr).not.toContain("receiverPhone");
    expect(jsonStr).not.toContain("senderAddress");
    expect(jsonStr).not.toContain("receiverAddress");
    expect(jsonStr).toContain("VNJP-8891");
  });

  it("Payments snapshot: Không chứa thông tin tài khoản hay PII", async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValueOnce([
      {
        orderCode: "KZN-PAY-1",
        productName: "Kem dưỡng da Shiseido",
        status: "PENDING_DEPOSIT",
        paymentStatus: "DEPOSITED_50",
        depositAmountVnd: 250000,
        totalVnd: 500000,
        createdAt: new Date(),
      } as any,
    ]);

    const snapshot = await getAdminAiModuleSnapshot("payments");
    const jsonStr = JSON.stringify(snapshot);

    expect(jsonStr).not.toContain("customerName");
    expect(jsonStr).not.toContain("customerEmail");
    expect(jsonStr).not.toContain("customerPhone");
    expect(jsonStr).toContain("KZN-PAY-1");
  });

  it("Emails snapshot: Không chứa địa chỉ email khách hàng (PII)", async () => {
    vi.mocked(prisma.emailLog.count).mockResolvedValue(2);
    vi.mocked(prisma.emailLog.findMany).mockResolvedValueOnce([
      {
        id: "log-abc",
        emailType: "order-confirmation",
        status: "FAILED",
        attemptCount: 3,
        maxAttempts: 3,
        lastErrorCode: "ECONNREFUSED",
        nextRetryAt: null,
        createdAt: new Date(),
        order: { orderCode: "KZN-EMAIL-FAIL" },
      } as any,
    ]);

    const snapshot = await getAdminAiModuleSnapshot("emails");
    const jsonStr = JSON.stringify(snapshot);

    expect(jsonStr).not.toContain("@gmail.com");
    expect(jsonStr).not.toContain("recipient");
    expect(jsonStr).toContain("KZN-EMAIL-FAIL");
  });
});

describe("Admin AI - Controlled Email Drafting (Soạn thảo có kiểm soát)", () => {
  it("interpolateEmailTemplate thay thế đầy đủ 3 chỗ giữ {{customerName}}, {{orderCode}}, {{statusLabel}}", () => {
    const template = {
      subject: "Thông báo đơn #{{orderCode}} của Quý khách {{customerName}}",
      body: "Kính gửi {{customerName}},\nĐơn hàng #{{orderCode}} hiện có trạng thái: {{statusLabel}}.\n{{customerName}} vui lòng kiểm tra.",
    };

    const context = {
      customerName: "Nguyễn Văn Bảo",
      orderCode: "KZN-2026-9999",
      statusLabel: "Chờ cọc",
    };

    const result = interpolateEmailTemplate(template, context);

    expect(result.subject).toBe("Thông báo đơn #KZN-2026-9999 của Quý khách Nguyễn Văn Bảo");
    expect(result.body).toContain("Kính gửi Nguyễn Văn Bảo,");
    expect(result.body).toContain("Đơn hàng #KZN-2026-9999 hiện có trạng thái: Chờ cọc.");
    expect(result.body).toContain("Nguyễn Văn Bảo vui lòng kiểm tra.");
    expect(result.body).not.toContain("{{customerName}}");
    expect(result.body).not.toContain("{{orderCode}}");
    expect(result.body).not.toContain("{{statusLabel}}");
  });

  it("Cả 3 mẫu email chuẩn đều chứa đúng 3 chỗ giữ bắt buộc", () => {
    const types: ControlledDraftType[] = ["price_verification", "delay_apology", "status_adjustment"];

    for (const type of types) {
      const draft = FALLBACK_EMAIL_TEMPLATES[type];
      expect(draft.subject).toContain("{{orderCode}}");
      expect(draft.body).toContain("{{customerName}}");
      expect(draft.body).toContain("{{orderCode}}");
      expect(draft.body).toContain("{{statusLabel}}");
    }
  });
});

describe("Admin AI - Module Keyword Routing", () => {
  it("Nhận diện đúng module từ câu hỏi quản trị", () => {
    expect(detectModulesByKeywords("Cần duyệt giá các đơn ngoài catalog")).toContain("approvals");
    expect(detectModulesByKeywords("Những đơn hàng nào đang đứng yên ở kho Nhật Bản?")).toContain("logistics");
    expect(detectModulesByKeywords("Đơn đã cọc nhưng chưa chuyển trạng thái và tỷ giá hiện tại")).toContain("payments");
    expect(detectModulesByKeywords("Có bao nhiêu email thông báo gửi thất bại?")).toContain("emails");
    expect(detectModulesByKeywords("Tình hình tổng quan vận hành hôm nay")).toContain("overview");
  });
});
