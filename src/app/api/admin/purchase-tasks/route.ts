/**
 * Admin Purchase Tasks API — Nhóm 3: Auto-Purchasing Agent (Phase A)
 *
 * GET  /api/admin/purchase-tasks            → Danh sách tasks (filter theo status, platform)
 * POST /api/admin/purchase-tasks            → Tạo task mới từ orderId
 * PATCH /api/admin/purchase-tasks/[id]      → Cập nhật task (APPROVE, CANCEL, mark PURCHASED)
 *
 * Bảo mật: Yêu cầu Admin session (requireAdmin).
 * Human-in-the-loop: Mọi task phải APPROVE trước khi chuyển sang IN_PROGRESS.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUsernameFromRequest } from "@/lib/auth-session";
import { requireAdmin } from "@/lib/admin-guard";
import { createPurchaseTask } from "@/features/purchasing/service";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

// ─── GET: Lấy danh sách Purchase Tasks ───────────────────────────────────────

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const platform = searchParams.get("platform") || undefined;
  const requestedPage = Number.parseInt(searchParams.get("page") || "1", 10);
  const requestedLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
  const page = Number.isSafeInteger(requestedPage) ? Math.max(1, requestedPage) : 1;
  const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(50, requestedLimit)
    : 20;

  const [tasks, total] = await Promise.all([
    prisma.purchaseTask.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(platform ? { platform } : {}),
      },
      include: {
        order: {
          select: {
            orderCode: true,
            customerName: true,
            productName: true,
            priceJpy: true,
            originalUrl: true,
            paymentStatus: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.purchaseTask.count({
      where: {
        ...(status ? { status } : {}),
        ...(platform ? { platform } : {}),
      },
    }),
  ]);

  return NextResponse.json({
    tasks,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// ─── POST: Tạo Purchase Task mới ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  let body: { orderId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON không hợp lệ." }, { status: 400 });
  }

  const { orderId } = body;
  if (!orderId || typeof orderId !== "string") {
    return NextResponse.json({ error: "Thiếu orderId." }, { status: 400 });
  }

  const adminUsername = getAdminUsernameFromRequest(req) ?? "admin";

  const { task, info, error } = await createPurchaseTask(orderId, adminUsername);

  if (error || !task) {
    const isConflict = typeof error === "string" && (error.includes("đã có") || error.includes("đồng thời"));
    return NextResponse.json(
      { error: error ?? "Không thể tạo purchase task." },
      { status: isConflict ? 409 : 400 }
    );
  }

  await writeAuditLog({
    actor: adminUsername,
    action: "PURCHASE_TASK_CREATED",
    entityType: "PurchaseTask",
    entityId: task.id,
    summary: "Tạo tác vụ mua hộ.",
    metadata: { toStatus: task.status },
    req,
  });

  return NextResponse.json(
    {
      success: true,
      task,
      platformInfo: info,
      message: `Purchase task đã tạo cho đơn hàng. Trạng thái: QUEUED — chờ Admin duyệt.`,
    },
    { status: 201 }
  );
}
