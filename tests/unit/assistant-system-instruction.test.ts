import { describe, expect, it } from "vitest";
import { buildSystemInstruction } from "@/features/ai/customer/assistant";
import type { SupportEvidence } from "@/features/ai/customer/support-policy";

describe("BƯỚC 6: Chỉnh system instruction (buildSystemInstruction)", () => {
  it("chứa chỉ dẫn trả lời ngắn gọn 3-6 dòng và chỉ dựa trên bằng chứng công cụ", () => {
    const instruction = buildSystemInstruction([]);
    expect(instruction).toMatch(/3.*6 dòng/i);
    expect(instruction).toMatch(/CHỈ DỰA TRÊN BẰNG CHỨNG CÔNG CỤ/i);
  });

  it("chứa quy tắc khi catalog không khớp: hỏi lại 1 câu làm rõ và đề nghị dán link để báo giá", () => {
    const instruction = buildSystemInstruction([]);
    expect(instruction).toMatch(/Khi Catalog KHÔNG có sản phẩm khớp/i);
    expect(instruction).toMatch(/Hỏi lại đúng 1 câu làm rõ/i);
    expect(instruction).toMatch(/dán link sản phẩm từ sàn Nhật/i);
  });

  it("cấm tự ý nêu giá hay cân nặng không có trong bằng chứng", () => {
    const instruction = buildSystemInstruction([]);
    expect(instruction).toMatch(/Tuyệt đối KHÔNG được tự nêu giá tiền.*cân nặng.*không có trong/i);
  });

  it("cấm lặp lại nguyên văn câu của khách trong link hoặc tiêu đề", () => {
    const instruction = buildSystemInstruction([]);
    expect(instruction).toMatch(/TUYỆT ĐỐI KHÔNG lặp lại nguyên văn câu chat hay câu hỏi của khách làm tiêu đề hoặc nhãn liên kết/i);
  });

  it("bảo lưu các ràng buộc bảo vệ an toàn và chèn payload JSON bằng chứng", () => {
    const mockEvidence: SupportEvidence[] = [
      {
        toolId: "catalog_search",
        status: "ok",
        source: { label: "Catalog", observedAt: "2026-01-01T00:00:00Z" },
        known: { matchCount: 1, inCatalog: true },
        unknown: [],
        links: [],
      },
    ];

    const instruction = buildSystemInstruction(mockEvidence);
    expect(instruction).toMatch(/không tuyên bố đã reverse-image-search/i);
    expect(instruction).toMatch(/không khẳng định đúng model/i);
    expect(instruction).toContain('"toolId":"catalog_search"');
  });
});
