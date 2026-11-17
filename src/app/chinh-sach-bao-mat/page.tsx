import Link from "next/link";

export const metadata = {
  title: "Chính Sách Bảo Mật Dữ Liệu Cá Nhân | ChillBanana",
  description: "Cam kết bảo vệ dữ liệu cá nhân và quyền riêng tư của khách hàng tại ChillBanana.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
        <div className="inline-block px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold mb-4">
          Bản nháp kỹ thuật (Chờ rà soát pháp lý bởi Luật sư) • Phiên bản 1.0
        </div>

        <h1 className="text-3xl font-extrabold text-stone-900 mb-6">
          Chính Sách Bảo Mật & Bảo Vệ Quyền Riêng Tư
        </h1>

        <p className="text-stone-600 mb-6 leading-relaxed">
          ChillBanana cam kết tôn trọng và bảo vệ tối đa quyền riêng tư cùng dữ liệu cá nhân của mọi khách hàng sử dụng dịch vụ mua hộ hàng Nhật Bản (JP → VN) và ký gửi vận chuyển quốc tế (VN → JP).
        </p>

        <section className="space-y-6 text-stone-700">
          <div>
            <h2 className="text-xl font-bold text-stone-900 mb-2">1. Mục đích thu thập dữ liệu</h2>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Xử lý và hoàn tất đơn hàng mua hộ từ các sàn thương mại điện tử Nhật Bản.</li>
              <li>Thực hiện thủ tục hải quan, khai báo tờ khai bưu chính quốc tế (CN23) và kiểm dịch hàng không.</li>
              <li>Thông báo cập nhật tiến độ vận đơn theo thời gian thực qua Email và Zalo.</li>
              <li>Tất toán công nợ và lưu trữ hóa đơn theo quy định của pháp luật tài chính và thuế.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-stone-900 mb-2">2. Các đối tác và bên thứ ba tiếp nhận dữ liệu kỹ thuật</h2>
            <p className="text-sm mb-2">Để vận hành hệ thống thông suốt, dữ liệu kỹ thuật được lưu trữ và xử lý an toàn tại:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li><strong>Hạ tầng máy chủ:</strong> Vercel Inc. (Edge Network) và Neon Inc. (Serverless PostgreSQL).</li>
              <li><strong>Đối tác vận chuyển & Bưu chính:</strong> Hãng bay Vietnam Airlines/Japan Airlines, bưu chính Yamato Transport, Sagawa Express, Bưu điện Việt Nam.</li>
              <li><strong>Trí tuệ nhân tạo (AI):</strong> Google Cloud (Gemini API) — <em>Mọi dữ liệu gửi sang AI đều được khử trùng và che ẩn toàn bộ số điện thoại, email và số nhà chi tiết (PII Masking).</em></li>
              <li><strong>Cổng thanh toán:</strong> Công ty Cổ phần Giải pháp Thanh toán Việt Nam (VNPAY).</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-stone-900 mb-2">3. Quyền của khách hàng đối với dữ liệu cá nhân</h2>
            <p className="text-sm mb-2">
              Khách hàng có quyền yêu cầu xem, trích xuất hoặc yêu cầu ẩn danh hóa thông tin định danh cá nhân ("Quyền được quên").
            </p>
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-600">
              <strong>Lưu ý bất biến tài chính:</strong> Theo quy định của Luật Kế toán và chế độ chứng từ tài chính, ChillBanana có nghĩa vụ pháp lý phải bảo lưu số tiền giao dịch và mã đơn hàng đã thanh toán. Việc ẩn danh hóa sẽ xóa toàn bộ số điện thoại, địa chỉ và email cá nhân mà không làm sai lệch sổ sách kế toán thuế.
            </div>
          </div>
        </section>

        <div className="border-t border-stone-200 pt-6 mt-8 flex justify-between items-center text-sm">
          <Link href="/" className="text-amber-700 font-semibold hover:underline">
            ← Quay về trang chủ ChillBanana
          </Link>
          <span className="text-stone-400">Hiệu lực từ tháng 11/2026</span>
        </div>
      </div>
    </div>
  );
}

