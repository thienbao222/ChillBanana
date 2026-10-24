import { describe, expect, it } from "vitest";
import {
  isCommandOrConversationalMessage,
  isFollowupQuery,
  resolveEffectiveSupportMessage,
} from "@/features/ai/customer/support-tools";
import { extractCatalogSearchTerms } from "@/features/ai/customer/support-policy";

describe("BƯỚC 4: Gộp lịch sử chat đúng cách (runCustomerSupportTools)", () => {
  describe("isCommandOrConversationalMessage: Bỏ qua tin mang tính lệnh", () => {
    it("nhận diện đúng các lệnh thêm vào giỏ / đặt hàng", () => {
      expect(isCommandOrConversationalMessage("thêm vào giỏ")).toBe(true);
      expect(isCommandOrConversationalMessage("cho vào giỏ hàng giúp mình")).toBe(true);
      expect(isCommandOrConversationalMessage("bỏ vào giỏ")).toBe(true);
      expect(isCommandOrConversationalMessage("add to cart")).toBe(true);
      expect(isCommandOrConversationalMessage("mua ngay")).toBe(true);
      expect(isCommandOrConversationalMessage("chốt đơn")).toBe(true);
    });

    it("nhận diện đúng các câu cảm ơn thuần túy", () => {
      expect(isCommandOrConversationalMessage("cảm ơn shop")).toBe(true);
      expect(isCommandOrConversationalMessage("cảm ơn bạn nhiều nhé")).toBe(true);
      expect(isCommandOrConversationalMessage("thanks ad")).toBe(true);
    });

    it("nhận diện đúng các câu chào hỏi thuần túy", () => {
      expect(isCommandOrConversationalMessage("xin chào")).toBe(true);
      expect(isCommandOrConversationalMessage("chào shop")).toBe(true);
      expect(isCommandOrConversationalMessage("hello")).toBe(true);
      expect(isCommandOrConversationalMessage("hi shop")).toBe(true);
      expect(isCommandOrConversationalMessage("shop ơi")).toBe(true);
    });

    it("KHÔNG đánh dấu nhầm tin nhắn có chứa từ chào nhưng thực chất là hỏi mua sản phẩm", () => {
      expect(isCommandOrConversationalMessage("Chào shop mình muốn tìm nồi cơm Zojirushi")).toBe(false);
      expect(isCommandOrConversationalMessage("Hello shop, cho mình hỏi tai nghe Sony giá sao")).toBe(false);
    });
  });

  describe("isFollowupQuery: Kiểm tra câu hỏi nối tiếp", () => {
    it("KHÔNG coi là câu nối tiếp nếu tự tin hiện tại đã có từ 2 từ khóa trở lên", () => {
      // Ví dụ theo yêu cầu: 'thực phẩm chức năng thì sao' có các từ khóa 'thực', 'chức', 'năng'
      const terms1 = extractCatalogSearchTerms("thực phẩm chức năng thì sao");
      expect(terms1.length).toBeGreaterThanOrEqual(2);
      expect(isFollowupQuery("thực phẩm chức năng thì sao", terms1)).toBe(false);

      const terms2 = extractCatalogSearchTerms("áo khoác Uniqlo nam");
      expect(terms2.length).toBeGreaterThanOrEqual(2);
      expect(isFollowupQuery("áo khoác Uniqlo nam", terms2)).toBe(false);
    });

    it("nhận diện câu hỏi nối tiếp khi tự nó có ít hơn 2 từ khóa", () => {
      const termsBudget = extractCatalogSearchTerms("tầm 5 triệu");
      expect(termsBudget.length).toBeLessThan(2);
      expect(isFollowupQuery("tầm 5 triệu", termsBudget)).toBe(true);

      const termsCont = extractCatalogSearchTerms("còn loại nào khác không?");
      expect(termsCont.length).toBeLessThan(2);
      expect(isFollowupQuery("còn loại nào khác không?", termsCont)).toBe(true);

      const termsPrice = extractCatalogSearchTerms("giá bao nhiêu?");
      expect(termsPrice.length).toBeLessThan(2);
      expect(isFollowupQuery("giá bao nhiêu?", termsPrice)).toBe(true);

      const termsConn = extractCatalogSearchTerms("thế còn size L?");
      expect(termsConn.length).toBeLessThan(2);
      expect(isFollowupQuery("thế còn size L?", termsConn)).toBe(true);
    });

    it("từ chối các câu lệnh hoặc cảm ơn/chào hỏi không phải câu hỏi nối tiếp", () => {
      const termsThanks = extractCatalogSearchTerms("cảm ơn shop");
      expect(isFollowupQuery("cảm ơn shop", termsThanks)).toBe(false);

      const termsCart = extractCatalogSearchTerms("thêm vào giỏ");
      expect(isFollowupQuery("thêm vào giỏ", termsCart)).toBe(false);
    });
  });

  describe("resolveEffectiveSupportMessage: Logic gộp lịch sử", () => {
    it("KHÔNG gộp tin trước khi tin hiện tại đã có từ 2 từ khóa trở lên (ví dụ: thực phẩm chức năng thì sao)", () => {
      const history = [
        { role: "user", text: "Tôi muốn tìm nồi cơm Zojirushi" },
        { role: "assistant", text: "Dưới đây là một số mẫu nồi cơm Zojirushi..." },
      ];

      const effective = resolveEffectiveSupportMessage("thực phẩm chức năng thì sao", history);
      expect(effective).toBe("thực phẩm chức năng thì sao");
      expect(effective).not.toContain("nồi cơm");
    });

    it("gộp khi tin hiện tại là câu hỏi nối tiếp và có dưới 2 từ khóa", () => {
      const history = [
        { role: "user", text: "Tôi muốn tìm áo khoác Uniqlo" },
        { role: "assistant", text: "Dạ đây là các mẫu áo khoác Uniqlo..." },
      ];

      const effective = resolveEffectiveSupportMessage("tầm 1 triệu", history);
      expect(effective).toBe("Tôi muốn tìm áo khoác Uniqlo tầm 1 triệu");
    });

    it("chỉ lấy 1 tin user gần nhất và bỏ qua các tin lệnh (thêm vào giỏ, cảm ơn, chào hỏi)", () => {
      const history = [
        { role: "user", text: "Tìm tai nghe Sony WH-1000XM5" },
        { role: "assistant", text: "Dạ tai nghe Sony WH-1000XM5 có giá..." },
        { role: "user", text: "thêm vào giỏ" },
        { role: "assistant", text: "Đã hướng dẫn thêm vào giỏ..." },
        { role: "user", text: "cảm ơn shop nhiều nhé" },
        { role: "assistant", text: "Rất hân hạnh được hỗ trợ bạn!" },
      ];

      // Khách hỏi tiếp ngân sách sau một chuỗi tin cảm ơn / thêm giỏ
      const effective = resolveEffectiveSupportMessage("khoảng 3 triệu", history);
      // Phải bỏ qua "cảm ơn shop" và "thêm vào giỏ", lấy đúng 1 tin user "Tìm tai nghe Sony WH-1000XM5"
      expect(effective).toBe("Tìm tai nghe Sony WH-1000XM5 khoảng 3 triệu");
      expect(effective).not.toContain("thêm vào giỏ");
      expect(effective).not.toContain("cảm ơn");
    });

    it("chỉ lấy duy nhất 1 tin user gần nhất, không gom dồn nhiều tin user cũ", () => {
      const history = [
        { role: "user", text: "Tìm giày sneaker" },
        { role: "assistant", text: "Có nhiều mẫu sneaker..." },
        { role: "user", text: "màu trắng" },
        { role: "assistant", text: "Dưới đây là mẫu màu trắng..." },
      ];

      // Chỉ lấy đúng 1 tin user gần nhất là "màu trắng", không lấy cả "Tìm giày sneaker"
      const effective = resolveEffectiveSupportMessage("size 42", history);
      expect(effective).toBe("màu trắng size 42");
      expect(effective).not.toContain("Tìm giày sneaker");
    });
  });
});
