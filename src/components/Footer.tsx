import React from "react";
import Link from "next/link";
import { ShieldCheck, MapPin, Phone, Mail, Clock } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-navy-900 text-white pt-14 pb-8 border-t border-slate-800">
      <div className="max-w-[1600px] w-[95%] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-white/10 text-xs text-slate-300">
          {/* Col 1: Brand & Intro */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-2xl bg-banana-500 flex items-center justify-center text-xl shadow">
                🍌
              </div>
              <span className="text-xl font-bold font-serif text-white">
                Chill<span className="text-banana-400">Banana</span>
              </span>
            </div>
            <p className="leading-relaxed text-slate-300">
              Nền tảng thương mại điện tử mua hộ và ủy thác order hàng nội địa Nhật Bản tích hợp trợ lý ChillBanana AI tư vấn 24/7, bóc tách link tự động và thanh toán VietQR Napas 247.
            </p>
            <div className="pt-1">
              <span className="inline-block bg-white/10 text-banana-300 text-[11px] px-3 py-1 rounded-full font-bold">
                🍌 Mua Hàng Nhật Thư Thái Cùng ChillBanana
              </span>
            </div>
          </div>

          {/* Col 2: Hệ Thống Kho Hàng 2 Đầu */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider font-serif">
              Hệ Thống Kho Hàng Nhật – Việt
            </h4>
            <div className="space-y-2.5">
              <div className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 text-banana-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">Kho Tokyo (Nhật Bản):</p>
                  <p className="text-slate-400">Edogawa-ku, Tokyo 134-0088, Japan</p>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">Kho Hà Nội (Việt Nam):</p>
                  <p className="text-slate-400">Tòa nhà CMC, Phố Duy Tân, Cầu Giấy, Hà Nội</p>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">Kho TP.HCM (Việt Nam):</p>
                  <p className="text-slate-400">Đường Trường Sơn, P.2, Q. Tân Bình, TP.HCM</p>
                </div>
              </div>
            </div>
          </div>

          {/* Col 3: Liên Kết Nhanh */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider font-serif">
              Dịch Vụ &amp; Tra Cứu
            </h4>
            <ul className="space-y-2 text-slate-300">
              <li>
                <Link href="/#calculator" className="hover:text-banana-400 transition-colors">
                  ➔ Công cụ bóc tách link &amp; tính giá tự động
                </Link>
              </li>
              <li>
                <Link href="/tracking" className="hover:text-banana-400 transition-colors">
                  ➔ Tra cứu hành trình đơn hàng 7 bước
                </Link>
              </li>
              <li>
                <Link href="/#categories" className="hover:text-banana-400 transition-colors">
                  ➔ 4 Danh mục hàng Nhật nội địa hot
                </Link>
              </li>
              <li>
                <Link href="/#news" className="hover:text-banana-400 transition-colors">
                  ➔ Cẩm nang săn sale &amp; Lịch bay hỏa tốc
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-banana-400 transition-colors">
                  ➔ Bảng Quản Trị Đơn Hàng (Admin)
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Hỗ Trợ Khách Hàng */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider font-serif">
              Tổng Đài Hỗ Trợ 24/7
            </h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-banana-400" />
                <span>Hotline: <strong className="text-white text-sm">1900 6868</strong> (Miễn phí)</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-banana-400" />
                <span>Email: support@chillbanana.vn</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-banana-400" />
                <span>Giờ làm việc: 08:00 - 22:00 hàng ngày</span>
              </div>
            </div>

            <div className="pt-2">
              <div className="p-3 bg-white/5 rounded-2xl border border-white/10 flex items-center space-x-2.5">
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                <span className="text-[11px] text-slate-300">
                  Bảo hiểm 100% đền bù nếu kiện hàng bị thất lạc hoặc hư hỏng trong quá trình bay
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="pt-6 flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-400 gap-2">
          <p>© 2026 ChillBanana.vn — Nền tảng Mua Hộ Hàng Nhật Bản Uy Tín.</p>
          <p className="flex items-center space-x-2">
            <span>Google Gemini AI Powered</span>
            <span>•</span>
            <span>VietQR Napas 247 Integration</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
