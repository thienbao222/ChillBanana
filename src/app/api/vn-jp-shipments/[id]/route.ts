import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

// --------------------------------------------------------------------------
// PATCH /api/vn-jp-shipments/[id]
// Admin cập nhật trạng thái vận đơn VN ➔ JP, nhập cân đo IATA, ghi chú điều phối
// --------------------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.vnJpShipment.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy vận đơn VN ➔ JP tương ứng." },
        { status: 404 }
      );
    }

    const {
      status,
      dispatcherNote,
      flightNumber,
      japanCourier,
      japanTrackingCode,
      actualWeightKg,
      dimensionLengthCm,
      dimensionWidthCm,
      dimensionHeightCm,
    } = body;

    const updateData: any = {};

    if (status) {
      const validStatuses = [
        "PENDING_CONFIRMATION",
        "CONFIRMED_PICKUP",
        "WAREHOUSE_VN_INSPECTED",
        "IN_FLIGHT_TO_JP",
        "DELIVERED_JP",
        "CANCELLED",
      ];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, error: "Trạng thái không hợp lệ." },
          { status: 400 }
        );
      }
      updateData.status = status;
    }

    if (typeof dispatcherNote === "string") {
      updateData.dispatcherNote = dispatcherNote.trim();
    }

    if (typeof flightNumber === "string") {
      updateData.flightNumber = flightNumber.trim();
    }

    if (typeof japanCourier === "string") {
      updateData.japanCourier = japanCourier.trim();
    }

    if (typeof japanTrackingCode === "string") {
      updateData.japanTrackingCode = japanTrackingCode.trim();
    }

    // Khi kho VN cân đo kích thước theo chuẩn IATA:
    const actW = actualWeightKg !== undefined ? Number(actualWeightKg) : existing.actualWeightKg;
    const l = dimensionLengthCm !== undefined ? Number(dimensionLengthCm) : existing.dimensionLengthCm;
    const w = dimensionWidthCm !== undefined ? Number(dimensionWidthCm) : existing.dimensionWidthCm;
    const h = dimensionHeightCm !== undefined ? Number(dimensionHeightCm) : existing.dimensionHeightCm;

    if (actualWeightKg !== undefined) updateData.actualWeightKg = actW;
    if (dimensionLengthCm !== undefined) updateData.dimensionLengthCm = l;
    if (dimensionWidthCm !== undefined) updateData.dimensionWidthCm = w;
    if (dimensionHeightCm !== undefined) updateData.dimensionHeightCm = h;

    // Tính cước theo chuẩn thể tích IATA:
    if (l && w && h) {
      const volumetricWeight = Number(((l * w * h) / 5000).toFixed(2));
      const effectiveWeight = Math.max(actW || existing.estimatedWeightKg, volumetricWeight);
      updateData.chargeableWeightKg = effectiveWeight;
      updateData.totalShippingFeeVnd = Math.round(existing.unitPricePerKg * effectiveWeight);
    } else if (actW) {
      updateData.chargeableWeightKg = actW;
      updateData.totalShippingFeeVnd = Math.round(existing.unitPricePerKg * actW);
    }

    const updatedShipment = await prisma.vnJpShipment.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      shipment: updatedShipment,
      message: `Đã cập nhật vận đơn #${updatedShipment.trackingCode} thành công.`,
    });
  } catch (error) {
    console.error("[API VnJpShipment PATCH] Lỗi cập nhật vận đơn VN-JP:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi máy chủ khi cập nhật vận đơn VN-JP." },
      { status: 500 }
    );
  }
}
