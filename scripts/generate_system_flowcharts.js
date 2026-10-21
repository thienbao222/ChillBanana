const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'NeoUniverse', 'So_Do_Kien_Truc_Va_Luong_Hoat_Dong_He_Thong');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

async function renderFlowcharts() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });

  // =========================================================================
  // 1. SƠ ĐỒ LUỒNG HOẠT ĐỘNG: GỬI HÀNG TỪ VIỆT NAM SANG NHẬT BẢN (VN ➔ JP)
  // (Đúng phong cách flowchart nằm ngang như ảnh chụp của người dùng)
  // =========================================================================
  const page1 = await browser.newPage({ viewport: { width: 1750, height: 420 }, deviceScaleFactor: 2 });
  const html1 = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      body { background: #12141a; color: #f8fafc; padding: 35px 30px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
      .title-bar { text-align: center; margin-bottom: 25px; }
      .badge { display: inline-block; background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); padding: 5px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; }
      h1 { font-size: 21px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px; }
      
      .flow-container { display: flex; align-items: center; justify-content: center; gap: 0; width: 100%; max-width: 1680px; }
      .step-node { background: #181c26; border: 1.5px solid #334155; border-radius: 10px; padding: 18px 16px; width: 230px; min-height: 125px; display: flex; flex-direction: column; justify-content: center; text-align: center; box-shadow: 0 4px 14px rgba(0,0,0,0.4); }
      .step-title { font-size: 13.5px; font-weight: 800; color: #f8fafc; margin-bottom: 6px; line-height: 1.35; }
      .step-desc { font-size: 11.5px; color: #94a3b8; line-height: 1.4; }
      .step-sub { font-size: 10.5px; color: #38bdf8; font-weight: 700; margin-top: 5px; font-family: monospace; }
      
      .arrow { width: 44px; display: flex; align-items: center; justify-content: center; color: #38bdf8; font-size: 22px; font-weight: 900; shrink-0; }
    </style>
  </head>
  <body>
    <div class="title-bar">
      <span class="badge">Quy Trình Nghiệp Vụ Tuyến Xuất Khẩu</span>
      <h1>SƠ ĐỒ LUỒNG HOẠT ĐỘNG: GỬI HÀNG TỪ VIỆT NAM SANG NHẬT BẢN (VN ➔ JP)</h1>
    </div>

    <div class="flow-container">
      <div class="step-node" style="border-color: #38bdf8;">
        <div class="step-title">1. Khách điền Web</div>
        <div class="step-desc">Thông tin người gửi VN, người nhận JP (〒 Zipcode) & Danh mục hàng</div>
        <div class="step-sub">Cam kết MAFF cấm thịt</div>
      </div>

      <div class="arrow">➔</div>

      <div class="step-node" style="border-color: #60a5fa;">
        <div class="step-title">2. Sinh mã vận đơn</div>
        <div class="step-desc">Hệ thống tạo bản ghi và mã vận đơn theo chuẩn hàng không</div>
        <div class="step-sub">#VNJP-2026-XXXX</div>
      </div>

      <div class="arrow">➔</div>

      <div class="step-node" style="border-color: #f59e0b;">
        <div class="step-title">3. Admin nhận đơn</div>
        <div class="step-desc">Xuất hiện ngay tại cột Mới Tiếp Nhận trên Bàn điều phối VN ➔ JP</div>
        <div class="step-sub">Cảnh báo chưa gọi điện</div>
      </div>

      <div class="arrow">➔</div>

      <div class="step-node" style="border-color: #a855f7;">
        <div class="step-title">4. Gọi điện & Chốt lịch</div>
        <div class="step-desc">Nhân viên rà soát hàng cấm, chốt lịch tài xế qua lấy tận nhà VN</div>
        <div class="step-sub">Điều phối bưu tá First-Mile</div>
      </div>

      <div class="arrow">➔</div>

      <div class="step-node" style="border-color: #ec4899;">
        <div class="step-title">5. Kho VN cân đo IATA</div>
        <div class="step-desc">Soát hàng cấm lớp 2, đo kích thước D×R×C/5000 để chốt cước thể tích</div>
        <div class="step-sub">Đóng thùng carton chuẩn bay</div>
      </div>

      <div class="arrow">➔</div>

      <div class="step-node" style="border-color: #10b981;">
        <div class="step-title">6. Bay & Giao tại Nhật</div>
        <div class="step-desc">Bay Narita/Haneda, thông quan hải quan Nhật, bàn giao Yamato phát tận tay</div>
        <div class="step-sub">Giao tận phòng Mansion</div>
      </div>
    </div>
  </body>
  </html>
  `;
  await page1.setContent(html1);
  await page1.screenshot({ path: path.join(targetDir, '01_So_Do_Luong_Hoat_Dong_Tuyen_VN_Sang_JP.png') });
  await page1.close();

  // =========================================================================
  // 2. SƠ ĐỒ LUỒNG HOẠT ĐỘNG: ỦY THÁC MUA HỘ HÀNG TỪ NHẬT VỀ VN (JP ➔ VN)
  // (Đúng phong cách flowchart nằm ngang tương tự)
  // =========================================================================
  const page2 = await browser.newPage({ viewport: { width: 1850, height: 420 }, deviceScaleFactor: 2 });
  const html2 = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      body { background: #12141a; color: #f8fafc; padding: 35px 30px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
      .title-bar { text-align: center; margin-bottom: 25px; }
      .badge { display: inline-block; background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); padding: 5px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; }
      h1 { font-size: 21px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px; }
      
      .flow-container { display: flex; align-items: center; justify-content: center; gap: 0; width: 100%; max-width: 1800px; }
      .step-node { background: #181c26; border: 1.5px solid #334155; border-radius: 10px; padding: 18px 14px; width: 215px; min-height: 125px; display: flex; flex-direction: column; justify-content: center; text-align: center; box-shadow: 0 4px 14px rgba(0,0,0,0.4); }
      .step-title { font-size: 13px; font-weight: 800; color: #f8fafc; margin-bottom: 6px; line-height: 1.35; }
      .step-desc { font-size: 11px; color: #94a3b8; line-height: 1.4; }
      .step-sub { font-size: 10.5px; color: #60a5fa; font-weight: 700; margin-top: 5px; font-family: monospace; }
      
      .arrow { width: 36px; display: flex; align-items: center; justify-content: center; color: #60a5fa; font-size: 20px; font-weight: 900; shrink-0; }
    </style>
  </head>
  <body>
    <div class="title-bar">
      <span class="badge">Quy Trình Nghiệp Vụ Tuyến Nhập Khẩu Mua Hộ</span>
      <h1>SƠ ĐỒ LUỒNG HOẠT ĐỘNG: ỦY THÁC MUA HỘ HÀNG TỪ NHẬT BẢN VỀ VIỆT NAM (JP ➔ VN)</h1>
    </div>

    <div class="flow-container">
      <div class="step-node" style="border-color: #f59e0b;">
        <div class="step-title">1. Dán Link Sản Phẩm</div>
        <div class="step-desc">Khách dán link từ Amazon JP, Mercari, Rakuten, Yahoo Auctions</div>
        <div class="step-sub">Scraper bóc tách tự động</div>
      </div>

      <div class="arrow">➔</div>

      <div class="step-node" style="border-color: #38bdf8;">
        <div class="step-title">2. AI Định Giá & Gộp Đơn</div>
        <div class="step-desc">Hệ thống áp tỷ giá Yên, tính phí mua hộ 4% & cước bay, tư vấn gộp đơn -20%</div>
        <div class="step-sub">ChillBanana AI Agent</div>
      </div>

      <div class="arrow">➔</div>

      <div class="step-node" style="border-color: #60a5fa;">
        <div class="step-title">3. Đặt Cọc 50% - 100%</div>
        <div class="step-desc">Khách thanh toán qua VietQR hoặc VNPay Sandbox. Lưu CSDL bảng Order</div>
        <div class="step-sub">#KZN-2026-XXXX</div>
      </div>

      <div class="arrow">➔</div>

      <div class="step-node" style="border-color: #a855f7;">
        <div class="step-title">4. Nhân Viên JP Mua Hàng</div>
        <div class="step-desc">Admin duyệt đơn, nhân viên tại Tokyo dùng thẻ Nhật mua hàng trên sàn nguồn</div>
        <div class="step-sub">Quản lý Kanban Tokyo</div>
      </div>

      <div class="arrow">➔</div>

      <div class="step-node" style="border-color: #ec4899;">
        <div class="step-title">5. Nhập Kho Tokyo & Bay</div>
        <div class="step-desc">Kiểm tra ngoại quan, cân đo thực tế, đóng gói carton bay Narita ➔ VN</div>
        <div class="step-sub">Chuyến bay HAN / SGN</div>
      </div>

      <div class="arrow">➔</div>

      <div class="step-node" style="border-color: #f97316;">
        <div class="step-title">6. Kho Phân Loại Tại VN</div>
        <div class="step-desc">Thông quan hải quan VN, bưu tá bàn giao cho GHTK / GHN / ViettelPost</div>
        <div class="step-sub">Thu cước cân nặng còn lại</div>
      </div>

      <div class="arrow">➔</div>

      <div class="step-node" style="border-color: #10b981;">
        <div class="step-title">7. Giao Tận Nhà & Tracking</div>
        <div class="step-desc">Khách nhận hàng kiểm tra, tra cứu 7 trạng thái vận đơn tại trang /tracking</div>
        <div class="step-sub">Hoàn tất đơn hàng</div>
      </div>
    </div>
  </body>
  </html>
  `;
  await page2.setContent(html2);
  await page2.screenshot({ path: path.join(targetDir, '02_So_Do_Luong_Hoat_Dong_Tuyen_JP_Ve_VN_Mua_Ho.png') });
  await page2.close();

  // =========================================================================
  // 3. SƠ ĐỒ KIẾN TRÚC TỔNG THỂ TOÀN BỘ HỆ THỐNG (FULL-STACK ARCHITECTURE)
  // (5 tầng kiến trúc phần mềm chuẩn mực)
  // =========================================================================
  const page3 = await browser.newPage({ viewport: { width: 1400, height: 1050 }, deviceScaleFactor: 2 });
  const html3 = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      body { background: #0c1017; color: #f8fafc; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
      .title-box { text-align: center; margin-bottom: 25px; }
      .tag { display: inline-block; background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4); padding: 5px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 8px; }
      h1 { font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px; }
      p.sub { font-size: 13px; color: #94a3b8; max-width: 900px; margin-top: 4px; }
      
      .arch-stack { display: flex; flex-direction: column; gap: 14px; width: 100%; max-width: 1280px; }
      .layer { background: #141a24; border: 1px solid #334155; border-radius: 14px; padding: 16px 20px; }
      .layer-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .layer-title { font-size: 14px; font-weight: 800; color: #f8fafc; display: flex; align-items: center; gap: 8px; }
      .layer-tech { font-size: 11px; color: #94a3b8; font-family: monospace; background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 6px; }
      
      .grid-boxes { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
      .box { background: #1a2230; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px; }
      .box h3 { font-size: 12.5px; font-weight: 700; color: #ffffff; margin-bottom: 4px; }
      .box p { font-size: 11px; color: #94a3b8; line-height: 1.35; }
      .box b { color: #f59e0b; }
      
      .layer.l1 { border-left: 4px solid #38bdf8; }
      .layer.l2 { border-left: 4px solid #818cf8; }
      .layer.l3 { border-left: 4px solid #c084fc; }
      .layer.l4 { border-left: 4px solid #f472b6; }
      .layer.l5 { border-left: 4px solid #34d399; }
    </style>
  </head>
  <body>
    <div class="title-box">
      <span class="tag">System Architecture Overview</span>
      <h1>SƠ ĐỒ KIẾN TRÚC TỔNG THỂ TOÀN BỘ HỆ THỐNG CHILLBANANA</h1>
      <p class="sub">Kiến trúc đa tầng (Layered Architecture) phân tách độc lập giữa Khách Hàng, API Gateway, Nghiệp Vụ AI & Vận Hành, Tích Hợp Ngoại Vi và Cơ Sở Dữ Liệu.</p>
    </div>

    <div class="arch-stack">
      <!-- LAYER 1: CLIENT PRESENTATION -->
      <div class="layer l1">
        <div class="layer-header">
          <div class="layer-title"><span>💻 TẦNG 1: GIAO DIỆN NGƯỜI DÙNG (PRESENTATION LAYER)</span></div>
          <span class="layer-tech">React 18 · Next.js 14 App Router · Tailwind CSS</span>
        </div>
        <div class="grid-boxes">
          <div class="box">
            <h3>🌐 Trang Chủ Khách Hàng (NeoDaylight)</h3>
            <p>Dán link bóc tách giá Yên, Chat AI Omotenashi, Báo giá VN ➔ JP, Cẩm nang hàng Nhật.</p>
          </div>
          <div class="box">
            <h3>📦 Tra Cứu Vận Đơn (/tracking)</h3>
            <p>Xem timeline 7 bước vận đơn JP ➔ VN, xem trạng thái cọc, mã kiện nội địa Yamato/GHTK.</p>
          </div>
          <div class="box">
            <h3>⚙️ Bàn Tác Nghiệp Admin (Kanban)</h3>
            <p>3 Chế độ: <b>Dashboard</b> (KPI), <b>Tác nghiệp JP➔VN</b> (7 bước), <b>✈️ Điều phối VN➔JP</b> (5 bước).</p>
          </div>
          <div class="box">
            <h3>👥 Unified Customer 360 (CRM)</h3>
            <p>Quản lý toàn diện: Thành viên đăng ký, Khách đặt đơn vãng lai, và Khách tư vấn Chat Lead.</p>
          </div>
        </div>
      </div>

      <!-- LAYER 2: API & GATEWAY -->
      <div class="layer l2">
        <div class="layer-header">
          <div class="layer-title"><span>🛡️ TẦNG 2: API ROUTING & GATEWAY BẢO MẬT</span></div>
          <span class="layer-tech">Next.js Edge / Node.js Route Handlers · Jose JWT · Rate Limit</span>
        </div>
        <div class="grid-boxes">
          <div class="box">
            <h3>🔒 Admin & Customer Auth Guard</h3>
            <p>Xác thực phiên qua HttpOnly Cookie, chữ ký HMAC SHA-256 chống giả mạo danh tính.</p>
          </div>
          <div class="box">
            <h3>⏱️ Persistent DB Rate Limiter</h3>
            <p>Chống spam brute-force login, chống spam đăng ký, chống DDOS bot cào dữ liệu qua IP.</p>
          </div>
          <div class="box">
            <h3>🛒 Order & Dispatch API Handlers</h3>
            <p><code>POST /api/orders</code> (Mua hộ JP➔VN) và <code>POST /api/vn-jp-shipments</code> (Ký gửi VN➔JP).</p>
          </div>
          <div class="box">
            <h3>🤖 AI Support Tools API Handler</h3>
            <p><code>POST /api/ai/chat</code> tiếp nhận tin nhắn, điều phối Intent, gọi Function Calling.</p>
          </div>
        </div>
      </div>

      <!-- LAYER 3: CORE LOGIC & AI -->
      <div class="layer l3">
        <div class="layer-header">
          <div class="layer-title"><span>🧠 TẦNG 3: LÕI NGHIỆP VỤ & TRÍ TUỆ NHÂN TẠO (BUSINESS & AI ENGINES)</span></div>
          <span class="layer-tech">Google Gemini 1.5 · Business Calculators · Scraping Parsers</span>
        </div>
        <div class="grid-boxes">
          <div class="box">
            <h3>🤖 ChillBanana AI Agent Engine</h3>
            <p>2 phong cách <i>Omotenashi</i> (trang trọng) và <i>Vietnamese</i> (thân thiện). Tư vấn sản phẩm 24/7.</p>
          </div>
          <div class="box">
            <h3>🔍 E-Commerce Scraper Engine</h3>
            <p>Bóc tách tự động link Amazon JP (ASIN), Mercari (mXXXX), Rakuten (itemCode), Yahoo Auctions.</p>
          </div>
          <div class="box">
            <h3>📐 IATA Air Freight Calculator</h3>
            <p>So sánh Cân thực tế vs Thể tích $(D \times R \times C / 5000)$. Bảng giá theo danh mục hàng.</p>
          </div>
          <div class="box">
            <h3>🏷️ Dynamic Pricing Config Engine</h3>
            <p>Snapshot tỷ giá JPY/VND, phí mua hộ 4%, cước bay 185k/kg, lưu lịch sử phiên bản Versioning.</p>
          </div>
        </div>
      </div>

      <!-- LAYER 4: INTEGRATIONS -->
      <div class="layer l4">
        <div class="layer-header">
          <div class="layer-title"><span>🔌 TẦNG 4: KẾT NỐI NGOẠI VI (EXTERNAL SERVICES & INTEGRATIONS)</span></div>
          <span class="layer-tech">Google AI Studio · VNPay Sandbox · VietQR · Nodemailer SMTP</span>
        </div>
        <div class="grid-boxes">
          <div class="box">
            <h3>✨ Google Gemini API</h3>
            <p>Xử lý ngôn ngữ tự nhiên, phân tích sentiment khách hàng, trích xuất từ khóa quan tâm.</p>
          </div>
          <div class="box">
            <h3>💳 Cổng Thanh Toán VNPay & VietQR</h3>
            <p>Sinh mã QR VietQR chuyển khoản tức thì; Cổng VNPAY Sandbox bảo mật IPN checksum.</p>
          </div>
          <div class="box">
            <h3>📧 Dịch Vụ Email Tự Động (SMTP)</h3>
            <p>Nodemailer gửi email xác nhận đặt hàng, link kích hoạt tài khoản, mã tra cứu đơn hàng.</p>
          </div>
          <div class="box">
            <h3>✈️ Logistics Carriers & Checkpoint</h3>
            <p>Theo dõi chuyến bay AWB Narita/Haneda, hãng bưu chính nội địa Yamato Kuroneko & Sagawa.</p>
          </div>
        </div>
      </div>

      <!-- LAYER 5: DATA PERSISTENCE -->
      <div class="layer l5">
        <div class="layer-header">
          <div class="layer-title"><span>🗄️ TẦNG 5: CƠ SỞ DỮ LIỆU & LƯU TRỮ BỀN VỮNG (PERSISTENCE LAYER)</span></div>
          <span class="layer-tech">Neon Serverless PostgreSQL · Prisma ORM Client</span>
        </div>
        <div class="grid-boxes">
          <div class="box">
            <h3>📦 Order & OrderItem</h3>
            <p>Lưu toàn bộ đơn hàng mua hộ JP ➔ VN, tiền cọc, tỷ giá, 7 trạng thái Kanban, tracking logs.</p>
          </div>
          <div class="box">
            <h3>✈️ VnJpShipment (Độc Lập)</h3>
            <p>Lưu phiếu ký gửi VN ➔ JP, người gửi VN, người nhận JP (〒 7 số), cam kết MAFF, cước IATA.</p>
          </div>
          <div class="box">
            <h3>💬 ChatSession & Customer</h3>
            <p>Lưu lịch sử hội thoại, phân tích xu hướng mua sắm, tài khoản thành viên, nhật ký kiểm toán.</p>
          </div>
          <div class="box">
            <h3>⚙️ PricingConfig & SystemConfig</h3>
            <p>Lưu cấu hình phí, tỷ giá động, bộ đếm RateLimit, log giao dịch thanh toán.</p>
          </div>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
  await page3.setContent(html3);
  await page3.screenshot({ path: path.join(targetDir, '03_So_Do_Kien_Truc_Tong_The_Full_Stack_ChillBanana.png') });
  await page3.close();

  // =========================================================================
  // 4. SƠ ĐỒ VẬN HÀNH 2 BÀN TÁC NGHIỆP SONG SONG TRONG ADMIN
  // (Dual-Operations Kanban Flowchart)
  // =========================================================================
  const page4 = await browser.newPage({ viewport: { width: 1600, height: 600 }, deviceScaleFactor: 2 });
  const html4 = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      body { background: #11151f; color: #f8fafc; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
      .title-box { text-align: center; margin-bottom: 25px; }
      .badge { display: inline-block; background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4); padding: 5px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 8px; }
      h1 { font-size: 22px; font-weight: 800; color: #ffffff; }
      
      .main-split { display: flex; gap: 30px; width: 100%; max-width: 1520px; align-items: stretch; }
      .split-card { flex: 1; background: #181f2c; border: 1.5px solid #334155; border-radius: 16px; padding: 22px; display: flex; flex-direction: column; }
      .split-card.blue { border-top: 4px solid #3b82f6; }
      .split-card.green { border-top: 4px solid #10b981; }
      
      .split-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); }
      .split-title { font-size: 16px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
      .split-badge { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; }
      
      .chain { display: flex; flex-direction: column; gap: 8px; flex: 1; justify-content: space-between; }
      .chain-node { background: #111722; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; font-size: 12px; }
      .chain-node b { color: #ffffff; }
      .chain-node span { color: #94a3b8; font-size: 11px; }
      
      .top-hub { width: 100%; max-width: 1520px; background: #1e293b; border: 1px solid #475569; border-radius: 12px; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 25px; }
      .top-hub div { font-size: 13.5px; font-weight: 700; color: #cbd5e1; }
      .switch-mock { display: flex; gap: 8px; }
      .btn-mock { padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; border: 1px solid transparent; }
      .btn-mock.active1 { background: #3b82f6; color: white; }
      .btn-mock.active2 { background: #10b981; color: white; }
      .btn-mock.idle { background: #0f172a; color: #94a3b8; border-color: #334155; }
    </style>
  </head>
  <body>
    <div class="title-box">
      <span class="badge">Admin Operations Dual-Workflow</span>
      <h1>SƠ ĐỒ PHÂN NHÁNH 2 BÀN TÁC NGHIỆP SONG SONG TRÊN ADMIN PORTAL</h1>
    </div>

    <div class="top-hub">
      <div>⚙️ <b>Thanh Chuyển Chế Độ Làm Việc (Admin Header Mode Switch):</b></div>
      <div class="switch-mock">
        <div class="btn-mock idle">📊 Dashboard</div>
        <div class="btn-mock active1">📋 Tác nghiệp JP ➔ VN (Mua Hộ)</div>
        <div class="btn-mock active2">✈️ Điều phối VN ➔ JP (Ký Gửi)</div>
      </div>
    </div>

    <div class="main-split">
      <!-- CỘT 1: TÁC NGHIỆP MUA HỘ JP -> VN -->
      <div class="split-card blue">
        <div class="split-header">
          <div class="split-title" style="color: #60a5fa;">🇯🇵 ➔ 🇻🇳 BÀN TÁC NGHIỆP MUA HỘ (KANBAN 7 BƯỚC)</div>
          <span class="split-badge" style="background: rgba(59, 130, 246, 0.2); color: #93c5fd;">Bảng Order (PostgreSQL)</span>
        </div>
        <div class="chain">
          <div class="chain-node"><b>1. PENDING_DEPOSIT</b> <span>Chờ khách đặt cọc 50% - 100% qua VietQR/VNPay</span></div>
          <div class="chain-node"><b>2. PURCHASING_JP</b> <span>Nhân viên Tokyo vào sàn Amazon/Mercari mua hàng</span></div>
          <div class="chain-node"><b>3. WAREHOUSE_JP</b> <span>Hàng về kho Tokyo/Osaka, kiểm tra & cân đo</span></div>
          <div class="chain-node"><b>4. IN_TRANSIT_AIR</b> <span>Đang bay hàng không quốc tế Narita ➔ Nội Bài/Tân Sơn Nhất</span></div>
          <div class="chain-node"><b>5. WAREHOUSE_VN</b> <span>Đã cập cảng / nhập kho phân loại tại Việt Nam</span></div>
          <div class="chain-node"><b>6. LOCAL_DELIVERY</b> <span>Đang giao hàng chặng cuối qua GHTK / GHN / ViettelPost</span></div>
          <div class="chain-node"><b>7. COMPLETED</b> <span>Khách nhận hàng thành công, tất toán tiền cọc</span></div>
        </div>
      </div>

      <!-- CỘT 2: ĐIỀU PHỐI KÝ GỬI VN -> JP -->
      <div class="split-card green">
        <div class="split-header">
          <div class="split-title" style="color: #34d399;">🇻🇳 ➔ 🇯🇵 BÀN ĐIỀU PHỐI KÝ GỬI (KANBAN 5 BƯỚC)</div>
          <span class="split-badge" style="background: rgba(16, 185, 129, 0.2); color: #6ee7b7;">Bảng VnJpShipment (Độc Lập)</span>
        </div>
        <div class="chain">
          <div class="chain-node"><b>1. MỚI TIẾP NHẬN</b> <span>Khách submit web, hiển thị chuông đỏ, có nút "📞 Gọi khách"</span></div>
          <div class="chain-node"><b>2. ĐÃ CHỐT & CHỜ LẤY</b> <span>Đã gọi rà soát hàng cấm MAFF, xếp lịch bưu tá qua lấy tận nhà VN</span></div>
          <div class="chain-node"><b>3. KHO VN CÂN ĐO IATA</b> <span>Nhập kho VN, kiểm tra thùng, nhập D×R×C chốt cước thể tích</span></div>
          <div class="chain-node"><b>4. ĐANG BAY SANG NHẬT</b> <span>Đã lên máy bay, có mã AWB chuyến bay, hải quan Nhật quét X-quang</span></div>
          <div class="chain-node"><b>5. GIAO THÀNH CÔNG TẠI JP</b> <span>Bàn giao Yamato/Sagawa phát tận tay người nhận theo 〒 Zipcode</span></div>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
  await page4.setContent(html4);
  await page4.screenshot({ path: path.join(targetDir, '04_So_Do_Hai_Luong_Tac_Nghiep_Song_Song_Trong_Admin.png') });
  await page4.close();

  await browser.close();
  console.log('ALL 4 SYSTEM FLOWCHARTS GENERATED SUCCESSFULLY in:', targetDir);
}

renderFlowcharts().catch(err => {
  console.error('FAILED TO RENDER FLOWCHARTS:', err);
  process.exit(1);
});
