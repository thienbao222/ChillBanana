# Tài Liệu Đặc Tả Kết Nối API Chính Thống — Rakuten & Yahoo! Shopping

Tài liệu này ghi nhận thông số kỹ thuật, quy định kết nối và điều khoản sử dụng của hai sàn thương mại điện tử lớn của Nhật Bản được tích hợp trong hệ thống ChillBanana.

---

## 1. Rakuten Ichiba Item Search API (楽天市場商品検索API)

- **Tài liệu chính thức:** [Rakuten Developers - Ichiba Item Search API](https://webservice.rakuten.co.jp/documentation/ichiba-item-search)
- **Endpoint chuẩn:** `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601`
- **Giao thức:** HTTPS GET (REST/JSON)
- **Tham số bắt buộc:**
  - `applicationId`: Mã ứng dụng được cấp khi đăng ký tài khoản Rakuten Developers (App ID).
  - `format`: `json` (hoặc `xml`).
  - Một trong các tham số truy vấn: `keyword` (từ khóa tiếng Nhật) hoặc `genreId` hoặc `itemCode`.
- **Tham số tùy chọn quan trọng:**
  - `hits`: Số lượng kết quả mỗi trang (mặc định 30, tối đa 30).
  - `page`: Trang kết quả (1 - 100).
  - `sort`: Cách sắp xếp (`standard`, `+itemPrice`, `-itemPrice`, `+reviewCount`, v.v.).
  - `minPrice` / `maxPrice`: Bộ lọc giá.
- **Giới hạn tần suất (Rate Limits):**
  - Mặc định: 1 yêu cầu / giây (1 req/sec) cho mỗi App ID.
  - Vượt quá tần suất sẽ trả về HTTP 429 hoặc HTTP 400 kèm lỗi `"Rate limit exceeded"`.
- **Quy định lưu bộ nhớ đệm (Caching):**
  - Cho phép lưu cache tạm thời (thời gian tối đa khuyến nghị: 24 giờ đối với thông tin sản phẩm tĩnh, không lưu vĩnh viễn dữ liệu giá để đảm bảo tính thời điểm).
- **Yêu cầu hiển thị thương hiệu & Nguồn dữ liệu:**
  - Bắt buộc ghi nhận nguồn dữ liệu từ Rakuten.

---

## 2. Yahoo! Shopping API v3 (Yahoo!ショッピングAPI v3 - 商品検索)

- **Tài liệu chính thức:** [Yahoo! JAPAN Developer Network - Shopping API v3](https://developer.yahoo.co.jp/webapi/shopping/v3/itemsearch.html)
- **Endpoint chuẩn:** `https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch`
- **Giao thức:** HTTPS GET (REST/JSON)
- **Tham số bắt buộc:**
  - `appid`: Client ID (Application ID) của ứng dụng đăng ký trên Yahoo! JAPAN Developer Network.
  - Một trong các tham số truy vấn: `query` (từ khóa tìm kiếm) hoặc `jan_code` (mã vạch hàng Nhật JAN/EAN).
- **Tham số tùy chọn quan trọng:**
  - `results`: Số lượng kết quả trả về (1 - 100, mặc định 20).
  - `start`: Vị trí kết quả bắt đầu (1 - 1000).
  - `sort`: Sắp xếp (`-score`, `+price`, `-price`).
  - `price_from` / `price_to`: Khoảng giá tìm kiếm.
- **Giới hạn tần suất (Rate Limits):**
  - Mặc định: 50.000 lượt gọi / ngày cho mỗi Client ID (giới hạn theo giây/phút linh hoạt từ phía Gateway).
- **Quy định lưu bộ nhớ đệm (Caching):**
  - Nghiêm cấm lưu trữ dữ liệu sản phẩm quá 24 giờ. Phải làm mới cache định kỳ.
- **Yêu cầu hiển thị thương hiệu & Nguồn dữ liệu (Credit):**
  - **BẮT BUỘC:** Hiển thị biểu trưng Credit Image hoặc dòng chữ *"Web Services by Yahoo! JAPAN"* hoặc *"Supported by Yahoo! JAPAN"* tại chân giao diện tìm kiếm hoặc gần khu vực hiển thị kết quả.

---

## 3. Rào Chắn An Toàn Tại ChillBanana

1. **Biến môi trường:** Các khóa API được cấu hình qua biến môi trường server-side (`RAKUTEN_APP_ID`, `YAHOO_CLIENT_ID`), tuyệt đối không gửi về client browser.
2. **Khả năng chịu lỗi (Fault Tolerance):** Nếu thiếu khóa hoặc sàn trả về lỗi HTTP 429, hệ thống không làm gián đoạn trải nghiệm của khách mà trả về thông báo nhẹ nhàng và hướng dẫn khách dán link sản phẩm trực tiếp (phương thức cào/nhập tay truyền thống).
3. **Bất biến xác minh giá:** Dữ liệu trả về từ API chỉ mang tính gợi ý tham khảo; khi khách đưa vào đơn hàng, đơn luôn được gán `quoteSource = API_RAKUTEN | API_YAHOO` và bắt buộc nhân viên thẩm định (`isPriceVerified = false`).

