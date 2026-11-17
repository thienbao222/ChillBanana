# SOP 08: Quy Trình Đóng Sổ Tài Chính Cuối Tháng (Monthly Closing)

- **Mã quy trình:** SOP-CB-08
- **Vai trò chịu trách nhiệm (RBAC):** `SUPER_ADMIN` (đóng sổ) kết hợp `ACCOUNTANT` (đối soát)
- **Thời hạn cam kết (SLA):** Trước ngày mùng 5 của tháng kế tiếp.

---

## 1. Mục Đích
Khóa cứng toàn bộ số liệu tài chính của kỳ kế toán tháng trước, đối soát tổng doanh thu dịch vụ, tổng chi phí mua hàng và chi phí vận chuyển, tính toán chính xác lãi gộp và ngăn chặn việc sửa đổi số liệu hồi tố.

## 2. Các Bước Thao Tác
1. **Đối soát số liệu trước khi chốt:**
   - Kế toán chạy báo cáo tài chính V2 (`/api/admin/reports`).
   - Xuất file CSV báo cáo (`/api/admin/reports/export?from=...&to=...`) để kiểm tra từng dòng đơn hàng.
   - Kiểm tra mọi đơn hàng hoàn tất trong tháng đã được nhập đủ dòng chi phí thực (`OrderCostLine`) hay chưa.
2. **Thực hiện đóng sổ:**
   - Super Admin truy cập API đóng sổ: `POST /api/admin/finance/close-period` kèm mã kỳ (VD: `{"period": "2026-10"}`).
   - Hệ thống tự động snapshot: Tổng GMV, Doanh thu dịch vụ, Chi phí thực tế, Lãi gộp, Số lượng đơn hàng vào bảng `PeriodClose`.
3. **Hiệu lực khóa cứng:**
   - Sau khi kỳ kế toán đã đóng, hệ thống chặn mọi thao tác sửa trực tiếp số tiền hoặc trạng thái của các đơn hàng trong kỳ đó.
   - Mọi điều chỉnh kế toán phát sinh sau ngày đóng sổ bắt buộc phải thực hiện trong kỳ kế toán hiện hành thông qua bút toán đảo.

## 3. Chứng Từ & Nơi Ghi Nhận
- **Bảng ghi:** `PeriodClose`.
- **AuditLog Action:** `PERIOD_CLOSED`.

