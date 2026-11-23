import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export const CAMPAIGN_STATUSES = [
  "DRAFT",
  "OPEN",
  "CLOSED",
  "ORDERED",
  "ARRIVED",
  "SHIPPED",
  "SETTLED",
  "CANCELLED",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const ALLOWED_CAMPAIGN_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["CLOSED", "CANCELLED"],
  CLOSED: ["ORDERED", "CANCELLED", "OPEN"],
  ORDERED: ["ARRIVED", "CANCELLED"],
  ARRIVED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["SETTLED", "CANCELLED"],
  SETTLED: [],
  CANCELLED: [],
};

export function isAllowedCampaignTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  if (from === to) return true;
  const allowed = ALLOWED_CAMPAIGN_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export interface CreateCampaignInput {
  slug: string;
  title: string;
  description?: string;
  marketplace: string;
  opensAt?: Date;
  closesAt?: Date;
  minParticipants?: number;
  maxSlots?: number;
  notes?: string;
  createdBy?: string;
  items?: {
    name: string;
    priceJpy: number;
    weightKg: number;
    maxSlots?: number;
    imageUrl?: string;
    originalUrl?: string;
  }[];
}

export async function createCampaign(input: CreateCampaignInput, tx: any = prisma) {
  const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-");
  if (!slug) throw new Error("INVALID_CAMPAIGN_SLUG");

  return await tx.campaign.create({
    data: {
      slug,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      marketplace: input.marketplace,
      status: "DRAFT",
      opensAt: input.opensAt || null,
      closesAt: input.closesAt || null,
      minParticipants: Math.max(1, input.minParticipants || 1),
      maxSlots: input.maxSlots || null,
      notes: input.notes?.trim() || null,
      createdBy: input.createdBy || null,
      campaignItems: input.items && input.items.length > 0
        ? {
            create: input.items.map((it) => ({
              name: it.name.trim(),
              priceJpy: Math.max(0, Math.round(it.priceJpy)),
              weightKg: Math.max(0.01, Number(it.weightKg) || 0.5),
              maxSlots: it.maxSlots || null,
              imageUrl: it.imageUrl || null,
              originalUrl: it.originalUrl || null,
            })),
          }
        : undefined,
    },
    include: {
      campaignItems: true,
    },
  });
}

/**
 * Đăng ký suất mua trong chiến dịch (Atomic update chống race condition).
 */
export async function claimCampaignSlots(
  campaignItemId: string,
  quantity: number,
  orderItemId?: string,
  tx: any = prisma
) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("INVALID_SLOT_QUANTITY");
  }

  const campaignItem = await tx.campaignItem.findUnique({
    where: { id: campaignItemId },
    include: { campaign: true },
  });

  if (!campaignItem) {
    throw new Error("CAMPAIGN_ITEM_NOT_FOUND");
  }

  if (campaignItem.campaign.status !== "OPEN") {
    throw new Error(`CAMPAIGN_NOT_OPEN:${campaignItem.campaign.status}`);
  }

  // Atomic update có kiểm tra trần maxSlots
  const updated = await tx.campaignItem.updateMany({
    where: {
      id: campaignItemId,
      OR: [
        { maxSlots: null },
        { maxSlots: { gte: campaignItem.claimedSlots + quantity } },
      ],
    },
    data: {
      claimedSlots: { increment: quantity },
    },
  });

  if (updated.count === 0) {
    throw new Error("CAMPAIGN_SLOTS_FULL");
  }

  const entry = await tx.campaignEntry.create({
    data: {
      campaignItemId,
      orderItemId: orderItemId || null,
      quantity,
    },
  });

  return { entry, campaignItem };
}

/**
 * Hoàn trả suất mua khi đơn hàng hủy.
 */
export async function releaseCampaignSlots(
  campaignItemId: string,
  quantity: number,
  tx: any = prisma
) {
  if (quantity <= 0) return;
  await tx.campaignItem.updateMany({
    where: { id: campaignItemId },
    data: {
      claimedSlots: { decrement: quantity },
    },
  });
}

/**
 * Quét tự động các chiến dịch quá hạn closesAt và tự động đóng sang CLOSED.
 */
export async function sweepExpiredCampaigns() {
  const now = new Date();
  const expiredCampaigns = await prisma.campaign.findMany({
    where: {
      status: "OPEN",
      closesAt: { lte: now },
    },
    include: {
      campaignItems: {
        include: { entries: true },
      },
    },
  });

  let closedCount = 0;
  for (const camp of expiredCampaigns) {
    const totalEntries = camp.campaignItems.reduce((acc, it) => acc + it.entries.length, 0);
    const belowMinParticipants = totalEntries < camp.minParticipants;

    await prisma.campaign.update({
      where: { id: camp.id },
      data: {
        status: "CLOSED",
        notes: belowMinParticipants
          ? `[Tự động đóng] Chỉ có ${totalEntries}/${camp.minParticipants} người tham gia (chưa đạt tối thiểu). Chờ Admin quyết định hủy hoặc tiếp tục.`
          : `[Tự động đóng] Hết thời hạn nhận đơn lúc ${now.toISOString()}.`,
      },
    });

    closedCount++;
  }

  return { scanned: expiredCampaigns.length, closedCount };
}

