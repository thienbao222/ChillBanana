export const ADMIN_AI_MODULES = [
  { id: "overview", label: "Tổng quan", description: "KPI, việc cần chú ý và bức tranh vận hành." },
  { id: "reports", label: "Báo cáo", description: "Doanh thu thực thu, đơn hàng và so sánh kỳ." },
  { id: "trends", label: "Xu hướng khách", description: "Chủ đề và từ khóa được ghi nhận trong chat." },
  { id: "orders", label: "Đơn hàng", description: "Trạng thái, đơn chờ và hàng xử lý lâu." },
  { id: "products", label: "Sản phẩm", description: "Danh mục, số suất hiển thị và sản phẩm có đơn." },
  { id: "customers", label: "Khách hàng", description: "Số lượng và phân nhóm khách, không hiển thị PII." },
] as const;

export type AdminAiModuleId = (typeof ADMIN_AI_MODULES)[number]["id"];
