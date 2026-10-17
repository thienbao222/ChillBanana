import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { writeAuditLog } from "@/lib/audit";
import { validatePricingConfig } from "@/features/pricing/config";
import { createPricingConfig, getActivePricingConfig, listPricingConfigs } from "@/features/pricing/config-store";

export const dynamic = "force-dynamic";

// GET: cấu hình đang áp dụng + lịch sử thay đổi (mọi admin được xem).
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const [active, history] = await Promise.all([getActivePricingConfig(), listPricingConfigs(50)]);
  return NextResponse.json({
    active: { ...active.values, id: active.id, effectiveFrom: active.effectiveFrom, source: active.source },
    history,
  });
}

// POST: tạo phiên bản cấu hình mới (chỉ SUPER_ADMIN). Không sửa bản cũ; đơn đã tạo giữ nguyên ảnh chụp giá của nó.
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const validated = validatePricingConfig(body);
  if (!validated.ok) {
    return NextResponse.json({ error: "Cấu hình giá không hợp lệ.", details: validated.errors }, { status: 400 });
  }

  let effectiveFrom = new Date();
  if (body.effectiveFrom !== undefined && body.effectiveFrom !== null && body.effectiveFrom !== "") {
    const parsed = new Date(String(body.effectiveFrom));
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Ngày hiệu lực không hợp lệ." }, { status: 400 });
    }
    // Ngày trong quá khứ nghĩa là "áp dụng ngay"; không cho ghi lùi để không làm lệch lịch sử.
    if (parsed.getTime() > effectiveFrom.getTime()) effectiveFrom = parsed;
  }
  const note = typeof body.note === "string" ? body.note : null;

  const before = await getActivePricingConfig();
  const created = await createPricingConfig(validated.value, { createdBy: guard.username, effectiveFrom, note });

  await writeAuditLog({
    actor: guard.username,
    action: "PRICING_CONFIG_CREATED",
    entityType: "PricingConfig",
    entityId: created.id,
    summary: `Tạo cấu hình giá mới, hiệu lực từ ${effectiveFrom.toISOString()}`,
    metadata: { before: before.values, after: validated.value, effectiveFrom: effectiveFrom.toISOString() },
    req,
  });

  return NextResponse.json({ success: true, config: created });
}
