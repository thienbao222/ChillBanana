# Danh Sách Các Hạng Mục Cần Con Người Thực Hiện (Needs Human) — ChillBanana

Tài liệu này ghi nhận toàn bộ các công việc cấu hình môi trường thật, pháp lý, bí mật và vận hành thực tế mà AI không được phép và không thể tự động thực hiện, theo quy chuẩn bảo mật `AGENTS.md`.

---

## 1. Cấu Hình Biến Môi Trường Bí Mật & Sản Xuất (Vercel / Hosting)

Cần cấu hình trực tiếp trên bảng điều khiển môi trường sản xuất (ví dụ Vercel Project Settings > Environment Variables):

| Biến môi trường | Mục đích / Mô tả | Giá trị khuyến nghị / Ví dụ |
| :--- | :--- | :--- |
| `APP_ENV` | Khóa các endpoint Mock / Sandbox (`/api/payment/mock-sandbox`, `/api/payment/mock-confirm`, `/payment/mock*`). Trả về HTTP 404 khi vào production. | `production` |
| `DATABASE_URL` | Chuỗi kết nối bảo mật đến Neon PostgreSQL Production (có SSL / pooled connection). | `postgresql://user:password@ep-xyz.ap-southeast-1.neon.tech/chillbanana?sslmode=require` |
| `ADMIN_INITIAL_PASSWORD` | Mật khẩu quản trị viên ban đầu để seed cơ sở dữ liệu nếu cần khởi tạo lại. Tối thiểu 8 ký tự mạnh. | `[Chuỗi ký tự ngẫu nhiên phức tạp]` |
| `ADMIN_SESSION_SECRET` | Khóa bí mật dùng để ký và giải mã session token cookie của Admin (`admin_session`). | `[Chuỗi 64 ký tự ngẫu nhiên hex/base64]` |
| `CUSTOMER_SESSION_SECRET` | Khóa bí mật ký session khách hàng và link tracking đơn hàng. | `[Chuỗi 64 ký tự ngẫu nhiên hex/base64]` |

---

## 2. Thông Tin Tài Khoản Thụ Hưởng VietQR Thật

Đã xóa hoàn toàn số tài khoản fallback tĩnh `0901234567`. Khi triển khai bán thật, con người phải nhập tài khoản thụ hưởng của doanh nghiệp:

| Biến môi trường | Mục đích / Mô tả | Giá trị ví dụ |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_BANK_ACCOUNT` | Số tài khoản ngân hàng thụ hưởng nhận chuyển khoản đơn hàng. | `1903xxxxxxxxxx` |
| `NEXT_PUBLIC_BANK_BIN` | Mã BIN ngân hàng theo chuẩn Napas / VietQR (ví dụ 970407 - Techcombank, 970436 - Vietcombank). | `970407` (hoặc tên ngân hàng `Techcombank`) |
| `NEXT_PUBLIC_BANK_ACCOUNT_NAME` | Tên chủ tài khoản ngân hàng (viết hoa không dấu theo chuẩn ngân hàng). | `CONG TY TNHH CHILLBANANA` |

*Lưu ý an toàn:* Nếu các biến này chưa được điền, hệ thống sẽ ẩn mã QR và hiện cảnh báo hướng dẫn khách hàng thay vì tạo mã QR rác.

---

## 3. Cổng Thanh Toán Trực Tuyến VNPAY Production

| Biến môi trường | Mục đích / Mô tả |
| :--- | :--- |
| `VNPAY_TMN_CODE` | Terminal ID do VNPAY cấp khi ký hợp đồng dịch vụ thanh toán doanh nghiệp. |
| `VNPAY_HASH_SECRET` | Khóa bảo mật ký kiểm tra chữ ký SHA512 do VNPAY cấp. |
| `VNPAY_URL` | URL cổng thanh toán chính thức (`https://pay.vnpay.vn/vpcpay.html`). |

---

## 4. Dịch Vụ Gửi Email Giao Dịch (SMTP / Transactional Email)

Cấu hình tài khoản SMTP doanh nghiệp (Resend, SendGrid, Amazon SES, hoặc Google Workspace SMTP Relay):

| Biến môi trường | Mục đích / Mô tả |
| :--- | :--- |
| `SMTP_HOST` | Địa chỉ máy chủ SMTP (ví dụ: `smtp.resend.com` hoặc `smtp.sendgrid.net`). |
| `SMTP_PORT` | Cổng máy chủ SMTP (thường là `465` hoặc `587`). |
| `SMTP_USER` | Tên đăng nhập / API Key SMTP. |
| `SMTP_PASS` | Mật khẩu / Secret API Key SMTP. |
| `SMTP_FROM` | Địa chỉ người gửi hiển thị (ví dụ: `ChillBanana <orders@chillbanana.com>`). |

---

## 5. Hợp Đồng Logistics & Tài Khoản Mua Hàng Tokyo Thực Tế

1. **Hợp đồng kho & cước bay Tokyo - Việt Nam:**
   - Ký kết hợp đồng vận chuyển hàng không với đối tác logistics theo các mức giá sàn: cước bay 185.000 đ/kg (hoặc cập nhật lại trong `PricingConfig`).
   - Thiết lập địa chỉ kho nhận hàng thực tế tại Tokyo để nhân viên hoặc đối tác nhận hàng nội địa Nhật.
2. **Tài khoản thu mua sàn Nhật:**
   - Đăng ký và nạp thẻ thanh toán quốc tế / JCB vào tài khoản mua hàng trên Amazon JP, Rakuten JP, Mercari JP, Yahoo Auctions.
   - Bổ sung hạn mức thẻ tín dụng thanh toán JPY để không bị gián đoạn khi mua hàng cho khách.

---

## 6. Chính Sách Pháp Lý & Thuế

1. **Rà soát danh mục hàng cấm & hạn chế:**
   - Định kỳ cập nhật danh mục thực phẩm cấm mang vào Việt Nam theo quy chuẩn Cục Thú y và MAFF Nhật Bản.
2. **Chính sách hoàn tiền & tranh chấp:**
   - Xác nhận quy trình hoàn cọc và mức phí phát sinh khi hàng hóa bị hủy bởi sàn Nhật hoặc người bán gian lận.
