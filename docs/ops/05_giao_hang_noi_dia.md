# SOP 05: Quy Trình Giao Hàng Nội Địa & Đối Soát COD

- **Mã quy trình:** SOP-CB-05
- **Vai trò chịu trách nhiệm (RBAC):** `WAREHOUSE` (Kho VN) / `ACCOUNTANT`
- **Thời hạn cam kết (SLA):** Xuất kho giao nội địa trong vòng 24 giờ sau khi khách hoàn tất thanh toán.

---

## 1. Mục Đích
Bàn giao bưu phẩm cho đối tác vận chuyển nội địa (GHTK, Viettel Post, GHN), bảo đảm nguyên tắc tài chính cốt lõi: Chỉ giao hàng khi đã thu đủ 100% tiền hàng.

## 2. Các Bước Thao Tác
1. **Kiểm tra điều kiện xuất kho (Rào chắn WP3.3):**
   - Đơn hàng **bắt buộc** phải ở trạng thái `paymentStatus = "PAID_100"` mới được phép chuyển sang `LOCAL_DELIVERY`.
   - Trường hợp đặc biệt (khách B2B có hợp đồng bảo lãnh công nợ): Chỉ `SUPER_ADMIN` mới có quyền vượt quyền (override) giao hàng khi chưa PAID_100 và bắt buộc phải nhập lý do văn bản lưu vết vào `AuditLog`.
2. **Đóng gói & Tạo vận đơn:**
   - Đóng gói bọc bóng khí an toàn, dán nhãn vận chuyển mã đơn ChillBanana.
   - Bàn giao bưu tá lấy hàng, nhập mã vận đơn nội địa `vnDomesticTrack`.
3. **Hoàn tất đơn hàng:**
   - Khi bưu tá báo phát thành công: Chuyển trạng thái đơn sang `COMPLETED`.

## 3. Chứng Từ & Nơi Ghi Nhận
- **Bảng ghi:** `Order` (`status = LOCAL_DELIVERY`, `status = COMPLETED`), `TrackingLog`.
- **AuditLog Action:** `ORDER_STATUS_UPDATE` hoặc `OVERRIDE_DELIVERY_WITHOUT_FULL_PAYMENT`.

