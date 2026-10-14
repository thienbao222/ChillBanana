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
import { isAdminRequest, getAdminUsernameFromRequest } from "@/lib/auth-session";

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
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id: taskId } = await params;
  if (!taskId) {
    return NextResponse.json({ error: "Thiếu task ID." }, { status: 400 });
  }

  let body: {
    action: string;
    externalOrderId?: string;
    adminNote?: string;
    staffName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON không hợp lệ." }, { status: 400 });
  }

  const { action, externalOrderId, adminNote, staffName } = body;

  if (!action || !ACTION_TO_STATUS[action]) {
    return NextResponse.json(
      {
        error: `Action không hợp lệ. Các action hợp lệ: ${Object.keys(ACTION_TO_STATUS).join(", ")}`,
      },
      { status: 400 }
    );
  }

  const task = await prisma.purchaseTask.findUnique({
    where: { id: taskId },
    include: { order: { select: { orderCode: true, productName: true } } },
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
  }

  if (action === "fail") {
    updateData.lastError = adminNote ?? "Mua thất bại (không có chi tiết).";
    updateData.attempts = { increment: 1 };
  }

  if (action === "retry") {
    updateData.lastError = null;
    updateData.attempts = { increment: 1 };
  }

  const updated = await prisma.purchaseTask.update({
    where: { id: taskId },
    data: updateData,
    include: { order: { select: { orderCode: true, productName: true } } },
  });

  console.log(
    `[PurchaseAgent] Admin ${adminUsername} cập nhật task ${taskId} (${task.order.orderCode}): ${task.status} → ${targetStatus}`
  );

  return NextResponse.json({
    success: true,
    task: updated,
    message: `Task đã cập nhật: ${task.status} → ${targetStatus}`,
  });
}
