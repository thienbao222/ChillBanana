const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const downloadsDir = path.join('C:', 'Users', 'TBao', 'Downloads', 'ChillBanana_Bo_Anh_So_Do_Kien_Truc');
const rootProjectDir = path.join(__dirname, '..', 'Bo_Anh_So_Do_He_Thong_ChillBanana');
const neoDir = path.join(__dirname, '..', 'NeoUniverse', 'So_Do_Kien_Truc_Va_Luong_Hoat_Dong_He_Thong');
const vnJpDir = path.join(__dirname, '..', 'NeoUniverse', 'VN_JP_Logistics_MoHinh_Va_LuongHoatDong');

[downloadsDir, rootProjectDir, neoDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

async function renderExtraDiagrams() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });

  // --------------------------------------------------------------------------
  // DIAGRAM A: SƠ ĐỒ 3 KHỐI CLIENT - BACKEND - ADMIN (ĐÚNG NHƯ ẢNH USER GỬI)
  // --------------------------------------------------------------------------
  const pageA = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
  const htmlA = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      body { background: #12141a; color: #f8fafc; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
      .title-box { text-align: center; margin-bottom: 25px; }
      .badge { display: inline-block; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 5px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 8px; }
      h1 { font-size: 22px; font-weight: 800; color: #ffffff; }
      
      .flow-card { width: 100%; max-width: 1100px; display: flex; flex-direction: column; gap: 20px; align-items: center; }
      .subgraph { width: 100%; background: #181c26; border: 1.5px solid #334155; border-radius: 14px; padding: 20px 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.3); }
      .sub-title { font-size: 14px; font-weight: 800; color: #f8fafc; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px; }
      
      .nodes-row { display: flex; gap: 14px; justify-content: space-between; }
      .node-box { flex: 1; background: #0f172a; border: 1px solid #475569; border-radius: 10px; padding: 12px 14px; font-size: 12px; text-align: center; color: #cbd5e1; }
      .node-box b { display: block; color: #ffffff; margin-bottom: 4px; font-size: 12.5px; }
      
      .arrow-down { color: #38bdf8; font-size: 18px; font-weight: 800; display: flex; flex-direction: column; align-items: center; gap: 4px; }
      .arrow-down span { font-size: 11.5px; font-weight: 700; color: #94a3b8; background: #181c26; padding: 3px 12px; border-radius: 999px; border: 1px solid #334155; }
      
      .switch-bar { display: flex; gap: 10px; justify-content: center; margin-bottom: 14px; }
      .btn-s { background: #0f172a; border: 1px solid #475569; padding: 8px 18px; border-radius: 8px; font-size: 12px; font-weight: 700; color: #94a3b8; }
      .btn-s.active { background: #10b981; border-color: #059669; color: #ffffff; }
      
      .kanban-summary { background: #0b1120; border: 1px solid #10b981; border-radius: 10px; padding: 12px 16px; font-size: 12px; text-align: center; color: #6ee7b7; font-weight: 600; }
    </style>
  </head>
  <body>
    <div class="title-box">
      <span class="badge">Architecture Subsystem Flow</span>
      <h1>SƠ ĐỒ 3 KHỐI CLIENT - BACKEND - ADMIN PHÂN HỆ VN ➔ JP</h1>
    </div>

    <div class="flow-card">
      <!-- 1. KHÁCH HÀNG -->
      <div class="subgraph">
        <div class="sub-title">1. KHÁCH HÀNG (Web Form Tuyến VN ➔ JP)</div>
        <div class="nodes-row">
          <div class="node-box" style="border-color: #38bdf8;">
            <b>Người gửi tại VN</b>
            Họ tên, SĐT/Zalo, Địa chỉ lấy hàng tận nhà tại VN, Hẹn giờ lấy
          </div>
          <div class="node-box" style="border-color: #f59e0b;">
            <b>Người nhận tại Nhật</b>
            Tên Romaji in hoa, SĐT nội địa Nhật (+81), Mã bưu điện 〒 7 số, Số phòng Mansion
          </div>
          <div class="node-box" style="border-color: #ef4444;">
            <b>Hàng hóa & Cam kết MAFF</b>
            Danh mục chi tiết, Cân nặng, Hộp tính cước IATA, Cam kết cấm thịt
          </div>
        </div>
      </div>

      <div class="arrow-down">
        <span>Gửi yêu cầu (POST /api/vn-jp-shipments)</span>
        ↓
      </div>

      <!-- 2. BACKEND & CƠ SỞ DỮ LIỆU ĐỘC LẬP -->
      <div class="subgraph" style="border-color: #3b82f6;">
        <div class="sub-title" style="color: #60a5fa;">2. BACKEND & CƠ SỞ DỮ LIỆU ĐỘC LẬP</div>
        <div class="nodes-row">
          <div class="node-box" style="flex: 1; border-color: #60a5fa;">
            <b>API: /api/vn-jp-shipments & /api/vn-jp-shipments/[id]</b>
            Thẩm định dữ liệu, sinh mã duy nhất VNJP-2026-XXXX, tính cước IATA, bảo mật Admin
          </div>
          <div class="node-box" style="flex: 1; border-color: #10b981; background: #064e3b20;">
            <b>Bảng PostgreSQL: VnJpShipment (31 Cột Độc Lập)</b>
            Lưu độc lập trên Neon Cloud. Hoàn toàn KHÔNG đụng bảng Order cũ ➔ Không lỗi Domino!
          </div>
        </div>
      </div>

      <div class="arrow-down">
        <span>Hiển thị Realtime & Quản trị</span>
        ↓
      </div>

      <!-- 3. ADMIN PORTAL -->
      <div class="subgraph" style="border-color: #10b981;">
        <div class="sub-title" style="color: #34d399;">3. ADMIN PORTAL (Thêm Nút Song Song & Bàn Điều Phối)</div>
        
        <div class="switch-bar">
          <div class="btn-s">📊 Dashboard</div>
          <div class="btn-s">📋 Tác nghiệp (JP ➔ VN Mua hộ)</div>
          <div class="btn-s active">✈️ Điều phối VN ➔ JP (Nút Mới Kế Bên)</div>
        </div>

        <div class="kanban-summary">
          Bàn Điều Phối Kanban 5 Cột:<br>
          <b>1. Mới Tiếp Nhận ➔ 2. Đã Chốt & Chờ Lấy ➔ 3. Kho VN Cân Đo IATA ➔ 4. Đang Bay Sang JP ➔ 5. Hoàn Tất</b>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
  await pageA.setContent(htmlA);
  const fileA = '05_So_Do_Kien_Truc_3_Khoi_Client_Backend_Admin_Song_Song.png';
  await pageA.screenshot({ path: path.join(neoDir, fileA) });
  await pageA.close();

  // --------------------------------------------------------------------------
  // DIAGRAM B: LUỒNG TƯ VẤN AI AGENT OMOTENASHI & THU THẬP CHAT LEAD
  // --------------------------------------------------------------------------
  const pageB = await browser.newPage({ viewport: { width: 1700, height: 420 }, deviceScaleFactor: 2 });
  const htmlB = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      body { background: #12141a; color: #f8fafc; padding: 35px 30px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
      .title-bar { text-align: center; margin-bottom: 25px; }
      .badge { display: inline-block; background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4); padding: 5px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; }
      h1 { font-size: 21px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px; }
      
      .flow-container { display: flex; align-items: center; justify-content: center; gap: 0; width: 100%; max-width: 1650px; }
      .step-node { background: #181c26; border: 1.5px solid #334155; border-radius: 10px; padding: 18px 14px; width: 220px; min-height: 125px; display: flex; flex-direction: column; justify-content: center; text-align: center; box-shadow: 0 4px 14px rgba(0,0,0,0.4); }
      .step-title { font-size: 13px; font-weight: 800; color: #f8fafc; margin-bottom: 6px; line-height: 1.35; }
      .step-desc { font-size: 11px; color: #94a3b8; line-height: 1.4; }
      .step-sub { font-size: 10.5px; color: #c084fc; font-weight: 700; margin-top: 5px; font-family: monospace; }
      
      .arrow { width: 38px; display: flex; align-items: center; justify-content: center; color: #c084fc; font-size: 20px; font-weight: 900; shrink-0; }
    </style>
  </head>
  <body>
    <div class="title-bar">
      <span class="badge">Trí Tuệ Nhân Tạo & Chăm Sóc Khách Hàng</span>
      <h1>SƠ ĐỒ LUỒNG HOẠT ĐỘNG: CHILLBANANA AI AGENT & THU THẬP CHAT LEAD CRM</h1>
    </div>

    <div class="flow-container">
      <div class="step-node" style="border-color: #38bdf8;">
        <div class="step-title">1. Khách Gửi Tin Nhắn</div>
        <div class="step-desc">Khách chat hỏi tỷ giá, cách mua Mercari, cước bay, hoặc dán link hàng Nhật</div>
        <div class="step-sub">Web Chat Widget 24/7</div>
      </div>

      <div class="arrow">➔</div>

      <div class="step-node" style="border-color: #818cf8;">
        <div class="step-title">2. Rate Limit & Phân Tích</div>
        <div class="step-desc">Kiểm tra tần suất IP (chống spam), bóc tách từ khóa, xác định cảm xúc (sentiment)</div>
        <div class="step-sub">Persistent RateLimit DB</div>
      </div>

      <div class="arrow">➔</div>

      <div class="step-node" style="border-color: #c084fc;">
        <div class="step-title">3. Support Tools Engine</div>
        <div class="step-desc">Tự động gọi công cụ tra cứu giá, chính sách kiểm dịch, tra cứu đơn hàng không cần AI</div>
        <div class="step-sub">Deterministic Guardrail</div>
      </div>

      <div class="arrow">➔</div>

      <div class="step-node" style="border-color: #ec4899;">
        <div class="step-title">4. Gemini AI Phản Hồi</div>
        <div class="step-desc">Gọi Google Gemini 1.5 với phong cách Omotenashi tinh tế hoặc tiếng Việt thân thiện</div>
        <div class="step-sub">Google Gemini Flash/Pro</div>
      </div>

      <div class="arrow">➔</div>

      <div class="step-node" style="border-color: #f59e0b;">
        <div class="step-title">5. Tách Họ Tên & SĐT</div>
        <div class="step-desc">Regex bóc tách Họ tên, SĐT, Email từ tin nhắn để định danh khách tư vấn</div>
        <div class="step-sub">Phân loại CHAT_LEAD</div>
      </div>

      <div class="arrow">➔</div>

      <div class="step-node" style="border-color: #10b981;">
        <div class="step-title">6. Đồng Bộ Admin CRM</div>
        <div class="step-desc">Lưu ChatSession, tự động xuất hiện tại Tab Khách Hàng 360 & Tab Xu Hướng AI</div>
        <div class="step-sub">Nhân viên tiếp nhận chăm sóc</div>
      </div>
    </div>
  </body>
  </html>
  `;
  await pageB.setContent(htmlB);
  const fileB = '06_So_Do_Luong_Tu_Van_AI_Agent_Va_Thu_Thap_Lead.png';
  await pageB.screenshot({ path: path.join(neoDir, fileB) });
  await pageB.close();

  await browser.close();
  console.log('Extra diagrams rendered successfully.');
}

async function copyAllFiles() {
  await renderExtraDiagrams();

  // Gather all generated files from both directories
  const filesFromNeo = fs.readdirSync(neoDir).filter(f => f.endsWith('.png'));
  const filesFromVnJp = fs.readdirSync(vnJpDir).filter(f => f.endsWith('.png'));

  console.log(`Copying ${filesFromNeo.length} files from NeoDir and ${filesFromVnJp.length} files from VnJpDir...`);

  filesFromNeo.forEach(file => {
    const src = path.join(neoDir, file);
    fs.copyFileSync(src, path.join(downloadsDir, file));
    fs.copyFileSync(src, path.join(rootProjectDir, file));
  });

  filesFromVnJp.forEach(file => {
    const src = path.join(vnJpDir, file);
    fs.copyFileSync(src, path.join(downloadsDir, file));
    fs.copyFileSync(src, path.join(rootProjectDir, file));
  });

  console.log('SUCCESS: All diagram images exported to:');
  console.log('1.', downloadsDir);
  console.log('2.', rootProjectDir);
}

copyAllFiles().catch(err => {
  console.error('EXPORT ERROR:', err);
  process.exit(1);
});
