import { NextRequest, NextResponse } from "next/server";
import { chatKeyPool, visionKeyPool, adminKeyPool } from "@/lib/api-key-manager";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "chillbanana_admin_session";
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "chillbanana_secure_admin_salt_2026";

function verifyAdmin(req: NextRequest): boolean {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie?.value) return false;
  try {
    const decoded = Buffer.from(cookie.value, "base64").toString("utf-8");
    const [payloadStr, signature] = decoded.split("::");
    const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(payloadStr).digest("hex");
    if (signature !== expectedSig) return false;
    const payload = JSON.parse(payloadStr);
    return payload.exp > Date.now();
  } catch { return false; }
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập quản trị." }, { status: 401 });
  }

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
