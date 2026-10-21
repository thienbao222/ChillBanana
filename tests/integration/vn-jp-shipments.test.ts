import { describe, expect, it } from "vitest";
import { POST as createShipment, GET as getShipments } from "@/app/api/vn-jp-shipments/route";
import { PATCH as updateShipment } from "@/app/api/vn-jp-shipments/[id]/route";
import { prisma } from "../helpers/db";
import { adminCookies, makeAdmin } from "../helpers/factories";
import { get, json, params, patch, post } from "../helpers/request";

const validShipmentPayload = {
  senderName: "Nguyen Van A",
  senderPhone: "0912345678",
  senderAddress: "123 Pho Hue, Hai Ba Trung",
  senderCity: "Hà Nội",
  pickupDate: "2026-11-01",
  receiverName: "TANAKA TARO",
  receiverPhone: "09012345678",
  receiverPostalCode: "100-0001",
  receiverPrefecture: "Tokyo",
  receiverAddress: "Chiyoda-ku 1-1",
  cargoType: "food",
  cargoDetails: "2 hop ca phe Trung Nguyen va banh dau xanh",
  estimatedWeightKg: 3.5,
  maffAgreement: true,
};

describe("Phân hệ Vận đơn VN ➔ JP (Integration Tests)", () => {
  it("tạo vận đơn hợp lệ công khai, sinh mã định dạng VNJP-YYYY-...", async () => {
    const res = await createShipment(post("/api/vn-jp-shipments", validShipmentPayload));
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.trackingCode).toMatch(/^VNJP-2026-[A-Z0-9]+-[0-9]{4}$/);
    expect(body.shipment.status).toBe("PENDING_CONFIRMATION");
    expect(body.shipment.estimatedWeightKg).toBe(3.5);
    expect(body.shipment.unitPricePerKg).toBe(220_000);
  });

  it("từ chối tạo vận đơn khi thiếu cam kết MAFF hoặc sai số điện thoại", async () => {
    const res1 = await createShipment(
      post("/api/vn-jp-shipments", { ...validShipmentPayload, maffAgreement: false })
    );
    expect(res1.status).toBe(400);

    const res2 = await createShipment(
      post("/api/vn-jp-shipments", { ...validShipmentPayload, senderPhone: "12345" })
    );
    expect(res2.status).toBe(400);
  });

  it("GET /api/vn-jp-shipments yêu cầu quyền Admin và lọc theo prefecture", async () => {
    const unauth = await getShipments(get("/api/vn-jp-shipments"));
    expect(unauth.status).toBe(401);

    await makeAdmin("dispatch_admin", "SUPER_ADMIN");
    const cookies = adminCookies("dispatch_admin");

    const authRes = await getShipments(get("/api/vn-jp-shipments?prefecture=Tokyo", { cookies }));
    expect(authRes.status).toBe(200);
    const body = await json(authRes);
    expect(body.success).toBe(true);
    expect(typeof body.totalCount).toBe("number");
    expect(body.counts).toBeDefined();
  });

  it("PATCH /api/vn-jp-shipments/[id]: áp dụng State Machine nghiêm ngặt và chặn số âm/NaN", async () => {
    await makeAdmin("operator_jp", "OPERATOR");
    const cookies = adminCookies("operator_jp");

    // Tạo 1 shipment
    const created = await createShipment(post("/api/vn-jp-shipments", validShipmentPayload));
    const { shipment } = await json(created);

    // 1. Thử truyền cân nặng âm -> nhận 400
    const negWeight = await updateShipment(
      patch(`/api/vn-jp-shipments/${shipment.id}`, { actualWeightKg: -5 }, { cookies }),
      params({ id: shipment.id })
    );
    expect(negWeight.status).toBe(400);

    // 2. Thử nhảy cóc từ PENDING_CONFIRMATION sang DELIVERED_JP -> nhận 409
    const skipStep = await updateShipment(
      patch(`/api/vn-jp-shipments/${shipment.id}`, { status: "DELIVERED_JP" }, { cookies }),
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

    // 5. WAREHOUSE_VN_INSPECTED -> IN_FLIGHT_TO_JP khi CHƯA cân đo -> nhận 400
    const flyWithoutWeight = await updateShipment(
      patch(`/api/vn-jp-shipments/${shipment.id}`, { status: "IN_FLIGHT_TO_JP" }, { cookies }),
      params({ id: shipment.id })
    );
    expect(flyWithoutWeight.status).toBe(400);

    // Cân đo hợp lệ
    const weighed = await updateShipment(
      patch(
        `/api/vn-jp-shipments/${shipment.id}`,
        { actualWeightKg: 4.0, dimensionLengthCm: 30, dimensionWidthCm: 20, dimensionHeightCm: 15 },
        { cookies }
      ),
      params({ id: shipment.id })
    );
    expect(weighed.status).toBe(200);

    // Giờ xuất bay thành công
    const flySuccess = await updateShipment(
      patch(
        `/api/vn-jp-shipments/${shipment.id}`,
        {
          status: "IN_FLIGHT_TO_JP",
          flightNumber: "VN310 (HAN ➔ NRT - Vietnam Airlines)",
          japanCourier: "Yamato Transport (Kuroneko Takkyubin)",
          japanTrackingCode: "4829-1029-3810",
        },
        { cookies }
      ),
      params({ id: shipment.id })
    );
    expect(flySuccess.status).toBe(200);

    // Giao thành công
    const deliverSuccess = await updateShipment(
      patch(`/api/vn-jp-shipments/${shipment.id}`, { status: "DELIVERED_JP" }, { cookies }),
      params({ id: shipment.id })
    );
    expect(deliverSuccess.status).toBe(200);

    // 6. Thử lùi trạng thái từ DELIVERED_JP về lại CONFIRMED_PICKUP hoặc CANCELLED -> nhận 409
    const revertAttempt = await updateShipment(
      patch(`/api/vn-jp-shipments/${shipment.id}`, { status: "CONFIRMED_PICKUP" }, { cookies }),
      params({ id: shipment.id })
    );
    expect(revertAttempt.status).toBe(409);
  });
});
