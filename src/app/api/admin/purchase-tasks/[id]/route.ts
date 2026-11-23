/**
 * Admin Purchase Task Detail API — Nhóm 3: Auto-Purchasing Agent
 *
 * PATCH /api/admin/purchase-tasks/[id]  → Cập nhật trạng thái task
 *
 * Các action hợp lệ:
 *   - "approve"   → QUEUED → APPROVED (Admin duyệt, nhân viên JP có thể tiến hành)
 *   - "start"     → APPROVED → IN_PROGRESS (Nhân viên JP xác nhận đang mua)
 *   - "complete"  → IN_PROGRESS → PURCHASED (Nhân viên JP xác nhận đã mua, nhập externalOrderId)
 *   - "fail"      → * → FAILED (Mua thất bại, nhập lý do)
 *   - "cancel"    → QUEUED | APPROVED → CANCELLED (Admin hủy)
 *
 * Bảo mật: Yêu cầu Admin session.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUsernameFromRequest } from "@/lib/auth-session";
import { requireAdmin } from "@/lib/admin-guard";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Định nghĩa các transition hợp lệ
const VALID_TRANSITIONS: Record<string, string[]> = {
  QUEUED: ["APPROVED", "CANCELLED"],
  APPROVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["PURCHASED", "FAILED"],
  PURCHASED: [],     // Terminal state
  FAILED: ["QUEUED"], // Có thể retry
  CANCELLED: [],    // Terminal state
};

const ACTION_TO_STATUS: Record<string, string> = {
  approve: "APPROVED",
  start: "IN_PROGRESS",
  complete: "PURCHASED",
  fail: "FAILED",
  cancel: "CANCELLED",
  retry: "QUEUED",
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN", "OPERATOR"] });
  if (!guard.ok) return guard.response;

  const { id: taskId } = await params;
  if (!taskId) {
    return NextResponse.json({ error: "Thiếu task ID." }, { status: 400 });
  }

  let body: {
    action: string;
    externalOrderId?: string;
    adminNote?: string;
    staffName?: string;
    actualPriceJpy?: number;
    fxRate?: number;
    receiptUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON không hợp lệ." }, { status: 400 });
  }

  const { action, externalOrderId, adminNote, staffName, actualPriceJpy, fxRate, receiptUrl } = body;

  if (!action || !ACTION_TO_STATUS[action]) {
    return NextResponse.json(
      {
        error: `Action không hợp lệ. Các action hợp lệ: ${Object.keys(ACTION_TO_STATUS).join(", ")}`,
      },
      { status: 400 }
    );
  }

  // BẢO MẬT (P1-04 & P2-12): Chỉ SUPER_ADMIN mới có quyền duyệt hoặc hủy Purchase Task
  if ((action === "approve" || action === "cancel") && guard.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Chỉ Super Admin mới có quyền duyệt hoặc hủy tác vụ mua hộ." },
      { status: 403 }
    );
  }

  const task = await prisma.purchaseTask.findUnique({
    where: { id: taskId },
    include: { order: { select: { id: true, orderCode: true, productName: true, priceJpy: true, exchangeRate: true } } },
  });

  if (!task) {
    return NextResponse.json({ error: "Không tìm thấy purchase task." }, { status: 404 });
  }

  const targetStatus = ACTION_TO_STATUS[action];
  const allowedNext = VALID_TRANSITIONS[task.status] ?? [];

  if (!allowedNext.includes(targetStatus)) {
    return NextResponse.json(
      {
        error: `Không thể chuyển từ ${task.status} → ${targetStatus}. Các transition hợp lệ: ${allowedNext.join(", ") || "không có"}.`,
      },
      { status: 409 }
    );
  }

  const adminUsername = getAdminUsernameFromRequest(req) ?? "admin";
  const now = new Date();

  // Build update payload theo từng action
  const updateData: Record<string, unknown> = {
    status: targetStatus,
    ...(adminNote !== undefined ? { adminNote } : {}),
  };

  if (action === "approve") {
    updateData.approvedByAdmin = adminUsername;
    updateData.approvedAt = now;
  }

  let warningMessage: string | null = null;
  if (action === "complete") {
    if (!externalOrderId) {
      return NextResponse.json(
        { error: "Phải cung cấp externalOrderId khi đánh dấu PURCHASED." },
        { status: 400 }
      );
    }
    updateData.externalOrderId = externalOrderId;
    updateData.purchasedByStaff = staffName ?? adminUsername;
    updateData.purchasedAt = now;

    if (actualPriceJpy !== undefined && actualPriceJpy !== null) {
      const numPriceJpy = Number(actualPriceJpy);
      if (!Number.isFinite(numPriceJpy) || numPriceJpy <= 0) {
        return NextResponse.json({ error: "Giá thực mua actualPriceJpy phải là số dương." }, { status: 400 });
      }
      const expectedPriceJpy = task.order.priceJpy;
      if (expectedPriceJpy > 0) {
        const diffPercent = ((numPriceJpy - expectedPriceJpy) / expectedPriceJpy) * 100;
        if (Math.abs(diffPercent) > 5) {
          warningMessage = `Cảnh báo: Giá thực mua (${numPriceJpy.toLocaleString()} ¥) lệch ${diffPercent > 0 ? "+" : ""}${diffPercent.toFixed(1)}% so với giá đã báo (${expectedPriceJpy.toLocaleString()} ¥).`;
        }
      }
    }
  }

  if (action === "fail") {
    updateData.lastError = adminNote ?? "Mua thất bại (không có chi tiết).";
    updateData.attempts = { increment: 1 };
  }

  if (action === "retry") {
    updateData.lastError = null;
    updateData.attempts = { increment: 1 };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedTask = await tx.purchaseTask.update({
      where: { id: taskId },
      data: updateData,
      include: { order: { select: { id: true, orderCode: true, productName: true, status: true } } },
    });

    if (action === "complete" && externalOrderId) {
      await tx.trackingLog.create({
        data: {
          orderId: updatedTask.order.id,
          status: updatedTask.order.status,
          title: "Đã đặt mua thành công trên sàn Nhật",
          description: `Nhân viên tại Nhật (${staffName ?? adminUsername}) đã hoàn tất mua hàng. Mã đơn hàng sàn: ${externalOrderId}.${warningMessage ? ` (${warningMessage})` : ""}`,
          location: "Tokyo, Nhật Bản",
        },
      });

      // WP2.4: Tự động ghi nhận OrderCostLine GOODS_JPY khi hoàn tất mua hàng
      if (actualPriceJpy !== undefined && actualPriceJpy !== null) {
        const numPriceJpy = Number(actualPriceJpy);
        const numFxRate = Number(fxRate || task.order.exchangeRate || 172);
        const amountVnd = Math.round(numPriceJpy * numFxRate);

        await tx.orderCostLine.create({
          data: {
            orderId: task.order.id,
            purchaseTaskId: task.id,
            category: "GOODS_JPY",
            amountOriginal: numPriceJpy,
            currency: "JPY",
            fxRate: numFxRate,
            amountVnd,
            receiptUrl: receiptUrl ? String(receiptUrl).trim() : null,
            note: `Mua tại sàn ${task.platform}. Mã đơn sàn: ${externalOrderId}${warningMessage ? ` [${warningMessage}]` : ""}`,
            createdBy: staffName ?? adminUsername,
          },
        });
      }
    }

    return updatedTask;
  });

  await writeAuditLog({
    actor: adminUsername,
    action: "PURCHASE_TASK_STATUS_CHANGED",
    entityType: "PurchaseTask",
    entityId: taskId,
    summary: `Cập nhật trạng thái tác vụ mua hộ: ${task.status} → ${targetStatus}.`,
    metadata: { action, fromStatus: task.status, toStatus: targetStatus },
    req,
  });

  console.log(
    `[PurchaseAgent] Admin ${adminUsername} cập nhật task ${taskId} (${task.order.orderCode}): ${task.status} → ${targetStatus}`
  );

  return NextResponse.json({
    success: true,
    task: updated,
    message: `Task đã cập nhật: ${task.status} → ${targetStatus}`,
    warning: warningMessage || undefined,
  });
}
