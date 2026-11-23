# SOP 01: Quy Trình Tiếp Nhận Đơn Hàng & Thẩm Định Duyệt Giá Ngoài Catalog

- **Mã quy trình:** SOP-CB-01
- **Vai trò chịu trách nhiệm (RBAC):** `PURCHASER` (Nhân viên Mua hàng) / `SUPER_ADMIN`
- **Thời hạn cam kết (SLA):** Tối đa 4 giờ kể từ khi khách tạo đơn (hàng đợi chuyển màu đỏ cảnh báo khi quá 4 giờ).

---

## 1. Mục Đích
Đảm bảo mọi mặt hàng ngoài danh mục sẵn (link Amazon, Mercari, Rakuten, Yahoo Shopping hoặc qua Bookmarklet) đều được thẩm định tính chính xác của giá, tình trạng còn hàng và không vi phạm quy định hàng cấm bay quốc tế.

## 2. Các Bước Thao Tác
1. **Truy cập hàng đợi:** Mở trang Quản trị > tab **Hàng Đợi Duyệt Giá** (`/api/admin/orders/quote-queue`).
2. **Kiểm tra thông tin:**
   - Mở link gốc sản phẩm (`originalUrl`).
   - Đối chiếu giá Yên (JPY) thực tế trên sàn đối tác so với giá khách gửi.
   - Kiểm tra phụ phí nội địa Nhật (nếu người bán tính thêm phí ship trong nước Nhật).
   - Kiểm tra danh mục hàng hóa (tuyệt đối từ chối pin lithium rời, chất dễ cháy, bình xịt nén, hàng cấm IATA).
3. **Phê duyệt hoặc điều chỉnh:**
   - Nếu giá đúng: Bấm nút **Phê duyệt giá** (`POST /api/admin/orders/[id]/verify-quote`).
   - Nếu giá lệch: Nhập giá cập nhật chính xác và ghi chú rõ lý do vào hệ thống.
4. **Thông báo:** Hệ thống tự động gửi email cập nhật báo giá chính thức và hướng dẫn khách thanh toán đặt cọc.

## 3. Chứng Từ & Nơi Ghi Nhận
- **Bảng ghi:** `OrderItem` (cập nhật `quoteVerifiedAt`, `quoteVerifiedBy`), `Order` (`isPriceVerified = true`).
- **AuditLog Action:** `QUOTE_VERIFIED`.
- **TrackingLog:** "Báo giá đơn hàng đã được phê duyệt".

