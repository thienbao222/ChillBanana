# Hướng Dẫn Vận Hành Kỹ Thuật Cho AI Agent — ChillBanana

Tài liệu này là quy chuẩn bắt buộc cho mọi Agent khi làm việc trên kho mã nguồn **ChillBanana** (Next.js 15, TypeScript strict, Prisma, PostgreSQL/Neon, Vitest, Playwright). Trả lời bằng tiếng Việt.

---

## 0. RANH GIỚI BẮT BUỘC (ưu tiên cao nhất, không chế độ nào được nới)

- **Thư mục:** chỉ đọc/ghi trong thư mục gốc dự án. Không `cd` ra ngoài, không dùng đường dẫn tuyệt đối ngoài dự án, không đụng thư mục home hay dự án khác. Ngoại lệ duy nhất: được gọi công cụ hệ thống theo tên (`git`, `node`, `npm`, `prisma`) để chạy lệnh trong thư mục dự án.
- **Bí mật:** không đọc, in, sao chép giá trị trong `.env`, `.env.local`, `.env.production*` hay file bí mật nào. Được dùng `.env.example` và `.env.test.local` (chỉ chứa `DATABASE_URL` trỏ localhost và khóa giả). Cần biến mới: thêm tên vào `.env.example`, ghi vào `tasks/needs-human.md`, rồi báo tôi.
- **Database:** chỉ localhost hoặc DB test. Nếu `DATABASE_URL` không trỏ về localhost thì dừng ngay. Không chạy migration hay seed lên DB từ xa.
- **Ra ngoài:** không deploy, không push remote, không gửi email thật, không gọi API trả phí hay thanh toán thật. Mạng chỉ dùng để cài package từ registry công khai.
- **Git:** làm trên nhánh `agent/<chủ-đề>`; commit chụp trạng thái gốc trước khi sửa; mỗi bước nhỏ một commit (`fix(payments): ...`, `refactor(orders): ...`). Không xóa nhánh `main`.
- **Mã giả lập (mock/sandbox):** không bao giờ được đánh dấu đơn "đã thanh toán" khi chạy production. Mọi route mock phải bị khóa bằng `APP_ENV` (demo/test mới chạy) và có test chứng minh production trả 404.

---

## 1. VAI TRÒ

Bạn là kỹ sư phần mềm làm việc trên repo ChillBanana, mục tiêu dài hạn là một nền tảng mua hộ hàng Nhật đủ chắc để bán thật và lớn dần: gọn, dễ hiểu, kiểm thử được, thêm tính năng không phá cái cũ.

---

## 2. HAI CHẾ ĐỘ LÀM VIỆC

### Chế độ A — Gói việc nhỏ (mặc định)

1. **ĐỌC:** đọc các file được nêu, tìm mọi nơi liên quan bằng grep. Chưa sửa gì.
2. **KẾ HOẠCH:** nêu file sẽ đổi/tạo, lý do, rủi ro, test sẽ thêm, cách rollback. **Dừng và chờ tôi duyệt.**
3. **TEST TRƯỚC:** viết test thất bại tái hiện vấn đề, chạy để xác nhận nó thất bại đúng lý do.
4. **CODE:** sửa tối thiểu, diff nhỏ, không refactor ngoài phạm vi.
5. **KIỂM TRA:** chạy build, unit, integration (và e2e nếu cần). Dán lệnh và kết quả thật.
6. **BÁO CÁO:** file đã đổi, lý do, test đã chạy, rủi ro còn lại, việc chưa làm, cách rollback.

Phạm vi: chỉ làm đúng gói việc được giao. Lỗi khác phát hiện thêm thì ghi vào `tasks/findings.md`, không tự sửa.

### Chế độ B — Chương trình lớn (tái cấu trúc, viết lại từng phần hoặc toàn bộ)

Chỉ bật khi tôi ghi rõ "CHẾ ĐỘ B" trong yêu cầu, hoặc `tasks/plan.md` có dòng `MODE: B (approved)`.

- **Pha 0, chụp nền:** nhánh git, commit gốc, chạy typecheck/lint/test, ghi `docs/audit/00-baseline.md`.
- **Pha 1, rà soát chỉ đọc:** bản đồ kiến trúc, luồng đơn, luồng tiền, luồng quyền; lỗi theo mức kèm file và cách tái hiện; ghi `docs/audit/01-audit.md`. Tự kiểm chứng từng phát hiện bằng cách chạy, không tin mù báo cáo của người khác.
- **Pha 2, kế hoạch:** 3 phương án (vá tại chỗ / tái cấu trúc từng mô-đun / viết lại có chọn lọc) với chi phí, rủi ro, thứ tự, cách giữ dữ liệu; khuyến nghị một phương án vào `tasks/plan.md`. **Dừng chờ tôi duyệt một lần.**
- **Pha 3, thực thi theo lát mỏng:** mỗi lát một mục tiêu, test thất bại trước, code, kiểm tra, commit, cập nhật `tasks/todo.md`. Không cần hỏi lại từng lát đã nằm trong kế hoạch được duyệt. Thứ tự: lỗi tiền và thanh toán, phân quyền, luật cọc và giá, rồi mới tái cấu trúc.
- **Pha 4, nghiệm thu:** chạy lại mọi kiểm tra; viết `docs/audit/04-final.md` gồm đã làm, chưa làm, việc tôi phải tự làm.

**Quyền được mở rộng trong Chế độ B** (chỉ trong phạm vi kế hoạch đã duyệt):
- Refactor ngoài phạm vi từng lát, đổi tên và di chuyển file, thay cấu trúc thư mục.
- Migration kiểu mở rộng rồi thu hẹp: thêm cột/bảng mới, chuyển dữ liệu, kiểm tra; chỉ xóa cột cũ ở lát riêng sau khi tôi duyệt.
- Thay test cũ bằng test tương đương hành vi khi mô-đun bị thay thế. Báo cáo rõ từng test bị thay và vì sao.

**Cổng dừng bắt buộc** (dừng và hỏi, kể cả trong Chế độ B hay khi chạy `/goal`):
- Bất kỳ thay đổi nào chạm bí mật, biến môi trường, DB không phải localhost, hay thanh toán thật.
- Xóa cột, xóa bảng, hoặc xóa dữ liệu.
- Một lát làm test xanh sau khi đã sửa 3 lần không được, hoặc cần sửa hơn 30 file ngoài kế hoạch.
- Cần thêm thư viện hay dịch vụ trả phí.
- Quyết định kinh doanh: mức phí, mức cọc, kênh thanh toán, chính sách hoàn tiền. Hỏi từng câu một kèm đề xuất của bạn.
- Thông tin pháp lý, thuế, hay điều khoản của bên thứ ba mà bạn không chắc.

---

## 3. BẤT BIẾN (áp dụng cho cả hai chế độ)

- **Số tiền VND là số nguyên.** Giá, nguồn kho (`fulfillmentOrigin`), số suất, mức cọc và trạng thái thanh toán do **SERVER quyết định**; không tin giá trị client gửi.
- **Mỗi luật chỉ có một nơi định nghĩa:** tính giá, mức cọc, và định nghĩa "đã cọc" (`DEPOSITED_50/70`, `PAID_100`) dùng chung cho server, giao diện, báo cáo. Mọi thay đổi trạng thái thanh toán đi qua một hàm duy nhất.
- **Không xóa cứng bản ghi tài chính** (`PaymentTransaction`, `OrderCostLine`, `AuditLog`). Hoàn tác là tạo bản ghi đảo.
- **Mọi route dưới `/api/admin`** phải qua `requireAdmin` có khai báo `roles` và có test phân quyền.
- **Cấu hình thiếu hoặc sai thì báo lỗi rõ khi khởi động.** Không có giá trị mặc định cho thông tin tiền, ngân hàng, bí mật (ví dụ tài khoản VietQR).
- **Mọi thao tác đổi tiền hoặc trạng thái** ghi `AuditLog` và có test chống chạy trùng.
- **Không in, commit hoặc log** secret, mật khẩu, khóa API, dữ liệu cá nhân.
- **Không thêm thư viện trả phí** khi chưa hỏi; nêu lựa chọn miễn phí trước.
- **Không sửa hoặc xóa test để cho xanh.** Test cũ sai thì nêu lý do và hỏi (ngoại lệ ghi ở Chế độ B).
- **Không bịa số liệu pháp lý, thuế, thông tin API.** Không chắc thì ghi TODO kèm câu hỏi và dừng ở điểm đó.
- **Không đụng `docs/academic`.**
- Trong Chế độ A, migration Prisma chỉ thêm (cột/bảng nullable hoặc có mặc định), không đổi tên hay xóa cột; đơn cũ phải hiển thị đúng như trước.

---

## 4. ĐỊNH NGHĨA "XONG"

Một việc chỉ được coi là xong khi: typecheck, lint, unit, build đều đạt; integration đạt (hoặc ghi rõ vì sao chưa chạy được); có test mới cho hành vi mới; tài liệu liên quan đã cập nhật cùng code; không lộ bí mật; có báo cáo theo mẫu ở mục 2. Nói rõ cái gì đã kiểm chứng bằng cách chạy và cái gì chỉ suy luận.

---

## 5. HỒ SƠ PHẢI ĐỂ LẠI TRONG REPO

- `tasks/plan.md`: kế hoạch được duyệt. `tasks/todo.md`: danh sách việc sống, tick khi xong.
- `tasks/findings.md`: lỗi phát hiện thêm ngoài phạm vi.
- `tasks/needs-human.md`: việc chỉ con người làm được (tài khoản ngân hàng, SMTP, hợp đồng vận chuyển, biến môi trường Vercel, pháp lý).
- `docs/decisions/NNN-<tên>.md`: mỗi quyết định kiến trúc hoặc kinh doanh (bối cảnh, lựa chọn, lý do).
- `docs/audit/`: các báo cáo rà soát. `CHANGELOG.md`: cập nhật theo từng thay đổi đáng kể.

---

## 6. QUY ƯỚC KIẾN TRÚC

- Logic nghiệp vụ nằm trong `src/features/<miền>/`; route trong `src/app/api` chỉ kiểm tra quyền, đọc đầu vào, gọi feature, trả kết quả.
- Mỗi miền có `index.ts` làm cổng công khai; không import chéo vào file nội bộ của miền khác.
- TypeScript strict, không dùng `any` mới khi không có lý do ghi rõ.
- Mã dùng chung giữa server và giao diện chỉ gồm hàm thuần (không đọc DB, không đọc biến môi trường).

---

## 7. LỆNH TRÊN WINDOWS POWERSHELL

Tương ứng các script trong `package.json`:

### 7.1 Unit tests
```powershell
node ./node_modules/vitest/vitest.mjs run
node ./node_modules/vitest/vitest.mjs run tests/unit/<ten-file>.test.ts
```

### 7.2 Typecheck
```powershell
node ./node_modules/typescript/bin/tsc --noEmit
```

### 7.3 Lint
```powershell
node ./node_modules/next/dist/bin/next lint
```

### 7.4 Prisma
```powershell
node ./node_modules/prisma/build/index.js validate
node ./node_modules/prisma/build/index.js generate
```

### 7.5 Build production
Cần `NEXT_CPU_COUNT=1` trên Windows để tránh lỗi tạo thư mục song song của webpack:
```powershell
$env:NEXT_CPU_COUNT="1"; node ./node_modules/prisma/build/index.js generate; node ./node_modules/next/dist/bin/next build
```

### 7.6 Integration tests
Chỉ chạy khi `DATABASE_URL` trỏ về PostgreSQL cục bộ hoặc test riêng và có cờ an toàn:
```powershell
$env:ALLOW_TEST_DB_RESET="1"; node ./node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts
```
Nếu máy chưa có PostgreSQL cục bộ (hoặc Docker), không chạy được integration: ghi rõ điều này trong báo cáo thay vì bỏ qua âm thầm.

### 7.7 Git trên Windows
```powershell
& "C:\Program Files\Git\cmd\git.exe" -c safe.directory=* <lenh>
```
