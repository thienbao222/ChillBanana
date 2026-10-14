import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/auth-session";
import { detectPlatform } from "@/features/purchasing/service";

export const dynamic = "force-dynamic";

/** Search only orders that satisfy the existing purchase-task prerequisites. */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rawQuery = new URL(req.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  const query = rawQuery.replace(/^#\s*/, "").trim();
  if (query.length < 2) {
    return NextResponse.json({ orders: [] });
  }

  try {
    const orders = await prisma.order.findMany({
      where: {
        status: "PURCHASING_JP",
        paymentStatus: { in: ["DEPOSITED_50", "PAID_100"] },
        isPriceVerified: true,
        originalUrl: { not: null },
        purchaseTask: { is: null },
        OR: [
          { orderCode: { contains: query, mode: "insensitive" } },
          { customerName: { contains: query, mode: "insensitive" } },
          { productName: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        orderCode: true,
        customerName: true,
        productName: true,
        priceJpy: true,
        paymentStatus: true,
        originalUrl: true,
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    });

    return NextResponse.json({
      orders: orders.map(({ originalUrl, ...order }) => ({
        ...order,
        platform: detectPlatform(originalUrl ?? ""),
      })),
    });
  } catch (error) {
    console.error("Lỗi tìm đơn đủ điều kiện tạo purchase task:", error);
    return NextResponse.json({ error: "Không thể tìm đơn hàng lúc này." }, { status: 500 });
  }
}
