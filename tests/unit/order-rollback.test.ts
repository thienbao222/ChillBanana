import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/notifications/email-delivery", () => ({
  deliverLoggedEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
    },
  },
}));

import { deliverLoggedEmail } from "@/features/notifications/email-delivery";
import { ORDER_STATUS_LABELS_VI, getPreviousOrderStatus } from "@/features/orders/policy";
import { sendOrderRollbackEmail, retryEmailLog } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";

afterEach(() => {
  vi.clearAllMocks();
});

describe("Hoàn tác trạng thái đơn hàng (Rollback Policy & Email)", () => {
  it("ORDER_STATUS_LABELS_VI định nghĩa đầy đủ nhãn tiếng Việt cho mọi trạng thái", () => {
    expect(ORDER_STATUS_LABELS_VI.PENDING_DEPOSIT).toBe("Chờ cọc");
    expect(ORDER_STATUS_LABELS_VI.PURCHASING_JP).toBe("Đang mua tại Nhật");
    expect(ORDER_STATUS_LABELS_VI.WAREHOUSE_JP).toBe("Đã nhập kho Nhật");
    expect(ORDER_STATUS_LABELS_VI.IN_TRANSIT_AIR).toBe("Đang vận chuyển quốc tế");
    expect(ORDER_STATUS_LABELS_VI.WAREHOUSE_VN).toBe("Đã nhập kho Việt Nam");
    expect(ORDER_STATUS_LABELS_VI.LOCAL_DELIVERY).toBe("Đang giao chặng cuối");
    expect(ORDER_STATUS_LABELS_VI.COMPLETED).toBe("Giao hàng thành công");
    expect(ORDER_STATUS_LABELS_VI.CANCELLED).toBe("Đã hủy");
  });

  it("getPreviousOrderStatus trả về đúng bước liền trước", () => {
    expect(getPreviousOrderStatus("COMPLETED")).toBe("LOCAL_DELIVERY");
    expect(getPreviousOrderStatus("LOCAL_DELIVERY")).toBe("WAREHOUSE_VN");
    expect(getPreviousOrderStatus("WAREHOUSE_VN")).toBe("IN_TRANSIT_AIR");
    expect(getPreviousOrderStatus("IN_TRANSIT_AIR")).toBe("WAREHOUSE_JP");
    expect(getPreviousOrderStatus("WAREHOUSE_JP")).toBe("PURCHASING_JP");
    expect(getPreviousOrderStatus("PURCHASING_JP")).toBe("PENDING_DEPOSIT");
    expect(getPreviousOrderStatus("PENDING_DEPOSIT")).toBeNull();
  });

  it("sendOrderRollbackEmail: gửi email điều chỉnh thông thường với giọng văn xin lỗi lịch sự", async () => {
    const mockOrder = {
      id: "ord-1",
      orderCode: "CB-ROLLBACK-01",
      customerName: "Nguyễn Văn A",
      customerEmail: "khach@example.com",
    };

    const result = await sendOrderRollbackEmail(mockOrder, {
      fromLabel: "Đã nhập kho Việt Nam",
      toLabel: "Đang vận chuyển quốc tế",
      reason: "Kiện hàng chưa về tới kho Hà Nội, nhân viên quét nhầm mã",
      isFromCompleted: false,
    });

    expect(result).toBe(true);
    expect(deliverLoggedEmail).toHaveBeenCalledTimes(1);

    const callArg = vi.mocked(deliverLoggedEmail).mock.calls[0][0];
    expect(callArg.emailType).toBe("order-rollback");
    expect(callArg.to).toBe("khach@example.com");
    expect(callArg.subject).toBe("[ChillBanana] Thông báo điều chỉnh trạng thái đơn hàng #CB-ROLLBACK-01");
    expect(callArg.html).toContain("Đang vận chuyển quốc tế");
    expect(callArg.html).toContain("Kiện hàng chưa về tới kho Hà Nội");
    expect(callArg.html).toContain('target="_blank" rel="noopener noreferrer"');
    expect(callArg.html).toContain("Tra cứu tiến độ");
    expect(callArg.payload).toEqual({
      fromLabel: "Đã nhập kho Việt Nam",
      toLabel: "Đang vận chuyển quốc tế",
      reason: "Kiện hàng chưa về tới kho Hà Nội, nhân viên quét nhầm mã",
      isFromCompleted: false,
    });
  });

  it("sendOrderRollbackEmail: khi lùi từ COMPLETED, tiêu đề ghi rõ CHƯA hoàn tất và có khối cải chính", async () => {
    const mockOrder = {
      id: "ord-2",
      orderCode: "CB-COMPLETED-ERR",
      customerName: "Trần Thị B",
      customerEmail: "tranthib@example.com",
    };

    const result = await sendOrderRollbackEmail(mockOrder, {
      fromLabel: "Giao hàng thành công",
      toLabel: "Đang giao chặng cuối",
      reason: "Shipper bấm hoàn tất trước khi phát xong kiện hàng",
      isFromCompleted: true,
    });

    expect(result).toBe(true);
    expect(deliverLoggedEmail).toHaveBeenCalledTimes(1);

    const callArg = vi.mocked(deliverLoggedEmail).mock.calls[0][0];
    expect(callArg.subject).toBe("[ChillBanana] Điều chỉnh: đơn CB-COMPLETED-ERR CHƯA hoàn tất");
    expect(callArg.html).toContain("Đính chính thông tin hoàn tất đơn hàng");
    expect(callArg.html).toContain("hiện tại vẫn đang trong quá trình xử lý/giao hàng");
    expect(callArg.html).toContain("Shipper bấm hoàn tất trước khi phát xong");
    expect(callArg.payload.isFromCompleted).toBe(true);
  });

  it("sendOrderRollbackEmail: escape HTML các ký tự đặc biệt trong dữ liệu người dùng", async () => {
    const mockOrder = {
      id: "ord-3",
      orderCode: "CB-XSS-TEST",
      customerName: "<script>alert('xss')</script>",
      customerEmail: "safe@example.com",
    };

    await sendOrderRollbackEmail(mockOrder, {
      fromLabel: "Giao hàng",
      toLabel: "Chờ giao",
      reason: "<img src=x onerror=alert(1)> Sửa lỗi nhầm lẫn",
      isFromCompleted: false,
    });

    const callArg = vi.mocked(deliverLoggedEmail).mock.calls[0][0];
    expect(callArg.html).not.toContain("<script>");
    expect(callArg.html).toContain("&lt;script&gt;");
    expect(callArg.html).not.toContain("<img src=x");
    expect(callArg.html).toContain("&lt;img src=x");
  });

  it("retryEmailLog hỗ trợ thử lại loại email order-rollback", async () => {
    const mockLog = {
      id: "log-1",
      emailType: "order-rollback",
      status: "FAILED",
      payload: {
        fromLabel: "Đã nhập kho Việt Nam",
        toLabel: "Đang vận chuyển quốc tế",
        reason: "Cập nhật nhầm kiện hàng",
        isFromCompleted: false,
      },
      order: {
        id: "ord-1",
        orderCode: "CB-RETRY-01",
        customerName: "Lê Văn C",
        customerEmail: "levanc@example.com",
      },
    };

    vi.mocked(prisma.emailLog.findUnique).mockResolvedValue(mockLog as any);

    const retryRes = await retryEmailLog("log-1");
    expect(retryRes).toBe(true);
    expect(deliverLoggedEmail).toHaveBeenCalledTimes(1);
    const callArg = vi.mocked(deliverLoggedEmail).mock.calls[0][0];
    expect(callArg.emailType).toBe("order-rollback");
    expect(callArg.logId).toBe("log-1");
    expect(callArg.to).toBe("levanc@example.com");
  });
});
