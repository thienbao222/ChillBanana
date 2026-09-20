import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAllProducts, createProduct, updateProduct, deleteProduct } from "@/lib/product-store";
import { fetchLiveExchangeRate } from "@/lib/exchange-rate";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "chillbanana_admin_session";
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "chillbanana_secure_admin_salt_2026";

function verifyAdminSession(req: NextRequest): boolean {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie || !cookie.value) return false;

  try {
    const decoded = Buffer.from(cookie.value, "base64").toString("utf-8");
    const [payloadStr, signature] = decoded.split("::");
    const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(payloadStr).digest("hex");
    if (signature !== expectedSig) return false;

    const payload = JSON.parse(payloadStr);
    if (payload.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

// GET: Lấy danh sách sản phẩm (hỗ trợ lọc theo category, tính giá VND theo tỷ giá live thời gian thực)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    // Lấy tỷ giá thực tế theo thời điểm hiện tại
    const rateData = await fetchLiveExchangeRate();
    const liveRate = rateData.roundedRate || 172;

    // 1. Lấy từ CSDL Prisma SQLite
    try {
      const dbProducts = await prisma.product.findMany({
        where: category && category !== "all" ? { category } : undefined,
        orderBy: { createdAt: "desc" },
      });

      if (dbProducts && dbProducts.length > 0) {
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
      }
    } catch (dbErr) {
      console.warn("Truy vấn sản phẩm từ Prisma thất bại:", dbErr);
    }

    // 2. Fallback
    let products = getAllProducts();
    if (category && category !== "all") {
      products = products.filter((p) => p.category === category);
    }

    const liveProducts = products.map((p) => ({
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
    return NextResponse.json(
      { success: false, error: "Lỗi tải danh sách sản phẩm." },
      { status: 500 }
    );
  }
}

// POST: Thêm sản phẩm mới (Admin)
export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập quản trị." }, { status: 401 });
  }
  try {
    const body = await req.json();

    if (!body.name || !body.priceJpy) {
      return NextResponse.json(
        { success: false, error: "Tên sản phẩm và Giá Yên (JPY) là bắt buộc." },
        { status: 400 }
      );
    }

    const newProd = createProduct({
      name: body.name,
      category: body.category || "cosmetics",
      priceJpy: Number(body.priceJpy),
      weightKg: Number(body.weightKg) || 0.4,
      imageUrl: body.imageUrl || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80",
      description: body.description || "Sản phẩm nội địa Nhật Bản chính hãng.",
      originalStore: body.originalStore || "Amazon JP",
      stockSlots: Number(body.stockSlots) || 10,
      isHot: Boolean(body.isHot),
      featuredNote: body.featuredNote || "",
      voltageNote: body.voltageNote || undefined,
    });

    // Lưu vào CSDL Prisma SQLite
    try {
      await prisma.product.create({
        data: {
          id: newProd.id,
          name: newProd.name,
          slug: newProd.slug,
          category: newProd.category,
          categoryName: newProd.categoryName,
          priceJpy: newProd.priceJpy,
          priceVnd: newProd.priceVnd,
          weightKg: newProd.weightKg,
          imageUrl: newProd.imageUrl,
          description: newProd.description,
          originalStore: newProd.originalStore,
          stockSlots: newProd.stockSlots,
          isHot: newProd.isHot,
          featuredNote: newProd.featuredNote,
          voltageNote: newProd.voltageNote,
        },
      });
    } catch (dbErr) {
      console.warn("Lưu sản phẩm vào Prisma thất bại:", dbErr);
    }

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
  if (!verifyAdminSession(req)) {
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

    let updated: any = null;

    // 1. Cập nhật trong Prisma SQLite
    try {
      const priceJpy = data.priceJpy !== undefined ? Number(data.priceJpy) : undefined;
      const priceVnd = priceJpy !== undefined ? Math.round(priceJpy * liveRate) : undefined;

      updated = await prisma.product.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.category && { category: data.category }),
          ...(data.categoryName && { categoryName: data.categoryName }),
          ...(priceJpy !== undefined && { priceJpy, priceVnd }),
          ...(data.weightKg !== undefined && { weightKg: Number(data.weightKg) }),
          ...(data.imageUrl && { imageUrl: data.imageUrl }),
          ...(data.description && { description: data.description }),
          ...(data.originalStore && { originalStore: data.originalStore }),
          ...(data.stockSlots !== undefined && { stockSlots: Number(data.stockSlots) }),
          ...(data.isHot !== undefined && { isHot: Boolean(data.isHot) }),
          ...(data.featuredNote !== undefined && { featuredNote: data.featuredNote }),
          ...(data.voltageNote !== undefined && { voltageNote: data.voltageNote }),
        },
      });

      // Đồng bộ vào RAM store nếu có
      updateProduct(id, data);
    } catch (dbErr) {
      // 2. Fallback sang RAM store
      updated = updateProduct(id, data);
    }

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy sản phẩm cần cập nhật." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Cập nhật sản phẩm thành công!",
      product: updated,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Không thể cập nhật sản phẩm." },
      { status: 500 }
    );
  }
}

// DELETE: Xóa sản phẩm
export async function DELETE(req: NextRequest) {
  if (!verifyAdminSession(req)) {
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

    let deleted = false;

    // 1. Xóa trong Prisma SQLite
    try {
      await prisma.product.delete({ where: { id } });
      deleted = true;
      deleteProduct(id);
    } catch (dbErr) {
      // 2. Fallback sang RAM store
      deleted = deleteProduct(id);
    }

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy sản phẩm cần xóa." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Đã xóa sản phẩm thành công.",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Lỗi khi xóa sản phẩm." },
      { status: 500 }
    );
  }
}
