import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchLiveExchangeRate } from "@/lib/exchange-rate";
import { isAdminRequest } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

// GET: Lấy danh sách sản phẩm (hỗ trợ lọc theo category, tính giá VND theo tỷ giá live thời gian thực)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    // Lấy tỷ giá thực tế theo thời điểm hiện tại
    const rateData = await fetchLiveExchangeRate();
    const liveRate = rateData.roundedRate || 172;

    const dbProducts = await prisma.product.findMany({
      where: category && category !== "all" ? { category } : undefined,
      orderBy: { createdAt: "desc" },
    });

    const liveProducts = dbProducts.map((p) => ({
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
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập quản trị." }, { status: 401 });
  }
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

    // Lưu vào CSDL Prisma SQLite
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
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập quản trị." }, { status: 401 });
  }
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
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập quản trị." }, { status: 401 });
  }
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
