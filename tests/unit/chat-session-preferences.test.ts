import { describe, expect, it } from "vitest";
import {
  formatSessionPreferencesContext,
  buildSystemInstruction,
} from "@/features/ai/customer/assistant";

describe("Ghi nhớ sở thích trong phiên (Session Preferences)", () => {
  it("formatSessionPreferencesContext định dạng chuẩn xác ngân sách, thương hiệu, nhóm hàng", () => {
    const rawKeywords = "ngân sách: 2 triệu,thương hiệu: Anessa,nhóm hàng: mỹ phẩm";
    const context = formatSessionPreferencesContext(rawKeywords, "Mỹ phẩm Nhật");

    expect(context).toBeDefined();
    expect(context).toContain("Sở thích khách đã nêu");
    expect(context).toContain("ngân sách: 2 triệu");
    expect(context).toContain("thương hiệu: Anessa");
    expect(context).toContain("nhóm hàng: mỹ phẩm");
  });

  it("formatSessionPreferencesContext tự động trích xuất từ từ khóa không có tiền tố", () => {
    const rawKeywords = "1.5 triệu,DHC,thực phẩm chức năng";
    const context = formatSessionPreferencesContext(rawKeywords, "Tư vấn chung");

    expect(context).toBeDefined();
    expect(context).toContain("Sở thích khách đã nêu");
    expect(context).toContain("ngân sách: 1.5 triệu");
    expect(context).toContain("thương hiệu: DHC");
    expect(context).toContain("nhóm hàng: thực phẩm chức năng");
  });

  it("dùng topic làm nhóm hàng khi chưa có nhóm hàng trong từ khóa", () => {
    const rawKeywords = "ngân sách: 3 triệu,thương hiệu: Zojirushi";
    const context = formatSessionPreferencesContext(rawKeywords, "Đồ gia dụng 100V");

    expect(context).toBeDefined();
    expect(context).toContain("ngân sách: 3 triệu");
    expect(context).toContain("thương hiệu: Zojirushi");
    expect(context).toContain("nhóm hàng: Đồ gia dụng 100V");
  });

  it("trả về null khi phiên chat không có sở thích hay chủ đề đặc thù", () => {
    expect(formatSessionPreferencesContext(null, null)).toBeNull();
    expect(formatSessionPreferencesContext("", "Tư vấn chung")).toBeNull();
  });

  it("buildSystemInstruction đưa 'Sở thích khách đã nêu' vào ngữ cảnh để AI ưu tiên", () => {
    const preferences = "Sở thích khách đã nêu: ngân sách: 2 triệu, thương hiệu: Anessa, nhóm hàng: mỹ phẩm";
    const instruction = buildSystemInstruction([], "vi", preferences);

    expect(instruction).toContain("SỞ THÍCH KHÁCH ĐÃ NÊU");
    expect(instruction).toContain(preferences);
    expect(instruction).toContain("Hãy ưu tiên ghi nhớ và tư vấn các sản phẩm phù hợp");
  });
});
