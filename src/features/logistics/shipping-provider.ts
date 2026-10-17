import type { PricingConfigValues } from "@/features/pricing/config";
import { DEFAULT_PRICING_CONFIG } from "@/features/pricing/config";

// Giao diện nhà cung cấp vận chuyển. Hiện chỉ có bản mô phỏng; dữ liệu trả về luôn mang isSimulated = true
// để giao diện/quản trị không nhầm với vận đơn thật. Khi có hợp đồng với hãng vận chuyển, thêm một lớp
// triển khai ShippingProvider mới mà không phải sửa nơi gọi.

export type ShipmentQuote = { provider: string; weightKg: number; feeVnd: number; estimatedDays: number; isSimulated: boolean };
export type Shipment = { provider: string; trackingCode: string; orderCode: string; isSimulated: boolean };
export type ShipmentEvent = { trackingCode: string; status: string; label: string; location: string; occurredAt: string; isSimulated: boolean };

export interface ShippingProvider {
  readonly name: string;
  readonly isSimulated: boolean;
  quote(input: { weightKg: number }): Promise<ShipmentQuote>;
  createShipment(input: { orderCode: string; weightKg: number; address: string }): Promise<Shipment>;
  getTrackingEvents(trackingCode: string): Promise<ShipmentEvent[]>;
}

const MOCK_JOURNEY: { status: string; label: string; location: string }[] = [
  { status: "PICKED_UP", label: "Đã lấy hàng (mô phỏng)", location: "Kho Tokyo" },
  { status: "IN_TRANSIT", label: "Đang bay quốc tế (mô phỏng)", location: "Narita → Nội Bài" },
  { status: "OUT_FOR_DELIVERY", label: "Đang giao chặng cuối (mô phỏng)", location: "Việt Nam" },
  { status: "DELIVERED", label: "Giao thành công (mô phỏng)", location: "Việt Nam" },
];

export class MockShippingProvider implements ShippingProvider {
  readonly name = "MOCK_SHIPPING";
  readonly isSimulated = true;

  constructor(private readonly pricing: PricingConfigValues = DEFAULT_PRICING_CONFIG) {}

  async quote(input: { weightKg: number }): Promise<ShipmentQuote> {
    const weightKg = Math.max(0, input.weightKg);
    return {
      provider: this.name,
      weightKg,
      feeVnd: Math.round(weightKg * this.pricing.airShippingPerKgVnd),
      estimatedDays: 7,
      isSimulated: true,
    };
  }

  async createShipment(input: { orderCode: string; weightKg: number; address: string }): Promise<Shipment> {
    if (!input.address.trim()) throw new Error("Thiếu địa chỉ giao hàng");
    return { provider: this.name, trackingCode: `MOCK-${input.orderCode}`, orderCode: input.orderCode, isSimulated: true };
  }

  /** Hành trình mô phỏng cố định, không phụ thuộc thời gian thực, để test được. */
  async getTrackingEvents(trackingCode: string): Promise<ShipmentEvent[]> {
    const base = Date.UTC(2026, 0, 1);
    return MOCK_JOURNEY.map((step, i) => ({
      trackingCode,
      ...step,
      occurredAt: new Date(base + i * 24 * 60 * 60 * 1000).toISOString(),
      isSimulated: true,
    }));
  }
}
