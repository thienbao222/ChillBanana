import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { applyBatchFreightToCampaignOrders } from "@/features/campaigns/freight-allocation";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN", "OPERATOR"] });
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const adminUsername = guard.username || "admin";

  try {
    const body = await req.json();
    const totalActualFreightVnd = Number(body.totalActualFreightVnd);

    if (!Number.isSafeInteger(totalActualFreightVnd) || totalActualFreightVnd <= 0) {
      return NextResponse.json(
        { error: "Tổng cước lô thực tế phải là số nguyên dương hợp lệ (VND)." },
        { status: 400 }
      );
    }

    const result = await applyBatchFreightToCampaignOrders(
      id,
      totalActualFreightVnd,
      adminUsername
    );

    await writeAuditLog({
      actor: adminUsername,
      action: "CAMPAIGN_BATCH_FREIGHT_ALLOCATED",
      entityType: "Campaign",
      entityId: id,
      summary: `Phân bổ tổng cước lô ${totalActualFreightVnd.toLocaleString("vi-VN")} đ cho ${result.totalOrders} đơn hàng trong chiến dịch.`,
      metadata: { campaignId: id, totalActualFreightVnd, ordersCount: result.totalOrders },
      req,
    });

    return NextResponse.json({
      success: true,
      message: `Đã phân bổ cước lô cho ${result.totalOrders} đơn hàng.`,
      allocations: result.allocations,
    });
  } catch (err: any) {
    console.error("[AllocateFreight] Lỗi phân bổ cước:", err);
    return NextResponse.json(
      { error: err?.message || "Lỗi hệ thống khi phân bổ cước lô." },
      { status: 500 }
    );
  }
}

