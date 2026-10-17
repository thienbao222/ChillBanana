import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;
  const status = req.nextUrl.searchParams.get("status");
  try {
    const logs = await prisma.emailLog.findMany({
      where: status && ["SENT", "SIMULATED", "FAILED", "PENDING"].includes(status) ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        emailType: true,
        providerMode: true,
        status: true,
        attemptCount: true,
        maxAttempts: true,
        lastErrorCode: true,
        nextRetryAt: true,
        sentAt: true,
        createdAt: true,
        order: { select: { orderCode: true } },
      },
    });
    return NextResponse.json({ logs });
  } catch (error) {
    console.error("[AdminEmailLog] Could not read logs:", error);
    return NextResponse.json({ error: "Không tải được nhật ký email." }, { status: 503 });
  }
}
