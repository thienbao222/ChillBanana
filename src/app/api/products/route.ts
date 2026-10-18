import { releaseExpiredOrderReservations } from "@/features/orders/reservations";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchLiveExchangeRate } from "@/features/pricing/exchange-rate";
import { getAdminUsernameFromRequest } from "@/lib/auth-session";
import { requireAdmin } from "@/lib/admin-guard";
import { writeAuditLog } from "@/lib/audit";
import curatedSeedProducts from "@/lib/curated-products.json";

export const dynamic = "force-dynamic";

// GET: Lấy danh sách sản phẩm (hỗ trợ lọc theo category, tự động seed từ curated-products.json nếu DB trống)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    // Lấy tỷ giá thực tế theo thời điểm hiện tại
    const rateData = await fetchLiveExchangeRate();
    const liveRate = rateData.roundedRate || 172;

    let dbProducts = await prisma.product.findMany({
      where: category && category !== "all" ? { category } : undefined,
      orderBy: { createdAt: "desc" },
    });

    const isTestEnv = process.env.APP_ENV === "test" || process.env.NODE_ENV === "test";

    // Giải phóng tồn kho các đơn giữ hàng quá hạn 30 phút ngay khi khách truy cập danh mục (hỗ trợ Vercel Hobby Cron)
    if (!isTestEnv) {
      await releaseExpiredOrderReservations(20).catch((err) =>
        console.warn("[Products API] Không thể giải phóng đơn giữ hàng quá hạn:", err)
      );
    }

    // Tự động nạp 10 sản phẩm mẫu vào DB nếu bảng Product đang hoàn toàn trống (bỏ qua trong môi trường test tự động)
    if (!isTestEnv && dbProducts.length === 0) {
      const totalCount = await prisma.product.count();
      if (totalCount === 0) {
        try {
          await prisma.product.createMany({
            data: curatedSeedProducts.map((item) => ({
              id: item.id,
              name: item.name,
              slug: item.slug,
              category: item.category,
              categoryName: item.categoryName,
              priceJpy: item.priceJpy,
              priceVnd: Math.round(item.priceJpy * liveRate),
              weightKg: item.weightKg,
              imageUrl: item.imageUrl,
              description: item.description,
              originalStore: item.originalStore,
              stockSlots: item.stockSlots,
              isHot: Boolean(item.isHot),
              featuredNote: item.featuredNote || "",
              voltageNote: (item as { voltageNote?: string }).voltageNote || undefined,
            })),
            skipDuplicates: true,
          });
          dbProducts = await prisma.product.findMany({
            where: category && category !== "all" ? { category } : undefined,
            orderBy: { createdAt: "desc" },
          });
        } catch (seedErr) {
          console.warn("[Products API] Fallback to static curated products:", seedErr);
        }
      }
    }

    const sourceList = dbProducts.length > 0 || isTestEnv
      ? dbProducts
      : curatedSeedProducts.filter((p) => !category || category === "all" || p.category === category);

    const liveProducts = sourceList.map((p) => ({
      ...p,
      priceVnd: Math.round(p.priceJpy * liveRate),
    }));

    return NextResponse.json({
      success: true,
      count: liveProducts.length,
      exchangeRate: liveRate,
      products: liveProducts,
    });
  } catch (error) {
    console.error("Lỗi tải danh sách sản phẩm:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi tải danh sách sản phẩm." },
      { status: 500 }
    );
  }
}

// POST: Thêm sản phẩm mới (Admin)
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  try {
    const body = await req.json();

    const priceJpy = body.priceJpy === undefined ? 3000 : Number(body.priceJpy);
    const weightKg = body.weightKg === undefined ? 0.4 : Number(body.weightKg);
    const stockSlots = body.stockSlots === undefined ? 10 : Number(body.stockSlots);
    if (!Number.isSafeInteger(priceJpy) || priceJpy < 1 || !Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 100 || !Number.isSafeInteger(stockSlots) || stockSlots < 0) {
      return NextResponse.json({ success: false, error: "Giá, cân nặng hoặc tồn kho không hợp lệ." }, { status: 400 });
    }
    const rateData = await fetchLiveExchangeRate();
    const liveRate = rateData.roundedRate || 172;
    const priceVnd = Math.round(priceJpy * liveRate);

    const slug = (body.name || "san-pham-moi")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "") + "-" + Math.floor(100 + Math.random() * 900);

    const categoryNames: Record<string, string> = {
      cosmetics: "Mỹ Phẩm & Chăm Sóc Da",
      health: "Thực Phẩm Chức Năng",
      gadgets: "Gia Dụng & Điện Tử Mini",
      anime: "Anime, Manga & Sưu Tầm",
    };

    // Lưu vào PostgreSQL thông qua Prisma.
    const newProd = await prisma.product.create({
      data: {
        id: "prod-" + Date.now(),
        name: body.name || "Sản phẩm nội địa Nhật",
        slug,
        category: (body.category as string) || "cosmetics",
        categoryName: categoryNames[body.category || ""] || "Hàng Nội Địa Nhật",
        priceJpy,
        priceVnd,
        weightKg,
        imageUrl: body.imageUrl || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80",
        description: body.description || "Sản phẩm nội địa Nhật Bản chính hãng.",
        originalStore: body.originalStore || "Amazon JP",
        stockSlots,
        isHot: Boolean(body.isHot),
        featuredNote: body.featuredNote || "",
        voltageNote: body.voltageNote || undefined,
      },
    });

    await writeAuditLog({
      actor: getAdminUsernameFromRequest(req) ?? "admin",
      action: "PRODUCT_CREATE",
      entityType: "Product",
      entityId: newProd.id,
      summary: `Tạo sản phẩm "${newProd.name}".`,
      req,
    });
    return NextResponse.json({
      success: true,
      message: "Thêm sản phẩm thành công!",
      product: newProd,
    }, { status: 201 });
  } catch (error) {
    console.error("Lỗi tạo sản phẩm:", error);
    return NextResponse.json(
      { success: false, error: "Không thể tạo sản phẩm." },
      { status: 500 }
    );
  }
}

// PUT: Cập nhật thông tin sản phẩm
export async function PUT(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Thiếu ID sản phẩm cần cập nhật." },
        { status: 400 }
      );
    }

    const rateData = await fetchLiveExchangeRate();
    const liveRate = rateData.roundedRate || 172;

    const priceJpy = data.priceJpy !== undefined ? Number(data.priceJpy) : undefined;
    const weightKg = data.weightKg !== undefined ? Number(data.weightKg) : undefined;
    const stockSlots = data.stockSlots !== undefined ? Number(data.stockSlots) : undefined;
    if (
      (priceJpy !== undefined && (!Number.isSafeInteger(priceJpy) || priceJpy < 1)) ||
      (weightKg !== undefined && (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 100)) ||
      (stockSlots !== undefined && (!Number.isSafeInteger(stockSlots) || stockSlots < 0))
    ) {
      return NextResponse.json({ success: false, error: "Giá, cân nặng hoặc tồn kho không hợp lệ." }, { status: 400 });
    }
    const priceVnd = priceJpy !== undefined ? Math.round(priceJpy * liveRate) : undefined;

    const categoryNames: Record<string, string> = {
      cosmetics: "Mỹ Phẩm & Chăm Sóc Da",
      health: "Thực Phẩm Chức Năng",
      gadgets: "Gia Dụng & Điện Tử Mini",
      anime: "Anime, Manga & Sưu Tầm",
    };

    let updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.category !== undefined) {
      updateData.category = data.category;
      updateData.categoryName = categoryNames[data.category as string] || data.category;
    }
    if (priceJpy !== undefined) updateData.priceJpy = priceJpy;
    if (priceVnd !== undefined) updateData.priceVnd = priceVnd;
    if (weightKg !== undefined) updateData.weightKg = weightKg;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.originalStore !== undefined) updateData.originalStore = data.originalStore;
    if (stockSlots !== undefined) updateData.stockSlots = stockSlots;
    if (data.isHot !== undefined) updateData.isHot = Boolean(data.isHot);
    if (data.featuredNote !== undefined) updateData.featuredNote = data.featuredNote;
    if (data.voltageNote !== undefined) updateData.voltageNote = data.voltageNote;

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    await writeAuditLog({
      actor: getAdminUsernameFromRequest(req) ?? "admin",
      action: "PRODUCT_UPDATE",
      entityType: "Product",
      entityId: id,
      summary: `Cập nhật sản phẩm "${updated.name}".`,
      metadata: { fields: Object.keys(updateData) },
      req,
    });
    return NextResponse.json({
      success: true,
      message: "Cập nhật thành công!",
      product: updated,
    });
  } catch (error) {
    console.error("Lỗi cập nhật sản phẩm:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi cập nhật sản phẩm." },
      { status: 500 }
    );
  }
}

// DELETE: Xóa sản phẩm
export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Thiếu ID sản phẩm cần xóa." },
        { status: 400 }
      );
    }

    await prisma.product.delete({
      where: { id },
    });

    await writeAuditLog({
      actor: getAdminUsernameFromRequest(req) ?? "admin",
      action: "PRODUCT_DELETE",
      entityType: "Product",
      entityId: id,
      summary: "Xóa sản phẩm.",
      req,
    });
    return NextResponse.json({
      success: true,
      message: "Đã xóa sản phẩm.",
    });
  } catch (error) {
    console.error("Lỗi xóa sản phẩm:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi xóa sản phẩm." },
      { status: 500 }
    );
  }
}
