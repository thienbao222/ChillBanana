import { prisma } from "@/lib/prisma";
import type { Prisma, OrderCostLine, PaymentTransaction } from "@prisma/client";

export const COST_CATEGORIES = [
  "GOODS_JPY",
  "JP_DOMESTIC_SHIP",
  "TOKYO_HANDLING",
  "INTL_FREIGHT",
  "VN_DOMESTIC_SHIP",
  "IMPORT_TAX",
  "PAYMENT_FEE",
  "FX_FEE",
  "OTHER",
] as const;

export type CostCategory = (typeof COST_CATEGORIES)[number];

export const PAYMENT_KINDS = [
  "DEPOSIT",
  "BALANCE",
  "REFUND",
  "REVERSAL",
  "LEGACY",
] as const;

export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export interface CreateCostLineInput {
  orderId: string;
  category: CostCategory;
  amountOriginal: number;
  currency: "JPY" | "VND";
  fxRate?: number | null;
  amountVnd: number;
  note?: string | null;
  receiptUrl?: string | null;
  createdBy: string;
  purchaseTaskId?: string | null;
  shipmentId?: string | null;
}

/**
 * Tạo một dòng chi phí thực tế cho đơn hàng (OrderCostLine).
 * Luôn tuân thủ bất biến: amountVnd là số nguyên.
 */
export async function createCostLine(input: CreateCostLineInput): Promise<OrderCostLine> {
  if (!COST_CATEGORIES.includes(input.category)) {
    throw new Error(`Danh mục chi phí '${input.category}' không hợp lệ.`);
  }

  if (typeof input.amountOriginal !== "number" || !Number.isFinite(input.amountOriginal) || input.amountOriginal <= 0) {
    throw new Error("Số tiền gốc amountOriginal phải là số dương hợp lệ.");
  }

  if (typeof input.amountVnd !== "number" || !Number.isSafeInteger(input.amountVnd) || input.amountVnd < 0) {
    throw new Error("Số tiền quy đổi amountVnd phải là số nguyên không âm (VND).");
  }

  if (!input.createdBy || !input.createdBy.trim()) {
    throw new Error("Bắt buộc ghi nhận người tạo createdBy.");
  }

  return await prisma.$transaction(async (tx) => {
    const costLine = await tx.orderCostLine.create({
      data: {
        orderId: input.orderId,
        category: input.category,
        amountOriginal: input.amountOriginal,
        currency: input.currency,
        fxRate: input.fxRate ?? null,
        amountVnd: Math.round(input.amountVnd),
        note: input.note ? input.note.trim() : null,
        receiptUrl: input.receiptUrl ? input.receiptUrl.trim() : null,
        createdBy: input.createdBy.trim(),
        purchaseTaskId: input.purchaseTaskId ?? null,
        shipmentId: input.shipmentId ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        actor: input.createdBy.trim(),
        action: "COST_LINE_CREATED",
        entityType: "OrderCostLine",
        entityId: costLine.id,
        summary: `Thêm chi phí ${input.category}: ${input.amountVnd.toLocaleString("vi-VN")} VND cho đơn ${input.orderId}`,
        metadata: {
          costLineId: costLine.id,
          orderId: input.orderId,
          category: input.category,
          amountVnd: costLine.amountVnd,
          currency: input.currency,
        } as Prisma.InputJsonValue,
      },
    });

    return costLine;
  });
}

/**
 * Vô hiệu hóa một dòng chi phí bằng cách gắn cờ voidedAt.
 * TUYỆT ĐỐI KHÔNG XÓA CỨNG bản ghi tài chính.
 */
export async function voidCostLine(
  costLineId: string,
  reason: string,
  actor: string
): Promise<OrderCostLine> {
  if (!reason || !reason.trim()) {
    throw new Error("Bắt buộc nhập lý do khi vô hiệu hóa dòng chi phí.");
  }
  if (!actor || !actor.trim()) {
    throw new Error("Bắt buộc thông tin người thực hiện actor.");
  }

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.orderCostLine.findUnique({ where: { id: costLineId } });
    if (!existing) {
      throw new Error(`Không tìm thấy dòng chi phí với ID '${costLineId}'.`);
    }

    if (existing.voidedAt) {
      throw new Error("Dòng chi phí này đã bị vô hiệu hóa trước đó.");
    }

    const noteAppend = ` [HỦY: ${reason.trim()} - bởi ${actor.trim()}]`;
    const updatedNote = existing.note ? `${existing.note}${noteAppend}` : noteAppend.trim();

    const updated = await tx.orderCostLine.update({
      where: { id: costLineId },
      data: {
        voidedAt: new Date(),
        note: updatedNote,
      },
    });

    await tx.auditLog.create({
      data: {
        actor: actor.trim(),
        action: "COST_LINE_VOIDED",
        entityType: "OrderCostLine",
        entityId: costLineId,
        summary: `Hủy dòng chi phí ${existing.category} (${existing.amountVnd.toLocaleString("vi-VN")} VND). Lý do: ${reason.trim()}`,
        metadata: {
          costLineId,
          orderId: existing.orderId,
          reason: reason.trim(),
          amountVnd: existing.amountVnd,
        } as Prisma.InputJsonValue,
      },
    });

    return updated;
  });
}

/**
 * Tạo bản ghi đảo giao dịch thanh toán (REVERSAL).
 * 1. Đánh dấu bản gốc thành VOIDED và ghi voidedAt.
 * 2. Tạo một giao dịch mới với số tiền âm (-amountVnd), kind = "REVERSAL", reversalOfId trỏ về bản gốc.
 * 3. Ghi vết AuditLog chi tiết.
 * TUYỆT ĐỐI KHÔNG DÙNG delete hoặc deleteMany!
 */
export async function createReversal(
  paymentId: string,
  reason: string,
  actor: string
): Promise<{ original: PaymentTransaction; reversal: PaymentTransaction }> {
  if (!reason || !reason.trim()) {
    throw new Error("Bắt buộc nhập lý do hoàn tác giao dịch.");
  }
  if (!actor || !actor.trim()) {
    throw new Error("Bắt buộc thông tin người thực hiện actor.");
  }

  return await prisma.$transaction(async (tx) => {
    const original = await tx.paymentTransaction.findUnique({ where: { id: paymentId } });
    if (!original) {
      throw new Error(`Không tìm thấy giao dịch thanh toán với ID '${paymentId}'.`);
    }

    if (original.status === "VOIDED" || original.voidedAt) {
      throw new Error("Giao dịch đã bị vô hiệu hóa hoặc hoàn tác trước đó.");
    }

    if (original.kind === "REVERSAL") {
      throw new Error("Không thể tạo giao dịch đảo cho một giao dịch đảo.");
    }

    // 1. Đánh dấu bản gốc là VOIDED
    const noteAppend = ` [HOÀN TÁC: ${reason.trim()} - bởi ${actor.trim()}]`;
    const updatedNote = original.note ? `${original.note}${noteAppend}` : noteAppend.trim();

    const updatedOriginal = await tx.paymentTransaction.update({
      where: { id: paymentId },
      data: {
        status: "VOIDED",
        voidedAt: new Date(),
        note: updatedNote,
      },
    });

    // 2. Tạo bản ghi đảo REVERSAL
    const reversalProviderTxId = `rev_${Date.now()}_${original.id.slice(-8)}`;
    const reversal = await tx.paymentTransaction.create({
      data: {
        orderId: original.orderId,
        provider: original.provider,
        amountVnd: -original.amountVnd,
        status: "CONFIRMED",
        kind: "REVERSAL",
        reversalOfId: original.id,
        confirmedByAdmin: actor.trim(),
        note: `Hoàn tác cho giao dịch ${original.id}. Lý do: ${reason.trim()}`,
        reference: original.reference ? `REV:${original.reference}` : null,
        providerTransactionId: reversalProviderTxId,
        shipmentId: original.shipmentId ?? null,
      },
    });

    // 3. Ghi AuditLog
    await tx.auditLog.create({
      data: {
        actor: actor.trim(),
        action: "PAYMENT_REVERSED",
        entityType: "PaymentTransaction",
        entityId: original.id,
        summary: `Hoàn tác giao dịch ${original.id} (${original.amountVnd.toLocaleString("vi-VN")} VND). Bản ghi đảo: ${reversal.id}`,
        metadata: {
          originalPaymentId: original.id,
          reversalPaymentId: reversal.id,
          orderId: original.orderId,
          amountVnd: original.amountVnd,
          reversalAmountVnd: reversal.amountVnd,
          reason: reason.trim(),
        } as Prisma.InputJsonValue,
      },
    });

    return { original: updatedOriginal, reversal };
  });
}

