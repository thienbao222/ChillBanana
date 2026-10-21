import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as createTask } from "@/app/api/admin/purchase-tasks/route";
import { PATCH as updateTask } from "@/app/api/admin/purchase-tasks/[id]/route";
import { prisma } from "../helpers/db";
import { adminCookies, makeAdmin, makeOrder } from "../helpers/factories";
import { json, params, patch, post } from "../helpers/request";

afterEach(() => vi.unstubAllGlobals());

describe("audit tác vụ mua hộ", () => {
  it("ghi sự kiện sau khi tạo task và đổi trạng thái thành công", async () => {
    await makeAdmin("operator", "OPERATOR");
    await makeAdmin("boss", "SUPER_ADMIN");
    const order = await makeOrder({
      originalUrl: "https://www.amazon.co.jp/dp/B012345678",
      paymentStatus: "DEPOSITED_50",
      status: "PURCHASING_JP",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 403 })));
    const opCookies = adminCookies("operator");
    const bossCookies = adminCookies("boss");

    const created = await createTask(post("/api/admin/purchase-tasks", { orderId: order.id }, { cookies: opCookies }));
    expect(created.status).toBe(201);
    const { task } = await json(created);

    // BẢO MẬT (P1-04 & P2-12): OPERATOR không được phép duyệt task -> nhận 403
    const opAttempt = await updateTask(
      patch(`/api/admin/purchase-tasks/${task.id}`, { action: "approve" }, { cookies: opCookies }),
      params({ id: task.id })
    );
    expect(opAttempt.status).toBe(403);

    // SUPER_ADMIN duyệt thành công -> nhận 200
    const approved = await updateTask(
      patch(`/api/admin/purchase-tasks/${task.id}`, { action: "approve" }, { cookies: bossCookies }),
      params({ id: task.id })
    );
    expect(approved.status).toBe(200);

    const logs = await prisma.auditLog.findMany({
      where: { entityType: "PurchaseTask", entityId: task.id },
      orderBy: { createdAt: "asc" },
      select: { actor: true, action: true, summary: true, metadata: true },
    });
    expect(logs).toHaveLength(2);
    expect(logs.map((log) => log.action)).toEqual(["PURCHASE_TASK_CREATED", "PURCHASE_TASK_STATUS_CHANGED"]);
    expect(logs[0]).toMatchObject({ actor: "operator", summary: "Tạo tác vụ mua hộ." });
    expect(logs[1]).toMatchObject({ actor: "boss", summary: "Cập nhật trạng thái tác vụ mua hộ: QUEUED → APPROVED." });
    expect(logs[1].metadata).toMatchObject({ action: "approve", fromStatus: "QUEUED", toStatus: "APPROVED" });
  });
});
