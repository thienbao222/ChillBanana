import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentProviderMode } from "@/lib/env";
import { MockPaymentProvider, isMockScenario, MOCK_SCENARIOS } from "@/features/payments/providers";
import { applyPaymentCallback } from "@/features/payments/service";

export const dynamic = "force-dynamic";

// Chỉ hoạt động khi PAYMENT_PROVIDER=mock (bị từ chối trên production). Dùng để diễn tập mọi kết quả thanh toán
// khi chưa có cổng thật: success, failed, pending, timeout, cancelled, duplicate (webhook gửi trùng).
export async function POST(req: NextRequest) {
  let mode: string;
  try {
    mode = getPaymentProviderMode();
  } catch {
    return NextResponse.json({ error: "Không tìm thấy." }, { status: 404 });
  }
  if (mode !== "mock") return NextResponse.json({ error: "Không tìm thấy." }, { status: 404 });

  let body: { orderCode?: unknown; scenario?: unknown; txnId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }
  if (typeof body.orderCode !== "string" || !isMockScenario(body.scenario)) {
    return NextResponse.json({ error: `Cần orderCode và scenario thuộc: ${MOCK_SCENARIOS.join(", ")}.` }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { orderCode: body.orderCode }, select: { depositAmountVnd: true } });
  if (!order) return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });

  const provider = new MockPaymentProvider();
  const callbacks = provider.buildCallbacks(body.scenario, {
    orderCode: body.orderCode,
    amountVnd: order.depositAmountVnd,
    txnId: typeof body.txnId === "string" && body.txnId ? body.txnId.slice(0, 120) : undefined,
  });
  const results = [];
  for (const callback of callbacks) results.push((await applyPaymentCallback(callback)).result);
  return NextResponse.json({ success: true, simulated: true, scenario: body.scenario, results });
}
