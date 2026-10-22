// FILE: tests/integration/vn-jp-shipments.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { prisma } from "../helpers/db";
import { adminCookies, makeAdmin } from "../helpers/factories";
import { get, json, params, patch, post } from "../helpers/request";
import { calculateIataChargeableWeight } from "@/features/pricing/vn-jp-rates";
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
});
