import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAllProducts, createProduct, updateProduct, deleteProduct } from "@/lib/product-store";

export const dynamic = "force-dynamic";

// GET: Lấy danh sách sản phẩm (hỗ trợ lọc theo category)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    // 1. Lấy từ CSDL Prisma SQLite
    try {
      const dbProducts = await prisma.product.findMany({
        where: category && category !== "all" ? { category } : undefined,
        orderBy: { createdAt: "desc" },
      });

      if (dbProducts && dbProducts.length > 0) {
        return NextResponse.json({
          success: true,
          count: dbProducts.length,
          products: dbProducts,
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

    return NextResponse.json({
      success: true,
      count: products.length,
      products,
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
  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Thiếu ID sản phẩm cần cập nhật." },
        { status: 400 }
      );
    }

    const updated = updateProduct(id, data);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy sản phẩm." },
        { status: 404 }
      );
    }

    // Cập nhật CSDL Prisma SQLite
    try {
      await prisma.product.update({
        where: { id },
        data: {
          name: updated.name,
          category: updated.category,
          categoryName: updated.categoryName,
          priceJpy: updated.priceJpy,
          priceVnd: updated.priceVnd,
          weightKg: updated.weightKg,
          imageUrl: updated.imageUrl,
          description: updated.description,
          originalStore: updated.originalStore,
          stockSlots: updated.stockSlots,
          isHot: updated.isHot,
          featuredNote: updated.featuredNote,
          voltageNote: updated.voltageNote,
        },
      });
    } catch (dbErr) {
      console.warn("Cập nhật sản phẩm vào Prisma thất bại:", dbErr);
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
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Thiếu ID sản phẩm cần xóa." },
        { status: 400 }
      );
    }

    const success = deleteProduct(id);
    if (!success) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy sản phẩm cần xóa." },
        { status: 404 }
      );
    }

    // Xóa từ CSDL Prisma SQLite
    try {
      await prisma.product.delete({ where: { id } });
    } catch (dbErr) {
      console.warn("Xóa sản phẩm trong Prisma thất bại:", dbErr);
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
