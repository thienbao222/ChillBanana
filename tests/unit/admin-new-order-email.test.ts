import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/notifications/email-delivery", () => ({
  deliverLoggedEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: {
      findFirst: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
    },
  },
}));

import { deliverLoggedEmail } from "@/features/notifications/email-delivery";
import { prisma } from "@/lib/prisma";
import { sendAdminNewOrderEmail } from "@/lib/mailer";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("sendAdminNewOrderEmail", () => {
  it("returns false without error if ADMIN_NOTIFY_EMAIL is empty or not set", async () => {
    vi.stubEnv("ADMIN_NOTIFY_EMAIL", "");
    const res = await sendAdminNewOrderEmail({ orderCode: "TEST-01" });
    expect(res).toBe(false);
    expect(deliverLoggedEmail).not.toHaveBeenCalled();
  });

  it("sends email to multiple recipients with [CẦN DUYỆT GIÁ] when isPriceVerified is false", async () => {
    vi.stubEnv("ADMIN_NOTIFY_EMAIL", "admin1@chillbanana.vn, admin2@chillbanana.vn");
    vi.mocked(prisma.emailLog.findFirst).mockResolvedValue(null);

    const order = {
      id: "ord-1",
      orderCode: "KZN-2026-0001",
      isPriceVerified: false,
      customerName: "Nguyễn Văn A",
      customerPhone: "0901234567",
      customerEmail: "khach@example.com",
      customerAddress: "123 Lê Lợi, Q1, TP.HCM",
      customerNote: "Giao giờ hành chính",
      totalVnd: 1250000,
      createdAt: new Date("2026-10-24T01:30:00Z"),
      orderItems: [
        {
          itemType: "EXTERNAL",
          productName: "Nồi cơm Zojirushi [https://www.amazon.co.jp/dp/B08XYZ]",
          quantity: 1,
          priceJpy: 6000,
          weightKg: 1.2,
        },
      ],
    };

    const res = await sendAdminNewOrderEmail(order);
    expect(res).toBe(true);
    expect(deliverLoggedEmail).toHaveBeenCalledTimes(1);

    const callArg = vi.mocked(deliverLoggedEmail).mock.calls[0][0];
    expect(callArg.emailType).toBe("admin-new-order");
    expect(callArg.to).toBe("admin1@chillbanana.vn, admin2@chillbanana.vn");
    expect(callArg.subject).toBe("[CẦN DUYỆT GIÁ] Đơn KZN-2026-0001");
    expect(callArg.html).toContain("KZN-2026-0001");
    expect(callArg.html).toContain("Nguyễn Văn A");
    expect(callArg.html).toContain("0901234567");
    expect(callArg.html).toContain("123 Lê Lợi, Q1, TP.HCM");
    expect(callArg.html).toContain("Giao giờ hành chính");
    expect(callArg.html).toContain("1.250.000 đ");
    expect(callArg.html).toContain("Nồi cơm Zojirushi");
    expect(callArg.html).toContain("Amazon JP");
    expect(callArg.html).toContain("https://www.amazon.co.jp/dp/B08XYZ");
    expect(callArg.html).toContain("Mở bảng duyệt giá");
    expect(callArg.html).toContain("/admin");
  });

  it("sends email with [Đơn mới] when isPriceVerified is true and handles Catalog items without links", async () => {
    vi.stubEnv("ADMIN_NOTIFY_EMAIL", "boss@chillbanana.vn");
    vi.mocked(prisma.emailLog.findFirst).mockResolvedValue(null);

    const order = {
      id: "ord-2",
      orderCode: "KZN-2026-0002",
      isPriceVerified: true,
      customerName: "Trần Thị B",
      customerPhone: "0987654321",
      customerEmail: "b@example.com",
      customerAddress: "456 Kim Mã, Ba Đình, Hà Nội",
      customerNote: null,
      totalVnd: 850000,
      createdAt: new Date("2026-10-24T02:00:00Z"),
      orderItems: [
        {
          itemType: "CATALOG",
          productName: "Tảo biển Spirulina",
          quantity: 2,
          priceJpy: 2500,
          weightKg: 0.5,
          product: {
            name: "Tảo biển Spirulina",
            imageUrl: "https://example.com/tao.jpg",
            originalStore: "Don Quijote",
          },
        },
      ],
    };

    const res = await sendAdminNewOrderEmail(order);
    expect(res).toBe(true);

    const callArg = vi.mocked(deliverLoggedEmail).mock.calls[0][0];
    expect(callArg.subject).toBe("[Đơn mới] KZN-2026-0002");
    expect(callArg.html).toContain("Catalog (Don Quijote)");
    expect(callArg.html).toContain("Hàng Catalog");
    expect(callArg.html).not.toContain("https://example.com/tao.jpg"); // Catalog items do not have product links
  });

  it("prevents sending duplicate emails for the same order", async () => {
    vi.stubEnv("ADMIN_NOTIFY_EMAIL", "admin@chillbanana.vn");
    vi.mocked(prisma.emailLog.findFirst).mockResolvedValue({ id: "log-existing" } as any);

    const res = await sendAdminNewOrderEmail({ id: "ord-duplicate", orderCode: "KZN-DUP" });
    expect(res).toBe(false);
    expect(deliverLoggedEmail).not.toHaveBeenCalled();
  });
});
