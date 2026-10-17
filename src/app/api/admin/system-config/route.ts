/**
 * /api/admin/system-config
 * ─────────────────────────────────────────────────────────────────────────────
 * GET  — Lấy toàn bộ cấu hình hệ thống (chỉ SUPER_ADMIN).
 * PATCH — Cập nhật một hoặc nhiều cặp key/value (chỉ SUPER_ADMIN).
 *
 * Body PATCH:
 *   { updates: [{ key: "service_fee_percent", value: "4.5" }] }
 *
 * RBAC: Chỉ SUPER_ADMIN được đọc/ghi. OPERATOR nhận 403 Forbidden.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRequest, getAdminUsernameFromRequest } from "@/lib/auth-session";
import {
  VALID_CONFIG_KEYS,
  SYSTEM_CONFIG_DEFAULTS,
  invalidateSystemConfigCache,
} from "@/lib/system-config";

export const dynamic = "force-dynamic";

// ─── GET: Lấy toàn bộ config ─────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isSuperAdminRequest(req)) {
    return NextResponse.json(
      { error: "Chỉ SUPER_ADMIN mới có quyền xem cấu hình hệ thống." },
      { status: 403 }
    );
  }

  try {
    const rows = await prisma.systemConfig.findMany({
      orderBy: { key: "asc" },
    });

    // Merge với defaults để luôn trả đủ tất cả key
    const result: Record<string, { value: string; description: string | null; updatedAt: Date | null; updatedBy: string | null }> = {};

    for (const key of VALID_CONFIG_KEYS) {
      const row = rows.find((r) => r.key === key);
      result[key] = {
        value: row?.value ?? String(SYSTEM_CONFIG_DEFAULTS[key]),
        description: row?.description ?? null,
        updatedAt: row?.updatedAt ?? null,
        updatedBy: row?.updatedBy ?? null,
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
  if (!isSuperAdminRequest(req)) {
    return NextResponse.json(
      { error: "Chỉ SUPER_ADMIN mới có quyền cập nhật cấu hình hệ thống." },
      { status: 403 }
    );
  }

  const adminUsername = getAdminUsernameFromRequest(req) ?? "unknown";

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
    // Giới hạn an toàn cho các key nhạy cảm
    if (update.key === "service_fee_percent" && (numValue < 0 || numValue > 20)) {
      errors.push(`service_fee_percent phải từ 0% đến 20% (hiện tại: ${numValue}%).`);
    }
    if (update.key === "group_buy_discount_percent" && (numValue < 0 || numValue > 50)) {
      errors.push(`group_buy_discount_percent phải từ 0% đến 50%.`);
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" | ") }, { status: 400 });
  }

  try {
    // Upsert từng key trong transaction
    await prisma.$transaction(
      updates.map((u) =>
        prisma.systemConfig.upsert({
          where: { key: u.key },
          update: {
            value: String(parseFloat(u.value)), // Normalize (loại bỏ trailing spaces v.v.)
            description: u.description ?? undefined,
            updatedBy: adminUsername,
          },
          create: {
            key: u.key,
            value: String(parseFloat(u.value)),
            description: u.description ?? null,
            updatedBy: adminUsername,
          },
        })
      )
    );

    // Xóa cache để lần sau đọc từ DB
    invalidateSystemConfigCache();

    console.log(`[system-config] Admin ${adminUsername} cập nhật: ${updates.map((u) => `${u.key}=${u.value}`).join(", ")}`);

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật ${updates.length} cấu hình thành công.`,
      updatedKeys: updates.map((u) => u.key),
    });
  } catch (err) {
    console.error("[system-config PATCH] Lỗi:", err);
    return NextResponse.json({ error: "Không thể cập nhật cấu hình." }, { status: 500 });
  }
}
