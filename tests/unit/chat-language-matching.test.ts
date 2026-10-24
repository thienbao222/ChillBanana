import { describe, expect, it } from "vitest";
import {
  detectCustomerLanguage,
  buildSystemInstruction,
  buildOfflineEvidenceReply,
} from "@/features/ai/customer/assistant";
import type { SupportEvidence } from "@/features/ai/customer/support-policy";

describe("Đáp bằng ngôn ngữ của khách (Language Matching: VI / EN / JA)", () => {
  describe("detectCustomerLanguage: Nhận diện ngôn ngữ chuẩn xác", () => {
    it("nhận diện tiếng Việt có dấu và không dấu", () => {
      expect(detectCustomerLanguage("sữa rửa mặt hada còn hàng sẵn không")).toBe("vi");
      expect(detectCustomerLanguage("sua rua mat hada con hang khong")).toBe("vi");
      expect(detectCustomerLanguage("bình giữ nhiệt zojirushi có sẵn không")).toBe("vi");
      expect(detectCustomerLanguage("cho mình xin giá cái này")).toBe("vi");
    });

    it("nhận diện tiếng Anh từ câu hỏi mua hàng / tra cứu", () => {
      expect(detectCustomerLanguage("do you have Hada Labo cleanser in stock")).toBe("en");
      expect(detectCustomerLanguage("how much is this sunscreen")).toBe("en");
      expect(detectCustomerLanguage("can you help me find a watch?")).toBe("en");
      expect(detectCustomerLanguage("what is the shipping rate to Vietnam?")).toBe("en");
    });

    it("nhận diện tiếng Nhật từ câu hỏi chứa Hiragana hoặc Katakana", () => {
      expect(detectCustomerLanguage("この商品の在庫はありますか？")).toBe("ja");
      expect(detectCustomerLanguage("アネッサの日焼け止めはいくらですか？")).toBe("ja");
      expect(detectCustomerLanguage("こんにちは、時計を探しています")).toBe("ja");
    });
  });

  describe("buildSystemInstruction: Điều hướng ngôn ngữ và giữ 2 persona", () => {
    it("yêu cầu tiếng Anh khi khách hỏi tiếng Anh", () => {
      const instruction = buildSystemInstruction([], "en");
      expect(instruction).toContain("MANDATORY LANGUAGE: RESPOND IN ENGLISH");
      expect(instruction).toContain("omotenashi");
      expect(instruction).toContain("chill");
    });

    it("yêu cầu tiếng Nhật khi khách hỏi tiếng Nhật", () => {
      const instruction = buildSystemInstruction([], "ja");
      expect(instruction).toContain("BẮT BUỘC PHẢN HỒI BẰNG TIẾNG NHẬT");
      expect(instruction).toContain("日本語で回答してください");
      expect(instruction).toContain("Omotenashi");
    });

    it("yêu cầu tiếng Việt khi khách hỏi tiếng Việt", () => {
      const instruction = buildSystemInstruction([], "vi");
      expect(instruction).toContain("BẮT BUỘC PHẢN HỒI BẰNG TIẾNG VIỆT");
    });
  });

  describe("buildOfflineEvidenceReply: Phản hồi bằng đúng ngôn ngữ của khách khi dự phòng", () => {
    const mockEvidence: SupportEvidence[] = [
      {
        toolId: "catalog_search",
        status: "ok",
        source: { label: "Catalog", observedAt: new Date().toISOString() },
        known: {
          searched: true,
          resultCount: 1,
          products: [
            {
              id: "prod-1",
              name: "Hada Labo Gokujyun Cleanser",
              priceJpy: 880,
              estimatedProductPriceVnd: 150000,
              inStock: true,
            },
          ],
        },
        unknown: [],
        links: [],
      },
    ];

    it("trả lời bằng tiếng Anh khi query tiếng Anh", () => {
      const reply = buildOfflineEvidenceReply(
        "do you have Hada Labo cleanser in stock",
        mockEvidence,
        true
      );
      expect(reply).toContain("ChillBanana Customer Support");
      expect(reply).toContain("Matching products from Japanese stores");
      expect(reply).toContain("Hada Labo Gokujyun Cleanser");
      expect(reply).not.toContain("Dạ, Neo xin phép gửi Quý khách");
    });

    it("trả lời bằng tiếng Nhật khi query tiếng Nhật", () => {
      const reply = buildOfflineEvidenceReply(
        "肌ラボの洗顔料はありますか？",
        mockEvidence,
        true
      );
      expect(reply).toContain("ChillBananaカスタマーサポート");
      expect(reply).toContain("おすすめ商品");
      expect(reply).toContain("Hada Labo Gokujyun Cleanser");
    });

    it("trả lời bằng tiếng Việt khi query tiếng Việt", () => {
      const reply = buildOfflineEvidenceReply(
        "sữa rửa mặt hada còn hàng không",
        mockEvidence,
        true
      );
      expect(reply).toContain("Dạ, Neo xin phép gửi Quý khách");
      expect(reply).toContain("Gợi ý sản phẩm phù hợp");
      expect(reply).toContain("Hada Labo Gokujyun Cleanser");
    });
  });
});
