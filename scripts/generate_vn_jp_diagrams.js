const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'NeoUniverse', 'VN_JP_Logistics_MoHinh_Va_LuongHoatDong');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

async function renderDiagrams() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });

  const page = await browser.newPage({
    viewport: { width: 1400, height: 950 },
    deviceScaleFactor: 2 // 2x retina sharpness
  });

  // ==========================================
  // DIAGRAM 1: KIẾN TRÚC 2 LUỒNG SONG SONG ĐỘC LẬP
  // ==========================================
  const html1 = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      body { background: #0b0f19; color: #f1f5f9; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
      .header { text-align: center; margin-bottom: 30px; }
      .tag { display: inline-block; background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4); padding: 6px 16px; border-radius: 999px; font-size: 13px; font-weight: 700; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
      h1 { font-size: 26px; font-weight: 800; color: #ffffff; margin-bottom: 8px; }
      p.sub { font-size: 14px; color: #94a3b8; max-width: 900px; line-height: 1.5; }
      
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; width: 100%; max-width: 1300px; margin-top: 20px; }
      .lane { background: rgba(30, 41, 59, 0.7); border-radius: 20px; padding: 25px; border: 1px solid rgba(255, 255, 255, 0.1); position: relative; }
      .lane.jp-vn { border-top: 4px solid #3b82f6; }
      .lane.vn-jp { border-top: 4px solid #10b981; }
      
      .lane-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); }
      .lane-title h2 { font-size: 18px; font-weight: 800; display: flex; align-items: center; gap: 10px; }
      .badge { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 8px; }
      .badge-blue { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); }
      .badge-green { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); }
      
      .steps { display: flex; flex-direction: column; gap: 12px; }
      .step-item { background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 14px 16px; display: flex; align-items: center; gap: 14px; }
      .step-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; shrink-0; }
      .step-info { flex: 1; }
      .step-info h3 { font-size: 13.5px; font-weight: 700; color: #f8fafc; margin-bottom: 2px; }
      .step-info p { font-size: 11.5px; color: #94a3b8; line-height: 1.4; }
      
      .footer-box { margin-top: 25px; width: 100%; max-width: 1300px; background: rgba(15, 23, 42, 0.95); border: 1px dashed rgba(245, 158, 11, 0.4); border-radius: 16px; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
      .footer-box div { font-size: 13px; color: #cbd5e1; }
      .footer-box b { color: #f59e0b; }
      .tag-safe { background: #064e3b; color: #6ee7b7; padding: 6px 14px; border-radius: 999px; font-weight: 800; font-size: 12px; border: 1px solid #059669; }
    </style>
  </head>
  <body>
    <div class="header">
      <span class="tag">Kiến Trúc Hệ Thống Song Song (Dual-Workflow)</span>
      <h1>MÔ HÌNH PHÂN TÁCH 2 CHIỀU HOẠT ĐỘNG RIÊNG BIỆT: JP ➔ VN & VN ➔ JP</h1>
      <p class="sub">Tách luồng triệt để: Chiều Mua Hộ Nhật giữ nguyên 100% (an toàn toàn bộ 106 test tự động). Chiều Ký Gửi Sang Nhật chạy song song với Bảng Dữ Liệu và Bàn Tác Nghiệp Độc Lập.</p>
    </div>

    <div class="grid">
      <!-- LUỒNG 1: JP -> VN -->
      <div class="lane jp-vn">
        <div class="lane-title">
          <h2><span>🇯🇵 ➔ 🇻🇳</span> Dịch Vụ Mua Hộ Hàng Nhật</h2>
          <span class="badge badge-blue">Luồng E-Commerce Mua Hộ</span>
        </div>
        <div class="steps">
          <div class="step-item">
            <div class="step-icon" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa;">🔗</div>
            <div class="step-info">
              <h3>Khách dán link hàng Nhật</h3>
              <p>Amazon JP, Mercari, Rakuten, Yahoo Auctions. Scraper tự động bóc tách giá Yên & tỷ giá.</p>
            </div>
          </div>
          <div class="step-item">
            <div class="step-icon" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa;">💳</div>
            <div class="step-info">
              <h3>Đặt cọc 50% - 100% qua VietQR / VNPay</h3>
              <p>Lưu vào bảng Order. Sinh mã đơn KZN-2026-XXXX. Khóa tỷ giá và phí dịch vụ mua hộ.</p>
            </div>
          </div>
          <div class="step-item">
            <div class="step-icon" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa;">🏢</div>
            <div class="step-info">
              <h3>Nhân viên mua hàng & nhập kho Tokyo/Osaka</h3>
              <p>Thanh toán thẻ Nhật, nhận hàng tại kho Nhật, kiểm tra ngoại quan và dán nhãn bay về VN.</p>
            </div>
          </div>
          <div class="step-item">
            <div class="step-icon" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa;">✈️</div>
            <div class="step-info">
              <h3>Bay về Nội Bài / Tân Sơn Nhất ➔ Giao nội địa</h3>
              <p>Quản lý qua Kanban 7 bước: OrderManagementTab. Khách tra cứu tại /tracking.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- LUỒNG 2: VN -> JP -->
      <div class="lane vn-jp">
        <div class="lane-title">
          <h2><span>🇻🇳 ➔ 🇯🇵</span> Dịch Vụ Ký Gửi Sang Nhật Bản</h2>
          <span class="badge badge-green">Luồng Ký Gửi Logistics Hàng Không</span>
        </div>
        <div class="steps">
          <div class="step-item">
            <div class="step-icon" style="background: rgba(16, 185, 129, 0.2); color: #34d399;">📝</div>
            <div class="step-info">
              <h3>Khách điền Phiếu gửi & Cam kết MAFF</h3>
              <p>Thu thập người gửi VN, người nhận JP (〒 Zipcode 7 số), danh mục hàng, tích cam kết chống hàng cấm.</p>
            </div>
          </div>
          <div class="step-item">
            <div class="step-icon" style="background: rgba(16, 185, 129, 0.2); color: #34d399;">📞</div>
            <div class="step-info">
              <h3>Bàn Điều Phối Admin gọi điện chốt lịch lấy hàng</h3>
              <p>Lưu vào bảng VnJpShipment (sinh mã VNJP-2026-XXXX). Nhân viên gọi điện, xếp lịch tài xế VN.</p>
            </div>
          </div>
          <div class="step-item">
            <div class="step-icon" style="background: rgba(16, 185, 129, 0.2); color: #34d399;">📦</div>
            <div class="step-info">
              <h3>Nhập kho VN, soát hàng cấm & đo cân IATA</h3>
              <p>Soát hàng (không thịt/xúc xích), đo kích thước D×R×C/5000, chốt cước thể tích, đóng thùng carton bay.</p>
            </div>
          </div>
          <div class="step-item">
            <div class="step-icon" style="background: rgba(16, 185, 129, 0.2); color: #34d399;">🚚</div>
            <div class="step-info">
              <h3>Bay Haneda/Narita ➔ Bàn giao Yamato/Sagawa</h3>
              <p>Hải quan Nhật thông quan. Bưu tá Nhật giao tận tay người nhận theo mã bưu điện 7 số.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="footer-box">
      <div>
        🛡️ <b>Cam kết Kiến Trúc:</b> Phân hệ <b>VN ➔ JP</b> hoạt động hoàn toàn song song qua nút <b>"✈️ Vận đơn VN ➔ JP"</b> độc lập trên Admin Navbar. Tuyệt đối không can thiệp bảng <code>Order</code> cũ, giữ nguyên <b>100% 106 bài test tự động</b>.
      </div>
      <div class="tag-safe">106 / 106 UNIT TESTS SAFE</div>
    </div>
  </body>
  </html>
  `;

  await page.setContent(html1);
  await page.screenshot({ path: path.join(targetDir, '01_Mo_Hinh_Kien_Truc_2_Chieu_Song_Song_Doc_Lap.png') });

  // ==========================================
  // DIAGRAM 2: USE CASE TỔNG THỂ CÁC BÊN THAM GIA
  // ==========================================
  const html2 = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      body { background: #0f172a; color: #f8fafc; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
      .header { text-align: center; margin-bottom: 25px; }
      .tag { display: inline-block; background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4); padding: 6px 16px; border-radius: 999px; font-size: 13px; font-weight: 700; margin-bottom: 10px; }
      h1 { font-size: 26px; font-weight: 800; color: #ffffff; margin-bottom: 8px; }
      p.sub { font-size: 14px; color: #94a3b8; max-width: 900px; }
      
      .actors-flow { display: flex; gap: 16px; width: 100%; max-width: 1320px; margin-top: 25px; justify-content: space-between; }
      .actor-card { flex: 1; background: rgba(30, 41, 59, 0.85); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 18px 14px; display: flex; flex-direction: column; align-items: center; text-align: center; position: relative; }
      .actor-icon { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 26px; margin-bottom: 12px; }
      .actor-title { font-size: 14px; font-weight: 800; color: #ffffff; margin-bottom: 4px; }
      .actor-role { font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.5px; }
      
      .usecases { width: 100%; display: flex; flex-direction: column; gap: 8px; text-align: left; }
      .uc-pill { background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.06); padding: 8px 10px; border-radius: 10px; font-size: 11px; color: #cbd5e1; line-height: 1.3; }
      .uc-pill b { color: #f8fafc; display: block; margin-bottom: 2px; }
      
      .arrow-conn { position: absolute; right: -12px; top: 38px; color: #64748b; font-size: 16px; z-index: 10; }
    </style>
  </head>
  <body>
    <div class="header">
      <span class="tag">Sơ Đồ Tác Nhân & Use Case Thực Tế (Actor-Driven Workflow)</span>
      <h1>7 TÁC NHÂN THAM GIA VÀO LUỒNG GỬI HÀNG TỪ VIỆT NAM SANG NHẬT BẢN</h1>
      <p class="sub">Minh họa vai trò và trách nhiệm pháp lý - nghiệp vụ của từng bên trong chuỗi cung ứng hàng không Việt - Nhật.</p>
    </div>

    <div class="actors-flow">
      <!-- 1. Người gửi VN -->
      <div class="actor-card">
        <div class="actor-icon" style="background: rgba(59, 130, 246, 0.2);">🧑‍💼</div>
        <div class="actor-title">Người Gửi Tại VN</div>
        <div class="actor-role" style="color: #60a5fa;">Khách hàng cá nhân</div>
        <div class="usecases">
          <div class="uc-pill"><b>Tạo Phiếu Điều Phối</b>Điền thông tin hàng & địa chỉ lấy tận nơi tại VN.</div>
          <div class="uc-pill"><b>Cung cấp 〒 Zipcode JP</b>Gửi thông tin người nhận: Tên Romaji, SĐT +81, số phòng.</div>
          <div class="uc-pill"><b>Ký Cam Kết MAFF</b>Cam kết không gửi thịt, xúc xích, đồ cấm kiểm dịch.</div>
        </div>
        <div class="arrow-conn">➔</div>
      </div>

      <!-- 2. Điều phối viên ChillBanana -->
      <div class="actor-card">
        <div class="actor-icon" style="background: rgba(245, 158, 11, 0.2);">👩‍💻</div>
        <div class="actor-title">Điều Phối Viên</div>
        <div class="actor-role" style="color: #fbbf24;">ChillBanana Ops</div>
        <div class="usecases">
          <div class="uc-pill"><b>Tiếp Nhận Trên Bàn Admin</b>Nhận thông báo khi có mã VNJP mới.</div>
          <div class="uc-pill"><b>Gọi Điện Thẩm Định</b>Gọi điện thoại/Zalo xác minh chi tiết hàng hóa.</div>
          <div class="uc-pill"><b>Điều Phối Bưu Tá</b>Bấm "Đã chốt" & xếp lịch tài xế qua lấy thùng hàng.</div>
        </div>
        <div class="arrow-conn">➔</div>
      </div>

      <!-- 3. Bưu tá lấy hàng VN -->
      <div class="actor-card">
        <div class="actor-icon" style="background: rgba(16, 185, 129, 0.2);">🛵</div>
        <div class="actor-title">Bưu Tá Lấy Hàng</div>
        <div class="actor-role" style="color: #34d399;">First-Mile Pickup</div>
        <div class="usecases">
          <div class="uc-pill"><b>Đến Tận Nhà Nhận Hàng</b>Đến đúng địa chỉ VN hẹn trước.</div>
          <div class="uc-pill"><b>Kiểm Tra Ngoại Quan</b>Soát nhanh hàng cấm, dán tem mã phiếu VNJP.</div>
          <div class="uc-pill"><b>Vận Chuyển Về Kho</b>Chuyển hàng về kho trung chuyển hàng không.</div>
        </div>
        <div class="arrow-conn">➔</div>
      </div>

      <!-- 4. Kho Hàng Không IATA -->
      <div class="actor-card">
        <div class="actor-icon" style="background: rgba(168, 85, 247, 0.2);">🏬</div>
        <div class="actor-title">Kho Hàng Không</div>
        <div class="actor-role" style="color: #c084fc;">Nội Bài / Tân Sơn Nhất</div>
        <div class="usecases">
          <div class="uc-pill"><b>Soát Hàng Lớp 2</b>Mở thùng kiểm tra 100% không chứa thịt/nông sản cấm.</div>
          <div class="uc-pill"><b>Cân Đo Chuẩn IATA</b>Đo D×R×C/5000 so với cân nặng thực tế để chốt cước.</div>
          <div class="uc-pill"><b>Đóng Thùng & Dán AWB</b>Bọc xốp nổ, dán nhãn vận đơn hàng không quốc tế.</div>
        </div>
        <div class="arrow-conn">➔</div>
      </div>

      <!-- 5. Hãng Bay & Hải Quan VN/JP -->
      <div class="actor-card">
        <div class="actor-icon" style="background: rgba(239, 68, 68, 0.2);">✈️</div>
        <div class="actor-title">Bay & Hải Quan</div>
        <div class="actor-role" style="color: #f87171;">Customs & Airlines</div>
        <div class="usecases">
          <div class="uc-pill"><b>Bay Quốc Tế (4–5h)</b>VNA / ANA / JAL bay thẳng Haneda/Narita/Kansai.</div>
          <div class="uc-pill"><b>Kiểm Dịch MAFF</b>Máy soi X-quang & chó nghiệp vụ kiểm tra thực phẩm.</div>
          <div class="uc-pill"><b>Thông Quan Phi Mậu Dịch</b>Miễn thuế nếu dưới 10.000 Yên (~1.7tr VNĐ).</div>
        </div>
        <div class="arrow-conn">➔</div>
      </div>

      <!-- 6. Hãng Giao Vận Nhật -->
      <div class="actor-card">
        <div class="actor-icon" style="background: rgba(14, 165, 233, 0.2);">🚚</div>
        <div class="actor-title">Giao Vận Tại Nhật</div>
        <div class="actor-role" style="color: #38bdf8;">Yamato / Sagawa / JP Post</div>
        <div class="usecases">
          <div class="uc-pill"><b>Quét 〒 Postal Code</b>Tự động chia chọn về đúng bưu cục quận/huyện.</div>
          <div class="uc-pill"><b>Giao Tận Căn Hộ</b>Shipper đối chiếu tên hòm thư & số phòng Mansion.</div>
          <div class="uc-pill"><b>Giấy Báo Fuzaihyō</b>Nếu vắng nhà, để lại giấy hẹn giờ nhận lại.</div>
        </div>
        <div class="arrow-conn">➔</div>
      </div>

      <!-- 7. Người Nhận Tại Nhật -->
      <div class="actor-card">
        <div class="actor-icon" style="background: rgba(234, 179, 8, 0.2);">🏠</div>
        <div class="actor-title">Người Nhận Tại JP</div>
        <div class="actor-role" style="color: #facc15;">Du học sinh / Tu nghiệp sinh</div>
        <div class="usecases">
          <div class="uc-pill"><b>Nghe Máy Shipper Nhật</b>Nhận cuộc gọi hẹn giờ giao (Jikantai Shitei).</div>
          <div class="uc-pill"><b>Ký Nhận Kiện Hàng</b>Ký nhận bưu phẩm hoặc nhận qua Takuhai Box.</div>
          <div class="uc-pill"><b>Đóng Thuế (Nếu có)</b>Thanh toán thuế JCT nếu hàng vượt 10k JPY.</div>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;

  await page.setContent(html2);
  await page.screenshot({ path: path.join(targetDir, '02_So_Do_Use_Case_Tong_The_Cac_Ben_Tham_Gia.png') });

  // ==========================================
  // DIAGRAM 3: QUY TRÌNH NGHIỆP VỤ 6 BƯỚC END-TO-END
  // ==========================================
  const html3 = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      body { background: #0a0e17; color: #f8fafc; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
      .header { text-align: center; margin-bottom: 30px; }
      .tag { display: inline-block; background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); padding: 6px 16px; border-radius: 999px; font-size: 13px; font-weight: 700; margin-bottom: 10px; }
      h1 { font-size: 26px; font-weight: 800; color: #ffffff; margin-bottom: 8px; }
      p.sub { font-size: 14px; color: #94a3b8; max-width: 900px; }
      
      .timeline { width: 100%; max-width: 1300px; display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; margin-top: 25px; }
      .tl-step { background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 20px 16px; display: flex; flex-direction: column; position: relative; }
      .tl-step::after { content: "➔"; position: absolute; right: -12px; top: 40px; color: #475569; font-size: 16px; font-weight: 900; z-index: 5; }
      .tl-step:last-child::after { display: none; }
      
      .step-num { width: 34px; height: 34px; border-radius: 999px; background: #3b82f6; color: #ffffff; font-weight: 900; font-size: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
      .step-h { font-size: 15px; font-weight: 800; color: #f8fafc; margin-bottom: 8px; line-height: 1.3; }
      .step-loc { font-size: 11px; font-weight: 700; color: #f59e0b; text-transform: uppercase; margin-bottom: 12px; }
      .step-desc { font-size: 12px; color: #94a3b8; line-height: 1.5; flex: 1; }
      
      .tag-risk { margin-top: 14px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5; padding: 6px 10px; border-radius: 8px; font-size: 11px; line-height: 1.3; }
      .tag-risk b { display: block; color: #ef4444; margin-bottom: 2px; }
      .tag-action { margin-top: 14px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #6ee7b7; padding: 6px 10px; border-radius: 8px; font-size: 11px; line-height: 1.3; }
      .tag-action b { display: block; color: #10b981; margin-bottom: 2px; }
    </style>
  </head>
  <body>
    <div class="header">
      <span class="tag">Quy Trình Nghiệp Vụ Thực Tế (End-to-End Logistics Pipeline)</span>
      <h1>LUỒNG HOẠT ĐỘNG 6 GIAI ĐOẠN TỪ LÚC TẠO PHIẾU ĐẾN GIAO TẬN TAY TẠI NHẬT</h1>
      <p class="sub">Mô hình giải quyết triệt để vấn đề: Khách gian dối hàng cấm, thiếu thông tin người nhận Nhật Bản, và lệch cước thể tích.</p>
    </div>

    <div class="timeline">
      <!-- BƯỚC 1 -->
      <div class="tl-step">
        <div class="step-num">1</div>
        <div class="step-h">Tạo Phiếu & Cam Kết MAFF</div>
        <div class="step-loc">📍 Trực Tuyến Trên Website</div>
        <div class="step-desc">
          Khách điền Họ tên, SĐT, Địa chỉ VN lấy hàng, Tỉnh/Thành Nhật, Tên người nhận Romaji, SĐT Nhật (+81), Mã bưu điện 〒 7 số. Tích cam kết không gửi thịt/xúc xích.
        </div>
        <div class="tag-action"><b>Tự Động Sinh Mã:</b>VNJP-2026-XXXX lưu ngay vào DB.</div>
      </div>

      <!-- BƯỚC 2 -->
      <div class="tl-step">
        <div class="step-num" style="background: #f59e0b;">2</div>
        <div class="step-h">Gọi Điện Xác Minh Hàng Hóa</div>
        <div class="step-loc">📍 Bàn Điều Phối Admin</div>
        <div class="step-desc">
          Nhân viên ChillBanana thấy đơn trong cột "Mới tiếp nhận", bấm gọi điện thoại/Zalo để rà soát: Hỏi kỹ từng món hàng, giải thích luật kiểm dịch MAFF Nhật, chốt giờ tài xế qua lấy.
        </div>
        <div class="tag-risk"><b>Phòng Ngừa Rủi Ro:</b>Khách giấu thịt ➔ Từ chối ngay qua điện thoại.</div>
      </div>

      <!-- BƯỚC 3 -->
      <div class="tl-step">
        <div class="step-num" style="background: #10b981;">3</div>
        <div class="step-h">Lấy Hàng Tận Nhà Tại VN</div>
        <div class="step-loc">📍 Nội Địa Việt Nam</div>
        <div class="step-desc">
          Tài xế ChillBanana đến địa chỉ khách tại Hà Nội, TP.HCM hoặc tỉnh thành. Kiểm tra sơ bộ kiện hàng, dán tem mã vận đơn VNJP và chở về trung tâm khai thác hàng không.
        </div>
        <div class="tag-action"><b>Chuyển Trạng Thái:</b>Admin cập nhật: "Đã lấy hàng về kho".</div>
      </div>

      <!-- BƯỚC 4 -->
      <div class="tl-step">
        <div class="step-num" style="background: #a855f7;">4</div>
        <div class="step-h">Soát Lớp 2 & Đo Cân IATA</div>
        <div class="step-loc">📍 Kho Nội Bài / Tân Sơn Nhất</div>
        <div class="step-desc">
          Kho mở thùng kiểm tra 100% không có hàng cấm. Đo kích thước D×R×C/5000 so với cân nặng thực tế. Đóng thùng carton chuẩn bay, quấn màng co, in tem Air Waybill (AWB).
        </div>
        <div class="tag-action"><b>Chốt Cước Chuẩn:</b>Khách thanh toán cước chính xác theo IATA.</div>
      </div>

      <!-- BƯỚC 5 -->
      <div class="tl-step">
        <div class="step-num" style="background: #ef4444;">5</div>
        <div class="step-h">Bay Quốc Tế & Thông Quan</div>
        <div class="step-loc">📍 Sân Bay Narita / Haneda</div>
        <div class="step-desc">
          Chuyến bay thẳng VNA/ANA hạ cánh sau 5 tiếng. Hải quan Nhật quét máy soi X-quang, chó nghiệp vụ kiểm tra thịt. Hàng quà biếu phi mậu dịch dưới 10k Yên được miễn thuế tiêu dùng.
        </div>
        <div class="tag-risk"><b>Pháp Lý An Toàn:</b>Nhờ bước 2 & 4, hàng không vi phạm MAFF.</div>
      </div>

      <!-- BƯỚC 6 -->
      <div class="tl-step">
        <div class="step-num" style="background: #0ea5e9;">6</div>
        <div class="step-h">Giao Tận Căn Hộ Tại Nhật</div>
        <div class="step-loc">📍 Nội Địa Nhật Bản</div>
        <div class="step-desc">
          Bàn giao Yamato Transport (Kuroneko) hoặc Sagawa. Máy quét đọc mã bưu chính 〒 7 số chia về bưu cục. Bưu tá Nhật gọi SĐT nội địa và giao tận số phòng căn hộ (Mansion).
        </div>
        <div class="tag-action"><b>Hoàn Tất 100%:</b>Admin cập nhật "Giao thành công".</div>
      </div>
    </div>
  </body>
  </html>
  `;

  await page.setContent(html3);
  await page.screenshot({ path: path.join(targetDir, '03_Quy_Trinh_Nghiep_Vu_Chi_Tiet_6_Giai_Doan_End_To_End.png') });

  // ==========================================
  // DIAGRAM 4: VÒNG ĐỜI TRẠNG THÁI KANBAN 5 BƯỚC ADMIN
  // ==========================================
  const html4 = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      body { background: #0b1120; color: #f8fafc; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
      .header { text-align: center; margin-bottom: 30px; }
      .tag { display: inline-block; background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4); padding: 6px 16px; border-radius: 999px; font-size: 13px; font-weight: 700; margin-bottom: 10px; }
      h1 { font-size: 26px; font-weight: 800; color: #ffffff; margin-bottom: 8px; }
      p.sub { font-size: 14px; color: #94a3b8; max-width: 900px; }
      
      .kanban-board { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; width: 100%; max-width: 1320px; margin-top: 20px; }
      .col { background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 16px 12px; display: flex; flex-direction: column; }
      .col-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 12px; margin-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.08); }
      .col-title { font-size: 13.5px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
      .col-count { background: rgba(255,255,255,0.1); font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 999px; }
      
      .card { background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
      .card-code { font-family: monospace; font-size: 12px; font-weight: 800; color: #38bdf8; margin-bottom: 6px; }
      .card-name { font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 4px; }
      .card-phone { font-size: 11.5px; color: #94a3b8; margin-bottom: 8px; }
      .card-meta { font-size: 11px; color: #cbd5e1; background: rgba(255,255,255,0.04); padding: 8px; border-radius: 8px; margin-bottom: 10px; line-height: 1.4; }
      .card-btn { width: 100%; border: none; padding: 7px 10px; border-radius: 8px; font-size: 11.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
      .btn-call { background: #f59e0b; color: #0f172a; }
      .btn-check { background: #3b82f6; color: #ffffff; }
      .btn-weigh { background: #8b5cf6; color: #ffffff; }
      .btn-fly { background: #ef4444; color: #ffffff; }
      .btn-done { background: #10b981; color: #ffffff; }
    </style>
  </head>
  <body>
    <div class="header">
      <span class="tag">Giao Diện Quản Trị Tác Nghiệp (Admin Kanban Dashboard)</span>
      <h1>BÀN ĐIỀU PHỐI VẬN ĐƠN VN ➔ JP VỚI 5 CỘT TRẠNG THÁI CHUYÊN BIỆT</h1>
      <p class="sub">Nút "✈️ Vận Đơn VN ➔ JP" nằm kế bên nút "Tác Nghiệp" giúp nhân viên xử lý tức thì, không bỏ sót bất kỳ cuộc gọi nào.</p>
    </div>

    <div class="kanban-board">
      <!-- CỘT 1 -->
      <div class="col" style="border-top: 3px solid #f59e0b;">
        <div class="col-header">
          <div class="col-title" style="color: #fbbf24;">🟡 1. Mới Tiếp Nhận</div>
          <span class="col-count">3 đơn</span>
        </div>
        <div class="card">
          <div class="card-code">#VNJP-2026-8891</div>
          <div class="card-name">Trần Hoàng Long</div>
          <div class="card-phone">📞 0912 345 678 (Cầu Giấy, HN)</div>
          <div class="card-meta">
            📦 Bánh kẹo & Quần áo (2.5 kg)<br>
            🇯🇵 Đến: Tokyo (〒 160-0022)<br>
            ⚠️ <i>Chưa liên hệ xác nhận</i>
          </div>
          <button class="card-btn btn-call">📞 Gọi Điện & Duyệt Đơn</button>
        </div>
      </div>

      <!-- CỘT 2 -->
      <div class="col" style="border-top: 3px solid #3b82f6;">
        <div class="col-header">
          <div class="col-title" style="color: #60a5fa;">🔵 2. Đã Chốt & Chờ Lấy</div>
          <span class="col-count">2 đơn</span>
        </div>
        <div class="card">
          <div class="card-code">#VNJP-2026-8840</div>
          <div class="card-name">Nguyễn Thị Mai</div>
          <div class="card-phone">📞 0988 776 655 (Q.1, TP.HCM)</div>
          <div class="card-meta">
            📦 Cà phê & Trà túi lọc (3.0 kg)<br>
            ✅ Đã gọi xác nhận không có thịt<br>
            🛵 Tài xế hẹn qua lấy 14h hôm nay
          </div>
          <button class="card-btn btn-check">🛵 Đã Lấy Về Kho VN</button>
        </div>
      </div>

      <!-- CỘT 3 -->
      <div class="col" style="border-top: 3px solid #8b5cf6;">
        <div class="col-header">
          <div class="col-title" style="color: #c084fc;">🟣 3. Kho VN Cân Đo IATA</div>
          <span class="col-count">4 đơn</span>
        </div>
        <div class="card">
          <div class="card-code">#VNJP-2026-8792</div>
          <div class="card-name">Lê Văn Hùng</div>
          <div class="card-phone">📞 0903 112 233 (Đà Nẵng)</div>
          <div class="card-meta">
            📏 Thùng: 40×30×20 cm (4.8 kg)<br>
            ⚖️ Cân thực tế: 3.2 kg ➔ Tính 4.8kg<br>
            🏷️ Đã dán tem AWB VN-JP
          </div>
          <button class="card-btn btn-weigh">✈️ Xuất Kho Ra Sân Bay</button>
        </div>
      </div>

      <!-- CỘT 4 -->
      <div class="col" style="border-top: 3px solid #ef4444;">
        <div class="col-header">
          <div class="col-title" style="color: #f87171;">✈️ 4. Đang Bay Sang Nhật</div>
          <span class="col-count">2 đơn</span>
        </div>
        <div class="card">
          <div class="card-code">#VNJP-2026-8715</div>
          <div class="card-name">Phạm Quỳnh Nga</div>
          <div class="card-phone">✈️ Chuyến: VN310 (HAN ➔ NRT)</div>
          <div class="card-meta">
            🏢 Kho đến: Tokyo Haneda Airport<br>
            📦 Đang qua máy soi kiểm dịch MAFF<br>
            🚚 Chờ bàn giao Yamato Kuroneko
          </div>
          <button class="card-btn btn-fly">🚚 Đã Bàn Giao Yamato</button>
        </div>
      </div>

      <!-- CỘT 5 -->
      <div class="col" style="border-top: 3px solid #10b981;">
        <div class="col-header">
          <div class="col-title" style="color: #34d399;">🟢 5. Giao Thành Công</div>
          <span class="col-count">18 đơn</span>
        </div>
        <div class="card">
          <div class="card-code">#VNJP-2026-8650</div>
          <div class="card-name">Vũ Minh Đức</div>
          <div class="card-phone">🇯🇵 Nhận: Osaka (〒 530-0001)</div>
          <div class="card-meta">
            📦 Bánh đậu xanh & Áo len (2 kg)<br>
            🕒 Giao lúc 10:45 sáng nay<br>
            ✍️ Đã ký nhận với shipper Yamato
          </div>
          <button class="card-btn btn-done">✅ Đã Hoàn Tất</button>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;

  await page.setContent(html4);
  await page.screenshot({ path: path.join(targetDir, '04_Vong_Doi_Trang_Thai_Kanban_5_Buoc_Admin.png') });

  // ==========================================
  // DIAGRAM 5: CƠ CHẾ KIỂM SOÁT HÀNG CẤM MAFF & TÍNH CƯỚC IATA
  // ==========================================
  const html5 = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      body { background: #090d16; color: #f8fafc; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
      .header { text-align: center; margin-bottom: 25px; }
      .tag { display: inline-block; background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); padding: 6px 16px; border-radius: 999px; font-size: 13px; font-weight: 700; margin-bottom: 10px; }
      h1 { font-size: 26px; font-weight: 800; color: #ffffff; margin-bottom: 8px; }
      p.sub { font-size: 14px; color: #94a3b8; max-width: 900px; }
      
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; width: 100%; max-width: 1300px; margin-top: 20px; }
      .card-box { background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 25px; }
      .card-box h2 { font-size: 18px; font-weight: 800; margin-bottom: 14px; display: flex; align-items: center; gap: 10px; }
      
      .rule-item { background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
      .rule-item h3 { font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
      .rule-item p { font-size: 12px; color: #94a3b8; line-height: 1.5; }
      
      .formula-box { background: #0f172a; border: 2px dashed #3b82f6; border-radius: 14px; padding: 18px; text-align: center; margin-bottom: 16px; }
      .formula-title { font-size: 13px; font-weight: 700; color: #93c5fd; margin-bottom: 6px; }
      .formula-math { font-size: 18px; font-weight: 900; color: #ffffff; font-family: monospace; }
      
      .example-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
      .example-table th, .example-table td { padding: 10px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.08); }
      .example-table th { background: rgba(255,255,255,0.05); color: #cbd5e1; font-weight: 700; }
      .example-table td { color: #94a3b8; }
      .example-table td.highlight { color: #34d399; font-weight: 800; }
    </style>
  </head>
  <body>
    <div class="header">
      <span class="tag">Tiêu Chuẩn Pháp Lý & Kỹ Thuật Hàng Không (Compliance & Billing)</span>
      <h1>CƠ CHẾ KIỂM SOÁT HÀNG CẤM MAFF & CÔNG THỨC TÍNH CƯỚC THỂ TÍCH IATA</h1>
      <p class="sub">Hai yếu tố quyết định sự sống còn của doanh nghiệp khi vận chuyển đường bay từ Việt Nam sang Nhật Bản.</p>
    </div>

    <div class="grid">
      <!-- BÊN TRÁI: KIỂM SOÁT HÀNG CẤM MAFF -->
      <div class="card-box" style="border-top: 4px solid #ef4444;">
        <h2 style="color: #f87171;">🚫 3 LỚP PHÒNG NGỰ HÀNG CẤM KIỂM DỊCH MAFF</h2>
        <div class="rule-item">
          <h3><span style="color: #f59e0b;">Lớp 1:</span> Cam kết điện tử trên Website</h3>
          <p>Bắt buộc khách hàng đánh dấu checkbox cam kết không gửi các sản phẩm thịt (thịt tươi, khô bò, khô gà, chà bông, giò lụa, nem chua, lạp xưởng), hoa quả tươi theo luật kiểm dịch Nhật Bản.</p>
        </div>
        <div class="rule-item">
          <h3><span style="color: #3b82f6;">Lớp 2:</span> Nhân viên thẩm định qua điện thoại</h3>
          <p>Khi đơn xuất hiện ở trạng thái "Mới tiếp nhận", nhân viên gọi điện hỏi chi tiết từng món quà. Nếu phát hiện khách có ý định gửi đồ cấm ➔ Tư vấn loại bỏ ngay từ đầu.</p>
        </div>
        <div class="rule-item">
          <h3><span style="color: #10b981;">Lớp 3:</span> Mở thùng kiểm tra tại Kho Hàng Không VN</h3>
          <p>Trước khi bọc màng co và dán tem Air Waybill (AWB), nhân viên kho mở thùng kiểm tra thực tế 100%. Nếu phát hiện hàng gian dối ➔ Trả lại người gửi, kiên quyết không cho lên máy bay.</p>
        </div>
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 10px; padding: 12px; font-size: 11.5px; color: #fca5a5; line-height: 1.4;">
          ⚠️ <b>Chế tài xử phạt của Nhật Bản:</b> Vi phạm kiểm dịch MAFF có thể bị phạt tù đến <b>3 năm</b> hoặc phạt tiền đến <b>3 triệu Yên (~500 triệu VNĐ)</b> và tiêu hủy hàng tại chỗ.
        </div>
      </div>

      <!-- BÊN PHẢI: TÍNH CƯỚC THỂ TÍCH IATA -->
      <div class="card-box" style="border-top: 4px solid #3b82f6;">
        <h2 style="color: #60a5fa;">📐 QUY TẮC TÍNH CƯỚC THỂ TÍCH HÀNG KHÔNG (IATA)</h2>
        <div class="formula-box">
          <div class="formula-title">Công thức Trọng lượng Thể tích Hàng không (Volumetric Weight):</div>
          <div class="formula-math">Cân nặng thể tích (kg) = (Dài × Rộng × Cao cm) / 5000</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 6px;">Cước phí = Đơn giá/kg × Max(Cân nặng thực tế, Cân nặng thể tích)</div>
        </div>

        <table class="example-table">
          <thead>
            <tr>
              <th>Loại Hàng Hóa</th>
              <th>Cân Thực</th>
              <th>Kích Thước (cm)</th>
              <th>Cân Thể Tích</th>
              <th>Cân Tính Cước</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>📦 Bánh pía / Cà phê (Nặng)</td>
              <td>4.0 kg</td>
              <td>30 × 20 × 15</td>
              <td>1.8 kg</td>
              <td class="highlight">4.0 kg (Cân thực)</td>
            </tr>
            <tr>
              <td>🧸 Quần áo phao / Gấu bông (Nhẹ)</td>
              <td>2.0 kg</td>
              <td>50 × 40 × 30</td>
              <td>12.0 kg</td>
              <td class="highlight">12.0 kg (Thể tích)</td>
            </tr>
            <tr>
              <td>📄 Hồ sơ du học / Bằng cấp</td>
              <td>0.5 kg</td>
              <td>35 × 25 × 5</td>
              <td>0.87 kg</td>
              <td class="highlight">1.0 kg (Làm tròn)</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 14px; font-size: 11.5px; color: #94a3b8; line-height: 1.4;">
          💡 <b>Giải pháp tối ưu:</b> ChillBanana hỗ trợ khách hàng hút chân không quần áo, gấu bông và cắt thùng carton vừa vặn để giảm tối đa kích thước thể tích, tiết kiệm tới 40% tiền cước cho khách.
        </div>
      </div>
    </div>
  </body>
  </html>
  `;

  await page.setContent(html5);
  await page.screenshot({ path: path.join(targetDir, '05_Co_Che_Kiem_Soat_Hang_Cam_MAFF_Va_Tinh_Cuoc_IATA.png') });

  await browser.close();
  console.log('ALL 5 DIAGRAMS GENERATED SUCCESSFULLY in:', targetDir);
}

renderDiagrams().catch(err => {
  console.error('FAILED TO RENDER DIAGRAMS:', err);
  process.exit(1);
});
