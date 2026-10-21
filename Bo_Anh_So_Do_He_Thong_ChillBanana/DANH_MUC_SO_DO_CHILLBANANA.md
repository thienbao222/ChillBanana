# 📚 DANH MỤC & CHÚ THÍCH BỘ ẢNH SƠ ĐỒ HỆ THỐNG CHILLBANANA
*Dành cho Báo cáo Đồ án, Slide Thuyết trình & Khóa luận Tốt nghiệp*

---

## 📂 Vị Trí Lưu File Trên Máy Tính Của Bạn:
* **Thư mục Downloads:** `C:\Users\TBao\Downloads\ChillBanana_Bo_Anh_So_Do_Kien_Truc\`
* **Thư mục Trong Dự Án:** `D:\BAITAP\ChillBanana-main\Bo_Anh_So_Do_He_Thong_ChillBanana\`

---

## 🖼️ BẢNG TỔNG HỢP & CHÚ THÍCH CHI TIẾT TỪNG ẢNH:

| STT | Tên File Ảnh | Thể Loại | Mục Đích Sử Dụng & Nội Dung Chú Thích |
| :---: | :--- | :---: | :--- |
| **01** | `01_Mo_Hinh_Kien_Truc_2_Chieu_Song_Song_Doc_Lap.png` | Kiến trúc | **Mô hình song song 2 chiều độc lập:** Phân tách rõ ràng giữa chiều Mua Hộ JP ➔ VN (E-commerce) và Ký Gửi VN ➔ JP (Forwarding Logistics). Giải thích lý do không bị lỗi Domino và bảo toàn 106 test. |
| **02** | `01_So_Do_Luong_Hoat_Dong_Tuyen_VN_Sang_JP.png` | Flowchart Khối | **Quy trình gửi hàng VN ➔ JP (6 bước ngang):** Khách điền Web + cam kết MAFF ➔ Sinh mã VNJP ➔ Admin nhận đơn cột Mới Tiếp Nhận ➔ Gọi điện rà soát hàng cấm ➔ Kho VN cân đo IATA ➔ Bay Narita & Yamato giao tận tay. |
| **03** | `02_So_Do_Luong_Hoat_Dong_Tuyen_JP_Ve_VN_Mua_Ho.png` | Flowchart Khối | **Quy trình mua hộ hàng Nhật JP ➔ VN (7 bước ngang):** Dán link Amazon/Mercari ➔ AI bóc tách giá Yên ➔ Đặt cọc 50%-100% qua VietQR/VNPay ➔ Nhân viên Tokyo mua hàng ➔ Nhập kho Tokyo & bay ➔ Phân loại kho VN ➔ GHTK giao tận nhà & Tra cứu /tracking. |
| **04** | `02_So_Do_Use_Case_Tong_The_Cac_Ben_Tham_Gia.png` | Use Case UML | **Sơ đồ Use Case giữa 7 tác nhân:** Người gửi VN, Điều phối viên ChillBanana, Bưu tá lấy hàng VN, Kho hàng không IATA, Hải quan & MAFF kiểm dịch, Hãng giao vận Nhật (Yamato/Sagawa), Người nhận tại Nhật Bản. |
| **05** | `03_Quy_Trinh_Nghiep_Vu_Chi_Tiet_6_Giai_Doan_End_To_End.png` | Pipeline | **Chuỗi cung ứng 6 giai đoạn khép kín:** Giải thích chi tiết các điểm chạm rủi ro (Risk Points) và hành động xử lý (Action Points) xuyên suốt hành trình bay từ Việt Nam sang Nhật. |
| **06** | `03_So_Do_Kien_Truc_Tong_The_Full_Stack_ChillBanana.png` | 5-Layer Arch | **Kiến trúc Full-Stack 5 Tầng:** Presentation (React 18, Tailwind, NeoDaylight) ➔ API Gateway & Bảo Mật (JWT, RateLimit) ➔ Core Business & AI Engines ➔ External Integrations (Gemini, VNPay, VietQR, SMTP) ➔ Persistence (PostgreSQL, Prisma). |
| **07** | `04_So_Do_Hai_Luong_Tac_Nghiep_Song_Song_Trong_Admin.png` | Bàn Quản Trị | **Phân nhánh 2 Bàn Tác Nghiệp Song Song:** Thanh chuyển chế độ Header (Dashboard, Tác nghiệp JP➔VN Kanban 7 bước, Điều phối VN➔JP Kanban 5 bước) giúp chuyển đổi qua lại mượt mà. |
| **08** | `04_Vong_Doi_Trang_Thai_Kanban_5_Buoc_Admin.png` | Kanban UI | **Chi tiết 5 cột Kanban Điều Phối VN ➔ JP:** 1. Mới tiếp nhận (nút Gọi điện) ➔ 2. Đã chốt & chờ lấy ➔ 3. Kho VN cân đo IATA ➔ 4. Đang bay sang JP ➔ 5. Giao thành công. |
| **09** | `05_Co_Che_Kiem_Soat_Hang_Cam_MAFF_Va_Tinh_Cuoc_IATA.png` | Compliance | **Cơ chế 3 lớp phòng ngự hàng cấm MAFF & Cước IATA:** Giải pháp chống gian dối thực phẩm cấm (thịt/xúc xích) và công thức tính cước thể tích $(D \times R \times C / 5000)$. |
| **10** | `05_So_Do_Kien_Truc_3_Khoi_Client_Backend_Admin_Song_Song.png` | Hệ Thống | **Kiến trúc 3 khối Client - Backend - Admin:** Thể hiện luồng dữ liệu độc lập từ Form Web ➔ API `/api/vn-jp-shipments` ➔ Bảng `VnJpShipment` ➔ Bàn điều phối Admin. |
| **11** | `06_So_Do_Luong_Tu_Van_AI_Agent_Va_Thu_Thap_Lead.png` | AI Agent Flow | **Luồng hoạt động của ChillBanana AI Agent:** Khách chat ➔ Rate Limiter kiểm tra IP ➔ Support Tools tra cứu ➔ Gemini 1.5 phản hồi ➔ Tách tên/SĐT ➔ Lưu Chat Lead CRM. |

---

## 🎯 Gợi Ý Cách Chèn Vào Slide Báo Cáo / Đồ Án:
1. **Slide 1 (Tổng quan đề tài):** Dùng ảnh `03_So_Do_Kien_Truc_Tong_The_Full_Stack_ChillBanana.png` để giới thiệu công nghệ và kiến trúc toàn bộ website.
2. **Slide 2 (Dịch vụ chủ lực Mua Hộ JP ➔ VN):** Dùng ảnh `02_So_Do_Luong_Hoat_Dong_Tuyen_JP_Ve_VN_Mua_Ho.png`.
3. **Slide 3 (Dịch vụ mở rộng Ký Gửi VN ➔ JP):** Dùng ảnh `01_So_Do_Luong_Hoat_Dong_Tuyen_VN_Sang_JP.png` và ảnh `05_So_Do_Kien_Truc_3_Khoi_Client_Backend_Admin_Song_Song.png`.
4. **Slide 4 (Nghiệp vụ Logistics thực tế):** Dùng ảnh `05_Co_Che_Kiem_Soat_Hang_Cam_MAFF_Va_Tinh_Cuoc_IATA.png` để ghi điểm tuyệt đối về hiểu biết kiểm dịch MAFF và quy tắc IATA.
5. **Slide 5 (Bàn điều hành Quản trị viên):** Dùng ảnh `04_So_Do_Hai_Luong_Tac_Nghiep_Song_Song_Trong_Admin.png` hoặc `04_Vong_Doi_Trang_Thai_Kanban_5_Buoc_Admin.png`.
