import { NextRequest, NextResponse } from "next/server";
import { resolvePaymentMode } from "@/features/payments/provider";
import { verifyMockPaymentAttemptToken } from "@/features/payments/mock-provider";
import { applyMockPaymentOutcome, type MockPaymentOutcome } from "@/lib/mock-payment";

export const dynamic = "force-dynamic";

const OUTCOMES = new Set<MockPaymentOutcome>(["success", "failed", "pending", "timeout"]);

export async function POST(req: NextRequest) {
  if (resolvePaymentMode() !== "mock") {
    return NextResponse.json({ error: "Nhà cung cấp mô phỏng không được bật." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const payload = verifyMockPaymentAttemptToken(body?.token);
  if (!payload) return NextResponse.json({ error: "Liên kết mô phỏng không hợp lệ hoặc đã hết hạn." }, { status: 400 });
  if (!OUTCOMES.has(body?.outcome)) return NextResponse.json({ error: "Kết quả mô phỏng không hợp lệ." }, { status: 400 });
  try {
    const result = await applyMockPaymentOutcome(payload.attemptId, body.outcome as MockPaymentOutcome);
    const status = result.result === "not_found" ? 404 : result.result === "expired" ? 410 : result.result === "not_payable" ? 409 : 200;
    return NextResponse.json({ ...result, demo: true, message: result.result === "simulated_success" ? "Đã ghi nhận kịch bản thành công; đơn vẫn chưa được thanh toán thật hoặc chuyển sang xử lý mua hàng." : undefined }, { status });
  } catch (error) {
    console.error("[MockPayment] Could not apply outcome:", error);
    return NextResponse.json({ error: "Không xử lý được kịch bản thanh toán mô phỏng." }, { status: 503 });
  }
}
