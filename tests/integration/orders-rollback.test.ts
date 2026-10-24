import { describe, expect, it, vi } from "vitest";
import { POST as createOrder } from "@/app/api/orders/route";
import { PATCH as patchOrder } from "@/app/api/orders/[id]/route";
import { prisma } from "../helpers/db";
import { json, params, patch, post } from "../helpers/request";
import { adminCookies, makeAdmin, makeOrder, makeProduct, orderPayload } from "../helpers/factories";
import { sendAdminNewOrderEmail, sendOrderRollbackEmail } from "@/lib/mailer";

describe("Tích hợp Rollback và Email quản trị", () => {
  it("(a) tạo đơn thì gọi gửi email admin khi ADMIN_NOTIFY_EMAIL có giá trị và không gọi khi rỗng", async () => {
    const product = await makeProduct({ stockSlots: 5 });

    // Khi ADMIN_NOTIFY_EMAIL có giá trị
    process.env.ADMIN_NOTIFY_EMAIL = "admin1@chillbanana.vn, admin2@chillbanana.vn";
    const res1 = await createOrder(post("/api/orders", orderPayload([{ id: product.id, quantity: 1 }])));
    expect(res1.status).toBe(200);
    expect(sendAdminNewOrderEmail).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();

    // Khi ADMIN_NOTIFY_EMAIL rỗng
    process.env.ADMIN_NOTIFY_EMAIL = "";
    const res2 = await createOrder(post("/api/orders", orderPayload([{ id: product.id, quantity: 1 }])));
    expect(res2.status).toBe(200);
    expect(sendAdminNewOrderEmail).not.toHaveBeenCalled();

    delete process.env.ADMIN_NOTIFY_EMAIL;
  });

  it("(b) rollback thiếu reason hoặc dưới 5 ký tự thì trả 400", async () => {
    await makeAdmin("boss", "SUPER_ADMIN");
    const order = await makeOrder({ status: "WAREHOUSE_JP" });
    const cookies = adminCookies("boss");

    const resNoReason = await patchOrder(
      patch(`/api/orders/${order.orderCode}`, { action: "rollback" }, { cookies }),
      params({ id: order.orderCode })
    );
    expect(resNoReason.status).toBe(400);
    const bodyNoReason = await json(resNoReason);
    expect(bodyNoReason.error).toContain("tối thiểu 5 ký tự");

    const resShort = await patchOrder(
      patch(`/api/orders/${order.orderCode}`, { action: "rollback", reason: "nham" }, { cookies }),
      params({ id: order.orderCode })
    );
    expect(resShort.status).toBe(400);
  });

  it("(c) rollback từ COMPLETED bằng OPERATOR trả 403, bằng SUPER_ADMIN thành công và có email cải chính", async () => {
    await makeAdmin("staff", "OPERATOR");
    await makeAdmin("boss", "SUPER_ADMIN");
    const order = await makeOrder({ status: "COMPLETED", paymentStatus: "PAID_100" });

    // OPERATOR nhận 403
    const resOp = await patchOrder(
      patch(
        `/api/orders/${order.orderCode}`,
        { action: "rollback", reason: "Lùi bước giao lại cho khách" },
        { cookies: adminCookies("staff", "OPERATOR") }
      ),
      params({ id: order.orderCode })
    );
    expect(resOp.status).toBe(403);
    const bodyOp = await json(resOp);
    expect(bodyOp.error).toContain("SUPER_ADMIN");

    // SUPER_ADMIN thành công 200 và gửi email cải chính
    const resSuper = await patchOrder(
      patch(
        `/api/orders/${order.orderCode}`,
        { action: "rollback", reason: "Cập nhật nhầm thành công khi khách chưa nhận" },
        { cookies: adminCookies("boss", "SUPER_ADMIN") }
      ),
      params({ id: order.orderCode })
    );
    expect(resSuper.status).toBe(200);
    const bodySuper = await json(resSuper);
    expect(bodySuper.success).toBe(true);
    expect(bodySuper.order.status).toBe("LOCAL_DELIVERY");
    expect(sendOrderRollbackEmail).toHaveBeenCalledWith(
      expect.objectContaining({ orderCode: order.orderCode }),
      expect.objectContaining({
        fromLabel: "Giao hàng thành công",
        toLabel: "Đang giao chặng cuối",
        isFromCompleted: true,
      })
    );
  });

  it("(d) rollback về PENDING_DEPOSIT khi đã cọc (paymentStatus khác UNPAID) trả 400", async () => {
    await makeAdmin("boss", "SUPER_ADMIN");
    const order = await makeOrder({ status: "PURCHASING_JP", paymentStatus: "DEPOSITED_50" });

    const res = await patchOrder(
      patch(
        `/api/orders/${order.orderCode}`,
        { action: "rollback", reason: "Lùi lại bước chờ cọc do nhầm lẫn" },
        { cookies: adminCookies("boss") }
      ),
      params({ id: order.orderCode })
    );
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error).toContain("hủy/hoàn tiền");
  });
});
