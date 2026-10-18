# BÁO CÁO ĐỐI CHIẾU & ĐÁNH GIÁ MÃ NGUỒN: TỆP ZIP TẢI LÊN VS WORKSPACE HIỆN TẠI
**Hệ thống:** ChillBanana — Mua hàng Nhật Bản chuẩn (JP ⇄ VN)  
**Tài liệu đối chiếu:** Tệp nén tải lên (`media_..._e57b0e93.zip`) vs Mã nguồn Workspace hiện tại (`ChillBanana-main`)  
**Ngày lập:** 18/10/2026  
**Phương pháp:** Static File Diff, Hash MD5 Verification & Business Logic Audit  

---

## 1. TỔNG QUAN SO SÁNH

* **Tổng thể kiến trúc:** Cả hai phiên bản đều được xây dựng trên cùng một bộ khung nền tảng: Next.js 15 (App Router), Prisma ORM, Neon PostgreSQL, TailwindCSS, Vitest.
* **Độ tương đồng:** **Hơn 95% mã nguồn là giống nhau**. Toàn bộ 52/52 bài test unit/integration trong thư mục `tests/` có nội dung logic đồng nhất 100% (chỉ khác biệt về định dạng ký tự xuống dòng CRLF/LF).
* **Phạm vi khác biệt:** Toàn bộ hệ thống ghi nhận chính xác **24 tệp tin** có sự khác biệt thực tế về nội dung mã nguồn.

---

## 2. NHỮNG ĐIỂM SÁNG VƯỢT TRỘI TRONG TỆP ZIP (ƯU ĐIỂM)

Tệp zip chứa nhiều giải pháp nâng cấp nghiệp vụ và tự động hóa rất đắt giá:

1. **Đã đăng ký đủ 4 Cron Jobs trên Vercel (`vercel.json`):**
   * Tệp zip đã bổ sung đúng 2 cron còn thiếu: `/api/cron/expire-order-reservations` (hủy đơn ảo, giải phóng kho sau 30 phút) và `/api/cron/auto-tracking` (quét hành trình bay mỗi ngày).
2. **Cơ chế Tự động hóa Sổ cái VNPAY (`src/lib/vnpay-payment.ts`):**
   * Tệp zip đã viết sẵn cờ `PAYMENT_AUTO_CONFIRM_ORDER`: Khi VNPAY xác nhận giao dịch thành công, hệ thống **tự động cập nhật `order.paymentStatus = DEPOSITED_50`**, tự động chuyển sang `PURCHASING_JP`, tạo bản ghi `PaymentTransaction` và gửi email xác nhận cho khách hàng.
3. **Khóa State Machine tại route chính (`src/app/api/orders/[id]/route.ts`):**
   * Tệp zip đã có đoạn kiểm tra: Bắt buộc `effectiveWeightKg > 0` mới cho phép xuất kho bay `IN_TRANSIT_AIR`, đồng thời tự động tính lại cước bay quốc tế theo cân nặng thực tế.
4. **Tự động chuyển `WAREHOUSE_JP` qua Tracking (`src/app/api/cron/auto-tracking/route.ts`):**
   * Khi đơn vị vận chuyển nội địa Nhật (Sagawa/Yamato) phát hàng thành công tới Tokyo Hub (`result.isDelivered`), cron tự động nhảy trạng thái đơn sang `WAREHOUSE_JP` (Đã về kho Tokyo).
5. **Kho Hàng Mẫu Fallback (`src/components/CuratedProducts.tsx`):**
   * Tệp zip import sẵn `curated-products.json` làm fallback. Dù Database trống hay lỗi kết nối, website vẫn hiển thị mượt mà 10 sản phẩm hàng Nhật có sẵn với đầy đủ nút lọc danh mục.
6. **AI Neo tư vấn biểu phí chuyên sâu (`src/features/ai/customer/support-tools.ts`):**
   * Khi khách hỏi công thức tính giá chung, trợ lý Neo đọc trực tiếp cấu hình tỷ giá & biểu phí thật trong DB để giải thích minh bạch công thức cho khách hàng.
7. **Bảo mật Endpoint Mock Sandbox (`src/app/api/payment/mock-sandbox/route.ts`):**
   * Tệp zip đã gắn `requireAdmin(req)` vào route này, ngăn chặn kẻ xấu gọi API trực tiếp để tự cọc đơn.

---

## 3. NHỮNG LỖI NGHIÊM TRỌNG & THIẾU HỤT CỦA TỆP ZIP (NHƯỢC ĐIỂM)

Mặc dù có nhiều logic hay, tệp zip lại gặp phải **1 lỗi kỹ thuật chí mạng (Breaking Bug)** và **thiếu các bản vá QA mới nhất**:

> [!CAUTION]
> **LỖI CHÍ MẠNG (BUILD BREAKER):**
> Trong tệp zip, cả `src/app/api/products/route.ts` và `src/app/api/cron/expire-order-reservations/route.ts` đều có dòng code:
> ```typescript
> import { releaseExpiredOrderReservations } from "@/features/orders/reservations";
> ```
> **Tuy nhiên, tệp `src/features/orders/reservations.ts` HOÀN TOÀN KHÔNG CÓ TRONG ZIP** (người đóng gói zip đã quên đưa file này vào). Nếu deploy trực tiếp tệp zip này lên Vercel, tiến trình build sẽ **BÁO LỖI VÀ DỪNG NGAY LẬP TỨC**:
> `Module not found: Can't resolve '@/features/orders/reservations'`

Ngoài ra, tệp zip **chưa có các cải tiến QA mới hoàn thành trên workspace hiện tại**:
* Thiếu form tính cước chuyên biệt cho chiều **VN → JP** (tệp zip vẫn dùng chung form và chỉ bật toast gọi hotline).
* Thiếu **chips chọn nhanh trọng lượng kiện hàng** (0.3kg, 0.5kg, 1.0kg) để ước tính ngay số tiền tiết kiệm khi Gộp Đơn.
* Thiếu **checkbox cam kết điều khoản mua hộ** không hoàn cọc khi khách tự ý hủy đơn sau khi đã mua hàng.
* Mascot AI Neo trong zip bị cài đặt `wanderingEnabled = false`, nhưng z-index của modal chưa được tinh chỉnh đồng bộ.

---

## 4. BẢNG MA TRẬN ĐỐI CHIẾU 24 TỆP KHÁC NHAU

| Phân vùng | Tệp tin | Tệp Zip tải lên | Workspace hiện tại | Đánh giá |
| :--- | :--- | :--- | :--- | :--- |
| **Hạ tầng** | `vercel.json` | Đủ 4 cron jobs | Chỉ có 2 cron jobs | **Zip tốt hơn** |
| **Database** | `prisma/seed.ts` | Seed cả Products & SystemConfig | Chỉ seed SystemConfig | **Zip tốt hơn** |
| **Vercel Build**| `scripts/vercel-build.js` | Tự động chạy `prisma:seed` khi deploy | Không seed lúc build | **Zip tốt hơn** |
| **Core API** | `products/route.ts` | **LỖI import file thiếu `reservations`** | Tự inline logic an toàn, không lỗi | **Workspace an toàn hơn** |
| **Core API** | `cron/expire-order-reservations` | **LỖI import file thiếu `reservations`** | Tự inline logic xử lý DB an toàn | **Workspace an toàn hơn** |
| **Core API** | `orders/[id]/route.ts` | Có kiểm tra `weightKg > 0` trước khi bay | Thiếu kiểm tra cân nặng ở API PATCH | **Zip chặt chẽ hơn** |
| **Thanh toán** | `lib/vnpay-payment.ts` | Có `autoSettleOrder` tự đổi cọc 50% | Chưa tự đổi trạng thái đơn khi IPN | **Zip hoàn chỉnh hơn** |
| **Thanh toán** | `api/payment/mock-sandbox` | Đã có `requireAdmin` chặn hack cọc | Chưa gắn guard admin | **Zip bảo mật hơn** |
| **Giao diện** | `NeoDaylightCosmos.tsx` | Nhận diện link cũ, thiếu tab VN → JP | Đã có tab VN → JP, chips kg, cam kết cọc | **Workspace tốt hơn** |
| **Giao diện** | `CuratedProducts.tsx` | Có fallback 10 sản phẩm mẫu | DB trống thì hiện khung thông báo | **Zip đẹp hơn** |
| **Giao diện** | `AuthModal.tsx` | Có link "Quên mật khẩu?" | Thiếu link "Quên mật khẩu?" | **Zip tốt hơn** |
| **Giao diện** | `CartDrawer.tsx` | Có regex kiểm tra SĐT 10 số & Email | Chưa có regex số điện thoại | **Zip tốt hơn** |
| **AI Agent** | `support-tools.ts` | Trả lời biểu phí động chi tiết | Trả lời text tĩnh chung chung | **Zip thông minh hơn** |

---

## 5. ĐÁNH GIÁ TỔNG KẾT & KHUYẾN NGHỊ

* **Bản chất tệp zip:** Đây là một bản phát triển song song (branch thử nghiệm nâng cao) chứa nhiều ý tưởng và đoạn code xử lý nghiệp vụ rất sắc sảo của bạn hoặc nhóm phát triển.
* **Đánh giá rủi ro:** Không thể lấy toàn bộ file zip đè lên dự án vì sẽ bị **lỗi mất build (thiếu file `reservations.ts`)** và mất các tính năng QA đã fix trên workspace.
* **Chiến lược tối ưu nhất (Cherry-Pick / Hợp nhất tinh hoa):**
  Chúng ta nên giữ nguyên nền tảng workspace hiện tại (đang pass 100% build & test), và **hấp thụ có chọn lọc các điểm sáng nhất từ file zip**:
  1. Thêm 2 cron vào `vercel.json`.
  2. Bổ sung `autoSettleOrder` vào `vnpay-payment.ts`.
  3. Thêm điều kiện chặn `weightKg > 0` vào `PATCH /api/orders/[id]`.
  4. Đưa fallback sản phẩm mẫu vào `CuratedProducts.tsx`.
  5. Thêm link "Quên mật khẩu" vào `AuthModal.tsx` và regex SĐT vào `CartDrawer.tsx`.
  6. Viết hàm `releaseExpiredOrderReservations` chuẩn mực vào đúng vị trí để hệ thống trọn vẹn 100%.
