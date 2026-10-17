import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;

  const requestedPage = Number.parseInt(req.nextUrl.searchParams.get("page") || "1", 10);
  const page = Number.isSafeInteger(requestedPage) ? Math.max(1, requestedPage) : 1;
  const action = req.nextUrl.searchParams.get("action")?.trim() || "";
  if (action && !/^[A-Z0-9_]{1,80}$/.test(action)) {
    return NextResponse.json({ error: "Bộ lọc thao tác không hợp lệ." }, { status: 400 });
  }

  try {
    const where = action ? { action: { startsWith: action } } : undefined;
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          actor: true,
          action: true,
          entityType: true,
          entityId: true,
          summary: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.count({ where }),
    ]);
    return NextResponse.json({ logs, pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) } });
  } catch (error) {
    console.error("[AdminAuditLog] Could not load logs:", error);
    return NextResponse.json({ error: "Không tải được nhật ký kiểm toán." }, { status: 503 });
  }
}
