import { describe, expect, it } from "vitest";
import {
  canReadOrder,
  detectSupportIntents,
  extractCatalogSearchTerms,
  getOrderStatusLabel,
  getRequestSlotLabel,
  isSupportedMarketplaceUrl,
  isValidOrderCode,
  isValidQuotePrice,
  normalizeSupportText,
} from "@/features/ai/customer/support-policy";

describe("support-policy unit tests", () => {
  describe("normalizeSupportText", () => {
    it("bỏ dấu tiếng Việt, chuyển đ/Đ thành d/D và chuyển chữ thường", () => {
      expect(normalizeSupportText("Nồi cơm điện Zojirushi")).toBe("noi com dien zojirushi");
      expect(normalizeSupportText("ĐỒNG HỒ ĐEO TAY")).toBe("dong ho deo tay");
      expect(normalizeSupportText("Đã kiểm tra")).toBe("da kiem tra");
    });
  });

  describe("isSupportedMarketplaceUrl", () => {
    it("chấp nhận các sàn thương mại điện tử Nhật Bản hợp lệ qua HTTPS", () => {
      expect(isSupportedMarketplaceUrl("https://jp.mercari.com/item/m12345678")).toBe(true);
      expect(isSupportedMarketplaceUrl("https://www.amazon.co.jp/dp/B08N5WRWNW")).toBe(true);
      expect(isSupportedMarketplaceUrl("https://item.rakuten.co.jp/shop/item123/")).toBe(true);
      expect(isSupportedMarketplaceUrl("https://page.auctions.yahoo.co.jp/jp/auction/1234")).toBe(true);
      expect(isSupportedMarketplaceUrl("https://www.suruga-ya.jp/product/detail/123")).toBe(true);
      expect(isSupportedMarketplaceUrl("https://www.biccamera.com/bc/item/123/")).toBe(true);
      expect(isSupportedMarketplaceUrl("https://www.yodobashi.com/product/123/")).toBe(true);
      expect(isSupportedMarketplaceUrl("https://www.uniqlo.com/jp/ja/products/E123")).toBe(true);
    });

    it("từ chối URL không phải HTTPS", () => {
      expect(isSupportedMarketplaceUrl("http://jp.mercari.com/item/m123")).toBe(false);
      expect(isSupportedMarketplaceUrl("javascript:alert(1)")).toBe(false);
      expect(isSupportedMarketplaceUrl("ftp://jp.mercari.com")).toBe(false);
    });

    it("từ chối URL có chứa thông tin đăng nhập trong liên kết", () => {
      expect(isSupportedMarketplaceUrl("https://admin:password@jp.mercari.com/item/123")).toBe(false);
    });

    it("từ chối các sàn ngoài phạm vi hoặc tên miền giả mạo", () => {
      expect(isSupportedMarketplaceUrl("https://shopee.vn/product/123")).toBe(false);
      expect(isSupportedMarketplaceUrl("https://fake-mercari.com/item/123")).toBe(false);
      expect(isSupportedMarketplaceUrl("https://phishing.rakuten.co.jp.attacker.com")).toBe(false);
      expect(isSupportedMarketplaceUrl("https://google.com")).toBe(false);
    });

    it("từ chối input không hợp lệ hoặc quá dài (>2048 ký tự)", () => {
      expect(isSupportedMarketplaceUrl(null)).toBe(false);
      expect(isSupportedMarketplaceUrl(undefined)).toBe(false);
      expect(isSupportedMarketplaceUrl(12345)).toBe(false);
      expect(isSupportedMarketplaceUrl("https://jp.mercari.com/" + "a".repeat(2050))).toBe(false);
    });
  });

  describe("isValidOrderCode", () => {
    it("chấp nhận mã đơn ChillBanana hợp lệ", () => {
      expect(isValidOrderCode("CB-2026-ABCD-123456")).toBe(true);
      expect(isValidOrderCode("cb-2026-xyz9-1234")).toBe(true);
    });

    it("từ chối mã đơn sai định dạng", () => {
      expect(isValidOrderCode("CB-123")).toBe(false);
      expect(isValidOrderCode("ORDER-2026-ABC-123")).toBe(false);
      expect(isValidOrderCode("CB-2026-")).toBe(false);
      expect(isValidOrderCode("")).toBe(false);
    });
  });

  describe("isValidQuotePrice", () => {
    it("chấp nhận số tiền JPY hợp lệ (>0 và <= 1.000.000.000)", () => {
      expect(isValidQuotePrice(1000)).toBe(true);
      expect(isValidQuotePrice(50000)).toBe(true);
      expect(isValidQuotePrice(1_000_000_000)).toBe(true);
    });

    it("từ chối số tiền không hợp lệ, số âm, số lẻ hoặc tràn số", () => {
      expect(isValidQuotePrice(0)).toBe(false);
      expect(isValidQuotePrice(-100)).toBe(false);
      expect(isValidQuotePrice(150.5)).toBe(false);
      expect(isValidQuotePrice(NaN)).toBe(false);
      expect(isValidQuotePrice(Infinity)).toBe(false);
      expect(isValidQuotePrice("1000")).toBe(false);
      expect(isValidQuotePrice(1_000_000_001)).toBe(false);
    });
  });

  describe("canReadOrder (Quyền truy cập thông tin đơn)", () => {
    it("cho phép đọc nếu đúng ID khách hàng sở hữu đơn", () => {
      expect(canReadOrder("user_1", "user_1", false)).toBe(true);
    });

    it("cho phép đọc nếu có guest access token hợp lệ", () => {
      expect(canReadOrder(null, "user_1", true)).toBe(true);
      expect(canReadOrder("user_different", "user_1", true)).toBe(true);
    });

    it("từ chối nếu sai ID khách hàng và không có token khách vãng lai", () => {
      expect(canReadOrder("user_attacker", "user_victim", false)).toBe(false);
      expect(canReadOrder(null, "user_1", false)).toBe(false);
      expect(canReadOrder(null, null, false)).toBe(false);
    });
  });

  describe("detectSupportIntents", () => {
    it("nhận diện intent kiểm tra điện áp tương thích 100V", () => {
      const intent = detectSupportIntents("Nồi cơm điện Nhật 100V có cắm được điện 220V ở nhà không?");
      expect(intent.compatibility).toBe(true);
    });

    it("nhận diện intent tính giá mua hộ", () => {
      const intent = detectSupportIntents("Tính giá về Việt Nam cho món này bao nhiêu tiền?");
      expect(intent.quote).toBe(true);
    });

    it("nhận diện intent kiểm tra tiến độ đơn hàng và trích xuất mã đơn", () => {
      const intent = detectSupportIntents("Tra cứu đơn hàng CB-2026-TEST-987654 đang ở đâu rồi?");
      expect(intent.orderStatus).toBe(true);
      expect(intent.orderCode).toBe("CB-2026-TEST-987654");
    });

    it("nhận diện intent về cước phí vận chuyển và gom đơn", () => {
      const intent = detectSupportIntents("Cước bay Narita về Sài Gòn tính thế nào? Gom đơn được giảm không?");
      expect(intent.shipping).toBe(true);
    });
  });

  describe("Nhãn hiển thị trạng thái và suất mua", () => {
    it("trả về nhãn tiếng Việt chuẩn cho từng trạng thái đơn", () => {
      expect(getOrderStatusLabel("PENDING_DEPOSIT")).toBe("Chờ đặt cọc");
      expect(getOrderStatusLabel("PURCHASING_JP")).toBe("Đang mua tại Nhật Bản");
      expect(getOrderStatusLabel("WAREHOUSE_JP")).toBe("Đã vào kho Nhật Bản");
      expect(getOrderStatusLabel("IN_TRANSIT_AIR")).toBe("Đang vận chuyển quốc tế");
      expect(getOrderStatusLabel("WAREHOUSE_VN")).toBe("Đã về kho Việt Nam");
      expect(getOrderStatusLabel("LOCAL_DELIVERY")).toBe("Đang giao hàng nội địa");
      expect(getOrderStatusLabel("COMPLETED")).toBe("Đã giao hàng thành công");
      expect(getOrderStatusLabel("CANCELLED")).toBe("Đã hủy");
      expect(getOrderStatusLabel("UNKNOWN")).toBe("Đang được kiểm tra");
    });

    it("trả về nhãn suất tiếp nhận yêu cầu mua hộ", () => {
      expect(getRequestSlotLabel(5)).toBe("Còn 5 suất tiếp nhận yêu cầu mua hộ");
      expect(getRequestSlotLabel(0)).toBe("Hiện chưa có suất tiếp nhận yêu cầu mua hộ");
    });
  });
});
