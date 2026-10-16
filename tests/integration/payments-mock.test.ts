import { afterEach, describe, expect, it } from "vitest";
import { POST as createPayment } from "@/app/api/payment/vnpay-create/route";
import { POST as confirmMockPayment } from "@/app/api/payment/mock-confirm/route";
import { prisma } from "../helpers/db";
import { json, post } from "../helpers/request";
import { makeOrder } from "../helpers/factories";

const savedMode = process.env.PAYMENT_MODE;
afterEach(() => {
  if (savedMode === undefined) delete process.env.PAYMENT_MODE;
  else process.env.PAYMENT_MODE = savedMode;
});

async function startMockPayment(orderCode: string) {
  process.env.PAYMENT_MODE = "mock";
  const response = await createPayment(post("/api/payment/vnpay-create", { orderCode }));
  const data = await json<{ paymentUrl: string; mode: string }>(response);
  return { response, data, token: new URL(data.paymentUrl).searchParams.get("token") || "" };
}

describe("mock payment provider", () => {
  it("creates a signed demo checkout without contacting VNPAY", async () => {
    const order = await makeOrder();
    const { response, data, token } = await startMockPayment(order.orderCode);
    expect(response.status).toBe(200);
    expect(data.mode).toBe("mock");
    expect(new URL(data.paymentUrl).pathname).toBe("/payment/mock");
    expect(token).toBeTruthy();
    expect(await prisma.paymentAttempt.count({ where: { orderId: order.id, provider: "MOCK" } })).toBe(1);
  });

  it("records a failed simulation but leaves order payment and inventory flow unpaid", async () => {
    const order = await makeOrder();
    const { token } = await startMockPayment(order.orderCode);
    const response = await confirmMockPayment(post("/api/payment/mock-confirm", { token, outcome: "failed" }));
    expect(response.status).toBe(200);
    expect((await json(response)).result).toBe("failed");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("UNPAID");
    expect((await prisma.paymentAttempt.findFirstOrThrow({ where: { orderId: order.id } })).status).toBe("FAILED");
    expect(await prisma.paymentTransaction.count()).toBe(0);
  });

  it("keeps a pending result retryable and confirms it only as a simulation", async () => {
    const order = await makeOrder();
    const { token } = await startMockPayment(order.orderCode);
    const pending = await confirmMockPayment(post("/api/payment/mock-confirm", { token, outcome: "pending" }));
    expect((await json(pending)).result).toBe("pending");
    const succeeded = await confirmMockPayment(post("/api/payment/mock-confirm", { token, outcome: "success" }));
    expect((await json(succeeded)).result).toBe("simulated_success");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("UNPAID");
  });

  it("marks simulated success explicitly and is idempotent", async () => {
    const order = await makeOrder();
    const { token } = await startMockPayment(order.orderCode);
    const request = () => confirmMockPayment(post("/api/payment/mock-confirm", { token, outcome: "success" }));
    expect((await json(await request())).result).toBe("simulated_success");
    expect((await json(await request())).result).toBe("simulated_success");
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.paymentStatus).toBe("UNPAID");
    expect(after.status).toBe("PENDING_DEPOSIT");
    expect(await prisma.paymentTransaction.count()).toBe(0);
    expect((await prisma.paymentAttempt.findFirstOrThrow({ where: { orderId: order.id } })).status).toBe("CONFIRMED");
  });

  it("rejects tampered tokens and rejects the simulator when another provider mode is active", async () => {
    const order = await makeOrder();
    const { token } = await startMockPayment(order.orderCode);
    const tampered = await confirmMockPayment(post("/api/payment/mock-confirm", { token: `${token}x`, outcome: "success" }));
    expect(tampered.status).toBe(400);
    process.env.PAYMENT_MODE = "sandbox";
    const disabled = await confirmMockPayment(post("/api/payment/mock-confirm", { token, outcome: "success" }));
    expect(disabled.status).toBe(403);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("UNPAID");
  });

  it("prevents concurrent attempts from creating multiple active payment sessions", async () => {
    const order = await makeOrder();
    process.env.PAYMENT_MODE = "mock";
    const results = await Promise.all([
      createPayment(post("/api/payment/vnpay-create", { orderCode: order.orderCode })),
      createPayment(post("/api/payment/vnpay-create", { orderCode: order.orderCode })),
    ]);
    expect(results.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await prisma.paymentAttempt.count({ where: { orderId: order.id, status: "INITIATED" } })).toBe(1);
  });
});
