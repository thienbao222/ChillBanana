# SOP 03: Quy Trình Nhập Kho Tokyo, Cân Đo & Xuất Bay Quốc Tế

- **Mã quy trình:** SOP-CB-03
- **Vai trò chịu trách nhiệm (RBAC):** `WAREHOUSE` (Nhân viên Kho Tokyo)
- **Thời hạn cam kết (SLA):** Trong vòng 24 giờ sau khi bưu kiện tới kho Tokyo.

---

## 1. Mục Đích
Kiểm tra tình trạng nguyên vẹn của kiện hàng tại kho Tokyo, cân trọng lượng thực tế, kiểm tra dung sai cân nặng và đóng bao xuất bay quốc tế về Việt Nam.

## 2. Các Bước Thao Tác
1. **Kiểm tra khi nhận kiện:**
   - Quét mã vận đơn Sagawa/Yamato trên kiện hàng đối chiếu với mã đơn ChillBanana.
   - Kiểm tra ngoại quan bưu phẩm (móp méo, rách vỡ phải chụp ảnh đính kèm).
2. **Cân đo trọng lượng:**
   - Cân bưu kiện trên cân điện tử chuẩn đã hiệu chuẩn, nhập số cân chính xác `weightKg`.
   - **Áp dụng chính sách dung sai (WP3.3):**
     - Nếu cân thực tế lệch ≤ 5% hoặc ≤ 50g so với ước tính ban đầu: Hệ thống giữ nguyên cước, không tính thêm phụ phí cho khách.
     - Nếu lệch > 5% và > 50g: Hệ thống tự động tính lại cước quốc tế và cập nhật số dư cần thu đợt 2.
3. **Chuyển trạng thái xuất bay:**
   - Cập nhật đơn hàng sang `WAREHOUSE_JP` -> sau khi lên chuyến bay chuyển `IN_TRANSIT_AIR`.
   - Bắt buộc phải có `weightKg > 0` mới được phép chuyển trạng thái bay (rào chắn WP2.2).

## 3. Chứng Từ & Nơi Ghi Nhận
- **Bảng ghi:** `Order` (`weightKg`, `status`), `TrackingLog`.
- **AuditLog Action:** `ORDER_STATUS_UPDATE`.

