# Ma Trận Phân Quyền Theo Vai Trò Quản Trị (Role-Based Access Control — RBAC)

Tài liệu này xác định ma trận kiểm soát truy cập và nguyên tắc phân quyền trên toàn bộ hệ thống API Quản trị ChillBanana theo chuẩn an ninh WP7.1.

---

## 1. Danh Mục Các Vai Trò Quản Trị (Admin Roles)

| Vai trò (Role) | Trách nhiệm chính |
| :--- | :--- |
| **`SUPER_ADMIN`** | Quản trị viên tối cao: Toàn quyền cấu hình hệ thống, quản lý tài khoản admin, xem/sửa cấu hình giá, hoàn tiền ngoại lệ, vượt quyền giao hàng, đóng sổ tài chính cuối tháng. |
| **`PURCHASER`** | Nhân viên Mua hàng: Quản lý hàng đợi báo giá (quote-queue), duyệt giá đơn hàng ngoài catalog, xử lý tác vụ mua hàng (Purchase Tasks), ghi nhận giá mua thực tế JPY. |
| **`WAREHOUSE`** | Nhân viên Kho vận: Quản lý cân đo hàng hóa, nhập kho Tokyo, xuất kho bay quốc tế, nhập kho Việt Nam, theo dõi mã vận đơn (Tracking). |
| **`ACCOUNTANT`** | Kế toán viên: Xem báo cáo tài chính, xuất báo cáo CSV, kiểm tra dòng chi phí thực (`OrderCostLine`), đối soát thanh toán và dòng tiền. |
| **`SUPPORT`** | Nhân viên Chăm sóc khách hàng: Tra cứu đơn hàng, hỗ trợ tin nhắn AI chat, xem thông tin vận chuyển, giải quyết thắc mắc khách hàng. |
| **`OPERATOR`** *(Legacy)* | Vai trò vận hành cũ: Được hệ thống tự động ánh xạ tương đương gồm cả 3 vai trò `PURCHASER`, `WAREHOUSE`, và `SUPPORT` để bảo đảm tính tương thích ngược và không làm gián đoạn công việc của nhân viên hiện hữu. |

---

## 2. Ma Trận Phân Quyền Hành Động (Action Permission Matrix)

| Chức năng / Hành động API | `SUPER_ADMIN` | `PURCHASER` | `WAREHOUSE` | `ACCOUNTANT` | `SUPPORT` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Đổi Cấu hình giá (`PricingConfig`)** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Mô phỏng giá (`pricing-simulation`)** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Duyệt báo giá ngoài catalog (`verify-quote`)** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Thực hiện mua hàng JP (`purchase-tasks`)** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Cập nhật cân nặng / trạng thái kho** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Vượt quyền giao khi chưa PAID_100** | ✅ (bắt buộc lý do) | ❌ | ❌ | ❌ | ❌ |
| **Xem báo cáo tài chính & Xuất CSV** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Nhập chi phí thực từng khâu (`costs`)** | ✅ | ✅ (phí hàng) | ✅ (cước) | ✅ | ❌ |
| **Hoàn tiền lớn (> 500.000 đ)** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Tạo & Quản lý chiến dịch (`Campaign`)** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Phân bổ cước lô (`allocate-freight`)** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Đóng sổ tài chính tháng (`PeriodClose`)** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Ẩn danh hóa dữ liệu cá nhân khách hàng** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Tra cứu đơn hàng & Phiếu VN → JP** | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 3. Danh Sách Ngoại Lệ Công Khai (Public Whitelist)

Các endpoint dưới đây nằm trong thư mục `/api/admin` nhưng phục vụ cơ chế xác thực hoặc chống CSRF nên không yêu cầu đăng nhập trước:
1. `src/app/api/admin/auth/route.ts` (Endpoint đăng nhập admin / lấy thông tin phiên).
2. `src/app/api/admin/csrf/route.ts` (Endpoint cấp phát CSRF token).

Tất cả các endpoint còn lại dưới `src/app/api/admin/**` **bắt buộc 100%** phải gọi `requireAdmin` hoặc `requireRole`.

