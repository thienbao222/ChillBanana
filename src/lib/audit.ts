import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/rate-limit";

// Nhật ký kiểm toán: ghi lại AI đã làm GÌ trên ĐỐI TƯỢNG nào, KHI nào, từ IP nào.
// QUY TẮC: không đưa mật khẩu, token, khóa API hoặc dữ liệu cá nhân nhạy cảm vào summary/metadata.
// Hàm này không bao giờ ném lỗi: lỗi ghi nhật ký không được làm hỏng thao tác chính.

export type AuditActorType = "ADMIN" | "CUSTOMER" | "SYSTEM";

export type AuditEntry = {
  actor: string;
  actorType?: AuditActorType;
  action: string; // ví dụ: ADMIN_LOGIN, PRODUCT_UPDATE, ORDER_PAYMENT_RECORDED
  entityType?: string;
  entityId?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  req?: NextRequest | Request;
  ip?: string;
};

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actor: entry.actor.slice(0, 120),
        actorType: entry.actorType ?? "ADMIN",
        action: entry.action.slice(0, 80),
        entityType: entry.entityType?.slice(0, 60),
        entityId: entry.entityId?.slice(0, 120),
        summary: entry.summary?.slice(0, 500),
        metadata: entry.metadata as Prisma.InputJsonValue | undefined,
        ip: entry.ip ?? (entry.req ? getClientIp(entry.req) : undefined),
      },
    });
  } catch (error) {
    console.error("[Audit] Không ghi được nhật ký kiểm toán:", error);
  }
}
