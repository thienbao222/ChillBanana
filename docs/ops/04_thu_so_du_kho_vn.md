# SOP 04: Quy Trình Nhập Kho Việt Nam & Chốt Thu Số Dư Đợt 2

- **Mã quy trình:** SOP-CB-04
- **Vai trò chịu trách nhiệm (RBAC):** `WAREHOUSE` (Kho VN) / `ACCOUNTANT` (Kế toán)
- **Thời hạn cam kết (SLA):** Trong vòng 12 giờ sau khi kiện hàng thông quan về kho Hà Nội/TP.HCM.

---

## 1. Mục Đích
Kiểm đếm kiện hàng khi hạ cánh tại Việt Nam, kích hoạt thông báo thanh toán khoản công nợ còn lại (tiền hàng đợt 2 + cước quốc tế chốt) trước khi xuất giao nội địa.

## 2. Các Bước Thao Tác
1. **Quét nhập kho:** Quét mã kiện hàng về kho Việt Nam, chuyển trạng thái sang `WAREHOUSE_VN`.
2. **Kiểm tra công nợ:**
   - Hệ thống tự động tính số dư cần thu: `remainingBalanceVnd = Math.max(0, totalVnd - depositAmountVnd)`.
   - Nếu `remainingBalanceVnd > 0`: Gửi email/Zalo thông báo chốt công nợ đợt 2 kèm mã VietQR chứa đúng cú pháp mã đơn.
3. **Nhắc nợ tự động:** Cron job chạy định kỳ tự động nhắc các đơn lưu kho VN quá 3 ngày chưa thanh toán nốt.
4. **Đối soát thanh toán:** Khi khách chuyển khoản đủ:
   - Kế toán xác nhận hoặc webhook VietQR tự động cập nhật `paymentStatus = "PAID_100"`.

## 3. Chứng Từ & Nơi Ghi Nhận
- **Bảng ghi:** `Order` (`paymentStatus`), `PaymentTransaction` (loại `BALANCE`).
- **AuditLog Action:** `PAYMENT_CONFIRMED`.

