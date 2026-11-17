import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { createCampaign, sweepExpiredCampaigns } from "@/features/campaigns/service";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN", "OPERATOR"] });
  if (!guard.ok) return guard.response;

  try {
    // Quét lazy đóng đợt hết hạn
    await sweepExpiredCampaigns();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const campaigns = await prisma.campaign.findMany({
      where: status ? { status } : undefined,
      include: {
        campaignItems: {
          include: {
            _count: { select: { entries: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, campaigns });
  } catch (err: any) {
    console.error("[AdminCampaigns] Lỗi lấy danh sách:", err);
    return NextResponse.json({ error: "Lỗi hệ thống khi tải chiến dịch." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN", "OPERATOR"] });
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    if (!body.title || !body.slug || !body.marketplace) {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ tiêu đề (title), slug và sàn thương mại (marketplace)." },
        { status: 400 }
      );
    }

    const campaign = await createCampaign({
      ...body,
      createdBy: guard.username || "admin",
      opensAt: body.opensAt ? new Date(body.opensAt) : undefined,
      closesAt: body.closesAt ? new Date(body.closesAt) : undefined,
    });

    await writeAuditLog({
      actor: guard.username || "admin",
      action: "CAMPAIGN_CREATED",
      entityType: "Campaign",
      entityId: campaign.id,
      summary: `Tạo chiến dịch gom hàng mới: [${campaign.title}] (slug: ${campaign.slug})`,
      metadata: { campaignId: campaign.id, slug: campaign.slug },
      req,
    });

    return NextResponse.json({ success: true, campaign }, { status: 201 });
  } catch (err: any) {
    console.error("[AdminCampaigns] Lỗi tạo chiến dịch:", err);
    return NextResponse.json(
      { error: err?.message?.includes("Unique") ? "Slug chiến dịch đã tồn tại." : "Lỗi hệ thống khi tạo chiến dịch." },
      { status: 400 }
    );
  }
}

