import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { writeAuditLog } from "@/lib/audit";
import { getPaymentProvider } from "@/features/payments/providers";
import { refundOrderPayment } from "@/features/payments/service";

export const dynamic = "force-dynamic";

// Hoàn tiền toàn phần cho đơn đã hủy mà khách đã thanh toán (chỉ SUPER_ADMIN).
// Với nhà cung cấp mô phỏng, đây là hoàn tiền mô phỏng; VNPAY chưa tích hợp hoàn tiền tự động.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;

  const { id } = await params;
  let body: { reason?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // body rỗng vẫn hợp lệ
  }
  const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 200) : "Hoàn tiền đơn đã hủy";

  const provider = getPaymentProvider();
  const outcome = await refundOrderPayment(provider, { orderCode: id, reason });

  switch (outcome.result) {
    case "refunded":
      await writeAuditLog({
        actor: guard.username,
        action: "ORDER_REFUNDED",
        entityType: "Order",
        entityId: id,
        summary: `Hoàn tiền đơn ${id} qua ${provider.name}${provider.isSimulated ? " (mô phỏng)" : ""}`,
        metadata: { provider: provider.name, providerRefundId: outcome.providerRefundId, reason },
        req,
      });
      return NextResponse.json({ success: true, simulated: provider.isSimulated, providerRefundId: outcome.providerRefundId });
    case "not_found":
      return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
    case "provider_failed":
      return NextResponse.json({ error: outcome.message }, { status: 502 });
    case "no_transaction":
      return NextResponse.json({ error: "Không có giao dịch đã xác nhận của nhà cung cấp này để hoàn." }, { status: 409 });
    default:
      return NextResponse.json({ error: "Chỉ hoàn tiền cho đơn đã hủy và đã thanh toán." }, { status: 409 });
  }
}
