import { NextRequest, NextResponse } from "next/server";
import { getAllProducts, createProduct, updateProduct, deleteProduct } from "@/lib/product-store";

export const dynamic = "force-dynamic";

// GET: Lấy danh sách sản phẩm (hỗ trợ lọc theo category)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

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
