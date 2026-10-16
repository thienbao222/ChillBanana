import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/admin-guard";
import { getCurrentPricingConfig, getPricingConfigHistory, validatePricingConfig } from "@/features/pricing/config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;
  try {
    const [current, history] = await Promise.all([getCurrentPricingConfig(), getPricingConfigHistory()]);
    return NextResponse.json({ current, history });
  } catch (error) {
    console.error("[AdminPricingConfig] Could not load history:", error);
    return NextResponse.json({ error: "Chưa tải được lịch sử cấu hình giá." }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nội dung gửi lên không phải JSON hợp lệ." }, { status: 400 });
  }
  const input = body as { values?: unknown; changeReason?: unknown };
  const result = validatePricingConfig(input?.values);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  const changeReason = typeof input.changeReason === "string" ? input.changeReason.trim() : "";
  if (changeReason.length > 240) return NextResponse.json({ error: "Lý do thay đổi tối đa 240 ký tự." }, { status: 400 });

  try {
    const current = await getCurrentPricingConfig();
    const changedFields = Object.keys(result.values).filter((key) => result.values[key as keyof typeof result.values] !== current.values[key as keyof typeof current.values]);
    if (changedFields.length === 0) {
      return NextResponse.json({ success: true, unchanged: true, current }, { status: 200 });
    }
    const config = await prisma.$transaction(async (tx) => {
      const created = await tx.pricingConfig.create({
        data: { values: result.values as Prisma.InputJsonValue, changedBy: guard.username, changeReason: changeReason || null },
      });
      await tx.auditLog.create({
        data: {
          actor: guard.username,
          action: "PRICING_CONFIG_UPDATED",
          entityType: "PricingConfig",
          entityId: String(created.version),
          summary: `Tạo phiên bản cấu hình giá v${created.version}${changeReason ? `: ${changeReason}` : ""}`.slice(0, 500),
          metadata: { version: created.version, previousVersion: current.version, changedFields, values: result.values } as Prisma.InputJsonValue,
          ip: getClientIp(req),
        },
      });
      return created;
    });
    return NextResponse.json({ success: true, current: { version: config.version, values: result.values, changedBy: guard.username, changeReason: changeReason || null, createdAt: config.createdAt } }, { status: 201 });
  } catch (error) {
    console.error("[AdminPricingConfig] Could not save version:", error);
    return NextResponse.json({ error: "Không lưu được cấu hình giá. Phiên bản trước vẫn được giữ nguyên." }, { status: 503 });
  }
}
