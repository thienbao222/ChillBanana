/**
 * Helper phân tích biến môi trường chứa danh sách model (phân tách dấu phẩy).
 * Loại bỏ khoảng trắng và model rỗng, giữ nguyên thứ tự.
 */
export function parseModelList(envValue: string | undefined, defaultModels: readonly string[]): string[] {
  if (!envValue || typeof envValue !== "string") {
    return [...defaultModels];
  }
  const parsed = envValue
    .split(",")
    .map((m) => m.trim())
    .filter((m) => m.length > 0);
  return parsed.length > 0 ? parsed : [...defaultModels];
}

export const DEFAULT_FEATURE_MODELS = {
  // Chat tư vấn khách hàng: Flash-Lite đứng đầu (500 RPD), Flash đứng sau khi cần suy luận sâu
  chat: ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash"] as const,
  // Trích xuất từ khóa & Intent Router: siêu nhanh, tốn ít token
  light: ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"] as const,
  // Phân tích hình ảnh: Multimodal Vision
  vision: ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash"] as const,
  // Admin Assistant, Daily Insights, AI Analytics: suy luận mạnh mẽ cho số liệu
  admin: ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"] as const,
  // Kiểm định hàng hóa VN - JP (MAFF / Hải quan)
  inspect: ["gemini-3.5-flash-lite", "gemini-3.8-flash"] as const,
} as const;

export type FeatureType = keyof typeof DEFAULT_FEATURE_MODELS;

export function getFeatureModels(feature: FeatureType): string[] {
  switch (feature) {
    case "chat":
      return parseModelList(process.env.GEMINI_CHAT_MODELS, DEFAULT_FEATURE_MODELS.chat);
    case "light":
      return parseModelList(process.env.GEMINI_LIGHT_MODELS, DEFAULT_FEATURE_MODELS.light);
    case "vision":
      return parseModelList(process.env.GEMINI_VISION_MODELS, DEFAULT_FEATURE_MODELS.vision);
    case "admin":
      return parseModelList(process.env.GEMINI_ADMIN_MODELS, DEFAULT_FEATURE_MODELS.admin);
    case "inspect":
      return parseModelList(process.env.GEMINI_INSPECT_MODELS, DEFAULT_FEATURE_MODELS.inspect);
    default:
      return [...DEFAULT_FEATURE_MODELS.light];
  }
}

// Cấu hình phân chia model tối ưu cho Google Gemini 3.x (Tương thích ngược)
export const GEMINI_MODELS = {
  // Chat tư vấn khách hàng (Chuỗi dự phòng mặc định: 3.5-flash-lite -> 3.1-flash-lite -> 3.8-flash)
  neo: "gemini-3.5-flash-lite",
  neoFallback: "gemini-3.1-flash-lite",
  neoFallback2: "gemini-3.8-flash",

  // Bóc tách link & Trích xuất JSON (Tối ưu tốc độ cao, trích xuất cấu trúc sạch)
  lightweight: "gemini-3.5-flash-lite",

  // AI Vision Phân tích hình ảnh (Multimodal gốc, nhận diện đa giác quan)
  vision: "gemini-3.5-flash-lite",

  // Trợ lý Quản trị & Báo cáo Admin (Phân tích bảng biểu số liệu)
  admin: "gemini-3.8-flash",
} as const;
