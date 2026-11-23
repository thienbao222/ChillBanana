import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { inspectVnJpCargoDeterministic } from "@/features/ai/vn-jp/maff-inspector";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(req, { roles: ["SUPER_ADMIN", "OPERATOR"] });
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const shipment = await prisma.vnJpShipment.findFirst({
    where: { OR: [{ id }, { trackingCode: id }] },
  });

  if (!shipment) {
    return NextResponse.json({ error: "Không tìm thấy phiếu gửi hàng VN → JP." }, { status: 404 });
  }

  // Phân tích danh mục hải quan
  const inspection = inspectVnJpCargoDeterministic({
    cargoDetails: shipment.cargoDetails,
    estimatedWeightKg: shipment.chargeableWeightKg || shipment.estimatedWeightKg,
    receiverPrefecture: shipment.receiverPrefecture,
    receiverPostalCode: shipment.receiverPostalCode,
    receiverName: shipment.receiverName,
    includeAdminCopilot: true,
  });

  const cn23Data = {
    declarationNumber: shipment.trackingCode,
    category: shipment.cargoType === "doc" ? "DOCUMENTS" : "GIFT",
    sender: {
      fullName: shipment.senderName,
      phone: shipment.senderPhone,
      streetAddress: shipment.senderAddress,
      city: shipment.senderCity,
      country: "VIETNAM",
      countryCode: "VN",
    },
    recipient: {
      fullName: shipment.receiverName,
      phone: shipment.receiverPhone,
      postalCode: shipment.receiverPostalCode,
      prefecture: shipment.receiverPrefecture,
      streetAddress: shipment.receiverAddress,
      country: "JAPAN",
      countryCode: "JP",
    },
    items: inspection.items.map((it, idx) => ({
      itemIndex: idx + 1,
      descriptionEn: it.englishCustomsName,
      descriptionJp: it.japaneseCustomsName,
      quantity: 1,
      weightKg: Math.round(((shipment.chargeableWeightKg || shipment.estimatedWeightKg) / inspection.items.length) * 100) / 100,
      declaredValueJpy: 2000,
      hsCode: it.hsCode,
      originCountry: "VN",
    })),
    totalWeightKg: shipment.chargeableWeightKg || shipment.estimatedWeightKg,
    totalValueJpy: inspection.items.length * 2000,
    flightNumber: shipment.flightNumber || "VN310 / JL752",
    japanCourier: shipment.japanCourier || "Yamato Transport",
    comments: "Contents inspected for aviation safety & MAFF plant quarantine regulations.",
    createdAt: shipment.createdAt.toISOString(),
  };

  return NextResponse.json({
    success: true,
    cn23: cn23Data,
  });
}

