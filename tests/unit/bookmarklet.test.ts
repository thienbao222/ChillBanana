import { describe, it, expect } from "vitest";
import { validateBookmarkletPayload } from "@/features/purchasing/bookmarklet-validator";

describe("WP4.3 — Bookmarklet & Bộ lọc làm sạch dữ liệu nhập giỏ", () => {
  it("chấp nhận dữ liệu hợp lệ từ sàn được hỗ trợ và gán quoteSource = EXTENSION", () => {
    const raw = {
      name: "Trà xanh Uji Matcha Nhật Bản 100g",
      price: 2500,
      url: "https://item.rakuten.co.jp/uji-tea/matcha-100/",
      imageUrl: "https://thumbnail.rakuten.co.jp/matcha.jpg",
      weightKg: 0.2,
    };

    const res = validateBookmarkletPayload(raw);
    expect(res.isValid).toBe(true);
    if (res.isValid) {
      expect(res.data.name).toBe("Trà xanh Uji Matcha Nhật Bản 100g");
      expect(res.data.priceJpy).toBe(2500);
      expect(res.data.weightKg).toBe(0.2);
      expect(res.data.quoteSource).toBe("EXTENSION");
      expect(res.data.id).toMatch(/^calc-ext-/);
    }
  });

  it("từ chối domain lạ không thuộc danh sách whitelist các sàn Nhật Bản", () => {
    const raw = {
      name: "Sản phẩm giả mạo",
      price: 1000,
      url: "https://evil-phishing-site.com/product",
    };

    const res = validateBookmarkletPayload(raw);
    expect(res.isValid).toBe(false);
    if (!res.isValid) {
      expect(res.error).toContain("không nằm trong danh sách các sàn");
    }
  });

  it("chặn triệt để tấn công SSRF / Private Host / Cloud Metadata", () => {
    const ssrfUrls = [
      "http://localhost:3000/admin",
      "http://127.0.0.1/steal-token",
      "http://169.254.169.254/latest/meta-data/",
      "http://10.0.0.1/internal-api",
      "http://192.168.1.1/router",
    ];

    for (const url of ssrfUrls) {
      const res = validateBookmarkletPayload({
        name: "Hàng test",
        price: 1500,
        url,
      });
      expect(res.isValid).toBe(false);
      if (!res.isValid) {
        expect(res.error).toMatch(/vi phạm chính sách bảo mật mạng|không nằm trong danh sách/);
      }
    }
  });

  it("từ chối giá không hợp lệ (âm, 0, NaN, chuỗi ký tự, vượt quá 10M ¥)", () => {
    const invalidPrices = [-100, 0, "free", NaN, Infinity, 15_000_000];

    for (const price of invalidPrices) {
      const res = validateBookmarkletPayload({
        name: "Sản phẩm thử nghiệm",
        price,
        url: "https://amazon.co.jp/dp/B000TEST",
      });
      expect(res.isValid).toBe(false);
      if (!res.isValid) {
        expect(res.error).toContain("Giá sản phẩm phải là số nguyên dương hợp lệ");
      }
    }
  });

  it("làm sạch và vô hiệu hóa các đoạn mã XSS độc hại trong tên sản phẩm", () => {
    const raw = {
      name: '<script>alert("XSS Attack!")</script>Áo thun Uniqlo Airism <b>chính hãng</b>',
      price: 1990,
      url: "https://www.uniqlo.com/jp/ja/products/E422986-000/",
    };

    const res = validateBookmarkletPayload(raw);
    expect(res.isValid).toBe(true);
    if (res.isValid) {
      expect(res.data.name).not.toContain("<script>");
      expect(res.data.name).not.toContain("<b>");
      expect(res.data.name).toContain("Áo thun Uniqlo Airism chính hãng");
    }
  });
});

