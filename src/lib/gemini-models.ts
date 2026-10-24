// Cấu hình phân chia model tối ưu cho Google Gemini 3.x
export const GEMINI_MODELS = {
  // Chat tư vấn khách hàng (Cần khả năng suy luận tự nhiên và nắm bắt ngữ cảnh tốt nhất)
  neo: "gemini-3.5-flash",
  neoFallback: "gemini-3.1-flash-lite",

  // Bóc tách link & Trích xuất JSON (Tối ưu tốc độ cao, trích xuất cấu trúc sạch)
  lightweight: "gemini-3.5-flash-lite",

  // AI Vision Phân tích hình ảnh (Multimodal gốc, nhận diện đa giác quan)
  vision: "gemini-3.5-flash",

  // Trợ lý Quản trị & Báo cáo Admin (Phân tích bảng biểu số liệu)
  admin: "gemini-3.5-flash",
} as const;
