// Cấu hình phân chia model tối ưu theo hạn mức Google AI Studio Free Tier
// - gemini-2.5-flash: Giới hạn 20 RPD (Dành riêng cho tư vấn khách hàng chất lượng cao)
// - gemini-2.0-flash: Giới hạn 1.500 RPD (Gấp 75 lần - Dùng cho Vision ảnh & Admin phân tích)
// - gemini-2.5-flash-lite: Giới hạn 1.500 RPD (Gấp 75 lần - Dùng cho bóc tách link & trích xuất JSON)

export const GEMINI_MODELS = {
  // Chat tư vấn khách hàng (Cần khả năng suy luận tự nhiên và nắm bắt ngữ cảnh tốt nhất)
  neo: "gemini-2.5-flash",
  neoFallback: "gemini-2.0-flash",

  // Bóc tách link & Trích xuất JSON (Tối ưu tốc độ cao, trích xuất cấu trúc sạch, 1.500 RPD)
  lightweight: "gemini-2.5-flash-lite",

  // AI Vision Phân tích hình ảnh (Multimodal gốc, nhận diện đa giác quan, 1.500 RPD)
  vision: "gemini-2.0-flash",

  // Trợ lý Quản trị & Báo cáo Admin (Phân tích bảng biểu số liệu, 1.500 RPD)
  admin: "gemini-2.0-flash",
} as const;
