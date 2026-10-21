const { chromium } = require('d:/BAITAP/ChillBanana-main/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const mermaidJs = fs.readFileSync('d:/BAITAP/ChillBanana-main/scripts/mermaid.min.js', 'utf8');

const downloadsDir = path.join('C:', 'Users', 'TBao', 'Downloads', 'ChillBanana_Bo_Anh_So_Do_Kien_Truc');
const rootProjectDir = path.join('d:', 'BAITAP', 'ChillBanana-main', 'Bo_Anh_So_Do_He_Thong_ChillBanana');
const neoDir = path.join('d:', 'BAITAP', 'ChillBanana-main', 'NeoUniverse', 'So_Do_Kien_Truc_Va_Luong_Hoat_Dong_He_Thong');

[downloadsDir, rootProjectDir, neoDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const diagrams = [
  {
    fileName: '01_So_Do_3_Khoi_Client_Backend_Admin_VN_JP.png',
    title: 'Sơ đồ 3 khối kiến trúc phân hệ VN ➔ JP (Client - Backend - Admin)',
    description: 'Mô hình phân hệ gửi hàng Việt Nam sang Nhật Bản gồm 3 khối: Web Form thu thập dữ liệu, Backend API & CSDL độc lập VnJpShipment (không đụng bảng Order cũ), và Admin Portal có thêm nút điều phối song song với bàn Kanban 5 giai đoạn.',
    code: `
flowchart TD
    subgraph Client ["1. KHÁCH HÀNG (Web Form VN ➔ JP)"]
        F1["Người gửi VN: Họ tên, SĐT, Địa chỉ lấy hàng tại VN"]
        F2["Người nhận JP: Tên Romaji, SĐT +81, Mã 〒 7 số, Số phòng Mansion"]
        F3["Hàng hóa: Danh mục chi tiết, Cân nặng, Cam kết kiểm dịch MAFF"]
    end

    subgraph Backend ["2. BACKEND & CƠ SỞ DỮ LIỆU ĐỘC LẬP"]
        API["API: /api/vn-jp-shipments (Riêng biệt)"]
        DB[("Bảng PostgreSQL: VnJpShipment\\n(Không đụng bảng Order cũ)")]
    end

    subgraph AdminPortal ["3. ADMIN PORTAL (Thêm Nút Song Song)"]
        Switch["Thanh Mode Switch Header"]
        Btn1["Dashboard"]
        Btn2["Tác nghiệp (JP ➔ VN Mua hộ)"]
        Btn3["✈️ Điều phối VN ➔ JP (Nút Mới Kế Bên)"]
        Kanban["Bàn Điều Phối Kanban 5 Cột:\\n1. Mới Tiếp Nhận ➔ 2. Đã Chốt & Chờ Lấy ➔ 3. Kho VN Cân Đo IATA ➔ 4. Đang Bay ➔ 5. Hoàn Tất"]
    end

    Client -->|Gửi yêu cầu| API
    API -->|Lưu dữ liệu| DB
    DB -->|Hiển thị Realtime| Kanban
    Switch --> Btn1
    Switch --> Btn2
    Switch --> Btn3
    Btn3 --> Kanban
`
  },
  {
    fileName: '02_So_Do_Luong_Hoat_Dong_6_Buoc_Tuyen_VN_Sang_JP.png',
    title: 'Sơ đồ luồng hoạt động 6 bước vận chuyển hàng tuyến VN ➔ JP',
    description: 'Quy trình vận hành logistics thực tế 6 bước từ khi khách điền form, kiểm dịch thực vật MAFF, lấy hàng tận nhà tại VN, cân đo IATA, bay chuyên tuyến quốc tế, thông quan Hải quan Nhật Bản và Sagawa/Yamato phát tận tay người nhận.',
    code: `
flowchart TD
    subgraph ClientStage ["CHẶNG 1: TẠI VIỆT NAM (TIẾP NHẬN & XỬ LÝ)"]
        S1["<b>Bước 1: Khách Tạo Đơn Trực Tuyến</b>\\n• Nhập thông tin người gửi tại VN & người nhận tại Nhật\\n• Tự động tính cước IATA (Đơn giá/kg × Cân nặng)\\n• Cam kết tuân thủ kiểm dịch MAFF (Tuyệt đối không thịt/trứng)"]
        S2["<b>Bước 2: CSKH Tiếp Nhận & Thẩm Định</b>\\n• Hệ thống tự động cấp mã vận đơn điều phối VNJP-2026-XXXX\\n• Chuyên viên rà soát danh mục hàng hóa hợp lệ\\n• Gọi điện thoại xác nhận & chốt lịch lấy hàng tận nhà"]
        S3["<b>Bước 3: Lấy Hàng & Đóng Gói Tại Kho VN</b>\\n• Shipper đến tận địa chỉ người gửi tại VN thu gom kiện hàng\\n• Kho VN cân đo thực tế (So sánh Cân nặng thực & Thể tích D×R×C/5000)\\n• Đóng thùng carton tiêu chuẩn hàng không quốc tế, dán tem mã vạch"]
    end

    subgraph FlightStage ["CHẶNG 2: HÀNG KHÔNG QUỐC TẾ & HẢI QUAN"]
        S4["<b>Bước 4: Bay Chuyên Tuyến & Thông Quan Nhật Bản</b>\\n• Vận chuyển đường bay quốc tế chuyên tuyến VN ➔ Sân bay Narita / Kansai\\n• Khai báo tờ khai điện tử Hải quan & Kiểm dịch MAFF Nhật Bản\\n• Thông quan hợp pháp và làm thủ tục nhập cảnh hàng hóa"]
    end

    subgraph JapanStage ["CHẶNG 3: NỘI ĐỊA NHẬT BẢN (PHÁT HÀNG TẬN NƠI)"]
        S5["<b>Bước 5: Bàn Giao Hãng Nội Địa Nhật</b>\\n• Chuyển phát bưu kiện qua Sagawa Express / Yamato Transport\\n• Định tuyến chuẩn xác theo Mã bưu điện 〒 7 số và Tỉnh/Thành"]
        S6["<b>Bước 6: Giao Tận Phòng Mansion & Hoàn Tất</b>\\n• Giao tận tay người nhận, đúng số phòng Mansion / Tòa nhà\\n• Người nhận ký nhận bưu kiện, hệ thống báo thành công cho người gửi\\n• Đóng hồ sơ điều phối và lưu trữ chứng từ vận đơn điện tử"]
    end

    ClientStage -->|Chốt đơn & xuất kho bay| FlightStage
    FlightStage -->|Thông quan bưu kiện tại Nhật| JapanStage
`
  },
  {
    fileName: '03_So_Do_Luong_Hoat_Dong_5_Buoc_Mua_Ho_JP_Ve_VN.png',
    title: 'Sơ đồ luồng hoạt động mua hộ & gom hàng tuyến JP ➔ VN',
    description: 'Quy trình nghiệp vụ mua hàng nội địa Nhật Bản gồm 5 bước: Khách dán link hàng trên sàn (Mercari, Rakuten, Yahoo, Amazon), báo giá & đặt cọc 70%, nhân viên tại Tokyo mua hàng & gom kho, bay chuyên tuyến về Nội Bài/TSN và giao tận nơi thu nốt 30%.',
    code: `
flowchart TD
    subgraph PhaseVN ["GIAI ĐOẠN 1: TÌM HÀNG & BÁO GIÁ ĐẶT CỌC"]
        J1["<b>Bước 1: Khách Gửi Yêu Cầu Mua Hộ</b>\\n• Khách dán link sản phẩm nội địa Nhật (Mercari, Rakuten, Yahoo, Amazon)\\n• Công cụ tự động quy đổi tỷ giá JPY/VND theo thời gian thực\\n• Tạm tính phí dịch vụ mua hộ và ước tính cước bay theo kg"]
        J2["<b>Bước 2: Báo Giá & Khách Đặt Cọc 70%</b>\\n• Tư vấn viên liên hệ chốt chi phí mua hàng và phụ phí nếu có\\n• Khách hàng thanh toán khoản đặt cọc 70% giá trị đơn hàng\\n• Đơn hàng chuyển sang trạng thái Đã đặt cọc"]
    end

    subgraph PhaseJP ["GIAI ĐOẠN 2: MUA HÀNG & GOM TẠI KHO TOKYO"]
        J3["<b>Bước 3: Mua Hàng & Nhập Kho Tokyo</b>\\n• Nhân viên tại Nhật Bản tiến hành mua hàng trực tiếp trên sàn\\n• Sản phẩm được chuyển phát nội địa Nhật về Kho Tokyo của ChillBanana\\n• Đội ngũ kho kiểm đếm, chụp ảnh thực tế, đóng gói kiện bay an toàn"]
    end

    subgraph PhaseTransit ["GIAI ĐOẠN 3: BAY VỀ VN & GIAO HÀNG TẤT TOÁN"]
        J4["<b>Bước 4: Bay Về Việt Nam & Thông Quan</b>\\n• Vận chuyển đường bay chuyên tuyến Tokyo ➔ Sân bay Nội Bài / TSN\\n• Hoàn tất thủ tục thông quan Hải quan và kiểm tra an ninh\\n• Nhập kho trung chuyển phân phối tại Hà Nội / TP. Hồ Chí Minh"]
        J5["<b>Bước 5: Giao Tận Nhà & Tất Toán 30%</b>\\n• Shipper giao hàng tận nơi cho khách hàng tại Việt Nam\\n• Khách kiểm tra hàng và thanh toán nốt 30% tiền hàng + Cước kg thực tế\\n• Hoàn tất đơn mua hộ và tiếp nhận đánh giá từ khách hàng"]
    end

    PhaseVN -->|Xác nhận cọc 70%| PhaseJP
    PhaseJP -->|Xuất kho Tokyo bay về VN| PhaseTransit
`
  },
  {
    fileName: '04_So_Do_Kien_Truc_Tong_The_Full_Stack_ChillBanana.png',
    title: 'Sơ đồ kiến trúc tổng thể toàn bộ hệ thống ChillBanana',
    description: 'Kiến trúc toàn diện 5 tầng: Giao diện Client Next.js/Tailwind, Tầng API Route Handlers bảo mật, Tầng nghiệp vụ điều phối Admin song song, Tầng dữ liệu PostgreSQL trên Neon Cloud độc lập an toàn, và Tầng tích hợp dịch vụ bên ngoài (IATA, Sagawa, VNPost, AI).',
    code: `
flowchart TD
    subgraph ClientLayer ["1. TẦNG GIAO DIỆN (CLIENT LAYER - NEXT.JS / TAILWIND)"]
        UI1["Landing Page & Tra Cứu Vận Đơn"]
        UI2["Form Gửi Hàng Tuyến VN ➔ JP"]
        UI3["Form Mua Hộ Tuyến JP ➔ VN"]
        UI4["AI Assistant Chat Tư Vấn CSKH"]
        UI5["Admin Management Portal"]
    end

    subgraph ApiLayer ["2. TẦNG XỬ LÝ & API (NEXT.JS APP ROUTER)"]
        API1["/api/vn-jp-shipments (Tuyến VN ➔ JP)"]
        API2["/api/orders & /api/orders/quote (Mua hộ JP ➔ VN)"]
        API3["/api/ai/chat (Bóc tách Lead & CSKH AI)"]
        API4["/api/tracking (Tra cứu mã vận đơn 2 chiều)"]
        API5["/api/rates (Cập nhật tỷ giá JPY/VND)"]
    end

    subgraph BusinessLayer ["3. TẦNG NGHIỆP VỤ & ĐIỀU PHỐI (ADMIN WORKFLOW)"]
        ADM1["Bàn Tác Nghiệp: Quản lý đơn mua hộ JP ➔ VN"]
        ADM2["Bàn Điều Phối: Quản lý vận chuyển VN ➔ JP (Kanban 5 bước)"]
        ADM3["Quản trị Khách hàng & Lead tự động"]
        ADM4["Quản lý Tỷ giá & Bảng giá cước bay"]
    end

    subgraph DatabaseLayer ["4. TẦNG DỮ LIỆU ĐỘC LẬP (NEON POSTGRESQL & PRISMA)"]
        DB1[("Bảng VnJpShipment\\n(31 Cột Tuyến VN ➔ JP)")]
        DB2[("Bảng Order & OrderItem\\n(Tuyến JP ➔ VN Mua hộ)")]
        DB3[("Bảng User, ChatLead, ExchangeRate")]
    end

    subgraph IntegrationLayer ["5. TẦNG DỊCH VỤ NGOÀI (EXTERNAL SERVICES)"]
        EXT1["Hãng bay IATA & Chuyển phát quốc tế"]
        EXT2["Nội địa Nhật: Sagawa / Yamato Transport"]
        EXT3["Nội địa VN: VNPost / GHTK / GHN"]
        EXT4["Google Gemini AI API"]
    end

    ClientLayer --> ApiLayer
    ApiLayer --> BusinessLayer
    BusinessLayer --> DatabaseLayer
    ApiLayer --> DatabaseLayer
    BusinessLayer -.-> IntegrationLayer
`
  },
  {
    fileName: '05_So_Do_Hai_Ban_Tac_Nghiep_Song_Song_Trong_Admin.png',
    title: 'Sơ đồ 2 bàn tác nghiệp song song trong Admin Portal',
    description: 'Cơ chế phân tách 2 luồng công việc độc lập trong giao diện quản trị Admin: Bàn Tác nghiệp Mua hộ (JP➔VN) và Bàn Điều phối Vận chuyển (VN➔JP), hoạt động trên 2 bảng dữ liệu riêng biệt giúp loại bỏ triệt để nguy cơ lỗi Domino.',
    code: `
flowchart TD
    subgraph AdminHeader ["HEADER ADMIN PORTAL (MODE SWITCHER)"]
        Header["Thanh Menu Điều Hướng Phân Hệ"]
        Tab1["📊 Dashboard Tổng Quan"]
        Tab2["📦 Tác Nghiệp (JP ➔ VN Mua Hộ)"]
        Tab3["✈️ Điều Phối VN ➔ JP (Tuyến Mới)"]
        Tab4["👥 Khách Hàng & AI Leads"]
        Tab5["⚙️ Cấu Hình Tỷ Giá"]
    end

    subgraph Mode1 ["PHÂN HỆ 1: TÁC NGHIỆP MUA HỘ (JP ➔ VN)"]
        Flow1["1. Đơn Mới ➔ 2. Đã Cọc 70% ➔ 3. Đã Mua Tại Nhật ➔ 4. Kho Tokyo Nhận ➔ 5. Đang Bay Về VN ➔ 6. Giao Hàng & Thu 30%"]
        Data1[("Bảng CSDL: Order & OrderItem")]
    end

    subgraph Mode2 ["PHÂN HỆ 2: ĐIỀU PHỐI VẬN CHUYỂN (VN ➔ JP)"]
        Flow2["1. Mới Tiếp Nhận ➔ 2. Đã Chốt & Chờ Lấy ➔ 3. Kho VN Cân Đo IATA ➔ 4. Đang Bay & Hải Quan ➔ 5. Giao Sagawa Hoàn Tất"]
        Data2[("Bảng CSDL: VnJpShipment (Độc Lập Hoàn Toàn)")]
    end

    Header --> Tab1
    Header --> Tab2
    Header --> Tab3
    Header --> Tab4
    Header --> Tab5

    Tab2 ==>|Kích hoạt bàn làm việc 1| Mode1
    Tab3 ==>|Kích hoạt bàn làm việc 2| Mode2

    Flow1 --- Data1
    Flow2 --- Data2
`
  },
  {
    fileName: '06_So_Do_Thuc_The_CSDL_ERD_Hai_Phan_He_Doc_Lap.png',
    title: 'Sơ đồ thực thể CSDL (ERD Schema) phân lập 2 phân hệ an toàn',
    description: 'Sơ đồ quan hệ thực thể cơ sở dữ liệu PostgreSQL: Bảng Order và OrderItem phục vụ mua hộ Nhật - Việt, đối ứng song song với bảng VnJpShipment (31 cột) phục vụ logistics Việt - Nhật, liên kết chặt chẽ qua bảng User, ChatLead và ExchangeRate.',
    code: `
erDiagram
    User ||--o{ Order : "đặt mua hộ (JP->VN)"
    User ||--o{ VnJpShipment : "gửi bưu kiện (VN->JP)"
    Order ||--|{ OrderItem : "chi tiết món hàng"

    User {
        string id PK
        string email UK
        string name
        string role
        string phone
    }

    Order {
        string id PK "Mã đơn CB-XXXX"
        string userId FK
        string status "PENDING, DEPOSITED, PURCHASED..."
        float totalAmountJpy
        float totalAmountVnd
        float depositAmountVnd
        string trackingNumber
    }

    OrderItem {
        string id PK
        string orderId FK
        string productUrl
        string productName
        float priceJpy
        int quantity
    }

    VnJpShipment {
        string id PK "Mã đơn VNJP-2026-XXXX"
        string senderName "Họ tên người gửi tại VN"
        string senderPhone "SĐT / Zalo"
        string senderAddress "Địa chỉ lấy hàng tại VN"
        string recipientName "Tên Romaji người nhận JP"
        string recipientPhone "SĐT Nhật (+81)"
        string postalCode "Mã bưu điện 〒 7 số"
        string prefecture "Tỉnh/Thành phố tại Nhật"
        string addressLine "Số phòng Mansion"
        string cargoType "GIFT, FOOD, DOC, OTHER"
        float weightKg "Cân nặng thực tế"
        float estimatedFeeVnd "Tổng cước IATA"
        string status "RECEIVED, CONFIRMED, VN_WAREHOUSE..."
        boolean isMaffCompliant "Cam kết MAFF"
        string localTracking "Mã Sagawa/Yamato"
    }

    ChatLead {
        string id PK
        string customerName
        string phone
        string cargoType
        string route "VN_TO_JP hoặc JP_TO_VN"
        string status "NEW, CONTACTED, CLOSED"
    }

    ExchangeRate {
        string id PK
        string currencyPair "JPY_VND"
        float rate "Tỷ giá hiện hành"
        datetime updatedAt
    }
`
  }
];

async function generateAll() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });

  for (let i = 0; i < diagrams.length; i++) {
    const item = diagrams[i];
    console.log(`Rendering [${i + 1}/${diagrams.length}]: ${item.title}...`);
    const page = await browser.newPage({ viewport: { width: 1400, height: 1200 }, deviceScaleFactor: 2 });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            background-color: #1e1e1e;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 0;
            padding: 30px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }
          #box {
            width: 1024px;
            background: #1e1e1e;
            padding: 24px;
            border-radius: 8px;
            box-sizing: border-box;
          }
          svg {
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
          }
        </style>
        <script>${mermaidJs}</script>
      </head>
      <body>
        <div id="box">
          <pre class="mermaid">
${item.code}
          </pre>
        </div>
        <script>
          mermaid.initialize({
            startOnLoad: true,
            theme: 'dark'
          });
        </script>
      </body>
      </html>
    `;

    await page.setContent(html);
    try {
      await page.waitForSelector('svg', { timeout: 10000 });
      await page.waitForTimeout(600);

      const el = await page.$('#box');
      const tempPath = path.join('C:', 'Users', 'TBao', '.gemini', 'antigravity', 'brain', 'c80cff6c-62f2-4766-b890-100012f644f3', 'scratch', item.fileName);
      await el.screenshot({ path: tempPath });

      // Copy to the 3 target directories
      fs.copyFileSync(tempPath, path.join(downloadsDir, item.fileName));
      fs.copyFileSync(tempPath, path.join(rootProjectDir, item.fileName));
      fs.copyFileSync(tempPath, path.join(neoDir, item.fileName));

      console.log(`  ✓ Successfully saved: ${item.fileName}`);
    } catch (err) {
      console.error(`  ✗ Error rendering ${item.fileName}:`, err.message);
    }

    await page.close();
  }

  // Create DANH_MUC_SO_DO_CHILLBANANA.md
  let catalogMd = `# BỘ ẢNH SƠ ĐỒ HỆ THỐNG CHILLBANANA (CHUẨN MERMAID GỐC 100%)\n\n`;
  catalogMd += `> Bộ tài liệu trực quan hóa kiến trúc hệ thống, quy trình nghiệp vụ 2 chiều song song (Nhật ➔ Việt và Việt ➔ Nhật), bàn tác nghiệp Admin và mô hình CSDL của dự án ChillBanana.\n\n`;
  catalogMd += `## 📁 Đường dẫn lưu trữ trên máy tính:\n`;
  catalogMd += `- **Thư mục Downloads Windows (Mở trực tiếp):** \`C:\\Users\\TBao\\Downloads\\ChillBanana_Bo_Anh_So_Do_Kien_Truc\\\`\n`;
  catalogMd += `- **Thư mục dự án:** \`d:\\BAITAP\\ChillBanana-main\\Bo_Anh_So_Do_He_Thong_ChillBanana\\\`\n`;
  catalogMd += `- **Thư mục NeoUniverse:** \`d:\\BAITAP\\ChillBanana-main\\NeoUniverse\\So_Do_Kien_Truc_Va_Luong_Hoat_Dong_He_Thong\\\`\n\n`;
  catalogMd += `---\n\n`;

  diagrams.forEach((item, idx) => {
    catalogMd += `### ${idx + 1}. ${item.title}\n`;
    catalogMd += `- **Tập tin:** \`${item.fileName}\`\n`;
    catalogMd += `- **Mô tả nội dung:** ${item.description}\n\n`;
    catalogMd += `\`\`\`mermaid\n${item.code.trim()}\n\`\`\`\n\n---\n\n`;
  });

  fs.writeFileSync(path.join(downloadsDir, 'DANH_MUC_SO_DO_CHILLBANANA.md'), catalogMd);
  fs.writeFileSync(path.join(rootProjectDir, 'DANH_MUC_SO_DO_CHILLBANANA.md'), catalogMd);
  fs.writeFileSync(path.join(neoDir, 'DANH_MUC_SO_DO_CHILLBANANA.md'), catalogMd);

  console.log('DANH_MUC_SO_DO_CHILLBANANA.md updated in all 3 directories.');
  await browser.close();
  console.log('ALL DIAGRAMS SUCCESSFULLY GENERATED & SAVED!');
}

generateAll().catch(console.error);
