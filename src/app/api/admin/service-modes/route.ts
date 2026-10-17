import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { resolvePaymentMode } from "@/features/payments/provider";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;

  return NextResponse.json({
    paymentMode: resolvePaymentMode(),
    vnpaySandboxReady: Boolean(process.env.VNPAY_TMN_CODE && process.env.VNPAY_HASH_SECRET && process.env.VNPAY_URL),
    emailMode: process.env.EMAIL_MODE?.trim().toLowerCase() === "smtp" ? "smtp" : "mock",
    smtpReady: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
    livePaymentEnabled: false,
  });
}
