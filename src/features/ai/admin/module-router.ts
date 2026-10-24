import { adminKeyPool } from "@/lib/api-key-manager";
import { GEMINI_MODELS } from "@/lib/gemini-models";
import { AdminAiModuleId } from "./definitions";

export type ConcreteAdminModuleId = Exclude<AdminAiModuleId, "auto">;

export const CONCRETE_MODULE_KEYWORDS: Record<ConcreteAdminModuleId, string[]> = {
  approvals: [
    "duyệt giá", "duyet gia", "chờ duyệt", "cho duyet", "chưa duyệt", "chua duyet",
    "báo giá", "bao gia", "giữ chỗ", "giu cho", "hết hạn", "het han", "cọc sắp hết",
    "coc sap het", "cân nặng 0", "can nang 0", "thiếu link", "thieu link", "xác nhận giá"
  ],
  logistics: [
    "vận chuyển", "van chuyen", "đứng yên", "dung yen", "kẹt", "ket", "chậm", "cham",
    "chặng", "chang", "kho", "vnjp", "vn->jp", "vn-jp", "vn jp", "maff", "kiểm dịch",
    "kiem dich", "thịt", "thuc pham", "tracking", "vận đơn", "van don", "narita", "tokyo"
  ],
  payments: [
    "thanh toán", "thanh toan", "tiền cọc", "tien coc", "đã cọc", "da coc", "chưa khớp",
    "chua khop", "lệch cọc", "lech coc", "tỷ giá", "ty gia", "jpy", "vnd", "vnpay",
    "vietqr", "chuyển khoản", "chuyen khoan", "ngân hàng"
  ],
  emails: [
    "email", "mail", "hàng đợi", "hang doi", "thất bại", "that bai", "gửi lại",
    "gui lai", "retry", "lỗi mail", "loi mail", "smtp", "outbox"
  ],
  orders: [
    "đơn hàng", "don hang", "mã đơn", "ma don", "trạng thái", "trang thai",
    "hủy đơn", "huy don", "đơn chờ", "don cho", "xử lý lâu", "xu ly lau"
  ],
  products: [
    "sản phẩm", "san pham", "catalog", "suất", "suat", "slot", "bán chạy",
    "ban chay", "hot", "hàng mẫu", "hang mau"
  ],
  customers: [
    "khách hàng", "khach hang", "khách mới", "khach moi", "đăng ký", "dang ky",
    "chat lead", "lead", "phân nhóm", "phan nhom"
  ],
  reports: [
    "báo cáo", "bao cao", "doanh thu", "doanh so", "thực thu", "thuc thu",
    "so sánh", "so sanh", "kỳ trước", "ky truoc", "ước tính"
  ],
  trends: [
    "xu hướng", "xu huong", "chủ đề", "chu de", "từ khóa", "tu khoa",
    "khiếu nại", "khieu nai", "hỏi nhiều", "hoi nhieu"
  ],
  overview: [
    "tổng quan", "tong quan", "tổng hợp", "tong hop", "hôm nay", "hom nay",
    "vận hành", "van hanh", "kpi", "toàn bộ", "toan bo"
  ],
};

export function detectModulesByKeywords(question: string): ConcreteAdminModuleId[] {
  const normalized = question.toLowerCase();
  const scored: { moduleId: ConcreteAdminModuleId; score: number }[] = [];

  for (const [moduleId, keywords] of Object.entries(CONCRETE_MODULE_KEYWORDS) as [ConcreteAdminModuleId, string[]][]) {
    let score = 0;
    for (const kw of keywords) {
      if (normalized.includes(kw)) {
        score += kw.length >= 6 ? 2 : 1;
      }
    }
    if (score > 0) {
      scored.push({ moduleId, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((item) => item.moduleId);
}

export async function resolveAutoModules(question: string): Promise<ConcreteAdminModuleId[]> {
  // 1. Ưu tiên luật từ khóa
  const keywordMatches = detectModulesByKeywords(question);
  if (keywordMatches.length > 0) {
    return keywordMatches;
  }

  // 2. Gemini lightweight nếu câu hỏi mơ hồ
  const apiKey = adminKeyPool.getNextKey();
  if (apiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODELS.lightweight}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `Phân loại câu hỏi của Quản trị viên ChillBanana vào từ 1 đến 3 module phù hợp nhất:
Các module hợp lệ: ["approvals", "logistics", "payments", "emails", "orders", "reports", "products", "customers", "trends", "overview"].
Câu hỏi: "${question}"
Chỉ trả về JSON mảng các tên module, ví dụ: ["approvals", "payments"]. Không kèm văn bản giải thích.`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 100,
            },
          }),
          signal: AbortSignal.timeout(3500),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        const match = text?.match(/\[[\s\S]*?\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed)) {
            const valid = parsed.filter(
              (m): m is ConcreteAdminModuleId =>
                typeof m === "string" && m in CONCRETE_MODULE_KEYWORDS
            );
            if (valid.length > 0) {
              return valid.slice(0, 3);
            }
          }
        }
      }
    } catch {
      // Fallback below
    }
  }

  return ["overview"];
}
