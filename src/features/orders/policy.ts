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

export function isNextOrderStatus(current: string, next: string): boolean {
  const currentIndex = ORDER_STATUS_FLOW.indexOf(current as ActiveOrderStatus);
  return currentIndex >= 0 && ORDER_STATUS_FLOW[currentIndex + 1] === next;
}

export function getPreviousOrderStatus(current: string): ActiveOrderStatus | null {
  const currentIndex = ORDER_STATUS_FLOW.indexOf(current as ActiveOrderStatus);
  return currentIndex > 0 ? ORDER_STATUS_FLOW[currentIndex - 1] : null;
}
