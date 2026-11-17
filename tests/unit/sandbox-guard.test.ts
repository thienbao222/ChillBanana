import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { isMockSandboxAllowed, enforceMockSandboxAllowed } from "@/features/payments/sandbox-guard";
import { POST as mockSandboxPost } from "@/app/api/payment/mock-sandbox/route";
import { POST as mockConfirmPost } from "@/app/api/payment/mock-confirm/route";
import { POST as mockTransitionPost } from "@/app/api/admin/orders/[id]/mock-transition/route";
import { GET as demoEmailsGet, DELETE as demoEmailsDelete } from "@/app/api/admin/demo-emails/route";
import { createPurchaseTask } from "@/features/purchasing/service";
import { GET as purchaseTaskOrdersGet } from "@/app/api/admin/purchase-tasks/orders/route";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    purchaseTask: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    paymentTransaction: {
      create: vi.fn(),
    },
    trackingLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb({
      order: { updateMany: vi.fn() },
      paymentTransaction: { create: vi.fn() },
      trackingLog: { create: vi.fn() },
    })),
  },
}));

vi.mock("@/lib/admin-guard", () => ({
  requireAdmin: vi.fn(async () => ({ ok: true, username: "test-admin", role: "SUPER_ADMIN" })),
}));

vi.mock("@/features/purchasing/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/purchasing/service")>();
  return {
    ...actual,
    lookupProductInfo: vi.fn(async () => ({
      platform: "amazon",
      externalProductId: "B00TEST",
      platformUrl: "https://amazon.co.jp/dp/B00TEST",
      scrapedPriceJpy: 2000,
    })),
  };
});

describe("Milestone 1 (R1): Sandbox Guard & Environment Isolation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("1. isMockSandboxAllowed() Policy", () => {
    it("returns false when APP_ENV is production", () => {
      process.env.APP_ENV = "production";
      expect(isMockSandboxAllowed()).toBe(false);

      process.env.APP_ENV = "PRODUCTION";
      expect(isMockSandboxAllowed()).toBe(false);
    });

    it("returns false for non-demo/non-test environments (staging, dev, arbitrary)", () => {
      process.env.APP_ENV = "staging";
      expect(isMockSandboxAllowed()).toBe(false);

      process.env.APP_ENV = "live";
      expect(isMockSandboxAllowed()).toBe(false);

      process.env.APP_ENV = "development";
      expect(isMockSandboxAllowed()).toBe(false);
    });

    it("returns true when APP_ENV is demo", () => {
      process.env.APP_ENV = "demo";
      expect(isMockSandboxAllowed()).toBe(true);

      process.env.APP_ENV = "DEMO";
      expect(isMockSandboxAllowed()).toBe(true);
    });

    it("returns true when APP_ENV is test", () => {
      process.env.APP_ENV = "test";
      expect(isMockSandboxAllowed()).toBe(true);

      process.env.APP_ENV = "TEST";
      expect(isMockSandboxAllowed()).toBe(true);
    });

    it("returns false when not in test and APP_ENV is not set", () => {
      delete process.env.APP_ENV;
      delete process.env.NEXT_PUBLIC_APP_ENV;
      const savedNodeEnv = process.env.NODE_ENV;
      const savedVitest = process.env.VITEST;

      process.env.NODE_ENV = "production";
      delete process.env.VITEST;

      expect(isMockSandboxAllowed()).toBe(false);

      process.env.NODE_ENV = savedNodeEnv;
      process.env.VITEST = savedVitest;
    });

    it("returns true in test runner when APP_ENV is unset", () => {
      delete process.env.APP_ENV;
      delete process.env.NEXT_PUBLIC_APP_ENV;
      process.env.NODE_ENV = "test";
      expect(isMockSandboxAllowed()).toBe(true);
    });
  });

  describe("2. enforceMockSandboxAllowed() Guard", () => {
    it("returns 404 response with error 'Not Found' when not allowed", async () => {
      process.env.APP_ENV = "production";
      const res = enforceMockSandboxAllowed();
      expect(res).not.toBeNull();
      expect(res?.status).toBe(404);

      const json = await res?.json();
      expect(json).toEqual({ error: "Not Found" });
    });

    it("returns null when allowed in demo mode", () => {
      process.env.APP_ENV = "demo";
      expect(enforceMockSandboxAllowed()).toBeNull();
    });

    it("returns null when allowed in test mode", () => {
      process.env.APP_ENV = "test";
      expect(enforceMockSandboxAllowed()).toBeNull();
    });
  });

  describe("3. Mock & Sandbox API Routes Locked on Production", () => {
    beforeEach(() => {
      process.env.APP_ENV = "production";
    });

    it("POST /api/payment/mock-sandbox returns 404 in production", async () => {
      const req = new NextRequest("http://localhost:3000/api/payment/mock-sandbox", {
        method: "POST",
        body: JSON.stringify({ orderCode: "CB-2026-TEST", action: "success" }),
      });
      const res = await mockSandboxPost(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data).toEqual({ error: "Not Found" });
    });

    it("POST /api/payment/mock-confirm returns 404 in production", async () => {
      const req = new NextRequest("http://localhost:3000/api/payment/mock-confirm", {
        method: "POST",
        body: JSON.stringify({ token: "test-token", outcome: "success" }),
      });
      const res = await mockConfirmPost(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data).toEqual({ error: "Not Found" });
    });

    it("POST /api/admin/orders/[id]/mock-transition returns 404 in production", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/orders/order-1/mock-transition", {
        method: "POST",
        body: JSON.stringify({ targetStatus: "PURCHASING_JP" }),
      });
      const res = await mockTransitionPost(req, { params: Promise.resolve({ id: "order-1" }) });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data).toEqual({ error: "Not Found" });
    });

    it("GET and DELETE /api/admin/demo-emails return 404 in production", async () => {
      const getReq = new NextRequest("http://localhost:3000/api/admin/demo-emails", { method: "GET" });
      const getRes = await demoEmailsGet(getReq);
      expect(getRes.status).toBe(404);
      expect(await getRes.json()).toEqual({ error: "Not Found" });

      const delReq = new NextRequest("http://localhost:3000/api/admin/demo-emails", { method: "DELETE" });
      const delRes = await demoEmailsDelete(delReq);
      expect(delRes.status).toBe(404);
      expect(await delRes.json()).toEqual({ error: "Not Found" });
    });
  });

  describe("4. Sandbox Orders Excluded from Tokyo Purchasing Queue", () => {
    beforeEach(() => {
      process.env.APP_ENV = "test";
    });

    it("createPurchaseTask rejects order when isSandbox is true", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: "ord-sandbox-1",
        orderCode: "CB-SANDBOX-1",
        originalUrl: "https://amazon.co.jp/dp/B00TEST",
        priceJpy: 2000,
        paymentStatus: "DEPOSITED_50",
        paymentMethod: "VIETQR",
        isSandbox: true,
        status: "PURCHASING_JP",
        isPriceVerified: true,
        purchaseTask: null,
      } as unknown as Awaited<ReturnType<typeof prisma.order.findUnique>>);

      const result = await createPurchaseTask("ord-sandbox-1", "admin");
      expect(result.task).toBeNull();
      expect(result.error).toBe("Đơn hàng Sandbox/Mô phỏng không được phép đưa vào hàng đợi mua hàng thật.");
    });

    it("createPurchaseTask rejects order when paymentMethod is VNPAY_SANDBOX", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: "ord-vnpay-sb",
        orderCode: "CB-SB-2",
        originalUrl: "https://amazon.co.jp/dp/B00TEST",
        priceJpy: 2000,
        paymentStatus: "DEPOSITED_50",
        paymentMethod: "VNPAY_SANDBOX",
        isSandbox: false,
        status: "PURCHASING_JP",
        isPriceVerified: true,
        purchaseTask: null,
      } as unknown as Awaited<ReturnType<typeof prisma.order.findUnique>>);

      const result = await createPurchaseTask("ord-vnpay-sb", "admin");
      expect(result.task).toBeNull();
      expect(result.error).toBe("Đơn hàng Sandbox/Mô phỏng không được phép đưa vào hàng đợi mua hàng thật.");
    });

    it("createPurchaseTask rejects order when paymentMethod is MOCK", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: "ord-mock",
        orderCode: "CB-MOCK-3",
        originalUrl: "https://amazon.co.jp/dp/B00TEST",
        priceJpy: 2000,
        paymentStatus: "DEPOSITED_50",
        paymentMethod: "MOCK",
        isSandbox: false,
        status: "PURCHASING_JP",
        isPriceVerified: true,
        purchaseTask: null,
      } as unknown as Awaited<ReturnType<typeof prisma.order.findUnique>>);

      const result = await createPurchaseTask("ord-mock", "admin");
      expect(result.task).toBeNull();
      expect(result.error).toBe("Đơn hàng Sandbox/Mô phỏng không được phép đưa vào hàng đợi mua hàng thật.");
    });

    it("createPurchaseTask succeeds for genuine non-sandbox order", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: "ord-real",
        orderCode: "CB-REAL-1",
        originalUrl: "https://amazon.co.jp/dp/B00TEST",
        priceJpy: 2000,
        paymentStatus: "DEPOSITED_50",
        paymentMethod: "VIETQR",
        isSandbox: false,
        status: "PURCHASING_JP",
        isPriceVerified: true,
        purchaseTask: null,
      } as unknown as Awaited<ReturnType<typeof prisma.order.findUnique>>);

      vi.mocked(prisma.purchaseTask.create).mockResolvedValueOnce({
        id: "pt-123",
        orderId: "ord-real",
        platform: "amazon",
        status: "QUEUED",
      } as unknown as Awaited<ReturnType<typeof prisma.purchaseTask.create>>);

      const result = await createPurchaseTask("ord-real", "admin");
      expect(result.task).not.toBeNull();
      expect(result.error).toBeUndefined();
    });

    it("GET /api/admin/purchase-tasks/orders filters out isSandbox: true and sandbox paymentMethods", async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValueOnce([]);

      const req = new NextRequest("http://localhost:3000/api/admin/purchase-tasks/orders?q=test");
      await purchaseTaskOrdersGet(req);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isSandbox: false,
            paymentMethod: { notIn: ["VNPAY_SANDBOX", "MOCK"] },
          }),
        })
      );
    });
  });
});
