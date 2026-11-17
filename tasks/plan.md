# Kế Hoạch Tái Cấu Trúc Nền Tảng (Re-Architect Foundation Plan)

- **Mã kế hoạch:** PLAN-CB-2026-FOUNDATION
- **Chế độ:** Chế độ B (Chương trình tái cấu trúc nền tảng)
- **Trạng thái:** MODE: B (approved)
- **Phương án lựa chọn:** **Phương án 2 — Tái cấu trúc từng mô-đun theo lát mỏng (Modular Refactoring by Thin Slices)**

---

## 1. Các Quyết Định Nghiệp Vụ & Thiết Kế Đã Thống Nhất Qua Phỏng Vấn (/grill-me)

1. **Chính sách đặt cọc trên giao diện:**
   - Giao diện giỏ hàng (`CartDrawer.tsx`) thích ứng theo 3 bậc của máy chủ (`calculateDepositV2`):
     - Đơn < 1.000.000 đ: Bắt buộc **100%** (chống bỏ cọc đơn nhỏ).
     - Đơn 1.000.000 đ - 10.000.000 đ: Cho chọn **70%** (mặc định) hoặc **100%**.
     - Đơn > 10.000.000 đ: Cho chọn **50%**, **70%** hoặc **100%**.
2. **Kinh tế đơn vị & Phí dịch vụ mua hộ:**
   - Nâng phí dịch vụ tối thiểu (`serviceFeeMinimumVnd`) từ **20.000 đ** lên **50.000 đ/đơn** (giữ nguyên tỷ lệ 4% cho đơn lớn). Đơn nhỏ tự động áp dụng 50.000 đ để bù đắp chi phí kho Tokyo (300 JPY ~ 51.000 đ) và ship nội địa VN, loại bỏ tình trạng lỗ ròng.
3. **Kênh thanh toán, Sandbox & VietQR:**
   - Cho phép mở VNPAY Sandbox cho người dùng trải nghiệm, nhưng đơn hàng thanh toán qua Sandbox phải được gắn cờ rõ ràng và **KHÔNG ĐƯỢC TỰ ĐỘNG ĐẨY SANG HÀNG ĐỢI MUA HÀNG BÊN NHẬT**.
   - Cấm front-channel tự ý chốt đơn từ trình duyệt. Khóa chặt endpoint `mock-sandbox`.
   - Loại bỏ hoàn toàn fallback STK giả `0901234567`. Nếu thiếu biến môi trường cấu hình ngân hàng trên production, hệ thống báo lỗi rõ ràng trên giao diện, fail-fast, tuyệt đối không dùng STK ảo.
4. **Phân quyền Quản trị RBAC:**
   - Mô hình 2 vai trò chuẩn: `SUPER_ADMIN` và `OPERATOR`.
   - `SUPER_ADMIN`: Toàn quyền tài chính, duyệt cọc VietQR, nhập chi phí, xác nhận hoàn tiền, cấu hình giá, xuất báo cáo và xem AuditLog.
   - `OPERATOR`: Thẩm định duyệt giá ngoài catalog, tạo và cập nhật tác vụ mua hàng Nhật Bản, cập nhật vận đơn và CSKH.
   - 100% API routes quản trị phải có khai báo `roles`.
5. **Chính sách Hủy đơn & Hoàn cọc:**
   - Chỉ `SUPER_ADMIN` mới được xác nhận Hoàn tiền.
   - Không bao giờ xóa cứng bản ghi; tạo bản ghi đảo `PaymentTransaction` loại `kind = "REVERSAL"`, tự động hoàn kho `stockSlots` catalog, gửi email thông báo và ghi `AuditLog`.

---

## 2. Lộ Trình 5 Lát Mỏng Triển Khai (Pha 3)

### Lát 1: Khóa Bảo Mật Thanh Toán, Phân Tách Sandbox Khỏi Hàng Đợi Mua Hàng
- Khóa chặt endpoint `src/app/api/payment/mock-sandbox/route.ts`: cấm khách hàng tự ý POST đổi trạng thái đơn hàng khi chạy production.
- Đảm bảo các giao dịch qua VNPAY Sandbox gắn cờ mô phỏng và không tự động chuyển trạng thái đơn hàng sang hàng đợi mua hàng thật (`PURCHASING_JP`).
- Loại bỏ hoàn toàn việc front-channel `vnpay-return` tự động chốt tiền từ request GET của browser.
- Viết unit test bảo vệ cho các quy tắc trên.

### Lát 2: Mở Thông Hoàn Toàn Trạng Thái Cọc 70% (`DEPOSITED_70`)
- Bổ sung `DEPOSITED_70` vào `PaymentStatus` trong `src/types/index.ts` và `prisma/schema.prisma`.
- Xóa bỏ rào cản tại `src/app/api/orders/[id]/route.ts:504` và `src/features/purchasing/service.ts:39`, cho phép đơn `DEPOSITED_70` chuyển sang `PURCHASING_JP` và tạo PurchaseTask bình thường.
- Cập nhật bộ lọc truy vấn tại `src/app/api/admin/purchase-tasks/orders/route.ts` và `src/app/api/admin/customers/route.ts`.
- Sửa hàm hoàn tác (rollback) để bảo toàn mức cọc 70% thay vì ép về 50%.
- Bổ sung test kiểm thử toàn diện cho vòng đời đơn cọc 70%.

### Lát 3: Đồng Bộ Luật Cọc UI-Server & Loại Bỏ VietQR Hardcode
- Cập nhật `src/components/CartDrawer.tsx` để hiển thị động các tùy chọn cọc theo đúng 3 bậc của `calculateDepositV2` (< 1M: 100%; 1M-10M: 70%, 100%; > 10M: 50%, 70%, 100%).
- Xóa bỏ toàn bộ fallback STK giả `"0901234567"` tại `src/app/tracking/page.tsx` và `src/components/NeoDaylightCosmos.tsx`. Nếu thiếu cấu hình, hiển thị cảnh báo cấu hình fail-fast.
- Tự động chuyển `status` sang `PURCHASING_JP` khi admin xác nhận chuyển khoản ngân hàng thành công tại `api/admin/orders/[id]/payments`.

### Lát 4: Chuẩn Hóa Phân Quyền RBAC 100% Route Admin (SUPER_ADMIN vs OPERATOR)
- Khai báo rõ ràng mảng `roles` cho toàn bộ các route trong `src/app/api/admin/`:
  - Route tài chính/cấu hình cao cấp (`payments`, `costs`, `close-period`, `reports`, `pricing-config`): chỉ `SUPER_ADMIN`.
  - Route vận hành đơn hàng/mua hàng (`orders/[id]`, `purchase-tasks`, `verify-quote`, `quote-queue`): `SUPER_ADMIN`, `OPERATOR`.
- Bổ sung test kiểm thử tự động quét 100% API admin phải có khai báo `roles`.

### Lát 5: Rào Chắn Lỗ Đơn Nhỏ & Sửa Lỗi Lint
- Cập nhật `serviceFeeMinimumVnd` từ 20.000 đ lên **50.000 đ** trong `src/features/pricing/calculator.ts` và `config.ts`.
- Sửa thẻ `<a>` thành `<Link>` tại `src/app/dat-hang/nhap/page.tsx:94` để đưa `next lint` về 0 errors.

---

## 3. Nghiệm Thu (Pha 4)
- Typecheck (`tsc --noEmit`): 0 errors.
- Lint (`next lint`): 0 errors.
- Unit tests: 100% pass (bao gồm các test mới).
- Production build: `next build` hoàn tất thành công.
- Báo cáo hoàn tất: `docs/audit/04-final.md`.
