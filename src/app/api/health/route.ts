import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "UNKNOWN";
  let dbLatencyMs = -1;

  try {
    const dbPingStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbPingStart;
    dbStatus = "HEALTHY";
  } catch (err: any) {
    dbStatus = "UNHEALTHY";
    console.error("[HealthCheck] Lỗi kết nối cơ sở dữ liệu:", err?.message);
  }

  // Quét thời gian chạy gần nhất của các tác vụ hệ thống (AuditLog)
  let cronWarnings: string[] = [];
  try {
    const thirtySixHoursAgo = new Date(Date.now() - 36 * 3600 * 1000);
    const lastCronLog = await prisma.auditLog.findFirst({
      where: {
        actor: { startsWith: "SYSTEM_CRON" },
      },
      orderBy: { createdAt: "desc" },
    });

    if (lastCronLog && lastCronLog.createdAt < thirtySixHoursAgo) {
      cronWarnings.push(`Cảnh báo: Tác vụ cron gần nhất chạy lúc ${lastCronLog.createdAt.toISOString()} (đã quá 36 giờ). Cần kiểm tra Vercel Cron.`);
    }
  } catch {
    // Không chặn health check nếu audit log đang bận
  }

  const isHealthy = dbStatus === "HEALTHY";
  const statusCode = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: isHealthy ? "OK" : "DEGRADED",
      version: "3.0.0",
      timestamp: new Date().toISOString(),
      appEnv: process.env.APP_ENV || "development",
      uptimeSeconds: Math.round(process.uptime()),
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      cronStatus: {
        warnings: cronWarnings,
        isOverdue: cronWarnings.length > 0,
      },
      responseTimeMs: Date.now() - startTime,
    },
    { status: statusCode }
  );
}

