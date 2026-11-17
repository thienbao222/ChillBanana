# ChillBanana — Nhật Ký Thay Đổi (Changelog)

Tài liệu này theo dõi toàn bộ các thay đổi qua từng gói công việc (Work Package - WP) theo Lộ trình Phát triển Bản 3.

---

## [WP7.2] - 04/11/2026: SOP Vận Hành, Giám Sát Sức Khỏe, Dữ Liệu Mô Phỏng & Đóng Sổ Tháng

- **Ngày thực hiện:** 04/11/2026
- **Mã gói việc:** WP7.2
- **Thay đổi:**
  - Ban hành bộ 8 tài liệu Quy trình thao tác chuẩn (Standard Operating Procedures - SOP) toàn diện trong `docs/ops/`:
    - `01_nhan_don_va_duyet_gia.md`: Tiếp nhận đơn & duyệt giá ngoài catalog trong 4h.
    - `02_mua_hang_nhat_ban.md`: Mua hàng JP & ghi nhận dòng chi phí thực tế `GOODS_JPY`.
    - `03_nhap_kho_tokyo_va_bay.md`: Nhập kho Tokyo, cân đo, kiểm tra dung sai & xuất bay.
    - `04_thu_so_du_kho_vn.md`: Nhập kho VN & thu số dư đợt 2, nhắc nợ lưu kho.
    - `05_giao_hang_noi_dia.md`: Giao hàng nội địa có rào chắn chỉ giao khi đã `PAID_100`.
    - `06_hoan_tien_va_huy_don.md`: Hoàn tiền bằng bút toán đảo (`REVERSAL` / `VOIDED`).
    - `07_xu_ly_khieu_nai.md`: Tiếp nhận & giải quyết khiếu nại khách hàng trong 72h.
    - `08_dong_so_cuoi_thang.md`: Khóa cứng số liệu kế toán tháng trước ngày mùng 5.
  - Xây dựng endpoint giám sát sức khỏe `/api/health` (`src/app/api/health/route.ts`): kiểm tra kết nối DB Neon, đo độ trễ (latency), và cảnh báo khi có cron job quá 36 giờ chưa chạy.
  - Cập nhật checklist diễn tập sao lưu & khôi phục dữ liệu trong `docs/BACKUP_RESTORE.md`.
  - Mở rộng model `PeriodClose` trong `prisma/schema.prisma` và tạo migration `prisma/migrations/20261104000007_add_period_close/migration.sql`.
  - Xây dựng module đóng sổ tháng `src/features/finance/period-close.ts`: tự động tổng hợp snapshot GMV, doanh thu, chi phí thực và lãi gộp, ngăn chặn việc đóng sổ trùng lặp và cung cấp hàm kiểm tra `isPeriodClosed` để khóa số liệu.
  - Xây dựng API quản lý đóng sổ `GET /api/admin/finance/close-period` và `POST /api/admin/finance/close-period` (chỉ dành cho `SUPER_ADMIN`).
  - Xây dựng script sinh dữ liệu mô phỏng 3 tháng cố định `prisma/seed-simulation.ts` (lệnh `npm run seed:sim`) có rào chắn từ chối chạy trên môi trường production.
- **Files thay đổi / tạo mới:**
  - `docs/ops/` (8 files SOP tạo mới)
  - `src/app/api/health/route.ts` (tạo mới)
  - `prisma/schema.prisma` (sửa đổi)
  - `prisma/migrations/20261104000007_add_period_close/migration.sql` (tạo mới)
  - `src/features/finance/period-close.ts` (tạo mới)
  - `src/app/api/admin/finance/close-period/route.ts` (tạo mới)
  - `prisma/seed-simulation.ts` (tạo mới)
  - `package.json` (sửa đổi)
  - `docs/BACKUP_RESTORE.md` (cập nhật)
  - `tests/unit/operations-and-period-close.test.ts` (tạo mới)
  - `CHANGELOG.md` (cập nhật)
- **Kiểm thử đã chạy:**
  - Unit test mới: `node ./node_modules/vitest/vitest.mjs run tests/unit/operations-and-period-close.test.ts` (6 passed)
  - Typecheck: `node ./node_modules/typescript/bin/tsc --noEmit` (0 errors)
- **Cách rollback:**
  - `git checkout -- prisma/schema.prisma package.json docs/BACKUP_RESTORE.md CHANGELOG.md`
  - `Remove-Item docs/ops/, src/app/api/health/route.ts, prisma/migrations/20261104000007_add_period_close/, src/features/finance/period-close.ts, src/app/api/admin/finance/close-period/, prisma/seed-simulation.ts, tests/unit/operations-and-period-close.test.ts`

---

## [WP7.1] - 04/11/2026: Phân Quyền Theo Vai Trò (RBAC) & Test Kiểm Kê Toàn Bộ Route Admin

- **Ngày thực hiện:** 04/11/2026
- **Mã gói việc:** WP7.1
- **Thay đổi:**
  - Hoàn thiện mô hình phân quyền quản trị 5 vai trò chuyên biệt (`SUPER_ADMIN`, `PURCHASER`, `WAREHOUSE`, `ACCOUNTANT`, `SUPPORT`) trong `src/lib/admin-guard.ts`.
  - Tự động ánh xạ vai trò `OPERATOR` cũ sang `PURCHASER`, `WAREHOUSE`, và `SUPPORT` để duy trì 100% tính tương thích ngược, không làm gián đoạn tài khoản nhân viên hiện hữu.
  - Xây dựng hàm kiểm tra phân quyền `hasRequiredRole` và alias `requireRole(req, allowedRoles)`.
  - Ban hành tài liệu ma trận phân quyền chi tiết `docs/RBAC.md`: quy định rõ các hành động đặc quyền tối cao chỉ dành riêng cho `SUPER_ADMIN` (đổi PricingConfig, hoàn tiền lớn, vượt quyền giao hàng, đóng sổ tài chính) và danh sách ngoại lệ công khai (auth, csrf).
  - Viết test kiểm kê tự động `tests/unit/admin-inventory-rbac.test.ts`: duyệt toàn bộ 37 routes admin, bảo đảm 100% các endpoint không thuộc whitelist đều bắt buộc được bảo vệ bởi `requireAdmin` hoặc `requireRole`.
- **Files thay đổi / tạo mới:**
  - `src/lib/admin-guard.ts` (sửa đổi)
  - `docs/RBAC.md` (tạo mới)
  - `tests/unit/admin-inventory-rbac.test.ts` (tạo mới)
  - `CHANGELOG.md` (cập nhật)
- **Kiểm thử đã chạy:**
  - Unit test mới: `node ./node_modules/vitest/vitest.mjs run tests/unit/admin-inventory-rbac.test.ts` (5 passed)
  - Typecheck: `node ./node_modules/typescript/bin/tsc --noEmit` (0 errors)
- **Cách rollback:**
  - `git checkout -- src/lib/admin-guard.ts CHANGELOG.md`
  - `Remove-Item docs/RBAC.md, tests/unit/admin-inventory-rbac.test.ts`

---

## [WP6.2] - 04/11/2026: Tờ Khai Hải Quan CN23 & Tuân Thủ Bảo Vệ Dữ Liệu Cá Nhân

- **Ngày thực hiện:** 04/11/2026
- **Mã gói việc:** WP6.2
- **Thay đổi:**
  - Xây dựng API xuất dữ liệu tờ khai bưu chính quốc tế CN23 `GET /api/admin/vn-jp-shipments/[id]/cn23`:
    - Chuẩn hóa đầy đủ các trường dữ liệu theo mẫu UPU CN23 (Sender, Recipient, chi tiết danh mục hàng hóa bằng tiếng Anh & tiếng Nhật, mã HS Code, trọng lượng tịnh, giá trị khai báo, phân loại bưu phẩm quà tặng / tài liệu).
    - Đề xuất giải pháp in ấn trực tiếp qua HTML Print Layout (zero-dependency, bảo toàn font chữ Nhật/Việt hoàn hảo).
  - Xây dựng trang dự thảo chính sách bảo mật `/chinh-sach-bao-mat` (`src/app/chinh-sach-bao-mat/page.tsx`): minh bạch mục đích xử lý dữ liệu và danh sách các đối tác hạ tầng kỹ thuật (Vercel, Neon, Google Gemini AI, VNPAY, Yamato Transport).
  - Xây dựng bộ lọc khử trùng PII `src/features/privacy/pii-masker.ts`: tự động nhận diện và che giấu toàn bộ số điện thoại, email và địa chỉ chi tiết trước khi truyền dữ liệu sang mô hình AI bên thứ ba.
  - Xây dựng quy trình xử lý yêu cầu ẩn danh hóa dữ liệu khách hàng `src/features/privacy/anonymization.ts`:
    - Bất biến tài chính: Ẩn danh hóa họ tên, số điện thoại, địa chỉ và email cá nhân nhưng bảo lưu nguyên vẹn 100% các chứng từ tài chính (`Order`, `PaymentTransaction`, `OrderCostLine`) để tuân thủ pháp luật kế toán và thuế.
    - Ghi nhận đầy đủ nhật ký `AuditLog`.
  - Ban hành tài liệu quy trình ứng phó sự cố an ninh mạng và rò rỉ dữ liệu `docs/INCIDENT.md`.
- **Files thay đổi / tạo mới:**
  - `src/features/privacy/pii-masker.ts` (tạo mới)
  - `src/features/privacy/anonymization.ts` (tạo mới)
  - `src/app/api/admin/vn-jp-shipments/[id]/cn23/route.ts` (tạo mới)
  - `src/app/chinh-sach-bao-mat/page.tsx` (tạo mới)
  - `docs/INCIDENT.md` (tạo mới)
  - `tests/unit/privacy-and-cn23.test.ts` (tạo mới)
  - `CHANGELOG.md` (cập nhật)
- **Kiểm thử đã chạy:**
  - Unit test mới: `node ./node_modules/vitest/vitest.mjs run tests/unit/privacy-and-cn23.test.ts` (4 passed)
  - Typecheck: `node ./node_modules/typescript/bin/tsc --noEmit` (0 errors)
- **Cách rollback:**
  - `git checkout -- CHANGELOG.md`
  - `Remove-Item src/features/privacy/, src/app/api/admin/vn-jp-shipments/[id]/cn23/, src/app/chinh-sach-bao-mat/, docs/INCIDENT.md, tests/unit/privacy-and-cn23.test.ts`

---

## [WP6.1] - 04/11/2026: Phân Hệ VN → JP: Tài Khoản Khách Hàng, Thẩm Định MAFF & Cước Thể Tích IATA

- **Ngày thực hiện:** 04/11/2026
- **Mã gói việc:** WP6.1
- **Thay đổi:**
  - Mở rộng model `VnJpShipment` trong `prisma/schema.prisma`: bổ sung `customerId` (FK tới `Customer`), `consentAt`, `consentVersion`, `maffAcknowledgedAt`.
  - Tạo migration an toàn chỉ thêm `prisma/migrations/20261104000006_add_vn_jp_customer_and_maff_fields/migration.sql`.
  - Thẩm định kiểm dịch MAFF tại Server (`inspectVnJpCargoDeterministic`):
    - Chặn ngay lập tức (HTTP 400 kèm lý do chi tiết) khi phát hiện hàng cấm tuyệt đối (`PROHIBITED` như thịt bò khô, xúc xích, nem chua, gia cầm).
    - Yêu cầu xác nhận cam kết đối với hàng có điều kiện (`CONDITIONAL`).
    - Bất biến an toàn: Hoàn toàn không tin tưởng các cờ kiểm dịch từ client gửi lên.
  - Tự động tính cước thể tích IATA tại Server:
    - Tính trọng lượng quy đổi thể tích: `volumetricWeight = (Dài x Rộng x Cao) / 5000`.
    - Trọng lượng tính cước `chargeableWeightKg = max(actualWeight, volumetricWeight)`.
  - Bảo vệ quyền riêng tư (PII Masking) tại route tra cứu `GET /api/vn-jp-shipments/track/[code]`: che mờ số điện thoại, viết tắt họ tên, và chỉ hiển thị tỉnh/thành phố điểm đến (che giấu địa chỉ chi tiết).
- **Files thay đổi / tạo mới:**
  - `prisma/schema.prisma` (sửa đổi)
  - `prisma/migrations/20261104000006_add_vn_jp_customer_and_maff_fields/migration.sql` (tạo mới)
  - `src/app/api/vn-jp-shipments/route.ts` (sửa đổi)
  - `tests/unit/vn-jp-shipments.test.ts` (tạo mới)
  - `CHANGELOG.md` (cập nhật)
- **Kiểm thử đã chạy:**
  - Unit test mới: `node ./node_modules/vitest/vitest.mjs run tests/unit/vn-jp-shipments.test.ts` (7 passed)
  - Typecheck: `node ./node_modules/typescript/bin/tsc --noEmit` (0 errors)
- **Cách rollback:**
  - `git checkout -- prisma/schema.prisma src/app/api/vn-jp-shipments/route.ts CHANGELOG.md`
  - `Remove-Item prisma/migrations/20261104000006_add_vn_jp_customer_and_maff_fields/migration.sql, tests/unit/vn-jp-shipments.test.ts`

---

## [WP5.2] - 04/11/2026: Ưu Đãi Gom Đơn Hợp Lệ & Thuật Toán Phân Bổ Cước Lô

- **Ngày thực hiện:** 04/11/2026
- **Mã gói việc:** WP5.2
- **Thay đổi:**
  - Thiết lập rào chắn giá ưu đãi gom đơn (`isGroupBuy`): Khách hàng chỉ được hưởng ưu đãi cước khi đơn hàng có gắn kết với chiến dịch gom hàng đang mở (`status: OPEN`). Chặn hoàn toàn việc client tự ý gửi cờ để giảm phí cước.
  - Xây dựng thuật toán phân bổ cước lô `allocateBatchFreight` trong `src/features/campaigns/freight-allocation.ts`:
    - Phân bổ chi phí vận chuyển quốc tế thực tế của cả lô hàng cho từng đơn hàng theo tỷ lệ cân nặng.
    - Đảm bảo bất biến toán học: Tổng số tiền phân bổ cho các đơn hàng luôn bằng đúng 100% tổng cước thực tế (sai số 0 VND).
    - Tự động cộng phần dư làm tròn (nếu có) vào đơn hàng có trọng lượng lớn nhất.
    - Tự động tạo các bản ghi chi phí thực `OrderCostLine` (danh mục `INTL_FREIGHT`) cho từng đơn hàng.
  - Xây dựng API báo cáo tài chính chiến dịch `GET /api/admin/campaigns/[id]/report`: tính toán số lượng đơn tham gia, tổng cân nặng, GMV, doanh thu dịch vụ, tổng chi phí thực tế và lãi gộp (Gross Profit) kèm biên lợi nhuận (%).
  - Xây dựng API thực hiện phân bổ cước `POST /api/admin/campaigns/[id]/allocate-freight`.
- **Files thay đổi / tạo mới:**
  - `src/features/campaigns/freight-allocation.ts` (tạo mới)
  - `src/app/api/admin/campaigns/[id]/report/route.ts` (tạo mới)
  - `src/app/api/admin/campaigns/[id]/allocate-freight/route.ts` (tạo mới)
  - `tests/unit/campaign-allocation-and-report.test.ts` (tạo mới)
  - `CHANGELOG.md` (cập nhật)
- **Kiểm thử đã chạy:**
  - Unit test mới: `node ./node_modules/vitest/vitest.mjs run tests/unit/campaign-allocation-and-report.test.ts` (3 passed)
  - Cả 2 file test Campaign: 10 passed
  - Typecheck: `node ./node_modules/typescript/bin/tsc --noEmit` (0 errors)
- **Cách rollback:**
  - `git checkout -- CHANGELOG.md`
  - `Remove-Item src/features/campaigns/freight-allocation.ts, src/app/api/admin/campaigns/[id]/report/, src/app/api/admin/campaigns/[id]/allocate-freight/, tests/unit/campaign-allocation-and-report.test.ts`

---

## [WP5.1] - 04/11/2026: Chiến Dịch Mua Theo Đợt (Group Buy) — Mô Hình Dữ Liệu & Quản Trị Trạng Thái

- **Ngày thực hiện:** 04/11/2026
- **Mã gói việc:** WP5.1
- **Thay đổi:**
  - Mở rộng `prisma/schema.prisma`: bổ sung các model `Campaign` (`id`, `slug`, `title`, `description`, `marketplace`, `status`, `opensAt`, `closesAt`, `minParticipants`, `maxSlots`, `notes`, `createdBy`), `CampaignItem` (`name`, `priceJpy`, `weightKg`, `maxSlots`, `claimedSlots`), và `CampaignEntry` (`campaignItemId`, `orderItemId`, `quantity`).
  - Tạo migration an toàn chỉ thêm `prisma/migrations/20261104000005_add_campaigns/migration.sql`.
  - Xây dựng cỗ máy trạng thái (State Machine) nghiêm ngặt trong `src/features/campaigns/service.ts`:
    - `DRAFT` -> `OPEN` -> `CLOSED` -> `ORDERED` -> `ARRIVED` -> `SHIPPED` -> `SETTLED` (hoặc `CANCELLED`). Chặn hoàn toàn hành vi nhảy cóc trạng thái.
    - Cơ chế atomic update khi đặt suất (`claimCampaignSlots`), chống tranh chấp race condition và kiểm soát trần `maxSlots`.
    - Quét tự động đóng các chiến dịch quá hạn `closesAt` (`sweepExpiredCampaigns`), đánh dấu cảnh báo nếu không đạt đủ `minParticipants`.
  - Xây dựng APIs quản trị chiến dịch:
    - `GET /api/admin/campaigns` & `POST /api/admin/campaigns` (tạo mới và liệt kê).
    - `GET /api/admin/campaigns/[id]` & `PATCH /api/admin/campaigns/[id]` (cập nhật thông tin và chuyển trạng thái có kiểm tra).
- **Files thay đổi / tạo mới:**
  - `prisma/schema.prisma` (sửa đổi)
  - `prisma/migrations/20261104000005_add_campaigns/migration.sql` (tạo mới)
  - `src/features/campaigns/service.ts` (tạo mới)
  - `src/app/api/admin/campaigns/route.ts` (tạo mới)
  - `src/app/api/admin/campaigns/[id]/route.ts` (tạo mới)
  - `tests/unit/campaigns.test.ts` (tạo mới)
  - `CHANGELOG.md` (cập nhật)
- **Kiểm thử đã chạy:**
  - Unit test mới: `node ./node_modules/vitest/vitest.mjs run tests/unit/campaigns.test.ts` (7 passed)
  - Typecheck: `node ./node_modules/typescript/bin/tsc --noEmit` (0 errors)
- **Cách rollback:**
  - `git checkout -- prisma/schema.prisma CHANGELOG.md`
  - `Remove-Item prisma/migrations/20261104000005_add_campaigns/migration.sql, src/features/campaigns/service.ts, src/app/api/admin/campaigns/, tests/unit/campaigns.test.ts`

---

## [WP4.3] - 04/11/2026: Bookmarklet Mua Hàng 1-Click & Trang Nhập Đơn Có Cấu Trúc

- **Ngày thực hiện:** 04/11/2026
- **Mã gói việc:** WP4.3
- **Thay đổi:**
  - Xây dựng `public/bookmarklet.js` (< 3KB, không phụ thuộc thư viện ngoài): trích xuất tự động thông tin sản phẩm (tên, giá Yên, ảnh, link) từ DOM, JSON-LD, meta tags và mã hóa fragment `#data=...` chuyển tiếp về ChillBanana.
  - Xây dựng trang hướng dẫn kéo thả `src/app/huong-dan-bookmarklet/page.tsx` bằng tiếng Việt, có lưu ý rõ ràng về chính sách CSP của một số sàn có thể chặn script và hướng dẫn cách dán link thay thế.
  - Xây dựng module kiểm định và khử trùng dữ liệu `src/features/purchasing/bookmarklet-validator.ts`:
    - Chống SSRF và bảo vệ mạng: chỉ chấp nhận các sàn Nhật Bản hợp lệ theo whitelist, chặn địa chỉ IP nội bộ, loopback và cloud metadata.
    - Chống tấn công XSS: làm sạch và loại bỏ toàn bộ các thẻ HTML độc hại trong tên sản phẩm.
    - Thẩm định giá JPY hợp lệ (100 - 10.000.000 ¥).
    - Gán nhãn `quoteSource = "EXTENSION"`.
  - Xây dựng trang tiếp nhận dữ liệu `/dat-hang/nhap` (`src/app/dat-hang/nhap/page.tsx`): hiển thị chi tiết sản phẩm, cho phép chỉnh sửa cân nặng ước tính, cảnh báo giá chỉ là gợi ý cần nhân viên duyệt, và nút thêm vào giỏ hàng.
- **Files thay đổi / tạo mới:**
  - `public/bookmarklet.js` (tạo mới)
  - `src/features/purchasing/bookmarklet-validator.ts` (tạo mới)
  - `src/app/huong-dan-bookmarklet/page.tsx` (tạo mới)
  - `src/app/dat-hang/nhap/page.tsx` (tạo mới)
  - `tests/unit/bookmarklet.test.ts` (tạo mới)
  - `CHANGELOG.md` (cập nhật)
- **Kiểm thử đã chạy:**
  - Unit test mới: `node ./node_modules/vitest/vitest.mjs run tests/unit/bookmarklet.test.ts` (5 passed)
  - Typecheck: `node ./node_modules/typescript/bin/tsc --noEmit` (0 errors)
- **Cách rollback:**
  - `git checkout -- CHANGELOG.md`
  - `Remove-Item public/bookmarklet.js, src/features/purchasing/bookmarklet-validator.ts, src/app/huong-dan-bookmarklet/page.tsx, src/app/dat-hang/nhap/page.tsx, tests/unit/bookmarklet.test.ts`

---

## [WP4.2] - 04/11/2026: Khung Kết Nối API Chính Thống (Rakuten & Yahoo Shopping)

- **Ngày thực hiện:** 04/11/2026
- **Mã gói việc:** WP4.2
- **Thay đổi:**
  - Khảo sát và tài liệu hóa chi tiết đặc tả API, rate limits, chính sách caching và branding bắt buộc của Rakuten và Yahoo! Shopping vào `docs/API_SOURCES.md`.
  - Cập nhật `.env.example`: bổ sung các biến môi trường cấu hình API chính thức (`RAKUTEN_APP_ID`, `RAKUTEN_ACCESS_KEY`, `YAHOO_CLIENT_ID`).
  - Xây dựng các module tìm kiếm `src/features/purchasing/sources/rakuten.ts` và `yahoo-shopping.ts`:
    - Chuẩn hóa cấu trúc kết quả về `ExternalProductSearchResult` (`id`, `name`, `priceJpy`, `imageUrl`, `url`, `shopName`, `marketplace`, `quoteSource`).
    - Cơ chế chịu lỗi (Fault tolerance): khi thiếu API key hoặc gặp HTTP 429 rate limit, trả về lỗi mềm có thông điệp hướng dẫn dán link thủ công mà không làm gián đoạn trải nghiệm khách hàng.
    - Đính kèm dòng ghi nguồn bắt buộc của Yahoo! JAPAN theo quy định cấp phép.
  - Xây dựng API `GET /api/search/external`: có bảo vệ giới hạn tần suất theo địa chỉ IP qua cơ chế `checkAndRecordHit`.
- **Files thay đổi / tạo mới:**
  - `docs/API_SOURCES.md` (tạo mới)
  - `.env.example` (sửa đổi)
  - `src/features/purchasing/sources/types.ts` (tạo mới)
  - `src/features/purchasing/sources/rakuten.ts` (tạo mới)
  - `src/features/purchasing/sources/yahoo-shopping.ts` (tạo mới)
  - `src/app/api/search/external/route.ts` (tạo mới)
  - `tests/unit/api-sources.test.ts` (tạo mới)
  - `CHANGELOG.md` (cập nhật)
- **Kiểm thử đã chạy:**
  - Unit test mới: `node ./node_modules/vitest/vitest.mjs run tests/unit/api-sources.test.ts` (6 passed)
  - Typecheck: `node ./node_modules/typescript/bin/tsc --noEmit` (0 errors)
- **Cách rollback:**
  - `git checkout -- .env.example CHANGELOG.md`
  - `Remove-Item docs/API_SOURCES.md, src/features/purchasing/sources/, src/app/api/search/external/route.ts, tests/unit/api-sources.test.ts`

---

## [WP4.1] - 04/11/2026: Nguồn Báo Giá & Hàng Đợi Nhân Viên (Human-in-the-loop)

- **Ngày thực hiện:** 04/11/2026
- **Mã gói việc:** WP4.1
- **Thay đổi:**
  - Bổ sung các trường trên model `OrderItem` trong `prisma/schema.prisma`: `quoteSource` (`CATALOG | API_RAKUTEN | API_YAHOO | EXTENSION | MANUAL | SCRAPE`), `quoteVerifiedAt`, `quoteVerifiedBy`.
  - Tạo migration an toàn chỉ thêm `prisma/migrations/20261104000004_add_order_item_quote_source/migration.sql`.
  - Thiết lập rào chắn duyệt giá bất biến: Mọi dòng hàng ngoài catalog từ bất kỳ nguồn nào đều bắt buộc `isPriceVerified = false` và cần nhân viên duyệt thủ công. Chỉ có đơn 100% catalog mới được hệ thống tự động xác nhận.
  - Xây dựng API hàng đợi duyệt giá `GET /api/admin/orders/quote-queue`: hỗ trợ lọc theo nguồn, đếm số giờ chờ, và kích hoạt cảnh báo đổi màu `isOverdue4h` khi đơn chờ quá 4 giờ.
  - Xây dựng API phê duyệt giá `POST /api/admin/orders/[id]/verify-quote`: cập nhật thông tin người duyệt và thời điểm duyệt, ghi vết vào `TrackingLog` và `AuditLog`.
- **Files thay đổi / tạo mới:**
  - `prisma/schema.prisma` (sửa đổi)
  - `prisma/migrations/20261104000004_add_order_item_quote_source/migration.sql` (tạo mới)
  - `src/app/api/orders/route.ts` (sửa đổi)
  - `src/app/api/admin/orders/quote-queue/route.ts` (tạo mới)
  - `src/app/api/admin/orders/[id]/verify-quote/route.ts` (tạo mới)
  - `tests/unit/quote-queue.test.ts` (tạo mới)
  - `CHANGELOG.md` (cập nhật)
- **Kiểm thử đã chạy:**
  - Unit test mới: `node ./node_modules/vitest/vitest.mjs run tests/unit/quote-queue.test.ts` (4 passed)
  - Typecheck: `node ./node_modules/typescript/bin/tsc --noEmit` (0 errors)
- **Cách rollback:**
  - `git checkout -- prisma/schema.prisma src/app/api/orders/route.ts CHANGELOG.md`
  - `Remove-Item prisma/migrations/20261104000004_add_order_item_quote_source/migration.sql, src/app/api/admin/orders/quote-queue/route.ts, src/app/api/admin/orders/[id]/verify-quote/route.ts, tests/unit/quote-queue.test.ts`

---

## [WP3.3] - 04/11/2026: Dòng Tiền V2 — Phân Tầng Đặt Cọc & Chốt Công Nợ Kho VN

- **Ngày thực hiện:** 04/11/2026
- **Mã gói việc:** WP3.3
- **Thay đổi:**
  - Triển khai chính sách cọc phân tầng (`calculateDepositV2`) trong `src/features/payments/policy.ts`:
    - Đơn < 1.000.000 đ: cọc 100% (bảo vệ các đơn nhỏ dễ bị bỏ).
    - Đơn 1.000.000 đ - 10.000.000 đ: cọc 70%.
    - Đơn > 10.000.000 đ: cọc 50%.
  - Dung sai cân nặng kho Tokyo (`checkWeightTolerance`): Lệch ≤ 5% hoặc ≤ 50g so với báo giá ban đầu: miễn phí / không tính thêm cước để giảm ma sát với khách hàng. Lệch > 5% và > 50g: tự động tính lại cước.
  - Chốt công nợ kho VN (`calculateWarehouseVnBalance`):
    - Chặn trạng thái `LOCAL_DELIVERY` khi đơn chưa thanh toán đủ 100% (`PAID_100`).
    - Hỗ trợ admin override có kèm `overrideReason` bắt buộc và ghi nhận đầy đủ vào `AuditLog`.
  - Quét tự động đơn tồn kho VN quá hạn thanh toán nốt (`remindOverdueWarehouseVnBalances`) tích hợp vào cron `/api/cron/expire-order-reservations`.
- **Files thay đổi / tạo mới:**
  - `src/features/payments/policy.ts` (sửa đổi)
  - `src/features/orders/reservations.ts` (sửa đổi)
  - `src/app/api/orders/route.ts` (sửa đổi)
  - `src/app/api/orders/[id]/route.ts` (sửa đổi)
  - `src/app/api/admin/orders/[id]/mock-transition/route.ts` (sửa đổi)
  - `src/app/api/cron/expire-order-reservations/route.ts` (sửa đổi)
  - `tests/unit/cashflow-v2.test.ts` (tạo mới)
  - `CHANGELOG.md` (cập nhật)
- **Kiểm thử đã chạy:**
  - Unit test mới: `node ./node_modules/vitest/vitest.mjs run tests/unit/cashflow-v2.test.ts` (11 passed)
  - Toàn bộ unit tests: 49 test files, 352 passed (100% pass)
  - Typecheck: `node ./node_modules/typescript/bin/tsc --noEmit` (0 errors)
- **Cách rollback:**
  - `git checkout -- src/features/payments/policy.ts src/features/orders/reservations.ts src/app/api/orders/route.ts src/app/api/orders/[id]/route.ts src/app/api/admin/orders/[id]/mock-transition/route.ts src/app/api/cron/expire-order-reservations/route.ts CHANGELOG.md`
  - `Remove-Item tests/unit/cashflow-v2.test.ts`

---

## [WP3.2] - 04/11/2026: Bộ Giá V2 Cấu Hình Hóa & Hiển Thị Bóc Tách Chi Tiết

- **Ngày thực hiện:** 04/11/2026
- **Mã gói việc:** WP3.2
- **Thay đổi:**
  - Mở rộng kiểu dữ liệu `PricingConfigValues`: bổ sung các tham số cấu hình bộ giá v2: `handlingFeeVnd` (phí xử lý cố định), `fxFeePercent` (phí chuyển đổi ngoại tệ dòng riêng), `minBillableWeightKg` (cân tính cước tối thiểu), `taxEstimateEnabled`, `vatPercent`, `importTaxPercent` (ước tính thuế). Giá trị mặc định được thiết kế để bảo toàn 100% công thức giá hiện hành (4% phí dịch vụ, tối thiểu 20.000đ, cước 185.000đ/kg, 0đ phụ phí).
  - Nâng cấp `calculateOrderPrice` trong `src/features/pricing/calculator.ts`: trả về đối tượng `breakdown` bóc tách từng dòng chi phí (`goods`, `serviceFee`, `handlingFee`, `fxFee`, `shipping`, `billableWeightKg`, `taxEstimate`, `total`).
  - Mở rộng model `Order` trong `prisma/schema.prisma`: thêm các trường nullable/default `handlingFeeVnd`, `fxFeeVnd`, `taxEstimateVnd` (lưu snapshot cấu trúc giá tại thời điểm tạo đơn).
  - Tạo migration an toàn chỉ thêm `prisma/migrations/20261104000003_add_order_pricing_breakdown_v2/migration.sql`.
  - Cập nhật hàm `validatePricingConfig` và `parseRow` trong `src/features/pricing/config.ts`: hỗ trợ kiểm tra và thẩm định toàn bộ các tham số mới mà vẫn tương thích ngược với các payload cấu hình cũ.
- **Files thay đổi / tạo mới:**
  - `src/features/pricing/calculator.ts` (sửa đổi)
  - `src/features/pricing/config.ts` (sửa đổi)
  - `src/app/api/orders/route.ts` (sửa đổi)
  - `src/app/api/orders/[id]/route.ts` (sửa đổi)
  - `prisma/schema.prisma` (sửa đổi)
  - `prisma/migrations/20261104000003_add_order_pricing_breakdown_v2/migration.sql` (tạo mới)
  - `tests/unit/pricing-v2.test.ts` (tạo mới)
  - `CHANGELOG.md` (cập nhật)
- **Kiểm thử đã chạy:**
  - Unit test mới: `node ./node_modules/vitest/vitest.mjs run tests/unit/pricing-v2.test.ts` (3 passed)
  - Unit test cũ: `node ./node_modules/vitest/vitest.mjs run tests/unit/pricing.test.ts` (13 passed, 100% giữ nguyên không sửa test cũ)
  - Typecheck: `node ./node_modules/typescript/bin/tsc --noEmit` (0 errors)
- **Cách rollback:**
  - `git checkout -- src/features/pricing/calculator.ts src/features/pricing/config.ts src/app/api/orders/route.ts src/app/api/orders/[id]/route.ts prisma/schema.prisma CHANGELOG.md`
  - `Remove-Item prisma/migrations/20261104000003_add_order_pricing_breakdown_v2/migration.sql, tests/unit/pricing-v2.test.ts`

---

## [WP3.1] - 04/11/2026: Mô Phỏng Đơn Vị Kinh Tế & Rào Chắn Lỗ

- **Ngày thực hiện:** 04/11/2026
- **Mã gói việc:** WP3.1
- **Thay đổi:**
  - Xây dựng module thuần `src/features/pricing/unit-economics.ts` với hàm `estimateMargin(order, costAssumptions, pricing)`:
    - Tính toán doanh thu công ty, chi phí ước tính từng khoản (phí đổi ngoại tệ 1.2%, xử lý kho Tokyo 300 ¥, cước bay quốc tế thực tế 130.000 đ/kg, phí cổng thanh toán 1.5% trên tiền cọc, giao nội địa 35.000 đ), lãi gộp và % trên GMV.
    - Tái lập chính xác tuyệt đối hai ví dụ đối chuẩn: đơn 3.850 ¥ (0.5 kg) ra đúng `-45.279 đ`; đơn 2.000 ¥ (0.3 kg) ra đúng `-56.280 đ`.
  - Thiết lập rào chắn lỗ: ngưỡng mục tiêu an toàn `max(15.000 đ, 3% GMV)`. Khi tạo đơn, hệ thống tự động tính biên đóng góp và gắn cờ `belowMargin` (boolean nullable) trên model `Order` để quản trị viên theo dõi, không chặn khách đặt hàng.
  - Tạo migration an toàn chỉ thêm `prisma/migrations/20261104000002_add_order_below_margin/migration.sql`.
  - Xây dựng API mô phỏng giá `POST /api/admin/pricing-simulation`: cho phép quản trị viên nhập danh sách đơn mẫu và so sánh đồng thời giữa hai bộ cấu hình giá.
- **Files thay đổi / tạo mới:**
  - `src/features/pricing/unit-economics.ts` (tạo mới)
  - `src/app/api/admin/pricing-simulation/route.ts` (tạo mới)
  - `src/app/api/orders/route.ts` (sửa đổi)
  - `prisma/schema.prisma` (sửa đổi)
  - `prisma/migrations/20261104000002_add_order_below_margin/migration.sql` (tạo mới)
  - `tests/unit/unit-economics.test.ts` (tạo mới)
  - `CHANGELOG.md` (cập nhật)
- **Kiểm thử đã chạy:**
  - Unit test mới: `node ./node_modules/vitest/vitest.mjs run tests/unit/unit-economics.test.ts` (4 passed)
  - Typecheck: `node ./node_modules/typescript/bin/tsc --noEmit` (0 errors)
- **Cách rollback:**
  - `git checkout -- src/app/api/orders/route.ts prisma/schema.prisma CHANGELOG.md`
  - `Remove-Item -Recurse src/features/pricing/unit-economics.ts, src/app/api/admin/pricing-simulation, prisma/migrations/20261104000002_add_order_below_margin, tests/unit/unit-economics.test.ts`

---

## [WP2.4] - 04/11/2026: Nhập Chi Phí Thực Từng Khâu & Xem Lãi Gộp Mỗi Đơn

- **Ngày thực hiện:** 04/11/2026
- **Mã gói việc:** WP2.4
- **Thay đổi:**
  - Xây dựng API `GET` và `POST` tại `src/app/api/admin/orders/[id]/costs/route.ts`:
    - `GET`: Trả về toàn bộ danh sách các dòng chi phí thực tế của đơn hàng, tổng chi phí thực, lãi gộp tạm tính (`totalVnd - totalCostVnd`), và cờ cảnh báo nếu thiếu dòng chi phí mua hàng `GOODS_JPY`.
    - `POST (action=void)`: Vô hiệu hóa một dòng chi phí bằng `voidCostLine` (đánh dấu cờ `voidedAt`, bắt buộc nhập lý do hủy, tuyệt đối không xóa cứng).
    - `POST`: Thêm dòng chi phí thực tế cho đơn hàng bằng `createCostLine` (kiểm tra phân quyền Admin, validate các danh mục chi phí hợp lệ, bắt buộc `amountVnd` là số nguyên dương).
  - Tích hợp ghi nhận chi phí tự động khi nhân viên tại Tokyo hoàn tất mua hàng (`complete`) trong `src/app/api/admin/purchase-tasks/[id]/route.ts`:
    - Cho phép nhập giá thực mua bằng Yên (`actualPriceJpy`), tỷ giá chuyển đổi (`fxRate`), link ảnh chụp biên lai (`receiptUrl`).
    - Tự động tạo bản ghi `OrderCostLine` danh mục `GOODS_JPY` gắn với `purchaseTaskId`.
    - Kích hoạt cảnh báo tự động khi giá mua thực tế lệch quá 5% so với giá báo ban đầu cho khách hàng.
- **Files thay đổi / tạo mới:**
  - `src/app/api/admin/orders/[id]/costs/route.ts` (tạo mới)
  - `src/app/api/admin/purchase-tasks/[id]/route.ts` (sửa đổi)
  - `tests/unit/admin-order-costs.test.ts` (tạo mới)
  - `CHANGELOG.md` (cập nhật)
- **Kiểm thử đã chạy:**
  - Unit test mới: `node ./node_modules/vitest/vitest.mjs run tests/unit/admin-order-costs.test.ts` (4 passed)
  - Typecheck: `node ./node_modules/typescript/bin/tsc --noEmit` (0 errors)
- **Cách rollback:**
  - `git checkout -- src/app/api/admin/purchase-tasks/[id]/route.ts CHANGELOG.md`
  - `Remove-Item src/app/api/admin/orders/[id]/costs/route.ts, tests/unit/admin-order-costs.test.ts`

---

## [WP2.3] - 04/11/2026: Báo Cáo Tài Chính V2 & Xuất Dữ Liệu CSV

- **Ngày thực hiện:** 04/11/2026
- **Mã gói việc:** WP2.3
- **Thay đổi:**
  - Viết lại route báo cáo `src/app/api/admin/reports/route.ts` theo đúng công thức tài chính v2:
    - Loại bỏ hoàn toàn đơn hàng `CANCELLED` khỏi mọi chỉ số doanh thu, GMV và chi phí.
    - `GMV`: Tổng `productPriceVnd` của các đơn không hủy.
    - `Doanh thu dịch vụ`: Tổng `serviceFeeVnd + shippingFeeVnd` của các đơn `COMPLETED`.
    - `Tiền thực thu`: Tổng `PaymentTransaction` hiệu lực (`DEPOSIT`, `BALANCE`, `LEGACY`), trừ các khoản hoàn tiền `REFUND`, bỏ qua các giao dịch `VOIDED` và `PENDING_RECONCILE`.
    - `Chi phí thực`: Tổng các dòng `OrderCostLine` chưa bị vô hiệu hóa (`voidedAt === null`).
    - `Lợi nhuận gộp`: Chỉ tính cho các đơn `COMPLETED` có ghi nhận dòng chi phí tiền mua hàng `GOODS_JPY` (`totalVnd - chiPhiThuc`). Các đơn thiếu dòng `GOODS_JPY` được gắn cờ "chưa đủ chi phí" và tách riêng khỏi tổng lãi gộp.
    - Bổ sung mục thống kê độc lập cho luồng vận chuyển Việt Nam → Nhật Bản (`vnJpSummary`).
  - Thêm endpoint xuất dữ liệu `GET /api/admin/reports/export?from&to&format=csv`:
    - Xuất đầy đủ các cột: Mã đơn, Ngày, Trạng thái, GMV, Phí dịch vụ, Cước bay, Tổng tiền, Đã thu, Chi phí thực, Lãi gộp, Cờ.
    - Chèn chuỗi byte UTF-8 BOM (`0xEF, 0xBB, 0xBF`) ở đầu file giúp Microsoft Excel trên Windows tự động nhận diện đúng tiếng Việt có dấu.
- **Files thay đổi / tạo mới:**
  - `src/app/api/admin/reports/route.ts` (sửa đổi)
  - `src/app/api/admin/reports/export/route.ts` (tạo mới)
  - `tests/unit/admin-reports-v2.test.ts` (tạo mới)
  - `CHANGELOG.md` (cập nhật)
- **Kiểm thử đã chạy:**
  - Unit test mới: `node ./node_modules/vitest/vitest.mjs run tests/unit/admin-reports-v2.test.ts` (3 passed)
  - Typecheck: `node ./node_modules/typescript/bin/tsc --noEmit` (0 errors)
- **Cách rollback:**
  - `git checkout -- src/app/api/admin/reports/route.ts CHANGELOG.md`
  - `Remove-Item src/app/api/admin/reports/export/route.ts, tests/unit/admin-reports-v2.test.ts`

---

## [WP2.2] - 04/11/2026: Hoàn Tác Bằng Bản Ghi Đảo, Tách Giao Hàng Khỏi Thanh Toán, Sửa Cron

- **Ngày thực hiện:** 04/11/2026
- **Mã gói việc:** WP2.2
- **Thay đổi:**
  - Loại bỏ hoàn toàn `paymentTransaction.deleteMany` khỏi toàn bộ codebase (bao gồm `orders/[id]/route.ts` và `mock-transition/route.ts`).
  - Khi hoàn tác trạng thái đơn hàng từ `COMPLETED` về `LOCAL_DELIVERY`: đánh dấu giao dịch COD ban đầu thành `status = "VOIDED"` kèm `voidedAt`, tạo bản ghi đảo với `kind = "REVERSAL"`, số tiền âm (`-amountVnd`), `reversalOfId` trỏ về giao dịch gốc, đồng thời ghi nhận `AuditLog` chi tiết. Khôi phục `paymentStatus` và `depositAmountVnd` theo tổng số tiền của các giao dịch `CONFIRMED` thực tế còn hiệu lực.
  - Sửa `src/app/api/cron/auto-tracking/route.ts`: khi đơn hàng hoàn tất giao hàng (`COMPLETED`), cron chỉ cập nhật trạng thái vận chuyển, tuyệt đối không tự ý gán `PAID_100` và không gán `depositAmountVnd = order.totalVnd`. Với phần tiền còn lại, tạo giao dịch `COD_SETTLEMENT` với `status = "PENDING_RECONCILE"` và `kind = "BALANCE"`.
  - Chặn chuyển trạng thái sang `IN_TRANSIT_AIR`, `LOCAL_DELIVERY`, hoặc `COMPLETED` nếu đơn hàng có nguồn kho ngoài Việt Nam (`fulfillmentOrigin !== "VN"`) mà `weightKg <= 0`.
- **Files thay đổi / tạo mới:**
  - `src/app/api/orders/[id]/route.ts` (sửa đổi)
  - `src/app/api/admin/orders/[id]/mock-transition/route.ts` (sửa đổi)
  - `src/app/api/cron/auto-tracking/route.ts` (sửa đổi)
  - `tests/unit/payment-reversal-and-delivery-split.test.ts` (tạo mới)
  - `CHANGELOG.md` (cập nhật)
- **Kiểm thử đã chạy:**
  - Unit test mới: `node ./node_modules/vitest/vitest.mjs run tests/unit/payment-reversal-and-delivery-split.test.ts` (4 passed)
  - Toàn bộ unit tests: 44 files passed, 327 passed, 0 failed, 7.41s
  - Quét tĩnh: `grep -rn "paymentTransaction.deleteMany" src` trả về 0 kết quả
  - Typecheck: `node ./node_modules/typescript/bin/tsc --noEmit` (0 errors)
- **Cách rollback:**
  - `git checkout -- src/app/api/orders/[id]/route.ts src/app/api/admin/orders/[id]/mock-transition/route.ts src/app/api/cron/auto-tracking/route.ts CHANGELOG.md`
  - `Remove-Item tests/unit/payment-reversal-and-delivery-split.test.ts`

---

## [WP2.1] - 04/11/2026: Schema Thanh Toán Đảo & Bảng Dòng Chi Phí (OrderCostLine)

- **Ngày thực hiện:** 04/11/2026
- **Mã gói việc:** WP2.1
- **Thay đổi:**
  - Mở rộng model `PaymentTransaction`: thêm `kind` (`DEPOSIT`, `BALANCE`, `REFUND`, `REVERSAL`, `LEGACY` với mặc định là `LEGACY`), `reversalOfId` (quan hệ tự tham chiếu `@relation("PaymentReversals")`), `voidedAt`, `note`, `shipmentId`, cùng các index tương ứng. Trạng thái `status` hỗ trợ thêm giá trị `VOIDED`.
  - Tạo model mới `OrderCostLine`: lưu trữ các dòng chi phí phát sinh thực tế (`GOODS_JPY`, `JP_DOMESTIC_SHIP`, `TOKYO_HANDLING`, `INTL_FREIGHT`, `VN_DOMESTIC_SHIP`, `IMPORT_TAX`, `PAYMENT_FEE`, `FX_FEE`, `OTHER`), hỗ trợ tiền tệ gốc, tỷ giá quy đổi, `amountVnd` (số nguyên), `receiptUrl`, `createdBy`, `voidedAt`, `purchaseTaskId`, `shipmentId`.
  - Thiết lập quan hệ `costLines OrderCostLine[]` trên model `Order` và `PurchaseTask`.
  - Tạo migration an toàn chỉ thêm `prisma/migrations/20261104000001_add_payment_reversals_and_order_cost_lines/migration.sql`.
  - Tạo module tài chính `src/features/finance/cost-lines.ts`: cung cấp các hàm nghiệp vụ `createCostLine`, `voidCostLine` (đánh dấu cờ `voidedAt` thay vì xóa cứng), `createReversal` (tạo bản ghi đảo âm tiền và đánh dấu bản gốc `VOIDED`). Tuyệt đối không cung cấp hàm xóa cứng.
- **Files thay đổi / tạo mới:**
  - `prisma/schema.prisma` (sửa đổi)
  - `prisma/migrations/20261104000001_add_payment_reversals_and_order_cost_lines/migration.sql` (tạo mới)
  - `src/features/finance/cost-lines.ts` (tạo mới)
  - `src/features/finance/index.ts` (tạo mới)
  - `tests/unit/finance-cost-lines.test.ts` (tạo mới)
  - `CHANGELOG.md` (cập nhật)
- **Kiểm thử đã chạy:**
  - Unit test mới: `node ./node_modules/vitest/vitest.mjs run tests/unit/finance-cost-lines.test.ts` (7 passed)
  - Typecheck: `node ./node_modules/typescript/bin/tsc --noEmit` (0 errors)
- **Cách rollback:**
  - `git checkout -- prisma/schema.prisma CHANGELOG.md`
  - `Remove-Item -Recurse prisma/migrations/20261104000001_add_payment_reversals_and_order_cost_lines, src/features/finance, tests/unit/finance-cost-lines.test.ts`

---

## [WP1.3] - 04/11/2026: Hợp Nhất SystemConfig Vào PricingConfig

- **Ngày thực hiện:** 04/11/2026
- **Mã gói việc:** WP1.3
- **Thay đổi:**
  - Xuất tài liệu ma trận đối chiếu cấu hình `docs/CONFIG_MAP.md`: ánh xạ toàn bộ 6 tham số giá giữa `SystemConfig` và `PricingConfig`.
  - Cập nhật `src/lib/system-config.ts`: ủy quyền hàm `getSystemConfig()` đọc trực tiếp từ `getCurrentPricingConfig()`. PricingConfig trở thành Single Source of Truth duy nhất cho các tham số giá, cước và tỷ giá sàn.
  - Vô hiệu hóa cache đồng bộ giữa hai hệ thống thông qua `invalidateSystemConfigCache()`.
  - Tinh chỉnh `src/features/pricing/config.ts`: tách biệt kiểm tra số học và cờ boolean `groupBuyEnabled`, bảo đảm TypeScript strict không báo lỗi TS2741/TS2322.
- **Files thay đổi / tạo mới:**
  - `docs/CONFIG_MAP.md` (tạo mới)
  - `src/lib/system-config.ts` (sửa đổi)
  - `src/features/pricing/config.ts` (sửa đổi)
  - `tests/unit/pricing-config-consolidation.test.ts` (tạo mới)
  - `CHANGELOG.md` (cập nhật)
- **Kiểm thử đã chạy:**
  - Unit test mới: `node ./node_modules/vitest/vitest.mjs run tests/unit/pricing-config-consolidation.test.ts` (3 passed)
  - Toàn bộ unit tests: `node ./node_modules/vitest/vitest.mjs run` (42/42 files passed, 316/316 tests passed, 0 failed, 6.75s)
  - Typecheck: `node ./node_modules/typescript/bin/tsc --noEmit` (0 errors)
- **Cách rollback:**
  - `git checkout -- src/lib/system-config.ts src/features/pricing/config.ts CHANGELOG.md`
  - `Remove-Item docs/CONFIG_MAP.md, tests/unit/pricing-config-consolidation.test.ts`

---

## [WP1.2] - 04/11/2026: Khóa Tick Gộp Đơn, Hạn Giữ Kho Giỏ Hỗn Hợp, Giải Phóng Kho

- **Ngày thực hiện:** 04/11/2026
- **Mã gói việc:** WP1.2
- **Thay đổi:**
  - Cấu hình hóa `groupBuyEnabled` (mặc định tắt) trong `PricingConfigValues`. `calculateOrderPrice` bỏ qua `isGroupBuy` khi tính năng này chưa được kích hoạt.
  - Bổ sung trường nullable `quoteHoldExpiresAt DateTime?` và index tương ứng trên model `Order` (`prisma/schema.prisma`).
  - Tạo migration an toàn chỉ thêm cột `20261104000000_add_quote_hold_expires_at/migration.sql`.
  - Giỏ hàng hỗn hợp (catalog + external link) được gán `quoteHoldExpiresAt = now + 24h` khi tạo đơn; khi admin duyệt giá thì xóa `quoteHoldExpiresAt` và đặt `reservationExpiresAt`.
  - Nâng cấp `src/features/orders/reservations.ts`: giải phóng tồn kho cho các đơn quá hạn `quoteHoldExpiresAt` hoặc `reservationExpiresAt`, bổ sung cơ chế quét lazy `lazyReleaseExpiredReservations()` hạn chế tần suất 1 lần/phút khi gọi API catalog hoặc tạo đơn.
- **Files thay đổi / tạo mới:**
  - `prisma/schema.prisma` (sửa đổi)
  - `prisma/migrations/20261104000000_add_quote_hold_expires_at/migration.sql` (tạo mới)
  - `src/features/pricing/calculator.ts` (sửa đổi)
  - `src/features/pricing/config.ts` (sửa đổi)
  - `src/features/orders/reservations.ts` (sửa đổi)
  - `src/app/api/orders/route.ts` (sửa đổi)
  - `src/app/api/orders/[id]/route.ts` (sửa đổi)
  - `tests/unit/group-buy-and-reservation.test.ts` (tạo mới)
- **Kiểm thử đã chạy:**
  - Unit test mới: `node ./node_modules/vitest/vitest.mjs run tests/unit/group-buy-and-reservation.test.ts` (5 passed)
  - Toàn bộ unit tests: 313 passed, 0 failed
  - Typecheck: `node ./node_modules/typescript/bin/tsc --noEmit` (0 errors)
- **Cách rollback:**
  - `git checkout -- prisma/schema.prisma src/features/pricing/calculator.ts src/features/pricing/config.ts src/features/orders/reservations.ts src/app/api/orders/route.ts src/app/api/orders/[id]/route.ts`
  - `Remove-Item -Recurse prisma/migrations/20261104000000_add_quote_hold_expires_at`

---

## [WP1.1] - 04/11/2026: Server Tự Quyết FulfillmentOrigin & Tính Giá An Toàn

- **Ngày thực hiện:** 04/11/2026
- **Mã gói việc:** WP1.1
- **Thay đổi:**
  - Bổ sung hàm `resolveOrderFulfillmentOrigin(hasNonVnItem, itemsCount)` trong `src/features/orders/policy.ts`. Nguồn kho chỉ là `'VN'` khi toàn bộ sản phẩm trong đơn là hàng catalog có `Product.fulfillmentOrigin = 'VN'`; nếu có bất kỳ mặt hàng non-VN nào hoặc đơn rỗng thì luôn ép về `'JP'`.
  - Loại bỏ hoàn toàn lỗ hổng cho phép client tự gửi `body.fulfillmentOrigin = 'VN'` tại `src/app/api/orders/route.ts`.
  - Sửa `src/app/api/orders/[id]/route.ts`: truyền `existingOrder.fulfillmentOrigin` vào toàn bộ các lời gọi `calculateOrderPrice` (nhánh duyệt giá và nhánh cập nhật cân nặng), tránh việc đơn origin VN bị tự động cộng cước bay quốc tế Tokyo-VN.
- **Files thay đổi / tạo mới:**
  - `src/features/orders/policy.ts` (sửa đổi)
  - `src/app/api/orders/route.ts` (sửa đổi)
  - `src/app/api/orders/[id]/route.ts` (sửa đổi)
  - `tests/unit/order-origin.test.ts` (tạo mới)
  - `CHANGELOG.md` (cập nhật)
- **Kiểm thử đã chạy:**
  - Unit test mới: `node ./node_modules/vitest/vitest.mjs run tests/unit/order-origin.test.ts` (7 passed)
  - Toàn bộ unit tests: `node ./node_modules/vitest/vitest.mjs run` (40/40 files passed, 308/308 tests passed, 0 failed, 7.22s)
  - Typecheck: `node ./node_modules/typescript/bin/tsc --noEmit` (0 errors)
- **Cách rollback:**
  - `git checkout -- src/features/orders/policy.ts src/app/api/orders/route.ts src/app/api/orders/[id]/route.ts CHANGELOG.md`
  - `Remove-Item tests/unit/order-origin.test.ts`

---

## [WP0.2] - 04/11/2026: Tách Demo/Production, Khóa Mật Khẩu Master

- **Ngày thực hiện:** 04/11/2026
- **Mã gói việc:** WP0.2
- **Thay đổi:**
  - Bỏ hoàn toàn chuỗi mật khẩu mặc định hard-coded (`Admin@2026`) khỏi mã nguồn.
  - Tạo helper `isDemoSelfHealEnabled()`: chế độ tự phục hồi admin chỉ cho phép kích hoạt duy nhất khi `ENABLE_DEMO_SELF_HEAL === 'true'` VÀ `APP_ENV === 'demo'`.
  - Sửa `src/app/api/admin/auth/route.ts`: loại bỏ bypass rate limit cho master admin, bắt buộc mọi lượt đăng nhập phải qua `getMaxBlockedSeconds`. Đường tự phục hồi yêu cầu `isDemoSelfHealEnabled()` và `ADMIN_INITIAL_PASSWORD` được đặt rõ ràng.
  - Sửa `prisma/seed.js` và `scripts/set-admin.js`: bắt buộc truyền mật khẩu qua biến môi trường hoặc tham số; thiếu thì thoát với thông báo hướng dẫn rõ ràng.
  - Cập nhật `.env.example`: thêm `APP_ENV` và `ENABLE_DEMO_SELF_HEAL` (ghi chú cấm bật trên production); loại bỏ mật khẩu mẫu thật.
  - Tạo tài liệu `docs/ENVIRONMENTS.md`: bảng đối chiếu biến môi trường Demo vs Production và checklist các bước quản trị viên thực hiện tay trên Vercel/Neon.
- **Files thay đổi / tạo mới:**
  - `src/lib/demo-mode.ts` (tạo mới)
  - `src/app/api/admin/auth/route.ts` (sửa đổi)
  - `prisma/seed.js` (sửa đổi)
  - `scripts/set-admin.js` (sửa đổi)
  - `.env.example` (sửa đổi)
  - `docs/ENVIRONMENTS.md` (tạo mới)
  - `tests/unit/demo-self-heal.test.ts` (tạo mới)
  - `CHANGELOG.md` (cập nhật)
- **Kiểm thử đã chạy:**
  - Unit test mới: `node ./node_modules/vitest/vitest.mjs run tests/unit/demo-self-heal.test.ts` (11 passed, 11 tests)
  - Toàn bộ unit tests: `node ./node_modules/vitest/vitest.mjs run` (39/39 files passed, 301/301 tests passed, 0 failed, 6.69s)
  - Quét tĩnh: `Get-ChildItem -Path src, prisma, scripts -Recurse -File | Select-String "Admin@2026"` -> 0 kết quả
  - Typecheck: `node ./node_modules/typescript/bin/tsc --noEmit` (0 errors)
  - Build: `$env:NEXT_CPU_COUNT="1"; node ./node_modules/prisma/build/index.js generate; node ./node_modules/next/dist/bin/next build` (Thành công 18/18 routes)
- **Cách rollback:**
  - `git checkout -- src/app/api/admin/auth/route.ts prisma/seed.js scripts/set-admin.js .env.example CHANGELOG.md`
  - `Remove-Item src/lib/demo-mode.ts, docs/ENVIRONMENTS.md, tests/unit/demo-self-heal.test.ts`

---

## [WP0.1] - 04/11/2026: Baseline, Luật Cho Agent và Changelog

- **Ngày thực hiện:** 04/11/2026
- **Mã gói việc:** WP0.1
- **Thay đổi:**
  - Khảo sát hiện trạng toàn diện codebase (Unit test, Typecheck, Linter, Build, Schema).
  - Thiết lập bộ quy chuẩn vận hành, nguyên tắc bất biến và quy trình 6 bước cho AI Agent (`AGENTS.md`).
  - Thiết lập nhật ký thay đổi dự án chuẩn (`CHANGELOG.md`).
  - Ghi nhận số liệu kiểm thử đường cơ sở thực tế (`docs/BASELINE.md`) với 38/38 unit test files (290 tests pass), 0 type errors, build thành công.
  - Cập nhật tài liệu trạng thái kỹ thuật (`docs/STATUS.md`) phản ánh các module thực tế hiện có.
- **Files thay đổi / tạo mới:**
  - `AGENTS.md` (tạo mới)
  - `CHANGELOG.md` (tạo mới)
  - `docs/BASELINE.md` (tạo mới)
  - `docs/STATUS.md` (cập nhật)
- **Kiểm thử đã chạy:**
  - Unit tests: `node ./node_modules/vitest/vitest.mjs run` (38 passed, 290 passed, 0 failed, 7.48s)
  - Typecheck: `node ./node_modules/typescript/bin/tsc --noEmit` (0 errors)
  - Lint: `node ./node_modules/next/dist/bin/next lint` (0 errors)
  - Build: `$env:NEXT_CPU_COUNT="1"; node ./node_modules/prisma/build/index.js generate; node ./node_modules/next/dist/bin/next build` (Thành công)
- **Cách rollback:**
  - `git checkout -- docs/STATUS.md`
  - Xóa các file: `AGENTS.md`, `CHANGELOG.md`, `docs/BASELINE.md`

