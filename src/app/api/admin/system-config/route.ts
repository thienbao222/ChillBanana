/**
 * /api/admin/system-config
 * ─────────────────────────────────────────────────────────────────────────────
 * GET   — Lấy toàn bộ cấu hình hệ thống (đồng bộ với PricingConfig).
 * PATCH — Cập nhật một hoặc nhiều cặp key/value (đồng bộ sang PricingConfig).
 *
 * RBAC: Chỉ SUPER_ADMIN được đọc/ghi qua requireAdmin (đối chiếu DB).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { getClientIp } from "@/lib/rate-limit";
import {
  VALID_CONFIG_KEYS,
  SYSTEM_CONFIG_DEFAULTS,
  invalidateSystemConfigCache,
} from "@/lib/system-config";
import { getCurrentPricingConfig } from "@/features/pricing/config";

export const dynamic = "force-dynamic";

// ─── GET: Lấy toàn bộ config ─────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;

  try {
    const [pricing, rows] = await Promise.all([
      getCurrentPricingConfig(),
      prisma.systemConfig.findMany({ orderBy: { key: "asc" } }),
    ]);

    // Ánh xạ sang PricingConfig thực tế đang có hiệu lực
    const liveMapping: Record<string, number> = {
      service_fee_percent: pricing.values.serviceFeePercent,
      min_service_fee_vnd: pricing.values.serviceFeeMinimumVnd,
      air_shipping_per_kg_vnd: pricing.values.airShippingPerKgVnd,
      group_buy_discount_percent: pricing.values.groupBuyShippingDiscountPercent,
      floor_exchange_rate_jpy: pricing.values.fallbackJpyVndRate,
      min_order_threshold_vnd: pricing.values.minimumBaseOrderVnd,
    };

    const result: Record<string, { value: string; description: string | null; updatedAt: Date | null; updatedBy: string | null }> = {};

    for (const key of VALID_CONFIG_KEYS) {
      const row = rows.find((r) => r.key === key);
      const val = liveMapping[key] !== undefined ? String(liveMapping[key]) : (row?.value ?? String(SYSTEM_CONFIG_DEFAULTS[key]));
      result[key] = {
        value: val,
        description: row?.description ?? null,
        updatedAt: row?.updatedAt ?? pricing.createdAt,
        updatedBy: row?.updatedBy ?? pricing.changedBy,
      };
    }

    return NextResponse.json({ success: true, config: result });
  } catch (err) {
    console.error("[system-config GET] Lỗi:", err);
    return NextResponse.json({ error: "Không thể tải cấu hình." }, { status: 500 });
  }
}

// ─── PATCH: Cập nhật config ───────────────────────────────────────────────────

interface ConfigUpdate {
  key: string;
  value: string;
  description?: string;
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;

  const adminUsername = guard.username;

  let body: { updates?: ConfigUpdate[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON không hợp lệ." }, { status: 400 });
  }

  const { updates } = body;
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json(
      { error: "Vui lòng cung cấp mảng 'updates' không rỗng." },
      { status: 400 }
    );
  }
  if (updates.length > 20) {
    return NextResponse.json({ error: "Tối đa 20 key được cập nhật mỗi lần." }, { status: 400 });
  }

  // Validate từng key/value
  const errors: string[] = [];
  for (const update of updates) {
    if (!VALID_CONFIG_KEYS.includes(update.key as keyof typeof SYSTEM_CONFIG_DEFAULTS)) {
      errors.push(`Key không hợp lệ: "${update.key}". Chỉ chấp nhận: ${VALID_CONFIG_KEYS.join(", ")}`);
      continue;
    }
    const numValue = parseFloat(update.value);
    if (!Number.isFinite(numValue) || numValue < 0) {
      errors.push(`Giá trị không hợp lệ cho key "${update.key}": "${update.value}" (phải là số >= 0).`);
    }
    if (update.key === "service_fee_percent" && (numValue < 0 || numValue > 25)) {
      errors.push(`service_fee_percent phải từ 0% đến 25% (hiện tại: ${numValue}%).`);
    }
    if (update.key === "group_buy_discount_percent" && (numValue < 0 || numValue > 80)) {
      errors.push(`group_buy_discount_percent phải từ 0% đến 80%.`);
    }
    if (update.key === "floor_exchange_rate_jpy" && (numValue < 100 || numValue > 300)) {
      errors.push(`floor_exchange_rate_jpy phải từ 100 đến 300 đ/¥.`);
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" | ") }, { status: 400 });
  }

  try {
    // 1. Đọc PricingConfig hiện tại và cập nhật giá trị mới
    const currentPricing = await getCurrentPricingConfig();
    const newPricingValues = { ...currentPricing.values };

    for (const u of updates) {
      const num = parseFloat(u.value);
      if (u.key === "service_fee_percent") newPricingValues.serviceFeePercent = num;
      else if (u.key === "min_service_fee_vnd") newPricingValues.serviceFeeMinimumVnd = Math.round(num);
      else if (u.key === "air_shipping_per_kg_vnd") newPricingValues.airShippingPerKgVnd = Math.round(num);
      else if (u.key === "group_buy_discount_percent") newPricingValues.groupBuyShippingDiscountPercent = num;
      else if (u.key === "floor_exchange_rate_jpy") newPricingValues.fallbackJpyVndRate = Math.round(num);
      else if (u.key === "min_order_threshold_vnd") newPricingValues.minimumBaseOrderVnd = Math.round(num);
    }

    // 2. Cập nhật đồng bộ trong Transaction (SystemConfig + PricingConfig + AuditLog)
    await prisma.$transaction(async (tx) => {
      // Upsert SystemConfig
      for (const u of updates) {
        await tx.systemConfig.upsert({
          where: { key: u.key },
          update: {
            value: String(parseFloat(u.value)),
            description: u.description ?? undefined,
            updatedBy: adminUsername,
          },
          create: {
            key: u.key,
            value: String(parseFloat(u.value)),
            description: u.description ?? null,
            updatedBy: adminUsername,
          },
        });
      }

      // Tạo phiên bản PricingConfig mới để Frontend và API Orders tự động có hiệu lực ngay
      const createdPricing = await tx.pricingConfig.create({
        data: {
          values: newPricingValues as Prisma.InputJsonValue,
          changedBy: adminUsername,
          changeReason: "Cập nhật qua Sandbox Tab (SystemConfig Editor)",
        },
      });

      // Ghi AuditLog
      await tx.auditLog.create({
        data: {
          actor: adminUsername,
          action: "SYSTEM_CONFIG_UPDATED",
          entityType: "SystemConfig",
          entityId: String(createdPricing.version),
          summary: `Admin ${adminUsername} cập nhật ${updates.length} cấu hình phí (đồng bộ PricingConfig v${createdPricing.version})`,
          metadata: ({ updates, pricingVersion: createdPricing.version } as unknown) as Prisma.InputJsonValue,
          ip: getClientIp(req),
        },
      });
    });

    // 3. Xóa cache in-memory
    invalidateSystemConfigCache();

    console.log(`[system-config] Admin ${adminUsername} cập nhật thành công: ${updates.map((u) => `${u.key}=${u.value}`).join(", ")}`);

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật ${updates.length} cấu hình và đồng bộ bảng giá thành công.`,
      updatedKeys: updates.map((u) => u.key),
    });
  } catch (err) {
    console.error("[system-config PATCH] Lỗi:", err);
    return NextResponse.json({ error: "Không thể cập nhật cấu hình." }, { status: 500 });
  }
}
