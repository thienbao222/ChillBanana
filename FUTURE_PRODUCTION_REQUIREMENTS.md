# 🚀 ĐIỀU KIỆN & LỘ TRÌNH CHUYỂN ĐỔI TỪ PRE-PRODUCTION SANG PRODUCTION THỰC TẾ
**Dự án:** ChillBanana.vn — Nền tảng Mua hộ & Vận chuyển Hàng Nội Địa Nhật Bản về Việt Nam  
**Phiên bản hiện tại:** Pre-Production (Next.js 15, TypeScript, Neon PostgreSQL, Gemini 2.5 Flash, Nodemailer)  
**Ngày lập:** Tháng 10/2026  

---

## 📑 MỤC LỤC
1. [Ranh Giới: Pre-Production vs. Production Thực Tế](#1-ranh-giới-pre-production-vs-production-thực-tế)
2. [Hồ Sơ Pháp Lý & Thuế Thương Mại Điện Tử (Việt Nam)](#2-hồ-sơ-pháp-lý--thuế-thương-mại-điện-tử-việt-nam)
3. [Cổng Thanh Toán: Hợp Đồng Doanh Nghiệp (Merchant Contracts)](#3-cổng-thanh-toán-hợp-đồng-doanh-nghiệp-merchant-contracts)
4. [Hậu Cần & Vận Chuyển: Hợp Đồng Đối Tác (Logistics APIs)](#4-hậu-cần--vận-chuyển-hợp-đồng-đối-tác-logistics-apis)
5. [Hạ Tầng Domain, Email Doanh Nghiệp & Bảo Mật](#5-hạ-tầng-domain-email-doanh-nghiệp--bảo-mật)
6. [Tài Khoản Mua Hàng & Pháp Nhân Kho Nhật Bản](#6-tài-khoản-mua-hàng--pháp-nhân-kho-nhật-bản)
7. [Checklist Chuyển Đổi Trước Giờ G (Go-Live Readiness)](#7-checklist-chuyển-đổi-trước-giờ-g-go-live-readiness)

---

## 1. Ranh Giới: Pre-Production vs. Production Thực Tế

| Tiêu Chí | Hệ Thống Pre-Production (Hiện Tại) | Hệ Thống Production Thực Tế (Thương Mại) |
|---|---|---|
| **Mục đích** | Thử nghiệm nghiệp vụ, demo cho nhà đầu tư/đối tác, hoàn thiện AI flow. | Giao dịch tài chính thật, chịu trách nhiệm pháp lý và nghĩa vụ thuế. |
| **Pháp nhân** | Chưa yêu cầu đăng ký kinh doanh. | Bắt buộc có Giấy phép ĐKKD hoặc Hộ kinh doanh cá thể. |
| **Bộ Công Thương** | Chưa cần thông báo website TMĐT. | **Bắt buộc** thông báo website TMĐT bán hàng với Bộ Công Thương (online.gov.vn). |
| **Thanh toán** | Sandbox VNPay / QR cá nhân / Mock Sandbox. | Hợp đồng VNPay Merchant chính thức, tài khoản ngân hàng doanh nghiệp. |
| **Logistics** | Adapter mô phỏng + Tracking webhook giả lập. | Hợp đồng B2B với GHN, GHTK, Viettel Post; hợp đồng kho vận Narita/Tokyo. |
| **Email & SMS** | SMTP Gmail / Console log / Zalo dev sandbox. | Tên miền riêng `@chillbanana.vn`, SendGrid/SES, Zalo OA xác thực tích vàng. |
| **Hạ tầng DB** | Neon PostgreSQL Serverless Free/Pro. | Neon Compute Autoscaling + Dedicated Read Replicas + Daily Point-in-time Recovery. |
| **Mua hàng** | Bán tự động (Admin xem gợi ý, click mua tay). | Tích hợp Rakuten Affiliate Partner chính thức, Yahoo Auction API thương mại. |

---

## 2. Hồ Sơ Pháp Lý & Thuế Thương Mại Điện Tử (Việt Nam)

### 2.1. Đăng Ký Kinh Doanh
- **Hình thức phù hợp:**
  - *Phương án A (Khởi điểm):* Hộ kinh doanh cá thể ngành nghề: Dịch vụ mua hộ hàng hoá, hỗ trợ thương mại điện tử, dịch vụ logistics.
  - *Phương án B (Quy mô lớn):* Công ty TNHH Một Thành Viên / Cổ Phần.
- **Mã ngành nghề đăng ký (VSIC):**
  - `4791`: Bán lẻ theo hình thức đặt hàng qua bưu điện hoặc qua Internet.
  - `5229`: Hoạt động dịch vụ hỗ trợ khác liên quan đến vận tải (giao nhận hàng hóa quốc tế).
  - `6201`: Lập trình máy vi tính (vận hành nền tảng công nghệ).

### 2.2. Thủ Tục Với Bộ Công Thương
- Đăng ký hồ sơ trực tuyến tại Cổng thông tin Quản lý hoạt động TMĐT: [online.gov.vn](http://online.gov.vn).
- Gắn logo **"Đã thông báo Bộ Công Thương"** có gắn link chứng nhận vào Footer website.
- Bắt buộc công bố đầy đủ trên website:
  - Chính sách bảo mật thông tin khách hàng (tuân thủ Nghị định 13/2023/NĐ-CP).
  - Quy định đổi trả, hoàn tiền và bảo hành hàng Nhật nội địa (hàng second-hand từ Mercari, Yahoo Auction).
  - Quy trình giải quyết khiếu nại và giới hạn trách nhiệm rủi ro vận chuyển hàng không.
  - Thông tin chủ sở hữu website (Mã số thuế, địa chỉ, người đại diện, số hotline).

### 2.3. Hóa Đơn Điện Tử & Nghĩa Vụ Thuế
- Đăng ký phát hành hóa đơn điện tử (Viettel Sinvoice, VNPT-Invoice, MISA meInvoice).
- Mô hình tính thuế cho dịch vụ mua hộ:
  - Thuế GTGT và Thuế TNDN tính trên **phí dịch vụ mua hộ** (Service Fee 3% - 5%) và **chênh lệch cước vận chuyển**, không tính trên toàn bộ trị giá hàng hóa gốc của khách.
  - Xuất hóa đơn dịch vụ mua hộ cho khách hàng yêu cầu.

---

## 3. Cổng Thanh Toán: Hợp Đồng Doanh Nghiệp (Merchant Contracts)

### 3.1. VNPay Payment Gateway
- **Hiện tại:** Sử dụng môi trường thử nghiệm `VNPAY_SANDBOX_URL` với `TMNCode` test.
- **Yêu cầu Production:**
  1. Ký hợp đồng dịch vụ chấp nhận thanh toán VNPay-QR và thẻ ATM/Visa nội địa.
  2. Bàn giao `TMN_CODE` production và `HASH_SECRET` production (HMAC-SHA512).
  3. Đăng ký địa chỉ IP Server tĩnh của hệ thống và cấu hình IPN URL chính thức: `https://chillbanana.vn/api/payment/vnpay-ipn`.
  4. Phí dịch vụ tham khảo: ~1.1% đến 1.8% trên mỗi giao dịch thành công.

### 3.2. Chuyển Khoản Ngân Hàng Tự Động (VietQR Pro / SeABank / MBBank Open API)
- **Hiện tại:** Quét mã VietQR cá nhân và Admin bấm xác nhận thủ công hoặc đối chiếu sao kê.
- **Yêu cầu Production:**
  1. Mở tài khoản thanh toán Doanh nghiệp (Techcombank, Vietinbank, MBBank).
  2. Tích hợp Webhook Báo Biến Động Số Dư (qua Casso.vn, SePay.vn hoặc ngân hàng trực tiếp).
  3. Hệ thống tự động đối chiếu cú pháp `KZN-xxxx-xxxx` để ghi nhận cọc trong 3 giây mà không cần con người can thiệp.

---

## 4. Hậu Cần & Vận Chuyển: Hợp Đồng Đối Tác (Logistics APIs)

### 4.1. Chặng Nội Địa Việt Nam (Last-Mile Delivery)
- **Giao Hàng Nhanh (GHN):**
  - Ký hợp đồng khách hàng doanh nghiệp để nhận chiết khấu vận chuyển và đối soát COD định kỳ.
  - Nhận `GHN_API_TOKEN` và `GHN_SHOP_ID` chính thức.
  - Tích hợp API tạo vận đơn tự động ngay khi hàng về tới kho Hà Nội/TP.HCM.
- **Giao Hàng Tiết Kiệm (GHTK) / Viettel Post:**
  - Tương tự GHN, cấp API Token chính thức để hệ thống so sánh giá cước thời gian thực giữa 3 hãng và chọn hãng tối ưu nhất cho khách.

### 4.2. Chặng Hàng Không Nhật - Việt (Cross-Border Air Cargo)
- Hợp đồng với đơn vị vận chuyển hàng không chuyên tuyến Nhật Bản (Tokyo Narita/Haneda ✈️ Hà Nội Nội Bài/TP.HCM Tân Sơn Nhất).
- Cam kết biểu phí cước bay ký hợp đồng (Tier 1: < 100kg/tháng, Tier 2: > 500kg/tháng).
- Thủ tục thông quan hải quan hàng phi mậu dịch hoặc tiểu ngạch/chính ngạch theo quy định hiện hành.

---

## 5. Hạ Tầng Domain, Email Doanh Nghiệp & Bảo Mật

### 5.1. Tên Miền & DNS
- Sở hữu tên miền thương hiệu: `chillbanana.vn` (đăng ký qua PA Việt Nam, Mắt Bão, hoặc Cloudflare Registrar).
- Cấu hình DNS qua Cloudflare (bật proxy DDoS Protection, WAF, SSL Strict Full).

### 5.2. Hạ Tầng Email Doanh Nghiệp (Transactional Email)
- Thay thế hoàn toàn SMTP Gmail cá nhân (vốn bị giới hạn 500 email/ngày và dễ vào Spam).
- Đăng ký dịch vụ chuyên nghiệp: **Resend**, **Amazon SES**, hoặc **SendGrid**.
- Cấu hình đầy đủ các bản ghi xác thực tên miền trên DNS:
  - **SPF:** `v=spf1 include:... ~all`
  - **DKIM:** Ký số điện tử cho mọi email gửi đi, chống giả mạo.
  - **DMARC:** `v=DMARC1; p=quarantine; rua=mailto:...`
  - **BIMI:** Hiển thị logo trái chuối ChillBanana cạnh tên người gửi trong hộp thư Gmail/Yahoo.

### 5.3. Zalo Official Account (Zalo OA) Doanh Nghiệp
- Nâng cấp Zalo OA lên tài khoản **Xác Thực Doanh Nghiệp** (Tích Vàng).
- Ký hợp đồng Zalo Notification Service (ZNS) để gửi thông báo biến động đơn hàng có mẫu duyệt trước bởi Zalo (tỷ lệ mở > 95%, không phụ thuộc spam filter của email).

### 5.4. Chống Spam Đăng Ký & Bảo Vệ Quota Email (Cloudflare Turnstile)
- **Rủi ro:** Kẻ tấn công dùng botnet hoặc proxy xoay IP liên tục (mỗi IP gửi 1 request) có thể vượt qua bộ đếm tần suất IP (`REGISTER_PER_IP`), kích hoạt lệnh gửi email xác nhận hàng loạt làm cạn kiệt quota gửi thư của hệ thống.
- **Cơ chế bảo vệ đa tầng đã tích hợp:**
  1. *Honeypot Trap (Đã kích hoạt):* Bẫy các bot tự động điền trường ẩn (`website`, `hpField`), từ chối request ngay lập tức và không gửi email.
  2. *Cloudflare Turnstile (Sẵn sàng kích hoạt):*
     - Tạo widget Turnstile miễn phí trên Cloudflare Dashboard.
     - Điền 2 biến môi trường trên Vercel:
       - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: Hiển thị widget xác thực trên modal/form đăng ký.
       - `TURNSTILE_SECRET_KEY`: Khóa bí mật xác thực token server-side tại `/api/auth/customer`.
     - Backend API sẽ tự động kích hoạt kiểm tra Captcha nghiêm ngặt 100% ngay khi biến `TURNSTILE_SECRET_KEY` được khai báo, bảo đảm an toàn tuyệt đối trước botnet.

---

## 6. Tài Khoản Mua Hàng & Pháp Nhân Kho Nhật Bản

### 6.1. Tài Khoản Mua Hàng Sàn Nhật
- Đăng ký tài khoản doanh nghiệp Amazon Business JP và Rakuten Merchant để nhận hóa đơn hoàn thuế nội địa Nhật (消費税 10%).
- Thẻ thanh toán quốc tế doanh nghiệp hoặc phương thức thanh toán trực tiếp qua Pay-easy / Combini (tiện lợi, an toàn hạn mức).

### 6.2. Địa Chỉ Kho Nhận Hàng Tại Nhật Bản
- Kho trung chuyển tại Tokyo hoặc Chiba (gần sân bay Narita) có nhân viên người Việt/Nhật tiếp nhận hàng, kiểm đếm ngoại quan, dán nhãn vận đơn và đóng gói chống sốc trước khi gửi ra sân bay.

---

## 7. Checklist Chuyển Đổi Trước Giờ G (Go-Live Readiness)

- [ ] Giấy phép ĐKKD và tài khoản ngân hàng doanh nghiệp đã kích hoạt.
- [ ] Website đã nộp hồ sơ thông báo Bộ Công Thương và hiển thị thông tin pháp lý ở Footer.
- [ ] VNPay Production Credentials đã thay thế toàn bộ key Sandbox trong file môi trường Vercel.
- [ ] Webhook biến động số dư ngân hàng đã kiểm thử thông luồng thành công.
- [ ] Tên miền chính thức `chillbanana.vn` đã trỏ về Vercel, SSL A+ trên SSL Labs.
- [ ] Email Transactional (Resend/SendGrid) đã vượt qua kiểm tra SPF/DKIM/DMARC (10/10 trên mail-tester.com).
- [ ] Cấu hình Cloudflare Turnstile (`TURNSTILE_SECRET_KEY` & `NEXT_PUBLIC_TURNSTILE_SITE_KEY`) để bảo vệ form đăng ký tài khoản.
- [ ] API Token 3 đơn vị vận chuyển Việt Nam (GHN, GHTK, VTP) đã nạp vào biến môi trường.
- [ ] Sao lưu cơ sở dữ liệu (Database Backup) định kỳ tự động đã được kích hoạt trên Neon/AWS S3.
- [ ] Toàn bộ test suite tự động (End-to-End & Integration Tests) đạt 100% Pass.
- [ ] Quy trình ứng phó sự cố (Incident Response Plan) và đường dây nóng hỗ trợ khẩn cấp sẵn sàng.
