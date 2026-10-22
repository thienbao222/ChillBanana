// FILE: src/app/api/vn-jp-shipments/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, verifySameOrigin } from "@/lib/admin-guard";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";
import {
  VALID_VN_JP_TRANSITIONS,
  getPreviousVnJpStatus,
  calculateIataChargeableWeight,
} from "@/features/pricing/vn-jp-rates";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Bảo vệ chống tấn công CSRF (Cross-Site Request Forgery)
    const csrfError = verifySameOrigin(req);
    if (csrfError) return csrfError;

    // 2. Xác thực phiên Admin & kiểm tra thu hồi quyền tức thời (pwdDigest)
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.vnJpShipment.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy vận đơn VN → JP tương ứng." },
        { status: 404 }
      );
    }

    const {
      action, // Hỗ trợ action: "rollback" để lùi bước an toàn
      status,
      paymentStatus,
      dispatcherNote,
      flightNumber,
      japanCourier,
      japanTrackingCode,
      actualWeightKg,
      dimensionLengthCm,
      dimensionWidthCm,
      dimensionHeightCm,
    } = body;

    const updateData: Record<string, unknown> = {};
    let auditAction = "VN_JP_SHIPMENT_UPDATED";

    // 3. Xử lý Hoàn tác lùi bước (Step Rollback) cho Quản trị viên
    if (action === "rollback") {
      const prevStatus = getPreviousVnJpStatus(existing.status);
      if (!prevStatus) {
        return NextResponse.json(
          {
            success: false,
            error: `Không thể hoàn tác lùi bước từ trạng thái ${existing.status}.`,
          },
          { status: 409 }
        );
      }
      updateData.status = prevStatus;
      auditAction = "VN_JP_SHIPMENT_ROLLBACK";
    } else if (status && status !== existing.status) {
      // 4. Kiểm soát Máy trạng thái tiến 5 bước (State Machine)
      const allowedNext = VALID_VN_JP_TRANSITIONS[existing.status] || [];
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
        const checkWeight =
          actualWeightKg !== undefined ? Number(actualWeightKg) : existing.actualWeightKg;
        if (!checkWeight || checkWeight <= 0) {
          return NextResponse.json(
            {
              success: false,
              error: "Kiện hàng phải được cân đo IATA (actualWeightKg > 0) trước khi xuất kho bay.",
            },
            { status: 400 }
          );
        }
      }
      updateData.status = status;
      auditAction = "VN_JP_SHIPMENT_STATUS_CHANGED";
    }

    // 5. Cập nhật trạng thái thanh toán cước (UNPAID | PAID)
    if (paymentStatus !== undefined) {
      if (paymentStatus !== "UNPAID" && paymentStatus !== "PAID") {
        return NextResponse.json(
          { success: false, error: "Trạng thái thanh toán không hợp lệ (chỉ nhận UNPAID hoặc PAID)." },
          { status: 400 }
        );
      }
      updateData.paymentStatus = paymentStatus;
    }

    if (typeof dispatcherNote === "string") updateData.dispatcherNote = dispatcherNote.trim();
    if (typeof flightNumber === "string") updateData.flightNumber = flightNumber.trim();
    if (typeof japanCourier === "string") updateData.japanCourier = japanCourier.trim();
    if (typeof japanTrackingCode === "string") updateData.japanTrackingCode = japanTrackingCode.trim();

    // 6. Kiểm tra giới hạn vật lý và tự động tính cân thể tích chuẩn IATA (D×R×C/5000)
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

    if (actW || (l && w && h)) {
      const calc = calculateIataChargeableWeight({
        actualWeightKg: actW || existing.estimatedWeightKg,
        lengthCm: l,
        widthCm: w,
        heightCm: h,
        unitPricePerKg: existing.unitPricePerKg,
      });
      updateData.chargeableWeightKg = calc.chargeableWeightKg;
      updateData.totalShippingFeeVnd = calc.totalShippingFeeVnd;
    }

    const updatedShipment = await prisma.vnJpShipment.update({
      where: { id },
      data: updateData,
    });

    // 7. Ghi nhật ký kiểm toán (AuditLog) phục vụ hậu kiểm an ninh
    await writeAuditLog({
      actor: guard.admin.username,
      actorType: "ADMIN",
      action: auditAction,
      entityType: "VnJpShipment",
      entityId: updatedShipment.id,
      summary: `Cập nhật vận đơn #${updatedShipment.trackingCode}: ${existing.status} -> ${updatedShipment.status} (Cân tính cước: ${updatedShipment.chargeableWeightKg ?? updatedShipment.estimatedWeightKg} kg)`,
      metadata: {
        trackingCode: updatedShipment.trackingCode,
        previousStatus: existing.status,
        newStatus: updatedShipment.status,
        chargeableWeightKg: updatedShipment.chargeableWeightKg,
        totalShippingFeeVnd: updatedShipment.totalShippingFeeVnd,
        paymentStatus: updatedShipment.paymentStatus,
      },
      ip: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      shipment: updatedShipment,
      message:
        action === "rollback"
          ? `Đã hoàn tác vận đơn #${updatedShipment.trackingCode} về bước ${updatedShipment.status}.`
          : `Đã cập nhật vận đơn #${updatedShipment.trackingCode} thành công.`,
    });
  } catch (error) {
    console.error("[API VnJpShipment PATCH] Lỗi cập nhật vận đơn VN-JP:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi máy chủ khi cập nhật vận đơn VN-JP." },
      { status: 500 }
    );
  }
}
