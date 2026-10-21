import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { checkAndRecordHit, getClientIp } from "@/lib/rate-limit";

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
    // Bảo mật #15: Rate limit theo IP chống spam tạo đơn
    const clientIp = getClientIp(req);
    const retryAfter = await checkAndRecordHit(`vn_jp_create:${clientIp}`, {
      max: 15,
      windowMs: 300_000,
      blockMs: 600_000,
    });
    if (retryAfter > 0) {
      return NextResponse.json(
        { success: false, error: `Bạn đã gửi yêu cầu quá nhanh. Vui lòng thử lại sau ${retryAfter} giây.` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

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

    // Bảo mật #19: Kiểm tra kiểu dữ liệu string nghiêm ngặt trước khi gọi .trim()
    if (
      typeof senderName !== "string" || !senderName.trim() ||
      typeof senderPhone !== "string" || !senderPhone.trim() ||
      typeof senderAddress !== "string" || !senderAddress.trim()
    ) {
      return NextResponse.json(
        { success: false, error: "Vui lòng điền đầy đủ họ tên, số điện thoại và địa chỉ người gửi tại Việt Nam." },
        { status: 400 }
      );
    }

    if (
      typeof receiverName !== "string" || !receiverName.trim() ||
      typeof receiverPhone !== "string" || !receiverPhone.trim() ||
      typeof receiverPostalCode !== "string" || !receiverPostalCode.trim() ||
      typeof receiverAddress !== "string" || !receiverAddress.trim()
    ) {
      return NextResponse.json(
        { success: false, error: "Vui lòng điền đầy đủ họ tên, SĐT, mã bưu điện 〒 7 số và địa chỉ người nhận tại Nhật Bản." },
        { status: 400 }
      );
    }

    if (typeof cargoDetails !== "string" || !cargoDetails.trim()) {
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

    // Bảo mật #18: Kiểm tra giới hạn cân nặng hợp lý (0.1kg - 500kg)
    const rawWeight = Number(estimatedWeightKg);
    if (!Number.isFinite(rawWeight) || rawWeight <= 0 || rawWeight > 500) {
      return NextResponse.json(
        { success: false, error: "Cân nặng ước tính phải là số hợp lệ từ 0.1 kg đến 500 kg." },
        { status: 400 }
      );
    }
    const weight = Math.max(0.5, rawWeight);
    const selectedType = typeof cargoType === "string" ? cargoType : "gift";
    const unitPrice = getRatePerKg(selectedType);
    const totalEstFee = Math.round(unitPrice * weight);

    // Bảo mật #15: Sinh mã vận đơn entropy cao và bọc try-catch retry chống P2002 collision
    const generateTrackingCode = () => {
      const year = new Date().getFullYear();
      const randDigits = Math.floor(1000 + Math.random() * 9000);
      const timePart = Date.now().toString(36).toUpperCase().slice(-3);
      return `VNJP-${year}-${timePart}${randDigits}`;
    };

    let shipment = null;
    let createAttempts = 0;
    while (!shipment && createAttempts < 5) {
      createAttempts++;
      const trackingCode = generateTrackingCode();
      try {
        shipment = await prisma.vnJpShipment.create({
          data: {
            trackingCode,
            senderName: senderName.trim(),
            senderPhone: senderPhone.trim(),
            senderAddress: senderAddress.trim(),
            senderCity: typeof senderCity === "string" && senderCity.trim() ? senderCity.trim() : "Hà Nội",
            pickupDate: typeof pickupDate === "string" && pickupDate.trim() ? pickupDate.trim() : null,
            receiverName: receiverName.trim().toUpperCase(),
            receiverPhone: receiverPhone.trim(),
            receiverPostalCode: receiverPostalCode.trim(),
            receiverPrefecture: typeof receiverPrefecture === "string" && receiverPrefecture.trim() ? receiverPrefecture.trim() : "Tokyo",
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
      } catch (err: any) {
        if (err?.code === "P2002" && createAttempts < 5) {
          continue; // Mã bị trùng, thử lại với mã mới
        }
        throw err;
      }
    }

    if (!shipment) {
      throw new Error("Không thể khởi tạo mã vận đơn sau nhiều lần thử.");
    }

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
