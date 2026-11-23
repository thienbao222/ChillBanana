import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isAllowedCampaignTransition,
  ALLOWED_CAMPAIGN_TRANSITIONS,
  claimCampaignSlots,
  sweepExpiredCampaigns,
} from "@/features/campaigns/service";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaign: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    campaignItem: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    campaignEntry: {
      create: vi.fn(),
    },
  },
}));

describe("WP5.1 — Mô hình chiến dịch gom hàng & Quản trị trạng thái", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Quy tắc chuyển trạng thái (State Machine)", () => {
    it("cho phép quy trình chuẩn từ DRAFT đến SETTLED", () => {
      expect(isAllowedCampaignTransition("DRAFT", "OPEN")).toBe(true);
      expect(isAllowedCampaignTransition("OPEN", "CLOSED")).toBe(true);
      expect(isAllowedCampaignTransition("CLOSED", "ORDERED")).toBe(true);
      expect(isAllowedCampaignTransition("ORDERED", "ARRIVED")).toBe(true);
      expect(isAllowedCampaignTransition("ARRIVED", "SHIPPED")).toBe(true);
      expect(isAllowedCampaignTransition("SHIPPED", "SETTLED")).toBe(true);
    });

    it("chặn nhảy cóc trạng thái sai thứ tự", () => {
      expect(isAllowedCampaignTransition("DRAFT", "ORDERED")).toBe(false);
      expect(isAllowedCampaignTransition("DRAFT", "SHIPPED")).toBe(false);
      expect(isAllowedCampaignTransition("OPEN", "ARRIVED")).toBe(false);
      expect(isAllowedCampaignTransition("SETTLED", "OPEN")).toBe(false);
    });

    it("cho phép hủy chiến dịch (CANCELLED) ở bất kỳ khâu nào trước khi chốt", () => {
      expect(isAllowedCampaignTransition("DRAFT", "CANCELLED")).toBe(true);
      expect(isAllowedCampaignTransition("OPEN", "CANCELLED")).toBe(true);
      expect(isAllowedCampaignTransition("CLOSED", "CANCELLED")).toBe(true);
      expect(isAllowedCampaignTransition("ORDERED", "CANCELLED")).toBe(true);
      expect(isAllowedCampaignTransition("SETTLED", "CANCELLED")).toBe(false); // Đã tất toán không được hủy ngang
    });
  });

  describe("Tranh chấp suất mua (Concurrency & Slot limits)", () => {
    it("từ chối khi chiến dịch chưa OPEN", async () => {
      const mockItem = {
        id: "item-1",
        claimedSlots: 0,
        maxSlots: 10,
        campaign: { status: "DRAFT" },
      };
      const txMock = {
        campaignItem: {
          findUnique: vi.fn().mockResolvedValue(mockItem),
          updateMany: vi.fn(),
        },
        campaignEntry: { create: vi.fn() },
      };

      await expect(claimCampaignSlots("item-1", 1, "order-item-1", txMock)).rejects.toThrow(
        "CAMPAIGN_NOT_OPEN:DRAFT"
      );
    });

    it("từ chối khi đã hết suất (maxSlots reached)", async () => {
      const mockItem = {
        id: "item-1",
        claimedSlots: 10,
        maxSlots: 10,
        campaign: { status: "OPEN" },
      };
      const txMock = {
        campaignItem: {
          findUnique: vi.fn().mockResolvedValue(mockItem),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }), // 0 dòng update thành công vì vi phạm điều kiện
        },
        campaignEntry: { create: vi.fn() },
      };

      await expect(claimCampaignSlots("item-1", 1, "order-item-1", txMock)).rejects.toThrow(
        "CAMPAIGN_SLOTS_FULL"
      );
    });

    it("đăng ký thành công và tạo CampaignEntry khi còn suất", async () => {
      const mockItem = {
        id: "item-1",
        claimedSlots: 5,
        maxSlots: 10,
        campaign: { status: "OPEN" },
      };
      const txMock = {
        campaignItem: {
          findUnique: vi.fn().mockResolvedValue(mockItem),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        campaignEntry: {
          create: vi.fn().mockResolvedValue({ id: "entry-1", quantity: 2 }),
        },
      };

      const res = await claimCampaignSlots("item-1", 2, "order-item-1", txMock);
      expect(res.entry.id).toBe("entry-1");
      expect(txMock.campaignItem.updateMany).toHaveBeenCalledWith({
        where: {
          id: "item-1",
          OR: [{ maxSlots: null }, { maxSlots: { gte: 7 } }],
        },
        data: { claimedSlots: { increment: 2 } },
      });
    });
  });

  describe("Tự động đóng chiến dịch hết hạn (sweepExpiredCampaigns)", () => {
    it("đóng chiến dịch quá hạn closesAt và gắn ghi chú phù hợp", async () => {
      const mockExpired = [
        {
          id: "camp-1",
          minParticipants: 5,
          campaignItems: [
            { entries: [{ id: "e1" }, { id: "e2" }] }, // Chỉ 2 entries < 5
          ],
        },
      ];

      vi.mocked(prisma.campaign.findMany).mockResolvedValue(mockExpired as any);
      vi.mocked(prisma.campaign.update).mockResolvedValue({} as any);

      const res = await sweepExpiredCampaigns();
      expect(res.closedCount).toBe(1);
      expect(prisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "camp-1" },
          data: expect.objectContaining({
            status: "CLOSED",
            notes: expect.stringContaining("chưa đạt tối thiểu"),
          }),
        })
      );
    });
  });
});

