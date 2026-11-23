# SOP 06: Quy Trình Hủy Đơn & Hoàn Tiền Bằng Bút Toán Đảo

- **Mã quy trình:** SOP-CB-06
- **Vai trò chịu trách nhiệm (RBAC):** `ACCOUNTANT` (Hoàn tiền ≤ 500.000 đ) / `SUPER_ADMIN` (Hoàn tiền > 500.000 đ)
- **Thời hạn cam kết (SLA):** Xử lý hoàn tiền trong vòng 24 giờ sau khi yêu cầu hủy đơn được phê duyệt.

---

## 1. Mục Đích
Bảo toàn nguyên tắc bất biến kế toán tài chính: TUYỆT ĐỐI KHÔNG XÓA CỨNG bản ghi tài chính. Mọi khoản hoàn tác/hoàn tiền bắt buộc phải tạo bản ghi đảo (`kind = "REVERSAL"`) và đánh dấu bản ghi gốc `status = "VOIDED"`.

## 2. Các Bước Thao Tác
1. **Xác nhận lý do hủy đơn:**
   - Người bán Nhật hết hàng hoặc khách yêu cầu hủy trong thời gian cho phép.
   - Kiểm tra xem đơn đã mua hàng trên sàn Nhật chưa (nếu đã mua không thể hủy ngang trừ khi người bán đồng ý).
2. **Thực hiện hoàn tiền trong hệ thống:**
   - Vào chi tiết đơn hàng > mục **Thanh toán & Hoàn tiền**.
   - Bấm nút **Hoàn tiền**: Hệ thống tự động tạo bản ghi `PaymentTransaction` mới với `kind = "REVERSAL"`, số tiền mang dấu âm hoặc bằng đúng số tiền hoàn trả, gắn `reversalOfId` trỏ về giao dịch thu ban đầu.
   - Cập nhật bản ghi ban đầu sang `status = "VOIDED"`, ghi chú thời điểm hủy `voidedAt`.
3. **Chuyển khoản trả lại khách:**
   - Kế toán thực hiện chuyển khoản lại cho khách theo thông tin tài khoản ngân hàng khách cung cấp.
   - Nhập mã giao dịch ngân hàng vào hệ thống đối soát.

## 3. Chứng Từ & Nơi Ghi Nhận
- **Bảng ghi:** `PaymentTransaction` (`kind = REVERSAL`, `status = VOIDED`), `Order` (`status = CANCELLED`, `paymentStatus = REFUNDED`).
- **AuditLog Action:** `PAYMENT_REVERSED`.

