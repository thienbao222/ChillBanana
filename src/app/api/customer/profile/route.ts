import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerFromRequest } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sessionData = getCustomerFromRequest(req);
    if (!sessionData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
