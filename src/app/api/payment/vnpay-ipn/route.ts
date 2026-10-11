import { NextRequest, NextResponse } from "next/server";
import { confirmVnpayPayment, verifyVnpaySignature } from "@/lib/vnpay-payment";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  if (!verifyVnpaySignature(params)) {
    return NextResponse.json({ RspCode: "97", Message: "Invalid signature" });
  }

  const orderCode = params.get("vnp_TxnRef") || "";
  if (!orderCode) return NextResponse.json({ RspCode: "01", Message: "Order not found" });
  if (params.get("vnp_ResponseCode") !== "00" || params.get("vnp_TransactionStatus") !== "00") {
    return NextResponse.json({ RspCode: "00", Message: "Confirm Success" });
  }

  try {
    const result = await confirmVnpayPayment(orderCode, params.get("vnp_Amount") || "");
    switch (result.result) {
      case "confirmed":
        return NextResponse.json({ RspCode: "00", Message: "Confirm Success" });
      case "already_paid":
        return NextResponse.json({ RspCode: "02", Message: "Order already confirmed" });
      case "not_found":
        return NextResponse.json({ RspCode: "01", Message: "Order not found" });
      case "invalid_amount":
        return NextResponse.json({ RspCode: "04", Message: "Invalid amount" });
      default:
        return NextResponse.json({ RspCode: "02", Message: "Order is not payable" });
    }
  } catch (error) {
    console.error("[VNPAY IPN] Payment confirmation failed:", error);
    return NextResponse.json({ RspCode: "99", Message: "Unknown error" });
  }
}
