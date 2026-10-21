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

    if (status && status !== existing.status) {
      // BẢO MẬT & NGHIỆP VỤ (P2-03): State Machine kiểm soát luồng chuyển trạng thái vận đơn VN -> JP
      const VALID_TRANSITIONS: Record<string, string[]> = {
        PENDING_CONFIRMATION: ["CONFIRMED_PICKUP", "CANCELLED"],
        CONFIRMED_PICKUP: ["WAREHOUSE_VN_INSPECTED", "CANCELLED"],
        WAREHOUSE_VN_INSPECTED: ["IN_FLIGHT_TO_JP", "CANCELLED"],
        IN_FLIGHT_TO_JP: ["DELIVERED_JP", "CANCELLED"],
        DELIVERED_JP: [], // Terminal
        CANCELLED: [],    // Terminal
      };

      const allowedNext = VALID_TRANSITIONS[existing.status] || [];
      if (!allowedNext.includes(status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Không thể chuyển trạng thái vận đơn từ ${existing.status} sang ${status}. Các trạng thái hợp lệ: ${allowedNext.join(", ") || "không có (trạng thái cuối)"}.`,
          },
          { status: 409 }
        );
      }

      if (status === "IN_FLIGHT_TO_JP") {
        const checkWeight = actualWeightKg !== undefined ? Number(actualWeightKg) : existing.actualWeightKg;
        if (!checkWeight || checkWeight <= 0) {
          return NextResponse.json(
            { success: false, error: "Kiện hàng phải được cân đo IATA (actualWeightKg > 0) trước khi xuất kho bay." },
            { status: 400 }
          );
        }
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

    // Khi kho VN cân đo kích thước theo chuẩn IATA (Bảo mật #17: Chặn số âm & NaN):
    let actW = existing.actualWeightKg;
    if (actualWeightKg !== undefined) {
      const numW = Number(actualWeightKg);
      if (!Number.isFinite(numW) || numW <= 0 || numW > 500) {
        return NextResponse.json(
          { success: false, error: "Cân nặng thực tế phải là số hợp lệ từ 0.1 kg đến 500 kg." },
          { status: 400 }
        );
      }
      actW = numW;
      updateData.actualWeightKg = numW;
    }

    let l = existing.dimensionLengthCm;
    if (dimensionLengthCm !== undefined) {
      const numL = Number(dimensionLengthCm);
      if (!Number.isFinite(numL) || numL <= 0 || numL > 300) {
        return NextResponse.json(
          { success: false, error: "Chiều dài kiện hàng phải từ 1 cm đến 300 cm." },
          { status: 400 }
        );
      }
      l = numL;
      updateData.dimensionLengthCm = numL;
    }

    let w = existing.dimensionWidthCm;
    if (dimensionWidthCm !== undefined) {
      const numW = Number(dimensionWidthCm);
      if (!Number.isFinite(numW) || numW <= 0 || numW > 300) {
        return NextResponse.json(
          { success: false, error: "Chiều rộng kiện hàng phải từ 1 cm đến 300 cm." },
          { status: 400 }
        );
      }
      w = numW;
      updateData.dimensionWidthCm = numW;
    }

    let h = existing.dimensionHeightCm;
    if (dimensionHeightCm !== undefined) {
      const numH = Number(dimensionHeightCm);
      if (!Number.isFinite(numH) || numH <= 0 || numH > 300) {
        return NextResponse.json(
          { success: false, error: "Chiều cao kiện hàng phải từ 1 cm đến 300 cm." },
          { status: 400 }
        );
      }
      h = numH;
      updateData.dimensionHeightCm = numH;
    }

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
