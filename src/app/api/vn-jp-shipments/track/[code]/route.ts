// FILE: src/app/api/vn-jp-shipments/track/[code]/route.ts
// Điểm cuối tra cứu hành trình vận đơn chiều Việt Nam -> Nhật Bản (VNJP-YYYY-XXX-XXXX)
// Áp dụng cơ chế che ẩn thông tin cá nhân nhạy cảm (PII Masking) và Rate Limit chống dò quét.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAndRecordHit, getClientIp } from "@/lib/rate-limit";
import { VN_JP_STATUS_LABELS, VN_JP_CARGO_LABELS } from "@/features/pricing/vn-jp-rates";

export const dynamic = "force-dynamic";

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  return `${digits.slice(0, 3)}****${digits.slice(-3)}`;
}

function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name.slice(0, 2) + "***";
  return `${parts[0]} *** ${parts[parts.length - 1]}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const clientIp = getClientIp(req);
    const retryAfter = await checkAndRecordHit(`vn_jp_track:${clientIp}`, {
      max: 30,
      windowMs: 60_000,
      blockMs: 120_000,
    });
    if (retryAfter > 0) {
      return NextResponse.json(
        { success: false, error: `Vui lòng thử lại sau ${retryAfter} giây.` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const { code } = await params;
    const normalizedCode = code.trim().toUpperCase();

    const shipment = await prisma.vnJpShipment.findUnique({
      where: { trackingCode: normalizedCode },
    });

    if (!shipment) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy mã vận đơn VN → JP tương ứng." },
        { status: 404 }
      );
    }

    // Trả về dữ liệu hành trình đã che ẩn PII (chỉ hiển thị tỉnh/thành, mã bưu điện 〒 và tên viết tắt)
    return NextResponse.json({
      success: true,
      shipmentType: "VN_TO_JP",
      shipment: {
        trackingCode: shipment.trackingCode,
        status: shipment.status,
        statusLabel: VN_JP_STATUS_LABELS[shipment.status] || shipment.status,
        paymentStatus: shipment.paymentStatus,
        senderNameMasked: maskName(shipment.senderName),
        senderPhoneMasked: maskPhone(shipment.senderPhone),
        senderCity: shipment.senderCity,
        pickupDate: shipment.pickupDate,
        receiverNameMasked: maskName(shipment.receiverName),
        receiverPostalCode: shipment.receiverPostalCode,
        receiverPrefecture: shipment.receiverPrefecture,
        cargoType: shipment.cargoType,
        cargoTypeLabel: VN_JP_CARGO_LABELS[shipment.cargoType] || shipment.cargoType,
        estimatedWeightKg: shipment.estimatedWeightKg,
        actualWeightKg: shipment.actualWeightKg,
        dimensionLengthCm: shipment.dimensionLengthCm,
        dimensionWidthCm: shipment.dimensionWidthCm,
        dimensionHeightCm: shipment.dimensionHeightCm,
        chargeableWeightKg: shipment.chargeableWeightKg,
        unitPricePerKg: shipment.unitPricePerKg,
        totalShippingFeeVnd: shipment.totalShippingFeeVnd,
        maffAgreement: shipment.maffAgreement,
        flightNumber: shipment.flightNumber,
        japanCourier: shipment.japanCourier,
        japanTrackingCode: shipment.japanTrackingCode,
        createdAt: shipment.createdAt.toISOString(),
        updatedAt: shipment.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[API VnJpShipment Track GET] Lỗi tra cứu:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi máy chủ khi tra cứu vận đơn VN → JP." },
      { status: 500 }
    );
  }
}
