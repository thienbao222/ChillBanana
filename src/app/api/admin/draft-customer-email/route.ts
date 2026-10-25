import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { prepareControlledCustomerEmail, ControlledDraftType } from "@/features/ai/admin/controlled-email";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const orderCode = typeof body?.orderCode === "string" ? body.orderCode.trim() : "";
    const draftType = body?.draftType as ControlledDraftType;
    const customInstructions = typeof body?.customInstructions === "string" ? body.customInstructions.trim() : undefined;

    if (!orderCode) {
      return NextResponse.json({ error: "Thiếu mã đơn hàng." }, { status: 400 });
    }

    const validTypes: ControlledDraftType[] = ["price_verification", "delay_apology", "status_adjustment"];
    if (!validTypes.includes(draftType)) {
      return NextResponse.json({ error: "Loại email cần soạn không hợp lệ." }, { status: 400 });
    }

    const email = await prepareControlledCustomerEmail(orderCode, draftType, customInstructions);
    return NextResponse.json({ success: true, email });
  } catch (error) {
    console.error("[DraftCustomerEmail] Lỗi soạn email:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể tạo bản nháp email." },
      { status: 500 }
    );
  }
}
