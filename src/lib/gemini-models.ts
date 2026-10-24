// Cấu hình phân chia model tối ưu cho Google Gemini 3.x
export const GEMINI_MODELS = {
  // Chat tư vấn khách hàng (Chuỗi dự phòng: 3.5-flash -> 3.6-flash -> 3.1-flash-lite)
  neo: "gemini-3.5-flash",
  neoFallback: "gemini-3.6-flash",
  neoFallback2: "gemini-3.1-flash-lite",

  // Bóc tách link & Trích xuất JSON (Tối ưu tốc độ cao, trích xuất cấu trúc sạch)
  lightweight: "gemini-3.5-flash-lite",

  // AI Vision Phân tích hình ảnh (Multimodal gốc, nhận diện đa giác quan)
  vision: "gemini-3.5-flash",

  // Trợ lý Quản trị & Báo cáo Admin (Phân tích bảng biểu số liệu)
  admin: "gemini-3.5-flash",
} as const;
