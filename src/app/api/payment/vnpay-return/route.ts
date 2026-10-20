import { NextRequest, NextResponse } from "next/server";
import { confirmVnpayPayment, verifyVnpaySignature } from "@/lib/vnpay-payment";
import { resolvePaymentMode } from "@/features/payments/provider";
import { recordVnpayAttemptFailure } from "@/lib/vnpay-payment";

function getAppUrl() {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === "production" ? "https://chill-banana.vercel.app" : "http://localhost:3000")).replace(/\/+$/, "");
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const rawTxnRef = params.get("vnp_TxnRef") || "";
  const orderCode = rawTxnRef.includes("_") ? rawTxnRef.split("_")[0] : rawTxnRef;
  if (resolvePaymentMode() !== "sandbox") {
    return NextResponse.redirect(`${getAppUrl()}/tracking?orderCode=${encodeURIComponent(orderCode)}&payment=disabled`);
  }
  if (!verifyVnpaySignature(params)) {
    return NextResponse.redirect(`${getAppUrl()}/tracking?orderCode=${encodeURIComponent(orderCode)}&payment=invalid`);
  }

  if (params.get("vnp_ResponseCode") !== "00" || params.get("vnp_TransactionStatus") !== "00") {
    await recordVnpayAttemptFailure(orderCode, params.get("vnp_ResponseCode"));
    return NextResponse.redirect(`${getAppUrl()}/tracking?orderCode=${encodeURIComponent(orderCode)}&payment=failed`);
  }

  try {
    const result = await confirmVnpayPayment(
      orderCode,
      params.get("vnp_Amount") || "",
      params.get("vnp_TransactionNo")
    );
    const payment = result.result === "confirmed" || result.result === "already_paid" ? "simulated" : "invalid";
    return NextResponse.redirect(`${getAppUrl()}/tracking?orderCode=${encodeURIComponent(orderCode)}&payment=${payment}`);
  } catch (error) {
    console.error("[VNPAY RETURN] Payment confirmation failed:", error);
    return NextResponse.redirect(`${getAppUrl()}/tracking?orderCode=${encodeURIComponent(orderCode)}&payment=pending`);
  }
}
