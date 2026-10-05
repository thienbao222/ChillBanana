import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const CUSTOMER_SESSION_SECRET = process.env.CUSTOMER_SESSION_SECRET || (() => { return 'INSECURE_PLACEHOLDER_SET_CUSTOMER_SESSION_SECRET_ENV'; })();

function verifySession(cookie: string): { id: string; email: string } | null {
  try {
    const decoded = Buffer.from(cookie, "base64").toString("utf-8");
    const [payloadStr, signature] = decoded.split("::");
    if (!payloadStr || !signature) return null;
    const expectedSig = crypto.createHmac("sha256", CUSTOMER_SESSION_SECRET).update(payloadStr).digest("hex");
    if (signature !== expectedSig) return null;
    return JSON.parse(payloadStr);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const customerCookie = req.cookies.get("cb_customer_session")?.value;
    if (!customerCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionData = verifySession(customerCookie);
    if (!sessionData) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: sessionData.id },
      include: {
        orders: {
          orderBy: { createdAt: "desc" },
          include: { trackingLogs: { orderBy: { createdAt: "desc" } } }
        },
        chatSessions: {
          orderBy: { updatedAt: "desc" },
          take: 10
        }
      }
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Xóa password hash khỏi response
    const { passwordHash, ...safeCustomer } = customer;

    return NextResponse.json({ success: true, profile: safeCustomer });
  } catch (error) {
    console.error("Profile API Error:", error);
    return NextResponse.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}
