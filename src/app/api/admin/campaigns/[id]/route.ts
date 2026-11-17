import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { isAllowedCampaignTransition, CampaignStatus } from "@/features/campaigns/service";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN", "OPERATOR"] });
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      campaignItems: {
        include: {
          entries: {
            include: {
              orderItem: {
                include: { order: true },
              },
            },
          },
        },
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Không tìm thấy chiến dịch." }, { status: 404 });
  }

  return NextResponse.json({ success: true, campaign });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN", "OPERATOR"] });
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await req.json();

  const campaign = await prisma.campaign.findFirst({
    where: { OR: [{ id }, { slug: id }] },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Không tìm thấy chiến dịch." }, { status: 404 });
  }

  const currentStatus = campaign.status as CampaignStatus;
  const targetStatus = body.status as CampaignStatus | undefined;

  if (targetStatus && targetStatus !== currentStatus) {
    if (!isAllowedCampaignTransition(currentStatus, targetStatus)) {
      return NextResponse.json(
        {
          error: `Không thể chuyển trạng thái chiến dịch từ ${currentStatus} sang ${targetStatus}. Quy trình không cho phép nhảy cóc.`,
        },
        { status: 400 }
      );
    }
  }

  const updateData: any = {};
  if (targetStatus) updateData.status = targetStatus;
  if (body.title) updateData.title = body.title.trim();
  if (body.description !== undefined) updateData.description = body.description;
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.opensAt) updateData.opensAt = new Date(body.opensAt);
  if (body.closesAt) updateData.closesAt = new Date(body.closesAt);

  const updatedCampaign = await prisma.campaign.update({
    where: { id: campaign.id },
    data: updateData,
  });

  if (targetStatus && targetStatus !== currentStatus) {
    await writeAuditLog({
      actor: guard.username || "admin",
      action: "CAMPAIGN_STATUS_UPDATED",
      entityType: "Campaign",
      entityId: campaign.id,
      summary: `Chuyển trạng thái chiến dịch [${campaign.title}] từ ${currentStatus} sang ${targetStatus}.`,
      metadata: { fromStatus: currentStatus, toStatus: targetStatus },
      req,
    });
  }

  return NextResponse.json({ success: true, campaign: updatedCampaign });
}

