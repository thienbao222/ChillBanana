import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { chatKeyPool, scrapeKeyPool, visionKeyPool, adminKeyPool } from "@/lib/api-key-manager";
import { getAllModelQuotaStates, formatVietnamTime } from "@/lib/model-quota";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;

  try {
    const poolEntries = [
      { name: "Chat", keys: chatKeyPool.getStatus() },
      { name: "Scrape", keys: scrapeKeyPool.getStatus() },
      { name: "Vision", keys: visionKeyPool.getStatus() },
      { name: "Admin", keys: adminKeyPool.getStatus() },
    ];

    // Deduplicate actual unique keys across pools so admin displays real distinct keys count
    const uniqueMap = new Map<string, {
      keyPreview: string;
      status: "ACTIVE" | "RATE_LIMITED" | "DEAD";
      cooldownUntil: number;
      requestCount: number;
      errorCount: number;
      pools: string[];
    }>();

    for (const pool of poolEntries) {
      for (const k of pool.keys) {
        const existing = uniqueMap.get(k.keyPreview);
        if (!existing) {
          uniqueMap.set(k.keyPreview, {
            keyPreview: k.keyPreview,
            status: k.status,
            cooldownUntil: k.cooldownUntil,
            requestCount: k.requestCount,
            errorCount: k.errorCount,
            pools: [pool.name],
          });
        } else {
          if (!existing.pools.includes(pool.name)) existing.pools.push(pool.name);
          existing.requestCount += k.requestCount;
          existing.errorCount += k.errorCount;
          if (k.status === "DEAD") {
            existing.status = "DEAD";
          } else if (k.status === "RATE_LIMITED" && existing.status !== "DEAD") {
            existing.status = "RATE_LIMITED";
          }
          existing.cooldownUntil = Math.max(existing.cooldownUntil, k.cooldownUntil);
        }
      }
    }

    const uniqueKeys = Array.from(uniqueMap.values()).map((k, i) => {
      const cooldownRemainingSec = Math.max(0, Math.ceil((k.cooldownUntil - Date.now()) / 1000));
      return {
        ...k,
        index: i + 1,
        cooldownRemainingSec,
      };
    });

    const modelQuotas = getAllModelQuotaStates().map((mq) => ({
      keyPreview: mq.keyPreview,
      model: mq.model,
      status: mq.status,
      cooldownUntil: mq.cooldownUntil,
      cooldownUntilVn: formatVietnamTime(mq.cooldownUntil),
      reason: mq.reason,
    }));

    return NextResponse.json({
      success: true,
      keys: uniqueKeys,
      totalKeys: uniqueKeys.length,
      activeKeys: uniqueKeys.filter(k => k.status === "ACTIVE").length,
      rateLimitedKeys: uniqueKeys.filter(k => k.status === "RATE_LIMITED").length,
      modelQuotas,
    });
  } catch (error) {
    console.error("Lỗi lấy trạng thái API Keys:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi lấy trạng thái API Keys." }, { status: 500 });
  }
}
