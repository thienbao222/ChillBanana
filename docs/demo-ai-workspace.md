# KỊCH BẢN THUYẾT TRÌNH BÁO CÁO TỐT NGHIỆP: AGENTIC AI WORKSPACE (R4)
## HỆ THỐNG ĐIỀU HÀNH TÁC NGHIỆP TỰ ĐỘNG ĐA AGENT NỀN TẢNG CHILLBANANA

Tài liệu này được biên soạn làm cẩm nang hướng dẫn trực tiếp cho sinh viên/nhóm phát triển khi trình diễn (live demo) trước Hội đồng Đánh giá Đồ án Tốt nghiệp. Kịch bản được thiết kế theo cấu trúc 6 bước mạch lạc, làm nổi bật giá trị công nghệ tác tử (Agentic AI), kiến trúc phân quyền Phương án B và tính minh bạch bất biến của hệ thống.

---

## TỔNG QUAN Ý TƯỞNG THUYẾT TRÌNH & ĐIỂM NHẤN CÔNG NGHỆ

- **Vấn đề thực tế:** Các hệ thống mua hộ truyền thống phụ thuộc nặng nề vào các vai trò nhân sự phân mảnh tĩnh (Mua hàng, Thủ kho, Kế toán, Chăm sóc khách hàng). Ở quy mô doanh nghiệp vừa và nhỏ, việc chia nhỏ 5 vai trò gây lãng phí định biên nhân sự và tạo ra các điểm nghẽn luồng xử lý (handoff bottlenecks).
- **Giải pháp ChillBanana (Phương án B):** Giữ đúng **2 vai trò Admin người thật** (`SUPER_ADMIN` quản trị chiến lược, `OPERATOR` chuyên viên vận hành) và chuyển giao toàn bộ 4 khối nghiệp vụ chuyên sâu cho **4 AI Agent chuyên trách**.
- **Đột phá giao diện:** Không sử dụng khung chatbox hỏi-đáp thụ động mà triển khai **Bàn Điều Hành Tác Nghiệp Tự Động (Multi-Agent Mission Control Center)** với sơ đồ quy trình trực quan (Pipeline Canvas), bảng điều khiển tương tác (Interactive Consoles) và dòng kiểm toán thời gian thực (Realtime Audit Stream).

---

## KỊCH BẢN 6 BƯỚC DEMO TRỰC TIẾP TRƯỚC HỘI ĐỒNG

### BƯỚC 1: GIỚI THIỆU TỔNG QUAN TRUNG TÂM CHỈ HUY TÁC NGHIỆP ĐA AGENT (2 PHÚT)

**Thao tác trên màn hình:**
1. Đăng nhập vào trang Quản trị: `http://localhost:3000/admin`.
2. Trên thanh điều hướng chính, bấm vào nút **`🤖 AI Workspace`**.
3. Màn hình Trung tâm Chỉ huy xuất hiện với 4 khu vực rõ rệt:
   - Header Roster 4 Agent (`ONLINE`, tỷ lệ thành công > 99%).
   - Sơ đồ Pipeline 7 bước (Tạo đơn ➔ Kiểm dịch ➔ Kiểm toán cọc ➔ Mua JP ➔ Kho Tokyo ➔ Thu số dư VN ➔ Giao hàng).
   - 4 Interactive Agent Consoles.
   - Realtime Audit Stream.

**Lời thoại gợi ý cho sinh viên:**
> *"Kính thưa Thầy/Cô Hội đồng, thay vì tiếp cận AI dưới dạng một chatbot đàm thoại rời rạc, dự án ChillBanana xây dựng một **Agentic AI Workspace** hoàn chỉnh. Hệ thống tổ chức một Biệt đội gồm 4 Agent chuyên trách tương ứng 4 vị trí then chốt trong chuỗi cung ứng hàng Nhật: Purchasing Agent, Quarantine Agent, Financial Audit Agent và Executive Assistant. Toàn bộ chuỗi vận hành được trực quan hóa qua Pipeline Canvas 7 bước, giúp người vận hành nắm bắt ngay lập tức trạng thái của từng mắt xích."*

---

### BƯỚC 2: DEMO AGENT KIỂM DỊCH — PHÁT HIỆN HÀNG CẤM MAFF & IATA (3 PHÚT)

**Thao tác trên màn hình:**
1. Trong khu vực Consoles, bấm chọn Tab **`2. Quarantine Agent (Kiểm Dịch MAFF & IATA)`**.
2. **Kịch bản Thử thách 1 (Vi phạm kiểm dịch MAFF):**
   - Nhập vào ô mô tả kiện hàng: `"1 áo len Uniqlo, 2 hộp bánh đậu xanh và 500g ruốc thịt heo"`.
   - Bấm nút **`Rà Soát Kiểm Dịch MAFF & Quy Đổi IATA`**.
   - **Kết quả hiển thị:** Banner đỏ rực cảnh báo: `CẢNH BÁO ĐỎ: Phát hiện mặt hàng cấm (ruốc thịt heo)!`. Agent trích dẫn rõ điều khoản Luật Kiểm dịch Động vật MAFF Nhật Bản và khuyến nghị loại bỏ món cấm trước khi bay.
3. **Kịch bản Thử thách 2 (Hàng nguy hiểm IATA & Cân thể tích):**
   - Sửa nội dung thành: `"Tai nghe bluetooth và sạc dự phòng pin lithium 20.000mAh"`.
   - Bấm quét.
   - **Kết quả hiển thị:** Cảnh báo nguy hiểm bay IATA DGR Class 9 (Lithium Battery nguy cơ cháy nổ trong khoang áp suất).
4. **Kịch bản Hàng an toàn & Tính cước thể tích IATA:**
   - Sửa nội dung thành: `"Mô hình Figure One Piece chính hãng bằng nhựa PVC"`.
   - Nhập kích thước: Dài 40cm, Rộng 30cm, Cao 25cm; Cân nặng thực tế: 2.0 kg.
   - Bấm quét.
   - **Kết quả hiển thị:** Trạng thái xanh `SAFE`. Phần máy tính IATA tự động tính:
     $$\text{Cân thể tích} = \frac{40 \times 30 \times 25}{5000} = 6.0\text{ kg} > \text{Cân thực } 2.0\text{ kg}$$
     Agent đề xuất tính cước theo $6.0\text{ kg}$, gợi ý quy chuẩn đóng thùng `BOX_L` và tự động tra cứu mã HS Code `9503.00`.

**Lời thoại gợi ý cho sinh viên:**
> *"Tác tử Kiểm dịch không chỉ dùng keyword matching đơn thuần mà kết hợp Rule-Engine kiểm dịch MAFF và an ninh hàng không IATA. Agent giải quyết triệt để rủi ro hàng triệu Yên tiền phạt từ Hải quan Nhật Bản đối với thực phẩm cấm, đồng thời tự động hóa việc tính trọng lượng thể tích IATA theo chuẩn quốc tế."*

---

### BƯỚC 3: DEMO AGENT MUA HÀNG — THẨM ĐỊNH SÀN NHẬT & CẤP MÃ VẬN ĐƠN (3 PHÚT)

**Thao tác trên màn hình:**
1. Bấm chuyển sang Tab **`1. Purchasing Agent (Sàn Nhật & Mua Hàng)`**.
2. **Thẩm định link Mercari/Rakuten:**
   - Dán URL: `https://jp.mercari.com/item/m9876543210` kèm giá 4.800 ¥.
   - Bấm nút **`Phân Tích & Thẩm Định Link Sàn Nhật`**.
   - **Kết quả hiển thị:**
     - Tự động nhận diện sàn: `MERCARI`.
     - Độ uy tín nhà bán: `GOOD (90/100)`.
     - Cước vận chuyển nội địa Nhật: `Miễn phí (Free Ship)`.
     - Quy đổi tỷ giá live: $4.800 \times 172 = 825.600\text{ đ}$.
     - Đánh giá: Đủ điều kiện mua hàng tự động 1-click.
3. **Thực thi Mua hàng Tự động:**
   - Chọn một mã đơn đã thanh toán cọc trong hệ thống.
   - Bấm nút **`Kích Hoạt Mua Hàng Tự Động 1-Click`**.
   - **Kết quả hiển thị:** Thông báo thành công màu xanh! Agent tạo mã đơn đối tác tại Nhật `JP-SUP-...`, tự động gán mã vận đơn nội địa Nhật Bản `YMT-4892019283` (Yamato Transport) và cập nhật đơn hàng sang trạng thái `PURCHASED`.

**Lời thoại gợi ý cho sinh viên:**
> *"Trước đây nhân viên mua hàng phải mở từng tab trình duyệt, đối soát tỷ giá thủ công và nhập tay mã vận đơn. Với Purchasing Agent, toàn bộ quá trình thẩm định độ tin cậy của seller, bóc tách cước nội địa Nhật và cấp mã vận đơn Yamato được hoàn tất chỉ với 1 cú click."*

---

### BƯỚC 4: DEMO AGENT KIỂM TOÁN TÀI CHÍNH — CỌC 3 BẬC & THU SỐ DƯ KHO VN (3 PHÚT)

**Thao tác trên màn hình:**
1. Bấm chuyển sang Tab **`3. Financial Audit Agent (Tài Chính & Thu Số Dư)`**.
2. **Kiểm toán chính sách cọc 3 bậc (WP3.3):**
   - Thử nghiệm 1: Nhập đơn 800.000 đ ➔ Thu 800.000 đ ➔ Báo `Tier LOW (100%) - HỢP LỆ`.
   - Thử nghiệm 2: Nhập đơn 3.000.000 đ ➔ Thu 2.100.000 đ ➔ Báo `Tier STANDARD (70%) - HỢP LỆ`.
   - Thử nghiệm 3: Nhập đơn 3.000.000 đ ➔ Thu 1.000.000 đ ➔ Báo `⚠ LỆCH CHÍNH SÁCH CỌC (Thiếu 1.100.000 đ)`.
3. **Nghiệp vụ cốt lõi: Thu số dư đợt 2 tại Kho VN để kích hoạt `PAID_100`:**
   - Nhập ID của một đơn hàng đã về tới kho Việt Nam (`status = WAREHOUSE_VN`).
   - Bấm **`Kiểm Toán Đơn Hàng`**: Agent phát hiện đơn mới cọc 70%, còn thiếu số dư đợt 2 là $600.000\text{ đ}$. Hệ thống báo cờ đỏ: `CHẶN GIAO (CHƯA ĐỦ TIỀN)`.
   - Bấm nút **`Tất Toán Số Dư Đợt 2`**: Agent ghi nhận giao dịch số dư `kind: BALANCE`, đổi trạng thái đơn sang `PAID_100`, và mở khóa chuyển đơn sang `LOCAL_DELIVERY`.

**Lời thoại gợi ý cho sinh viên:**
> *"Đây là chốt chặn tài chính quan trọng nhất của hệ thống: Theo quy tắc bất biến, kiện hàng tuyệt đối không được bàn giao cho bưu tá nội địa khi chưa đạt `PAID_100`. Financial Audit Agent tự động tính số dư còn thiếu tại kho VN, đối soát tiền về và chỉ mở khóa xuất kho khi tài chính đã cân bằng 100%."*

---

### BƯỚC 5: DEMO AGENT TRỢ LÝ ĐIỀU HÀNH — SCORECARD & ONE-CLICK DISPATCH (2 PHÚT)

**Thao tác trên màn hình:**
1. Bấm chuyển sang Tab **`4. Executive Assistant (Bảng Điểm & Điều Phối)`**.
2. Xem khối Bảng điểm Vận hành (Scorecard):
   - Thông lượng hệ thống: `96%`.
   - Tải kho Tokyo: `15%`, Tải kho Việt Nam: `20%`.
   - Đơn hàng đứng yên quá 48h: Hiển thị số lượng thực tế.
3. Xem danh sách **Điểm nghẽn (Bottlenecks)**:
   - Thấy điểm nghẽn: *"Đơn tại Kho VN chưa thanh toán số dư đợt 2"*.
   - Bấm nút **`Kích Hoạt 1-Click`** bên cạnh điểm nghẽn.
   - **Kết quả hiển thị:** Agent kích hoạt tác vụ gửi link thanh toán VietQR động/VNPAY tự động tới toàn bộ các khách hàng có đơn đọng tại kho.

**Lời thoại gợi ý cho sinh viên:**
> *"Thay vì yêu cầu nhà quản lý phải đọc qua hàng chục trang báo cáo phức tạp, Executive Assistant tổng hợp sẵn bức tranh vận hành, tự động chỉ ra các điểm nghẽn đang xảy ra và cung cấp các nút One-Click Dispatch để giải phóng luồng hàng ngay tức khắc."*

---

### BƯỚC 6: KIỂM CHỨNG TÍNH MINH BẠCH BẤT BIẾN QUA AUDIT LOG (2 PHÚT)

**Thao tác trên màn hình:**
1. Cuộn chuột xuống khu vực cuối trang: **`Nhật Ký Quyết Định AI Thời Gian Thực (Audit Stream)`**.
2. Chỉ cho Hội đồng thấy các dòng log vừa được sinh ra trong suốt quá trình demo:
   - `agent:quarantine` — `AI_SCREEN_COMPLIANCE` — *"CẢNH BÁO ĐỎ: Đơn hàng chứa mặt hàng vi phạm MAFF..."*
   - `agent:purchasing` — `AI_AUTO_PURCHASE_ORDER` — *"Mua hàng thành công, cấp mã vận đơn YMT-..."*
   - `agent:financial_audit` — `AI_SETTLE_WAREHOUSE_VN_BALANCE` — *"Tất toán số dư 600.000 đ, mở khóa PAID_100..."*
   - `agent:executive_assistant` — `AI_DISPATCH_ACTION` — *"One-Click Dispatch..."*
3. Nhấn mạnh trường `actor`: Lưu định danh tác tử chính xác; trường `actorType`: `"SYSTEM"`.

**Lời thoại gợi ý cho sinh viên:**
> *"Kính thưa Thầy/Cô, một trong những lo ngại lớn nhất khi ứng dụng AI vào doanh nghiệp là hiện tượng ảo giác (hallucination) và thiếu trách nhiệm giải trình. Tại ChillBanana, mọi hành động tác tử thực hiện đều đi qua `writeAuditLog`, lưu vết vĩnh viễn trong CSDL gồm định danh agent, thời gian thực thi, căn cứ quyết định và chi tiết thay đổi. Điều này bảo đảm AI của chúng em là AI có kiểm soát, minh bạch và hoàn toàn đáng tin cậy."*

---

## BẢNG TỔNG HỢP CÂU HỎI THƯỜNG GẶP TỪ HỘI ĐỒNG (Q&A DEFENSE)

| Câu hỏi của Giám Khảo | Câu trả lời trọng tâm của Sinh Viên |
| :--- | :--- |
| **1. Tại sao không dùng chatbox như ChatGPT mà phải làm Workspace riêng?** | Chatbox chỉ phù hợp cho người dùng tra cứu thông tin ngẫu nhiên. Trong quản trị tác nghiệp chuỗi cung ứng, người điều hành cần cái nhìn tổng thể về tiến độ (Pipeline), khả năng thao tác nhanh hàng loạt (Batch actions) và bảng điều khiển chuyên môn trực quan. Workspace giúp giảm 80% thao tác gõ phím và tránh sai sót số liệu. |
| **2. Làm sao đảm bảo AI không tự ý giảm tiền hoặc thất thoát tài chính?** | Hệ thống áp dụng nguyên tắc **Bất biến SERVER**: Số tiền VND là số nguyên, AI chỉ được phép đọc và kiểm toán theo công thức bất biến `calculateDepositV2` và `calculateWarehouseVnBalance`. AI không có quyền sửa công thức giá, không được xóa bản ghi tài chính và không thể vượt quyền giao hàng khi chưa đủ tiền. |
| **3. Nếu nhà bán trên Mercari hủy đơn hoặc hết hàng thì sao?** | PurchaseTask hỗ trợ các trạng thái `QUEUED`, `IN_PROGRESS`, `PURCHASED`, `FAILED`, `CANCELLED`. Khi xảy ra lỗi, Purchasing Agent ghi nhận `lastError` và kích hoạt cờ cảnh báo để chuyên viên vận hành can thiệp xử lý hoàn tiền hoặc chọn link thay thế. |
| **4. Các API của AI Workspace có được bảo vệ phân quyền không?** | 100% API routes (`/api/admin/ai-workspace/overview` và `/execute`) đều được bảo vệ bởi middleware `requireAdmin` với khai báo quyền nghiêm ngặt `{ roles: ["SUPER_ADMIN", "OPERATOR"] }` và chống CSRF bằng `verifySameOrigin`. |

---
**Chúc các bạn có buổi thuyết trình tốt nghiệp tự tin và đạt điểm số xuất sắc nhất!**
