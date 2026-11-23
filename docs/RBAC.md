# Ma Trận Phân Quyền Theo Vai Trò Quản Trị & Kiến Trúc AI Agent Workspace (RBAC — Phương Án B)

Tài liệu này xác định ma trận kiểm soát truy cập (Role-Based Access Control — RBAC) và kiến trúc phân quyền hiện đại trên toàn bộ hệ thống API Quản trị ChillBanana theo Phương án B (WP7.1 & R4).

---

## 1. Triết Lý Kiến Trúc Phân Quyền: Phương Án B

Thay vì chia cắt tài khoản quản trị người thật thành 5 vai trò phân mảnh tĩnh (`PURCHASER`, `WAREHOUSE`, `ACCOUNTANT`, `SUPPORT`) gây lãng phí nhân sự và nghẽn luồng xử lý ở quy mô doanh nghiệp vừa và nhỏ, ChillBanana áp dụng **Kiến trúc Vận hành Tinh gọn kết hợp Tác tử Thông minh (Lean Operations with Agentic AI Workspace)**:

1. **Hai vai trò Quản trị Người thật (Human Admin Roles)**:
   - **`SUPER_ADMIN` (Quản trị viên Cấp cao)**: Nắm toàn quyền hệ thống, phê duyệt chính sách giá, đóng sổ tài chính, kiểm soát cấu hình bảo mật, phân quyền tài khoản và xử lý các ngoại lệ nghiệp vụ.
   - **`OPERATOR` (Chuyên viên Vận hành Tổng hợp)**: Nhân sự điều hành tác nghiệp trực tiếp, giám sát đơn hàng xuyên suốt từ Nhật Bản về Việt Nam, phối hợp với khách hàng và trực tiếp điều hành 4 AI Agent chuyên trách.

2. **Chuyển giao 4 vai trò Chuyên môn cho 4 AI Agent Chuyên trách (Specialized AI Agents)**:
   - **Purchasing Agent (`agent:purchasing`)**: Thay thế vai trò `PURCHASER` thủ công — Thẩm định link sàn Nhật (Mercari, Rakuten, Yahoo, Amazon JP), tính giá quy đổi live, tạo và duyệt Purchase Task, tự động cấp mã vận đơn Nhật (Yamato, Sagawa).
   - **Quarantine & Compliance Agent (`agent:quarantine`)**: Thay thế vai trò kiểm tra kho sơ cấp — Quét danh mục hàng cấm theo quy định MAFF Nhật Bản (thịt gia súc, xúc xích, ruốc, hạt giống) và hàng nguy hiểm bay IATA (pin lithium, bình nén khí), thẩm định cân nặng thể tích IATA ($D \times R \times C / 5000$) và hỗ trợ khai báo tờ khai CN23.
   - **Financial Audit Agent (`agent:financial_audit`)**: Thay thế vai trò `ACCOUNTANT` kiểm tra đối soát thủ công — Kiểm toán tỷ lệ cọc 3 bậc (Tier 1: 100%, Tier 2: 70%, Tier 3: 50%), đối soát giao dịch VietQR/VNPAY, kiểm tra số dư đợt 2 tại `WAREHOUSE_VN` để kích hoạt `PAID_100` và mở khóa giao hàng, phát hiện bất thường tài chính (âm biên lợi nhuận, sai lệch `OrderCostLine`).
   - **Executive Assistant Agent (`agent:executive_assistant`)**: Hỗ trợ đắc lực vai trò `SUPPORT` và Ban Giám Đốc — Tổng hợp bức tranh vận hành toàn diện (Operations Scorecard), phát hiện điểm nghẽn (đơn chờ cọc quá hạn, đơn kẹt kho, quá tải), đề xuất hành động 1-click (One-Click Dispatch).

3. **Cơ chế Tương thích Ngược (Backward Compatibility)**:
   - Trong `src/lib/admin-guard.ts`, hàm `hasRequiredRole` tự động coi `OPERATOR` bao hàm các vai trò nghiệp vụ cũ (`PURCHASER`, `WAREHOUSE`, `SUPPORT`) để bảo đảm 100% các bộ kiểm thử unit/integration và mã nguồn kế thừa hoạt động ổn định tuyệt đối.

---

## 2. Danh Mục Hai Vai Trò Quản Trị Người Thật

| Vai trò (Role) | Cấp độ | Phạm vi trách nhiệm chính |
| :--- | :---: | :--- |
| **`SUPER_ADMIN`** | Cấp 1 (Root) | Quản trị viên tối cao: Toàn quyền cấu hình hệ thống (`system-config`), điều chỉnh công thức & sàn phí (`pricing-config`), đóng sổ kỳ tài chính (`finance/close-period`), phân bổ cước lô (`allocate-freight`), quản lý danh sách nhân viên admin, xem/truy xuất Audit Logs, quản lý API Keys & Quota, vượt quyền giao hàng khi chưa đủ điều kiện thanh toán (bắt buộc nhập lý do), hoàn tiền lớn (> 500.000 đ), ẩn danh hóa dữ liệu khách hàng theo GDPR. |
| **`OPERATOR`** | Cấp 2 (Ops) | Chuyên viên vận hành tổng hợp: Tiếp nhận và xử lý đơn hàng, duyệt báo giá ngoài catalog (`verify-quote`), theo dõi tiến độ mua hàng JP (`purchase-tasks`), cập nhật trạng thái kho & cân nặng thực tế, theo dõi đơn ký gửi VN→JP, gửi email thông báo khách hàng, điều khiển và kích hoạt các tác vụ tự động trong Agentic AI Workspace. |

---

## 3. Ma Trận Phân Quyền Chi Tiết Theo API Routes Admin Thực Tế

Ma trận dưới đây bao quát 100% các API routes quản trị hiện có trong thư mục `src/app/api/admin/**`:

| Nhóm chức năng | Endpoint API | Phương thức | `SUPER_ADMIN` | `OPERATOR` | Ghi chú an ninh / Audit |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Cấu hình & Hệ thống** | `/api/admin/pricing-config` | GET, POST | ✅ | ❌ | Bất biến phiên bản CSDL `PricingConfig` |
| | `/api/admin/system-config` | GET, POST | ✅ | ❌ | Thay đổi biến động tham số hệ thống |
| | `/api/admin/api-keys` | GET, POST, DELETE | ✅ | ❌ | Quản lý khóa Gemini/API dịch vụ |
| | `/api/admin/auth` | GET, POST, DELETE | *(Public)* | *(Public)* | Cấp & hủy phiên quản trị (Cookie HttpOnly) |
| | `/api/admin/csrf` | GET | *(Public)* | *(Public)* | Cấp phát CSRF Token |
| **Tài chính & Báo cáo** | `/api/admin/finance/close-period` | POST | ✅ | ❌ | Đóng sổ kế toán, chốt số dư bất biến |
| | `/api/admin/finance/costs` | GET, POST | ✅ | ✅ | Nhập/xem chi phí thực `OrderCostLine` |
| | `/api/admin/finance/allocate-freight` | POST | ✅ | ❌ | Phân bổ cước bay chung cho toàn lô hàng |
| | `/api/admin/reports` | GET | ✅ | ❌ | Báo cáo doanh thu, lợi nhuận, dòng tiền |
| | `/api/admin/pricing-simulation` | POST | ✅ | ✅ | Mô phỏng biên độ lợi nhuận trước áp dụng |
| | `/api/admin/payments` | POST | ✅ | ❌ | Xác nhận/hoàn tiền thủ công ngoại lệ |
| **Đơn hàng & Mua hàng** | `/api/admin/orders` | GET | ✅ | ✅ | Danh sách đơn hàng toàn hệ thống |
| | `/api/admin/orders/[id]` | GET, PATCH | ✅ | ✅ | Cập nhật trạng thái, cân nặng, mã vận đơn |
| | `/api/admin/orders/[id]/override-delivery` | POST | ✅ | ❌ | Vượt quyền giao khi chưa `PAID_100` (AuditLog) |
| | `/api/admin/quote-queue` | GET | ✅ | ✅ | Hàng đợi các đơn ngoài catalog chờ duyệt |
| | `/api/admin/verify-quote` | POST | ✅ | ✅ | Duyệt giá và tỷ lệ cọc cho đơn mua hộ |
| | `/api/admin/purchase-tasks` | GET, POST, PATCH | ✅ | ✅ | Tác vụ mua hàng JP (tích hợp Auto-Agent) |
| | `/api/admin/price-check` | POST | ✅ | ✅ | Cào giá nhanh từ URL sàn Nhật |
| **Kho Vận & Ký Gửi** | `/api/admin/vn-jp-shipments` | GET, POST | ✅ | ✅ | Quản lý vận đơn hàng không VN ➔ JP |
| | `/api/admin/vn-jp-shipments/[id]` | GET, PATCH | ✅ | ✅ | Cập nhật trạng thái kiểm dịch, lấy hàng |
| | `/api/admin/vn-jp-shipments/[id]/cn23` | GET, POST | ✅ | ✅ | Xuất tờ khai Hải quan hàng không CN23 |
| **AI Agent Workspace** | `/api/admin/ai-workspace/overview` | GET | ✅ | ✅ | Tổng quan trạng thái 4 Agent & metrics |
| | `/api/admin/ai-workspace/execute` | POST | ✅ | ✅ | Kích hoạt tác vụ Agent (AuditLog bắt buộc) |
| | `/api/admin/assistant` | GET, POST | ✅ | ✅ | Trợ lý điều hành AI / Snapshot BI |
| **Khách hàng & Nhật ký** | `/api/admin/customers` | GET | ✅ | ❌ | Quản lý thông tin khách hàng nhạy cảm |
| | `/api/admin/customers/[id]/anonymize` | POST | ✅ | ❌ | Ẩn danh hóa thông tin theo luật bảo mật |
| | `/api/admin/send-customer-email` | POST | ✅ | ✅ | Gửi email thông báo đơn theo mẫu |
| | `/api/admin/audit-logs` | GET | ✅ | ❌ | Truy xuất nhật ký kiểm toán bất biến |
| | `/api/admin/campaigns` | GET, POST, PATCH | ✅ | ✅ | Quản lý khuyến mãi, gom đơn |

---

## 4. Quyền Hạn Của 4 AI Agent Trong Hệ Thống

Các AI Agent hoạt động như những **Tác tử Chuyên trách Tự hành Có Giám Sát (Supervised Autonomous Agents)**. Mọi thao tác làm thay đổi dữ liệu hoặc tài chính đều tuân thủ các quy tắc bất biến:

1. **Định danh Tác tử (Agent Actor Identity)**:
   - Khi thực thi thông qua `agent-orchestrator`, trường `actor` trong `AuditLog` luôn được ghi nhận rõ ràng:
     - `agent:purchasing`: Tác tử Mua hàng JP
     - `agent:quarantine`: Tác tử Kiểm dịch & An ninh Hàng không
     - `agent:financial_audit`: Tác tử Kiểm toán Tài chính & Thu số dư
     - `agent:executive_assistant`: Tác tử Điều hành & Phát hiện Điểm nghẽn
   - Trường `actorType` mang giá trị `"SYSTEM"` (hoặc `"AI_AGENT"`).

2. **Quy tắc Kiểm soát Ranh giới (Boundary & Guardrails)**:
   - **Tài chính**: AI không được tự ý xóa, hủy hoặc giảm trừ số tiền thực thu của đơn hàng. Chỉ được phép đối soát khớp 100% số dư thực tế hoặc đánh dấu trạng thái hợp lệ.
   - **Vượt quyền**: AI **không bao giờ** được phép vượt quyền giao hàng (`override-delivery`) khi đơn hàng chưa thanh toán đủ `PAID_100`. Quyền này chỉ thuộc về `SUPER_ADMIN` người thật.
   - **Kiểm dịch**: Nếu phát hiện mặt hàng cấm MAFF (thịt, xúc xích, ruốc) hoặc hàng cấm IATA (pin lithium, bình xịt), Agent Kiểm dịch sẽ lập tức gắn cờ `PROHIBITED` và chặn kiện hàng chuyển trạng thái xuất kho bay.

---

## 5. Danh Sách Ngoại Lệ Công Khai (Public Whitelist)

Các endpoint dưới đây nằm trong thư mục `/api/admin` nhưng phục vụ cơ chế khởi tạo phiên và bảo mật CSRF:
1. `src/app/api/admin/auth/route.ts`: Xác thực tài khoản quản trị viên.
2. `src/app/api/admin/csrf/route.ts`: Cấp phát token phòng chống giả mạo request liên trang (CSRF).

Tất cả các endpoint còn lại dưới `src/app/api/admin/**` **bắt buộc 100%** phải gọi `requireAdmin(req, { roles: [...] })`.
