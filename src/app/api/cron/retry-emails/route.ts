import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { retryEmailLog } from "@/lib/mailer";
import { retryDueEmails } from "@/features/notifications/retry";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function hasValidCronSecret(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  const supplied = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Thử lại email FAILED đã đến hạn. Cần CRON_SECRET (Vercel Cron tự gửi header Authorization khi biến này được đặt).
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "Cron secret is not configured." }, { status: 503 });
  if (!hasValidCronSecret(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const summary = await retryDueEmails({ retry: retryEmailLog });
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error("[EmailRetry] Cron failed:", error);
    return NextResponse.json({ error: "Không thể chạy thử lại email." }, { status: 503 });
  }
}
