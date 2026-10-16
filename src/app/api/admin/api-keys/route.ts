import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { chatKeyPool, visionKeyPool, adminKeyPool } from "@/lib/api-key-manager";

export const dynamic = "force-dynamic";


export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN"] });
  if (!guard.ok) return guard.response;

  try {
    const chatKeys = chatKeyPool.getStatus();
    const visionKeys = visionKeyPool.getStatus();
    const adminKeys = adminKeyPool.getStatus();

    const allKeys = [...chatKeys, ...visionKeys, ...adminKeys];
    
    // Group keys logically for the UI to display them unified
    // For simplicity, we just return the chatKeys right now since UI expects a single array
    // Wait, the UI expects { keys: [...], activeKeys, rateLimitedKeys }.
    // Let's combine them and give them unique index names
    const combinedKeys = [
      ...chatKeys.map((k, i) => ({ ...k, index: `Chat-${i+1}` })),
      ...visionKeys.map((k, i) => ({ ...k, index: `Vision-${i+1}` })),
      ...adminKeys.map((k, i) => ({ ...k, index: `Admin-${i+1}` }))
    ];

    return NextResponse.json({
      success: true,
      keys: combinedKeys,
      totalKeys: combinedKeys.length,
      activeKeys: combinedKeys.filter(k => k.status === "ACTIVE").length,
      rateLimitedKeys: combinedKeys.filter(k => k.status === "RATE_LIMITED").length,
    });
  } catch (error) {
    console.error("Lỗi lấy trạng thái API Keys:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi lấy trạng thái API Keys." }, { status: 500 });
  }
}
