import { NextRequest, NextResponse } from "next/server";
import { getChatTrendAnalytics } from "@/lib/chat-store";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const ADMIN_COOKIE = "chillbanana_admin_session";
const ADMIN_SECRET = process.env.ADMIN_SESSION_SECRET || "INSECURE_PLACEHOLDER_SET_ADMIN_SESSION_SECRET_ENV";

function isAdmin(req: NextRequest): boolean {
  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!cookie) return false;
  try {
    const decoded = Buffer.from(cookie, "base64").toString("utf-8");
    const [payloadStr, sig] = decoded.split("::");
    if (!payloadStr || !sig) return false;
    const expected = crypto.createHmac("sha256", ADMIN_SECRET).update(payloadStr).digest("hex");
    if (sig !== expected) return false;
    const payload = JSON.parse(payloadStr);
    return payload.exp > Date.now();
  } catch { return false; }
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 401 });
  }
  try {
    const analytics = getChatTrendAnalytics();
    return NextResponse.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Lỗi khi lấy dữ liệu thống kê xu hướng." },
      { status: 500 }
    );
  }
}
