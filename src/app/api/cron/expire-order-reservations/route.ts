import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { releaseExpiredOrderReservations, remindOverdueWarehouseVnBalances } from "@/features/orders/reservations";

export const dynamic = "force-dynamic";

function hasValidCronSecret(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  const supplied = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || !supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Cron secret is not configured." }, { status: 503 });
  }
  if (!hasValidCronSecret(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const summary = await releaseExpiredOrderReservations(100, true);
  const reminderSummary = await remindOverdueWarehouseVnBalances(100);
  return NextResponse.json({ ...summary, warehouseVnReminders: reminderSummary }, { status: summary.success ? 200 : 500 });
}
