// FILE: tests/integration/vn-jp-shipments.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { prisma } from "../helpers/db";
import { adminCookies, makeAdmin } from "../helpers/factories";
import { get, json, params, patch, post } from "../helpers/request";
import { calculateIataChargeableWeight } from "@/features/pricing/vn-jp-rates";
import { inspectVnJpCargoDeterministic, toUpperRomaji, recommendIataBox } from "@/features/ai/vn-jp/maff-inspector";
import { POST as createShipment, GET as getShipments } from "@/app/api/vn-jp-shipments/route";
import { PATCH as updateShipment } from "@/app/api/vn-jp-shipments/[id]/route";
import { GET as trackShipment } from "@/app/api/vn-jp-shipments/track/[code]/route";

const validShipmentPayload = {
  senderName: "Đỗ Thiên Bảo",
  senderPhone: "0912345678",
  senderAddress: "Số 06 Trần Văn Ơn, Phú Hòa, Thủ Dầu Một",
  senderCity: "Bình Dương",
  pickupDate: "Sáng mai (8h - 12h)",
  receiverName: "NGUYEN VAN AN",
  receiverPhone: "08012345678",
  receiverPostalCode: "160-0022",
  receiverPrefecture: "Tokyo",
  receiverAddress: "Shinjuku Mansion 402",
  cargoType: "food",
  cargoDetails: "2 túi cà phê rang xay nguyên chất, 3 hộp bánh đậu xanh",
  estimatedWeightKg: 3.5,
  maffAgreement: true,
};

describe("Integration: Phân hệ Ký gửi & Vận chuyển Hàng không VN -> JP (VnJpShipment)", () => {
  beforeEach(async () => {
    await prisma.vnJpShipment.deleteMany({});
  });

  it("1. Tính chính xác trọng lượng quy đổi thể tích chuẩn IATA (D×R×C/5000)", () => {
    // Thùng hàng nhẹ nhưng cồng kềnh: Nặng thực tế 2.0 kg, kích thước 50 × 40 × 30 cm
    // Cân thể tích = (50 * 40 * 30) / 5000 = 12.0 kg -> Cân tính cước phải lấy 12.0 kg
    const result = calculateIataChargeableWeight({
      actualWeightKg: 2.0,
      lengthCm: 50,
      widthCm: 40,
      heightCm: 30,
      unitPricePerKg: 180000,
    });
    expect(result.volumetricWeightKg).toBe(12);
    expect(result.chargeableWeightKg).toBe(12);
    expect(result.totalShippingFeeVnd).toBe(2160000);
  });

  it("2. Ưu tiên lấy cân nặng thực tế nếu cân thực tế lớn hơn cân thể tích IATA", () => {
    // Kiện hàng gọn nhưng nặng: Nặng thực tế 8.5 kg, kích thước 30 × 20 × 20 cm (Thể tích = 2.4 kg)
    const result = calculateIataChargeableWeight({
      actualWeightKg: 8.5,
      lengthCm: 30,
      widthCm: 20,
      heightCm: 20,
      unitPricePerKg: 220000,
    });
    expect(result.volumetricWeightKg).toBe(2.4);
    expect(result.chargeableWeightKg).toBe(8.5);
    expect(result.totalShippingFeeVnd).toBe(1870000);
  });

  it("3. Khởi tạo vận đơn VnJpShipment thành công khi đã cam kết kiểm dịch MAFF", async () => {
    const res = await createShipment(post("/api/vn-jp-shipments", validShipmentPayload));
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.trackingCode).toMatch(/^VNJP-2026-[A-Z0-9]+-[0-9]{4}$/);
    expect(body.shipment.status).toBe("PENDING_CONFIRMATION");
    expect(body.shipment.maffAgreement).toBe(true);
    expect(body.shipment.unitPricePerKg).toBe(220000);
    expect(body.shipment.totalShippingFeeVnd).toBe(770000); // 3.5kg * 220,000 = 770,000
  });

  it("4. Từ chối tạo vận đơn khi thiếu cam kết MAFF hoặc sai số điện thoại", async () => {
    // 1. Thiếu cam kết MAFF
    const resNoMaff = await createShipment(
      post("/api/vn-jp-shipments", { ...validShipmentPayload, maffAgreement: false })
    );
    expect(resNoMaff.status).toBe(400);
    const bodyNoMaff = await json(resNoMaff);
    expect(bodyNoMaff.success).toBe(false);
    expect(bodyNoMaff.error).toContain("MAFF");

    // 2. Số điện thoại người gửi không hợp lệ (< 8 số)
    const resBadPhone = await createShipment(
      post("/api/vn-jp-shipments", { ...validShipmentPayload, senderPhone: "12345" })
    );
    expect(resBadPhone.status).toBe(400);
  });

  it("5. GET /api/vn-jp-shipments yêu cầu quyền Admin và lọc theo prefecture", async () => {
    // Chưa đăng nhập -> 401
    const unauth = await getShipments(get("/api/vn-jp-shipments"));
    expect(unauth.status).toBe(401);

    // Tạo vận đơn mẫu
    await createShipment(post("/api/vn-jp-shipments", validShipmentPayload));

    // Đăng nhập Admin
    await makeAdmin("dispatch_admin", "SUPER_ADMIN");
    const cookies = adminCookies("dispatch_admin");

    const authRes = await getShipments(get("/api/vn-jp-shipments?prefecture=Tokyo", { cookies }));
    expect(authRes.status).toBe(200);
    const body = await json(authRes);
    expect(body.success).toBe(true);
    expect(body.shipments.length).toBeGreaterThanOrEqual(1);
    expect(body.counts.PENDING_CONFIRMATION).toBeGreaterThanOrEqual(1);
  });

  it("6. PATCH /api/vn-jp-shipments/[id]: State Machine nghiêm ngặt, chặn số âm và chặn xuất bay khi chưa cân đo", async () => {
    await makeAdmin("operator_jp", "OPERATOR");
    const cookies = adminCookies("operator_jp");

    const created = await createShipment(post("/api/vn-jp-shipments", validShipmentPayload));
    const { shipment } = await json(created);

    // 1. Chặn cân nặng âm -> 400
    const negWeight = await updateShipment(
      patch(`/api/vn-jp-shipments/${shipment.id}`, { actualWeightKg: -5 }, { cookies }),
      params({ id: shipment.id })
    );
    expect(negWeight.status).toBe(400);

    // 2. Chặn nhảy cóc từ PENDING_CONFIRMATION sang IN_FLIGHT_TO_JP -> 409
    const skipStep = await updateShipment(
      patch(`/api/vn-jp-shipments/${shipment.id}`, { status: "IN_FLIGHT_TO_JP" }, { cookies }),
      params({ id: shipment.id })
    );
    expect(skipStep.status).toBe(409);

    // 3. Tiến bước hợp lệ: PENDING_CONFIRMATION -> CONFIRMED_PICKUP
    const step1 = await updateShipment(
      patch(`/api/vn-jp-shipments/${shipment.id}`, { status: "CONFIRMED_PICKUP" }, { cookies }),
      params({ id: shipment.id })
    );
    expect(step1.status).toBe(200);

    // 4. CONFIRMED_PICKUP -> WAREHOUSE_VN_INSPECTED
    const step2 = await updateShipment(
      patch(`/api/vn-jp-shipments/${shipment.id}`, { status: "WAREHOUSE_VN_INSPECTED" }, { cookies }),
      params({ id: shipment.id })
    );
    expect(step2.status).toBe(200);

    // 5. Chặn xuất bay khi chưa cân đo (actualWeightKg <= 0) -> 400
    const flyWithoutWeight = await updateShipment(
      patch(`/api/vn-jp-shipments/${shipment.id}`, { status: "IN_FLIGHT_TO_JP" }, { cookies }),
      params({ id: shipment.id })
    );
    expect(flyWithoutWeight.status).toBe(400);

    // 6. Nhập cân đo IATA hợp lệ
    const weighed = await updateShipment(
      patch(
        `/api/vn-jp-shipments/${shipment.id}`,
        { actualWeightKg: 4.0, dimensionLengthCm: 30, dimensionWidthCm: 20, dimensionHeightCm: 15 },
        { cookies }
      ),
      params({ id: shipment.id })
    );
    expect(weighed.status).toBe(200);
    const weighedBody = await json(weighed);
    expect(weighedBody.shipment.chargeableWeightKg).toBe(4.0);

    // 7. Xuất kho bay thành công
    const flySuccess = await updateShipment(
      patch(
        `/api/vn-jp-shipments/${shipment.id}`,
        {
          status: "IN_FLIGHT_TO_JP",
          flightNumber: "VN310 (HAN ➔ NRT - Vietnam Airlines)",
          japanCourier: "Yamato Transport",
          japanTrackingCode: "4829-1029-3810",
        },
        { cookies }
      ),
      params({ id: shipment.id })
    );
    expect(flySuccess.status).toBe(200);
  });

  it("7. PATCH /api/vn-jp-shipments/[id]: Hỗ trợ action rollback hoàn tác lùi bước và cập nhật paymentStatus (UNPAID -> PAID)", async () => {
    await makeAdmin("super_admin_audit", "SUPER_ADMIN");
    const cookies = adminCookies("super_admin_audit");

    const created = await createShipment(post("/api/vn-jp-shipments", validShipmentPayload));
    const { shipment } = await json(created);

    // Tiến bước 1: PENDING_CONFIRMATION -> CONFIRMED_PICKUP
    await updateShipment(
      patch(`/api/vn-jp-shipments/${shipment.id}`, { status: "CONFIRMED_PICKUP" }, { cookies }),
      params({ id: shipment.id })
    );

    // Hoàn tác lùi bước (Rollback): CONFIRMED_PICKUP -> PENDING_CONFIRMATION
    const rollbackRes = await updateShipment(
      patch(`/api/vn-jp-shipments/${shipment.id}`, { action: "rollback" }, { cookies }),
      params({ id: shipment.id })
    );
    expect(rollbackRes.status).toBe(200);
    const rollbackBody = await json(rollbackRes);
    expect(rollbackBody.shipment.status).toBe("PENDING_CONFIRMATION");

    // Cập nhật trạng thái thanh toán paymentStatus: PAID
    const payRes = await updateShipment(
      patch(`/api/vn-jp-shipments/${shipment.id}`, { paymentStatus: "PAID" }, { cookies }),
      params({ id: shipment.id })
    );
    expect(payRes.status).toBe(200);
    const payBody = await json(payRes);
    expect(payBody.shipment.paymentStatus).toBe("PAID");

    // Thử cập nhật paymentStatus không hợp lệ -> 400
    const invalidPayRes = await updateShipment(
      patch(`/api/vn-jp-shipments/${shipment.id}`, { paymentStatus: "INVALID" }, { cookies }),
      params({ id: shipment.id })
    );
    expect(invalidPayRes.status).toBe(400);
  });

  it("8. Ghi nhật ký kiểm toán (AuditLog) đầy đủ và API tra cứu công khai che ẩn thông tin cá nhân (PII)", async () => {
    await makeAdmin("audit_tester", "SUPER_ADMIN");
    const cookies = adminCookies("audit_tester");

    const created = await createShipment(post("/api/vn-jp-shipments", validShipmentPayload));
    const { shipment } = await json(created);

    // Cập nhật trạng thái có ghi AuditLog
    await updateShipment(
      patch(`/api/vn-jp-shipments/${shipment.id}`, { status: "CONFIRMED_PICKUP" }, { cookies }),
      params({ id: shipment.id })
    );

    // Kiểm tra bảng AuditLog
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityType: "VnJpShipment", entityId: shipment.id },
    });
    expect(auditLogs.length).toBeGreaterThanOrEqual(1);
    expect(auditLogs[0].action).toBe("VN_JP_SHIPMENT_STATUS_CHANGED");
    expect(auditLogs[0].actor).toBe("audit_tester");

    // Tra cứu công khai che ẩn PII (Masking)
    const trackRes = await trackShipment(
      get(`/api/vn-jp-shipments/track/${shipment.trackingCode}`),
      params({ code: shipment.trackingCode })
    );
    expect(trackRes.status).toBe(200);
    const trackBody = await json(trackRes);
    expect(trackBody.success).toBe(true);
    expect(trackBody.shipment.trackingCode).toBe(shipment.trackingCode);
    expect(trackBody.shipment.senderPhoneMasked).toMatch(/^091\*{4}678$/);
    expect(trackBody.shipment.senderNameMasked).toContain("***");
    expect(trackBody.shipment.receiverNameMasked).toContain("***");
  });

  it("9. inspectVnJpCargoDeterministic(): Chặn chính xác hàng cấm MAFF/IATA (khô bò, khô gà, pin dự phòng) và chuẩn hóa Romaji", () => {
    // 1. Thử nghiệm với kiện hàng chứa hàng cấm MAFF & pin IATA
    const inspection = inspectVnJpCargoDeterministic({
      cargoDetails: "2 hộp khô bò, 1 bịch khô gà lá chanh, 1 sạc dự phòng 10000mAh, 2 cái áo thun",
      estimatedWeightKg: 4.5,
      receiverName: "Nguyễn Văn Đạt",
      receiverPostalCode: "160-0022",
      receiverPrefecture: "Tokyo",
      senderCity: "Hà Nội",
    });

    expect(inspection.overallRisk).toBe("PROHIBITED");
    expect(inspection.canFly).toBe(false);
    expect(inspection.items.length).toBe(4);

    // Món 1: Khô bò (Cấm MAFF)
    expect(inspection.items[0].status).toBe("PROHIBITED");
    expect(inspection.items[0].reasonVi).toContain("MAFF");

    // Món 2: Khô gà (Cấm MAFF)
    expect(inspection.items[1].status).toBe("PROHIBITED");
    expect(inspection.items[1].reasonVi).toContain("MAFF");

    // Món 3: Sạc dự phòng (Cấm IATA)
    expect(inspection.items[2].status).toBe("PROHIBITED");
    expect(inspection.items[2].reasonVi).toContain("IATA");

    // Món 4: Áo thun (SAFE)
    expect(inspection.items[3].status).toBe("SAFE");

    // Tự động loại bỏ món cấm chỉ giữ lại món SAFE
    expect(inspection.cleanedCargoDetails).toBe("2 cái áo thun");

    // Chuẩn hóa Romaji tên người nhận
    expect(inspection.normalizedRomajiName).toBe("NGUYEN VAN DAT");
    expect(toUpperRomaji("Đỗ Thiên Bảo")).toBe("DO THIEN BAO");

    // Gợi ý kích thước thùng IATA cho 4.5 kg -> Size M (40x30x25cm)
    expect(inspection.recommendedBox.boxCode).toContain("Size M");
    expect(inspection.recommendedBox.volumetricWeightKg).toBe(6.0);

    // Lời bình Kuudere cảnh báo quỹ đạo đỏ
    expect(inspection.neoKuudereComment).toContain("quỹ đạo đỏ");
  });

  it("10. inspectVnJpCargoDeterministic(): Gợi ý đúng chuyến bay Kanto (NRT) vs Kansai (KIX) và sinh tờ khai CN23 cho Admin", () => {
    // Kịch bản A: Người nhận tại Osaka (Kansai), người gửi tại TP.HCM -> Bay thẳng KIX qua VN320, chuyển phát Sagawa
    const kansaiShipment = inspectVnJpCargoDeterministic({
      cargoDetails: "3 gói cà phê Trung Nguyên, 2 hộp bánh đậu xanh",
      estimatedWeightKg: 2.0,
      receiverName: "Tran Thi Mai",
      receiverPostalCode: "530-0001",
      receiverPrefecture: "Osaka",
      senderCity: "Hồ Chí Minh",
      includeAdminCopilot: true,
    });

    expect(kansaiShipment.overallRisk).toBe("CONDITIONAL");
    expect(kansaiShipment.canFly).toBe(true);
    expect(kansaiShipment.adminCustomsDeclaration).toBeDefined();
    expect(kansaiShipment.adminCustomsDeclaration?.recommendedFlight).toBe("VN320 (SGN ➔ KIX)");
    expect(kansaiShipment.adminCustomsDeclaration?.recommendedCourier).toBe("Sagawa Express");
    expect(kansaiShipment.adminCustomsDeclaration?.invoiceSummaryEn).toContain("[HS:");
    expect(kansaiShipment.adminCustomsDeclaration?.invoiceSummaryJp).toContain("個人用贈答品");
    expect(kansaiShipment.adminCustomsDeclaration?.routingReasonVi).toContain("Kansai");

    // Kịch bản B: Người nhận tại Tokyo (Kanto), gửi hồ sơ giấy tờ từ Hà Nội -> Bay NRT qua VN310, chuyển phát Japan Post
    const kantoDocShipment = inspectVnJpCargoDeterministic({
      cargoDetails: "Hồ sơ du học, học bạ, bằng tốt nghiệp THPT",
      estimatedWeightKg: 1.0,
      receiverName: "Le Hoang Nam",
      receiverPostalCode: "100-0001",
      receiverPrefecture: "Tokyo",
      senderCity: "Hà Nội",
      includeAdminCopilot: true,
    });

    expect(kantoDocShipment.overallRisk).toBe("SAFE");
    expect(kantoDocShipment.suggestedCargoType).toBe("doc");
    expect(kantoDocShipment.adminCustomsDeclaration?.declaredCategory).toBe("DOCUMENTS");
    expect(kantoDocShipment.adminCustomsDeclaration?.recommendedFlight).toBe("VN310 (HAN ➔ NRT)");
    expect(kantoDocShipment.adminCustomsDeclaration?.recommendedCourier).toBe("Japan Post (Yu-Pack / EMS)");
  });
});
