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
    const order = await makeOrder({
      originalUrl: "https://www.amazon.co.jp/dp/B012345678",
      paymentStatus: "DEPOSITED_50",
      status: "PURCHASING_JP",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 403 })));
    const cookies = adminCookies("operator");

    const created = await createTask(post("/api/admin/purchase-tasks", { orderId: order.id }, { cookies }));
    expect(created.status).toBe(201);
    const { task } = await json(created);
    const approved = await updateTask(
      patch(`/api/admin/purchase-tasks/${task.id}`, { action: "approve" }, { cookies }),
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
    expect(logs[1]).toMatchObject({ actor: "operator", summary: "Cập nhật trạng thái tác vụ mua hộ: QUEUED → APPROVED." });
    expect(logs[1].metadata).toMatchObject({ action: "approve", fromStatus: "QUEUED", toStatus: "APPROVED" });
  });
});
