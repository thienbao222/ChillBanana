// FILE: src/features/pricing/vn-jp-rates.ts
// Module trung tâm (Single Source of Truth) quản lý biểu phí, công thức cân thể tích
// chuẩn hàng không quốc tế IATA (1:5000) và máy trạng thái vận đơn tuyến VN -> JP.

export type VnJpCargoType = "gift" | "food" | "doc" | "other";

export type VnJpShipmentStatus =
  | "PENDING_CONFIRMATION"
  | "CONFIRMED_PICKUP"
  | "WAREHOUSE_VN_INSPECTED"
  | "IN_FLIGHT_TO_JP"
  | "DELIVERED_JP"
  | "CANCELLED";

export const VN_JP_RATES_VND_PER_KG: Record<VnJpCargoType, number> = {
  gift: 180000,  // Kiện quà biếu / Quần áo / Đồ cá nhân (Miễn phí đóng thùng)
  other: 200000, // Hàng mẫu thương mại / Mặt hàng khác
  doc: 210000,   // Tài liệu / Hồ sơ du học chuyển phát nhanh EMS (48h)
  food: 220000,  // Thực phẩm khô / Cà phê / Hải sản khô (Hỗ trợ nhãn kiểm dịch MAFF)
};

export const VN_JP_CARGO_LABELS: Record<string, string> = {
  gift: "Kiện quà / Đồ cá nhân",
  food: "Thực phẩm khô / Cà phê",
  doc: "Tài liệu / Du học (EMS)",
  other: "Hàng mẫu / Khác",
};

export const VN_JP_STATUS_FLOW: VnJpShipmentStatus[] = [
  "PENDING_CONFIRMATION",
  "CONFIRMED_PICKUP",
  "WAREHOUSE_VN_INSPECTED",
  "IN_FLIGHT_TO_JP",
  "DELIVERED_JP",
];

export const VN_JP_STATUS_LABELS: Record<string, string> = {
  PENDING_CONFIRMATION: "1. Mới tiếp nhận (Chờ xác minh MAFF)",
  CONFIRMED_PICKUP: "2. Đã chốt & Chờ bưu tá lấy hàng tại VN",
  WAREHOUSE_VN_INSPECTED: "3. Đã về kho VN & Cân đo chuẩn IATA",
  IN_FLIGHT_TO_JP: "4. Đang bay sang Nhật & Thông quan",
  DELIVERED_JP: "5. Đã giao thành công tại Nhật Bản",
  CANCELLED: "Đã hủy vận đơn",
};

export const VALID_VN_JP_TRANSITIONS: Record<string, string[]> = {
  PENDING_CONFIRMATION: ["CONFIRMED_PICKUP", "CANCELLED"],
  CONFIRMED_PICKUP: ["WAREHOUSE_VN_INSPECTED", "CANCELLED"],
  WAREHOUSE_VN_INSPECTED: ["IN_FLIGHT_TO_JP", "CANCELLED"],
  IN_FLIGHT_TO_JP: ["DELIVERED_JP", "CANCELLED"],
  DELIVERED_JP: [],
  CANCELLED: [],
};

// 47 Tỉnh thành Nhật Bản phục vụ dropdown / chọn lọc
export const JAPAN_PREFECTURES: string[] = [
  "Hokkaido", "Aomori", "Iwate", "Miyagi", "Akita", "Yamagata", "Fukushima",
  "Ibaraki", "Tochigi", "Gunma", "Saitama", "Chiba", "Tokyo", "Kanagawa",
  "Niigata", "Toyama", "Ishikawa", "Fukui", "Yamanashi", "Nagano", "Gifu",
  "Shizuoka", "Aichi", "Mie", "Shiga", "Kyoto", "Osaka", "Hyogo", "Nara",
  "Wakayama", "Tottori", "Shimane", "Okayama", "Hiroshima", "Yamaguchi",
  "Tokushima", "Kagawa", "Ehime", "Kochi", "Fukuoka", "Saga", "Nagasaki",
  "Kumamoto", "Oita", "Miyazaki", "Kagoshima", "Okinawa"
];

export function getVnJpRatePerKg(cargoType: string): number {
  return VN_JP_RATES_VND_PER_KG[cargoType as VnJpCargoType] ?? 200000;
}

export function getPreviousVnJpStatus(currentStatus: string): VnJpShipmentStatus | null {
  const idx = VN_JP_STATUS_FLOW.indexOf(currentStatus as VnJpShipmentStatus);
  if (idx <= 0) return null;
  return VN_JP_STATUS_FLOW[idx - 1];
}

export interface IataWeightCalculationResult {
  actualWeightKg: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
  totalShippingFeeVnd: number;
}

/**
 * Tính trọng lượng tính cước chuẩn Hiệp hội Vận tải Hàng không Quốc tế (IATA):
 * - Cân thể tích (Volumetric Weight) = (Dài × Rộng × Cao) / 5000 (kg)
 * - Cân tính cước (Chargeable Weight) = Max(Cân nặng thực tế, Cân thể tích)
 */
export function calculateIataChargeableWeight(params: {
  actualWeightKg: number;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  unitPricePerKg: number;
}): IataWeightCalculationResult {
  const actW = Math.max(0.1, Number(params.actualWeightKg) || 0.5);
  const l = Number(params.lengthCm) || 0;
  const w = Number(params.widthCm) || 0;
  const h = Number(params.heightCm) || 0;
  const volumetricWeightKg =
    l > 0 && w > 0 && h > 0 ? Number(((l * w * h) / 5000).toFixed(2)) : 0;
  const chargeableWeightKg = Math.max(actW, volumetricWeightKg);
  const totalShippingFeeVnd = Math.round(chargeableWeightKg * params.unitPricePerKg);
  return {
    actualWeightKg: actW,
    volumetricWeightKg,
    chargeableWeightKg,
    totalShippingFeeVnd,
  };
}
