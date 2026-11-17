# SOP 02: Quy Trình Mua Hàng Tại Nhật Bản & Ghi Nhận Chi Phí Thực

- **Mã quy trình:** SOP-CB-02
- **Vai trò chịu trách nhiệm (RBAC):** `PURCHASER` (Nhân viên Mua hàng)
- **Thời hạn cam kết (SLA):** Trong vòng 12 giờ làm việc sau khi đơn hàng đã cọc đủ (`DEPOSITED_50` hoặc `PAID_100`).

---

## 1. Mục Đích
Đặt mua chính xác sản phẩm trên sàn thương mại điện tử Nhật Bản, nhập mã vận đơn nội địa Nhật (Sagawa/Yamato) và ghi nhận chi phí thực mua hàng Yên Nhật (`GOODS_JPY`) để theo dõi lãi gộp.

## 2. Các Bước Thao Tác
1. **Tiếp nhận tác vụ:** Vào mục **Purchase Tasks** (`/api/admin/purchase-tasks`).
2. **Thực hiện mua hàng:**
   - Dùng tài khoản sàn của công ty để đặt mua sản phẩm đúng link và phân loại (size/màu).
   - Thanh toán qua thẻ tín dụng/kênh thanh toán công ty đã cấp.
3. **Cập nhật hệ thống:**
   - Nhập giá mua thực tế bằng Yên Nhật (`actualPriceJpy`).
   - Nhập mã đơn hàng đối tác (`partnerOrderId`) và mã vận đơn nội địa Nhật (`jpDomesticTrack`).
   - Nếu giá mua thực tế lệch > 5% so với báo giá ban đầu: Bắt buộc điền lý do chênh lệch giá.
4. **Chuyển trạng thái:** Đơn hàng tự động chuyển sang `PURCHASING_JP`.

## 3. Chứng Từ & Nơi Ghi Nhận
- **Bảng ghi:** `PurchaseTask` (chuyển `COMPLETED`), `OrderCostLine` (dòng chi phí `GOODS_JPY`).
- **AuditLog Action:** `PURCHASE_TASK_COMPLETED`.

