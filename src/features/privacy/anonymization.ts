import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export interface AnonymizeCustomerResult {
  success: boolean;
  customerId: string;
  retainedFinancialRecordsCount: {
    orders: number;
    paymentTransactions: number;
  };
  note: string;
}

/**
 * Ẩn danh hóa hồ sơ khách hàng theo yêu cầu bảo vệ quyền riêng tư (WP6.2).
 * 
 * BẤT BIẾN TUYỆT ĐỐI:
 * - KHÔNG xóa cứng các chứng từ tài chính (Order, PaymentTransaction, OrderCostLine, AuditLog).
 * - Các chứng từ này là tài sản pháp lý bắt buộc phải lưu trữ theo luật kế toán và thuế.
 * - Hồ sơ định danh cá nhân (Họ tên, SĐT, Địa chỉ, Email) được ẩn danh hóa không thể đảo ngược.
 */
export async function anonymizeCustomerProfile(
  customerId: string,
  actor: string
): Promise<AnonymizeCustomerResult> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      orders: {
        include: {
          paymentTransactions: true,
        },
      },
      vnJpShipments: true,
    },
  });

  if (!customer) {
    throw new Error("CUSTOMER_NOT_FOUND");
  }

  const anonymizedTag = customer.id.slice(-6);
  const anonymizedEmail = `anonymized_${anonymizedTag}@privacy.chillbanana.local`;

  let totalPaymentTxs = 0;
  for (const order of customer.orders) {
    totalPaymentTxs += order.paymentTransactions.length;
  }

  // Cập nhật ẩn danh thông tin cá nhân trên Customer
  await prisma.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: customerId },
      data: {
        name: `Khách hàng Ẩn danh #${anonymizedTag}`,
        email: anonymizedEmail,
        phone: null,
        address: null,
        passwordHash: "ACCOUNT_ANONYMIZED_FOR_PRIVACY",
        zaloUserId: null,
      },
    });

    // Ẩn danh thông tin liên hệ trên các đơn hàng nhưng giữ nguyên số tiền và mã đơn
    for (const order of customer.orders) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          customerName: `Khách hàng #${anonymizedTag}`,
          customerPhone: "0000000000",
          customerEmail: anonymizedEmail,
          customerAddress: "Địa chỉ đã ẩn danh theo yêu cầu quyền riêng tư",
        },
      });
    }

    // Ẩn danh trên các phiếu VN -> JP nếu có
    for (const shipment of customer.vnJpShipments) {
      await tx.vnJpShipment.update({
        where: { id: shipment.id },
        data: {
          senderName: `Người gửi #${anonymizedTag}`,
          senderPhone: "0000000000",
          senderAddress: "Địa chỉ đã ẩn danh",
        },
      });
    }
  });

  await writeAuditLog({
    actor,
    action: "CUSTOMER_DATA_ANONYMIZED",
    entityType: "Customer",
    entityId: customerId,
    summary: `Ẩn danh hóa thông tin định danh cá nhân cho khách hàng ${customerId}. Bảo lưu toàn bộ ${customer.orders.length} đơn hàng và ${totalPaymentTxs} giao dịch tài chính.`,
    metadata: {
      customerId,
      anonymizedEmail,
      retainedOrdersCount: customer.orders.length,
      retainedTransactionsCount: totalPaymentTxs,
    },
  });

  return {
    success: true,
    customerId,
    retainedFinancialRecordsCount: {
      orders: customer.orders.length,
      paymentTransactions: totalPaymentTxs,
    },
    note: "Đã ẩn danh hóa thành công thông tin định danh cá nhân. Toàn bộ chứng từ tài chính được bảo lưu nguyên vẹn theo quy chuẩn kế toán.",
  };
}

