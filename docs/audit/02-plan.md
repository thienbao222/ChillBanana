# Báo Cáo Kế Hoạch Tái Cấu Trúc (Planning) — Pha 2

- **Ngày lập:** 17/11/2026
- **Tác giả:** ChillBanana Lead Engineer
- **Trạng thái:** Chờ phê duyệt của Chủ dự án (DỪNG TẠI ĐÂY TRƯỚC PHA 3)

---

## 1. Đánh Giá 3 Phương Án Kiến Trúc

### Phương Án 1: Vá Tại Chỗ (Hotfix In-Place)
- **Mô tả:** Giữ nguyên toàn bộ cấu trúc hiện tại, chỉ sửa các dòng code bị lỗi (thêm `if (!isDemoMode())` vào `mock-sandbox`, thêm `DEPOSITED_70` vào các câu query/if, sửa fallback `0901234567` thành chuỗi rỗng).
- **Chi phí (Effort):** Rất thấp (1-2 ngày).
- **Rủi ro:** Cao về lâu dài. Code vẫn bị chắp vá, logic cọc và thanh toán phân tán ở nhiều nơi, dễ tiếp tục phát sinh lỗi mới khi kết nối cổng thanh toán thật.
- **Giữ dữ liệu & Migration:** Giữ nguyên schema, không cần migration.

---

### Phương Án 2: Tái Cấu Trúc Từng Mô-Đun Theo Lát Mỏng (Modular Refactoring by Thin Slices) — [KHUYẾN NGHỊ]
- **Mô tả:** Tái cấu trúc chuẩn hóa theo từng lát mỏng độc lập, giữ nguyên vẹn 399 unit tests hiện có và bổ sung test mới cho từng hành vi. Lần lượt xử lý:
  1. *Lát 1:* Khóa chặt bảo mật thanh toán & Sandbox (`mock-sandbox`, `mock-confirm`, `vnpay-return`).
  2. *Lát 2:* Mở thông luồng trạng thái cọc 70% (`DEPOSITED_70`) trên toàn hệ thống.
  3. *Lát 3:* Đồng bộ chính sách cọc & VietQR thành Một Nguồn Sự Thật (`Single Source of Truth`).
  4. *Lát 4:* Chuẩn hóa phân quyền RBAC: 100% route admin có khai báo `roles`.
  5. *Lát 5:* Tối ưu kinh tế đơn vị (phí dịch vụ tối thiểu) và sửa lỗi lint.
- **Chi phí (Effort):** Vừa phải (3-5 ngày). Các bước nhỏ, kiểm soát chặt chẽ.
- **Rủi ro:** Rất thấp. Mỗi lát đều có test bảo vệ, chạy typecheck, lint và test trước khi commit.
- **Giữ dữ liệu & Migration:** Hoàn toàn tương thích ngược, bảo toàn 100% dữ liệu lịch sử.

---

### Phương Án 3: Viết Lại Có Chọn Lọc (Selective Rewrite)
- **Mô tả:** Viết lại toàn bộ module thanh toán (`features/payments`) và các API routes quản trị theo kiến trúc mới tinh.
- **Chi phí (Effort):** Rất cao (2-3 tuần).
- **Rủi ro:** Cực cao. Dễ phá vỡ giao diện admin, frontend giỏ hàng, và phải viết lại hàng trăm test integration/e2e. Dễ tạo ra nhiều lỗi mới không mong muốn trong khi dự án cần ổn định để mở bán.
- **Giữ dữ liệu & Migration:** Cần migration lớn, rủi ro lệch dữ liệu lịch sử đơn hàng.

---

## 2. Lý Do Khuyến Nghị Phương Án 2

Phương án 2 đảm bảo đúng mục tiêu **"Cây đại thụ"**:
- Không đập phá những gì đang chạy tốt (bảo toàn 399 unit tests và luồng đơn cốt lõi).
- Khắc phục triệt để 4 lỗi nghiêm trọng và các lỗ hổng rò rỉ dòng tiền.
- Tiến hành theo các lát mỏng có thể kiểm chứng ngay lập tức bằng lệnh chạy thật.
- Phù hợp với năng lực quản trị và vận hành thực tế của ChillBanana.

---

## 3. Các Câu Hỏi Quyết Định Kinh Doanh Cần Chủ Dự Án Duyệt

1. **Mức đặt cọc:** Bạn có đồng ý với đề xuất đồng bộ giao diện giỏ hàng theo 3 bậc máy chủ (Đơn < 1M: cọc 100%; Đơn 1M-10M: cọc 70% hoặc 100%; Đơn > 10M: cọc 50%, 70% hoặc 100%) không?
2. **Phí dịch vụ tối thiểu:** Bạn có đồng ý nâng mức phí dịch vụ tối thiểu từ 20.000 đ lên 50.000 đ/đơn để bảo vệ chi phí xử lý kho Tokyo (tránh lỗ đơn nhỏ) không?
3. **Cấu hình VietQR:** Bạn có đồng ý loại bỏ hoàn toàn số tài khoản ảo `0901234567` và chuyển sang cơ chế fail-fast (báo lỗi cấu hình rõ ràng khi thiếu biến môi trường ngân hàng trên production) không?

---

> [!IMPORTANT]
> **CỔNG DỪNG BẮT BUỘC:** Kỹ sư trưởng đã hoàn tất Pha 0 và Pha 1, lập kế hoạch chi tiết tại artifact `re_architect_foundation_plan.md` và `tasks/plan.md`. Tôi DỪNG TẠI ĐÂY để chờ bạn duyệt kế hoạch và trả lời 3 câu hỏi kinh doanh trước khi bắt tay thực thi Pha 3.
