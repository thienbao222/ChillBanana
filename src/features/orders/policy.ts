export const MIN_ORDER_THRESHOLD_VND = 300_000;

export const ORDER_STATUS_FLOW = [
  "PENDING_DEPOSIT",
  "PURCHASING_JP",
  "WAREHOUSE_JP",
  "IN_TRANSIT_AIR",
  "WAREHOUSE_VN",
  "LOCAL_DELIVERY",
  "COMPLETED",
] as const;

export const ORDER_STATUS_FLOW_VN_ORIGIN = [
  "PENDING_DEPOSIT",
  "WAREHOUSE_VN",
  "LOCAL_DELIVERY",
  "COMPLETED",
] as const;

export type ActiveOrderStatus = (typeof ORDER_STATUS_FLOW)[number];

export const ORDER_STATUS_LABELS_VI: Record<string, string> = {
  PENDING_DEPOSIT: "Chờ cọc",
  PURCHASING_JP: "Đang mua tại Nhật",
  WAREHOUSE_JP: "Đã nhập kho Nhật",
  IN_TRANSIT_AIR: "Đang vận chuyển quốc tế",
  WAREHOUSE_VN: "Đã nhập kho Việt Nam",
  LOCAL_DELIVERY: "Đang giao chặng cuối",
  COMPLETED: "Giao hàng thành công",
  CANCELLED: "Đã hủy",
};

export type VnOriginOrderStatus = (typeof ORDER_STATUS_FLOW_VN_ORIGIN)[number];

export function isNextOrderStatus(current: string, next: string, fulfillmentOrigin = "JP"): boolean {
  if (fulfillmentOrigin === "VN") {
    // If an order with VN origin was mistakenly put in Japan status, allow transitioning directly to Kho VN
    if (["PURCHASING_JP", "WAREHOUSE_JP", "IN_TRANSIT_AIR"].includes(current) && next === "WAREHOUSE_VN") {
      return true;
    }
    const currentIndex = ORDER_STATUS_FLOW_VN_ORIGIN.indexOf(current as VnOriginOrderStatus);
    return currentIndex >= 0 && ORDER_STATUS_FLOW_VN_ORIGIN[currentIndex + 1] === next;
  }
  const currentIndex = ORDER_STATUS_FLOW.indexOf(current as ActiveOrderStatus);
  return currentIndex >= 0 && ORDER_STATUS_FLOW[currentIndex + 1] === next;
}

export function getPreviousOrderStatus(current: string, fulfillmentOrigin = "JP"): ActiveOrderStatus | null {
  if (fulfillmentOrigin === "VN") {
    if (["PURCHASING_JP", "WAREHOUSE_JP", "IN_TRANSIT_AIR"].includes(current)) {
      return "PENDING_DEPOSIT";
    }
    const currentIndex = ORDER_STATUS_FLOW_VN_ORIGIN.indexOf(current as VnOriginOrderStatus);
    return currentIndex > 0 ? (ORDER_STATUS_FLOW_VN_ORIGIN[currentIndex - 1] as ActiveOrderStatus) : null;
  }
  const currentIndex = ORDER_STATUS_FLOW.indexOf(current as ActiveOrderStatus);
  return currentIndex > 0 ? ORDER_STATUS_FLOW[currentIndex - 1] : null;
}

/**
 * Server tự quyết định nguồn kho fulfilmentOrigin:
 * - Origin là 'VN' chỉ khi toàn bộ sản phẩm trong đơn là hàng catalog có fulfillmentOrigin = 'VN'
 *   (nghĩa là không có bất kỳ mặt hàng non-VN nào) và số lượng sản phẩm > 0.
 * - Mọi trường hợp còn lại (có sản phẩm ngoài catalog, có hàng từ Nhật, hoặc đơn rỗng) luôn là 'JP'.
 * - Tuyệt đối không tin cậy giá trị do client gửi lên.
 */
export function resolveOrderFulfillmentOrigin(hasNonVnItem: boolean, itemsCount: number): "VN" | "JP" {
  return !hasNonVnItem && itemsCount > 0 ? "VN" : "JP";
}

