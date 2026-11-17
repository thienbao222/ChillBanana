# Hướng Dẫn Cấu Hình Và Tách Môi Trường (Demo vs Production)

**Cập nhật:** 04/11/2026 — Gói việc WP0.2  
**Tài liệu tham chiếu:** Kế hoạch phát triển Bản 3 (Mục 4.1 và WP0.2)

---

## 1. Mục tiêu và Nguyên tắc phân tách

Để đảm bảo an toàn dữ liệu và tuân thủ nguyên tắc bảo mật, hệ thống ChillBanana được tách biệt hoàn toàn giữa hai môi trường:
- **Môi trường Demo:** Dành cho trưng bày sản phẩm, chấm đồ án, chạy thử luồng. Cho phép chế độ tự phục hồi admin (`ENABLE_DEMO_SELF_HEAL=true`), dữ liệu mẫu, mailer giả lập (`mock`), khóa AI giới hạn hạn mức (Free tier).
- **Môi trường Production:** Dành cho vận hành thật. Tuyệt đối không bật cờ tự phục hồi, không có mật khẩu mặc định, CSDL độc lập, secret phiên bảo mật riêng biệt, mailer thật (`smtp`), khóa AI chính thức.

> [!IMPORTANT]
> Toàn bộ việc tạo database trên Neon và thiết lập biến môi trường trên Vercel do **BẠN (người quản trị) tự thực hiện bằng tay**. AI Agent tuyệt đối không chạm vào database hoặc biến môi trường production.

---

## 2. Bảng Ma Trận Biến Môi Trường (Environment Variables Matrix)

| Tên biến môi trường | Môi trường Demo | Môi trường Production | Ghi chú & Ý nghĩa bảo mật |
| --- | --- | --- | --- |
| `APP_ENV` | `demo` | `production` | Định danh môi trường thực thi. |
| `ENABLE_DEMO_SELF_HEAL` | `true` | `false` (hoặc không đặt) | Chỉ bật `true` trên demo. Bị chặn tuyệt đối trên production. |
| `DATABASE_URL` | Neon DB Demo riêng (`-pooler`) | Neon DB Production riêng (`-pooler`) | Hai branch/database Neon tách hẳn nhau. |
| `DIRECT_URL` | Neon Direct Host Demo | Neon Direct Host Production | Host không có `-pooler`, dùng cho `prisma migrate deploy`. |
| `ADMIN_INITIAL_PASSWORD` | Mật khẩu demo công khai (ví dụ: mật khẩu chấm thi) | **KHÔNG ĐẶT** | Tuyệt đối không đặt trên production để tránh ghi đè mật khẩu admin. |
| `ADMIN_SESSION_SECRET` | Secret ngẫu nhiên riêng (32 bytes hex) | Secret ngẫu nhiên riêng (32 bytes hex) | Sinh bằng `openssl rand -hex 32`. Hai môi trường khác nhau hoàn toàn. |
| `CUSTOMER_SESSION_SECRET` | Secret ngẫu nhiên riêng (32 bytes hex) | Secret ngẫu nhiên riêng (32 bytes hex) | Sinh bằng `openssl rand -hex 32`. |
| `CRON_SECRET` | Secret ngẫu nhiên riêng (32 bytes) | Secret ngẫu nhiên riêng (32 bytes) | Khóa bảo vệ endpoint Vercel cron jobs. |
| `PAYMENT_MODE` | `mock` | `mock` (hoặc `sandbox` test) | Mặc định an toàn là `mock`. Cấm `live` ở giai đoạn này. |
| `PAYMENT_AUTO_CONFIRM_ORDER` | `true` (để demo duyệt nhanh) | `false` (đợi đối soát thực) | Tự động hoàn tất thanh toán mô phỏng cho trải nghiệm demo. |
| `EMAIL_MODE` | `mock` | `smtp` (hoặc `mock` nếu chưa chạy thật) | Demo dùng `mock` để ghi `EmailLog` mà không gửi email rác ra ngoài. |
| `SMTP_HOST` / `PORT` / `USER` / `PASS` | Để trống | Thông tin SMTP Gmail/SendGrid thật | Thông tin nhạy cảm của dịch vụ gửi thư. |
| `GEMINI_API_KEY` | Khóa API Gemini phụ (hạn mức thấp) | Khóa API Gemini chính thức | Ngăn cản demo làm cạn hạn mức của production. |
| `NEXT_PUBLIC_APP_URL` | URL domain Vercel Demo (https) | URL domain Vercel Production chính (https) | Dùng để tạo link xác nhận email và webhook callback. |

---

## 3. Checklist Các Việc Bạn Cần Làm Thủ Công Trên Vercel & Neon

### 3.1 Trên Neon Console (https://console.neon.tech)
- [ ] **Tạo 2 Branch hoặc 2 Project tách biệt**:
  - `chillbanana-prod`: Dành riêng cho dữ liệu thật, bật Point-in-time Restore (PITR).
  - `chillbanana-demo`: Dành riêng cho dữ liệu demo, có thể reset bất cứ lúc nào.
- [ ] **Lấy 2 cặp connection string riêng biệt**:
  - `DATABASE_URL` (kết nối pooler) và `DIRECT_URL` (kết nối direct) cho từng branch.

### 3.2 Trên Vercel Dashboard (https://vercel.com)
- [ ] **Tạo 2 dự án riêng biệt trên Vercel**:
  - Dự án 1: `chillbanana-demo` (gắn branch git `demo` hoặc deployment demo).
  - Dự án 2: `chillbanana-production` (gắn branch git `main`).
- [ ] **Cấu hình Environment Variables cho `chillbanana-demo`**:
  - Đặt `APP_ENV="demo"`
  - Đặt `ENABLE_DEMO_SELF_HEAL="true"`
  - Đặt `ADMIN_INITIAL_PASSWORD="<mật khẩu bạn chọn cho demo>"`
  - Đặt `EMAIL_MODE="mock"`
  - Đặt `PAYMENT_MODE="mock"`
  - Cấu hình khóa Gemini phụ.
- [ ] **Cấu hình Environment Variables cho `chillbanana-production`**:
  - Đặt `APP_ENV="production"`
  - Đặt `ENABLE_DEMO_SELF_HEAL="false"` (hoặc xóa biến)
  - **XÓA biến `ADMIN_INITIAL_PASSWORD`** (tuyệt đối không để lại biến này)
  - Sinh secret phiên mới:
    ```bash
    openssl rand -hex 32 # Điền vào ADMIN_SESSION_SECRET
    openssl rand -hex 32 # Điền vào CUSTOMER_SESSION_SECRET
    openssl rand -hex 32 # Điền vào CRON_SECRET
    ```
  - Cấu hình SMTP thật nếu muốn gửi email thông báo.

### 3.3 Đổi mật khẩu tài khoản Admin trên Production
Sau khi deploy dự án production lên Vercel:
- Dùng tiện ích CLI `set-admin.js` chạy một lần duy nhất với chuỗi kết nối production trực tiếp hoặc qua Prisma Studio:
  ```powershell
  $env:DATABASE_URL="postgresql://...production..."
  node scripts/set-admin.js admin MatKhauManhQuanTri@2026!
  ```
- Sau đó xóa lịch sử terminal / PowerShell và kiểm tra đăng nhập trên URL production thật.

