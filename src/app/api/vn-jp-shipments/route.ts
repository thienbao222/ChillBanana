import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

const VN_JP_RATES: Record<string, number> = {
  gift: 180000,
  food: 220000,
  doc: 210000,
  other: 200000,
};

function getRatePerKg(cargoType: string): number {
  return VN_JP_RATES[cargoType] || 200000;
}

// --------------------------------------------------------------------------
// POST /api/vn-jp-shipments
// Khách hàng tạo phiếu gửi hàng tuyến Việt Nam ➔ Nhật Bản
// --------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      senderName,
      senderPhone,
      senderAddress,
      senderCity,
      pickupDate,
      receiverName,
      receiverPhone,
      receiverPostalCode,
      receiverPrefecture,
      receiverAddress,
      cargoType,
      cargoDetails,
      estimatedWeightKg,
      maffAgreement,
    } = body;

    // Validation
    if (!senderName?.trim() || !senderPhone?.trim() || !senderAddress?.trim()) {
      return NextResponse.json(
        { success: false, error: "Vui lòng điền đầy đủ họ tên, số điện thoại và địa chỉ người gửi tại Việt Nam." },
        { status: 400 }
      );
    }

    if (!receiverName?.trim() || !receiverPhone?.trim() || !receiverPostalCode?.trim() || !receiverAddress?.trim()) {
      return NextResponse.json(
        { success: false, error: "Vui lòng điền đầy đủ họ tên, SĐT, mã bưu điện 〒 7 số và địa chỉ người nhận tại Nhật Bản." },
        { status: 400 }
      );
    }

    if (!cargoDetails?.trim()) {
      return NextResponse.json(
        { success: false, error: "Vui lòng mô tả danh mục hàng hóa chi tiết (không ghi chung chung quà tặng)." },
        { status: 400 }
      );
    }

    if (!maffAgreement) {
      return NextResponse.json(
        { success: false, error: "Bạn bắt buộc phải xác nhận cam kết không gửi thực phẩm cấm kiểm dịch MAFF (thịt, xúc xích, đồ cấm) sang Nhật Bản." },
        { status: 400 }
      );
    }

    const weight = Math.max(0.5, Number(estimatedWeightKg) || 0.5);
    const selectedType = String(cargoType || "gift");
    const unitPrice = getRatePerKg(selectedType);
    const totalEstFee = Math.round(unitPrice * weight);

    // Sinh mã vận đơn duy nhất VNJP-2026-XXXX
    let trackingCode = "";
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      attempts++;
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      trackingCode = `VNJP-${new Date().getFullYear()}-${randomDigits}`;
      const existing = await prisma.vnJpShipment.findUnique({
        where: { trackingCode },
        select: { id: true },
      });
      if (!existing) isUnique = true;
    }

    const shipment = await prisma.vnJpShipment.create({
      data: {
        trackingCode,
        senderName: senderName.trim(),
        senderPhone: senderPhone.trim(),
        senderAddress: senderAddress.trim(),
        senderCity: senderCity?.trim() || "Hà Nội",
        pickupDate: pickupDate?.trim() || null,
        receiverName: receiverName.trim().toUpperCase(),
        receiverPhone: receiverPhone.trim(),
        receiverPostalCode: receiverPostalCode.trim(),
        receiverPrefecture: receiverPrefecture?.trim() || "Tokyo",
        receiverAddress: receiverAddress.trim(),
        cargoType: selectedType,
        cargoDetails: cargoDetails.trim(),
        estimatedWeightKg: weight,
        unitPricePerKg: unitPrice,
        totalShippingFeeVnd: totalEstFee,
        maffAgreement: Boolean(maffAgreement),
        status: "PENDING_CONFIRMATION",
      },
    });

    return NextResponse.json({
      success: true,
      trackingCode: shipment.trackingCode,
      shipment,
      message: `Đã ghi nhận phiếu điều phối #${shipment.trackingCode} thành công! Nhân viên điều phối sẽ liên hệ số ${shipment.senderPhone} để xác nhận quy cách lấy hàng.`,
    });
  } catch (error) {
    console.error("[API VnJpShipment POST] Lỗi tạo phiếu gửi hàng:", error);
    return NextResponse.json(
      { success: false, error: "Đã xảy ra lỗi máy chủ khi ghi nhận phiếu gửi hàng." },
      { status: 500 }
    );
  }
}

// --------------------------------------------------------------------------
// GET /api/vn-jp-shipments
// Admin xem danh sách phiếu điều phối & thống kê Kanban
// --------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";

    const whereClause: any = {};
    if (status && status !== "ALL") {
      whereClause.status = status;
    }

    if (search) {
      whereClause.OR = [
        { trackingCode: { contains: search, mode: "insensitive" } },
        { senderName: { contains: search, mode: "insensitive" } },
        { senderPhone: { contains: search } },
        { receiverName: { contains: search, mode: "insensitive" } },
        { receiverPostalCode: { contains: search } },
        { receiverPrefecture: { contains: search, mode: "insensitive" } },
        { cargoDetails: { contains: search, mode: "insensitive" } },
      ];
    }

    const [shipments, totalCount, statusCounts] = await Promise.all([
      prisma.vnJpShipment.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.vnJpShipment.count({ where: whereClause }),
      prisma.vnJpShipment.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    const counts: Record<string, number> = {
      PENDING_CONFIRMATION: 0,
      CONFIRMED_PICKUP: 0,
      WAREHOUSE_VN_INSPECTED: 0,
      IN_FLIGHT_TO_JP: 0,
      DELIVERED_JP: 0,
      CANCELLED: 0,
    };

    statusCounts.forEach((sc) => {
      counts[sc.status] = sc._count._all;
    });

    return NextResponse.json({
      success: true,
      shipments,
      totalCount,
      counts,
    });
  } catch (error) {
    console.error("[API VnJpShipment GET] Lỗi tải danh sách vận đơn VN-JP:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi máy chủ khi tải danh sách vận đơn VN-JP." },
      { status: 500 }
    );
  }
}
