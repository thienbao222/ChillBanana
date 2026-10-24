export const ADMIN_AI_MODULES = [
  { id: "auto", label: "Tự động", description: "Tự động chọn 1-3 module phù hợp nhất với câu hỏi." },
  { id: "overview", label: "Tổng quan", description: "KPI, việc cần chú ý và bức tranh vận hành." },
  { id: "reports", label: "Báo cáo", description: "Doanh thu thực thu, đơn hàng và so sánh kỳ." },
  { id: "trends", label: "Xu hướng khách", description: "Chủ đề và từ khóa được ghi nhận trong chat." },
  { id: "orders", label: "Đơn hàng", description: "Trạng thái, đơn chờ và hàng xử lý lâu." },
  { id: "products", label: "Sản phẩm", description: "Danh mục, số suất hiển thị và sản phẩm có đơn." },
  { id: "customers", label: "Khách hàng", description: "Số lượng và phân nhóm khách, không hiển thị PII." },
  { id: "approvals", label: "Duyệt giá & Cọc", description: "Đơn chờ duyệt giá và đơn chờ cọc sắp hết hạn giữ chỗ." },
  { id: "logistics", label: "Vận hành & Kho", description: "Đơn đứng yên theo trạng thái, vận đơn VN→JP và kiểm dịch MAFF." },
  { id: "payments", label: "Thanh toán & Tỷ giá", description: "Đơn cọc lệch trạng thái và tỷ giá quy đổi hiện hành." },
  { id: "emails", label: "Hàng đợi Email", description: "Email thất bại, đang chờ gửi lại và cảnh báo gửi tin." },
] as const;

export type AdminAiModuleId = (typeof ADMIN_AI_MODULES)[number]["id"];
