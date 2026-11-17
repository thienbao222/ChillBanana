# Kế Hoạch Tái Cấu Trúc Nền Tảng (Re-Architect Foundation Plan)

- **Mã kế hoạch:** PLAN-CB-2026-FOUNDATION
- **Chế độ:** Chế độ B (Chương trình tái cấu trúc nền tảng)
- **Phương án lựa chọn:** **Phương án 2 — Tái cấu trúc từng mô-đun theo lát mỏng (Modular Refactoring by Thin Slices)**

---

## 1. So Sánh 3 Phương Án

| Tiêu chí | Phương án 1: Vá tại chỗ | Phương án 2: Tái cấu trúc theo lát mỏng (CHỌN) | Phương án 3: Viết lại có chọn lọc |
| :--- | :--- | :--- | :--- |
| **Mô tả** | Sửa nhanh từng dòng lỗi trên code hiện có | Tái cấu trúc chuẩn hóa từng miền nghiệp vụ theo lát mỏng có test đi kèm | Viết lại toàn bộ module thanh toán & admin APIs |
| **Chi phí / Thời gian** | Thấp (1-2 ngày) | Vừa phải (3-5 ngày) | Rất cao (2-3 tuần) |
| **Độ tin cậy lâu dài** | Kém, nợ kỹ thuật tích tụ | Rất cao, đạt chuẩn "cây đại thụ" | Cao nếu làm chuẩn, nhưng dễ sót edge cases |
| **Rủi ro hồi quy (Regression)** | Trung bình (sửa chỗ này hỏng chỗ khác) | Rất thấp (mỗi lát có test bảo vệ, 399 unit tests giám sát) | Rất cao (phá vỡ giao diện & integration tests) |
| **Bảo toàn dữ liệu** | Giữ nguyên 100% | Giữ nguyên 100%, migration chỉ thêm | Rủi ro migration phức tạp |

---

## 2. Lộ Trình Thực Thi 5 Lát Mỏng (Pha 3)

### Lát 1: Khóa Chặt Bảo Mật Thanh Toán & Mô Phỏng (Security Foundation)
- Khóa toàn bộ các route sandbox/mock (`/api/payment/mock-sandbox`, `mock-confirm`) bằng `isDemoMode()` hoặc `APP_ENV !== "production"`. Trả 404/403 khi chạy production.
- Loại bỏ hoàn toàn việc tự động chốt đơn ở front-channel (`vnpay-return`). Việc cập nhật trạng thái tiền chỉ cho phép qua IPN webhook back-channel.
- Viết test chứng minh `mock-sandbox` trả 404/403 trên production.

### Lát 2: Mở Thông Trạng Thái Cọc 70% (`DEPOSITED_70`)
- Bổ sung `DEPOSITED_70` vào `PaymentStatus` trong `src/types/index.ts` và comment trong `prisma/schema.prisma`.
- Xóa bỏ rào cản tại `src/app/api/orders/[id]/route.ts:504` và `src/features/purchasing/service.ts:39`, cho phép đơn `DEPOSITED_70` chuyển sang `PURCHASING_JP` và tạo PurchaseTask bình thường.
- Cập nhật bộ lọc truy vấn tại `src/app/api/admin/purchase-tasks/orders/route.ts` và `src/app/api/admin/customers/route.ts`.
- Sửa hàm hoàn tác (rollback) để bảo toàn mức cọc 70% thay vì ép về 50%.
- Viết unit test cho toàn bộ vòng đời đơn cọc 70%.

### Lát 3: Đồng Bộ Chính Sách Cọc & Ngân Hàng VietQR (Single Source of Truth)
- Cập nhật giao diện giỏ hàng `src/components/CartDrawer.tsx` để đồng bộ hoàn toàn với logic tính cọc `calculateDepositV2` của máy chủ. Hiển thị rõ ràng mức cọc thực tế (100% cho đơn < 1M, 70% cho đơn 1M-10M, 50% cho đơn > 10M).
- Xóa bỏ toàn bộ fallback VietQR hardcode `"0901234567"` tại `src/app/tracking/page.tsx` và `src/components/NeoDaylightCosmos.tsx`. Nếu thiếu cấu hình ngân hàng ở production, máy chủ và giao diện hiển thị cảnh báo cấu hình rõ ràng, fail-fast, không chuyển tiền ảo.
- Tự động chuyển `status` sang `PURCHASING_JP` khi admin xác nhận chuyển khoản ngân hàng thành công tại `api/admin/orders/[id]/payments`.

### Lát 4: Thắt Chặt Phân Quyền RBAC 100% Route Admin
- Khai báo rõ ràng mảng `roles` cho toàn bộ các route trong `src/app/api/admin/`:
  + Các route tài chính nhạy cảm (`payments`, `costs`, `close-period`, `reports`): chỉ `SUPER_ADMIN`.
  + Các route mua hàng & xử lý đơn (`purchase-tasks`, `verify-quote`, `orders/[id]`): `SUPER_ADMIN`, `OPERATOR`.
- Đồng bộ định nghĩa vai trò giữa code và tài liệu.
- Bổ sung test kiểm thử phân quyền cho các route vừa cập nhật.

### Lát 5: Rào Chắn Lỗ Cho Đơn Nhỏ (Unit Economics Protection)
- Điều chỉnh phí dịch vụ mua hộ tối thiểu (`serviceFeeMinimumVnd`) trong `PricingConfig` từ 20.000 đ lên mức đảm bảo bù đắp chi phí xử lý kho (khuyến nghị tối thiểu 50.000 đ - 70.000 đ / đơn).
- Đảm bảo rào chắn `belowMargin` cảnh báo chính xác cho đội ngũ quản trị.

---

## 3. Tiêu Chí Nghiệm Thu (Pha 4)
- Typecheck (`tsc --noEmit`): 0 errors.
- Lint (`next lint`): 0 errors (đã sửa lỗi thẻ `<a>` tại `src/app/dat-hang/nhap/page.tsx`).
- Unit tests: 100% tests pass (bao gồm các test mới cho cọc 70% và bảo mật sandbox).
- Production build: `next build` hoàn tất thành công.
- Báo cáo hoàn tất: `docs/audit/04-final.md`.
