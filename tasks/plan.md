# Kế Hoạch Hoàn Thiện Toàn Diện Dự Án (Project Completion Plan)

- **Mã kế hoạch:** PLAN-CB-2026-COMPLETION
- **Mục tiêu:** Khép kín 100% vòng đời mua hộ và chuẩn bị mở bán thương mại thực tế
- **Trạng thái:** Chờ phê duyệt (Pending Approval)

---

## 1. Bốn Điểm Nghẽn Cốt Lõi Cần Giải Quyết

1. **Khép kín luồng thu số dư đợt 2 tại Kho VN (`WAREHOUSE_VN`):**
   - Hiện tại: Đơn hàng cọc 50%/70% khi về kho VN bị chặn không cho sang `LOCAL_DELIVERY` vì chưa `PAID_100`. Cả giao diện và admin đều chưa có chức năng thanh toán/ghi nhận số dư đợt 2 (tiền hàng còn lại + cước bay).
   - Giải pháp: Xây dựng UI thanh toán số dư trên `/tracking`, mở rộng API admin `/api/admin/orders/[id]/payments` chấp nhận giao dịch loại `BALANCE` để chuyển đơn thành `PAID_100`.

2. **Hệ thống email thông báo tự động theo 5 mốc sự kiện:**
   - Bổ sung 5 template email tự động: Duyệt báo giá ngoài catalog, Mua hàng thành công tại Nhật, Nhập kho Tokyo, Hàng về kho VN kèm link tất toán đợt 2, và Bàn giao giao hàng nội địa kèm mã vận đơn.

3. **Webhook đối soát biến động số dư VietQR tự động:**
   - Xây dựng endpoint webhook `/api/payment/webhook/bank-transfer` an toàn với `WEBHOOK_SECRET`, tự động đối soát mã đơn hàng và chốt tiền cọc / tất toán số dư trong 3 giây.

4. **Quản lý giao hàng chặng cuối & SEO/Pháp lý:**
   - Tích hợp chọn hãng vận chuyển nội địa (GHTK, GHN, ViettelPost) và sinh link tra cứu trực tiếp.
   - Bổ sung `sitemap.ts`, `robots.ts`, và trang điều khoản dịch vụ mua hộ `/dieu-khoan-dich-vu`.

---

## 2. Lộ Trình Triển Khai 4 Gói Việc (Work Packages)

- **Gói 1 (WP1):** Luồng thu tiền đợt 2 tại kho VN & giải phóng giao hàng nội địa.
- **Gói 2 (WP2):** Hệ thống email thông báo 5 mốc vòng đời đơn hàng.
- **Gói 3 (WP3):** Webhook đối soát chuyển khoản ngân hàng VietQR tự động.
- **Gói 4 (WP4):** Quản lý giao hàng nội địa chặng cuối, Sitemap, Robots & Điều khoản dịch vụ.

---

## 3. Tiêu Chí Nghiệm Thu Kỹ Thuật
- Typecheck (`tsc --noEmit`): 0 errors.
- Lint (`next lint`): 0 errors.
- Unit tests: 100% pass (dự kiến nâng lên 470+ tests).
- Production build: `next build` hoàn tất sạch sẽ.
