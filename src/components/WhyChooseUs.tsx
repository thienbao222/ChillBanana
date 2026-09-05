import React from "react";
import { ShieldCheck, Plane, Bot, RefreshCw, BadgePercent } from "lucide-react";

export default function WhyChooseUs() {
  const points = [
    {
      icon: <ShieldCheck className="w-7 h-7 text-banana-600" />,
      title: "100% Nội Địa Nhật Bản",
      desc: "Tự động phân tích link và mua trực tiếp từ Amazon JP, Mercari, Rakuten, Yahoo. Có bill mua hàng rõ ràng.",
    },
    {
      icon: <Plane className="w-7 h-7 text-blue-600" />,
      title: "Bay Hỏa Tốc 3-5 Ngày",
      desc: "Tuyến bay cố định 3 chuyến/tuần từ Narita & Haneda về Nội Bài & Tân Sơn Nhất. Tiết kiệm thời gian chờ đợi.",
    },
    {
      icon: <Bot className="w-7 h-7 text-purple-600" />,
      title: "Google Gemini AI Tư Vấn 24/7",
      desc: "Trợ lý ảo am hiểu hàng Nhật, hỗ trợ 2 phong cách (Omotenashi & Thân thiện), tư vấn size, điện 100V và hạn sử dụng.",
    },
    {
      icon: <BadgePercent className="w-7 h-7 text-emerald-600" />,
      title: "Gộp Đơn Giảm 25% Cước Bay",
      desc: "Giải pháp ghép kiện bay chung thông minh dành cho các món hàng nhỏ nhẹ dưới 0.5kg giúp tiết kiệm chi phí tối đa.",
    },
  ];

  return (
    <section className="py-14 bg-white border-y border-slate-200">
      <div className="w-full px-4 sm:px-8 lg:px-12">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-bold text-banana-800 bg-banana-100 px-3 py-1 rounded-full uppercase tracking-wider border border-banana-200">
            Giá Trị Khác Biệt
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-navy-900 mt-2">
            Vì Sao Khách Hàng Chọn ChillBanana?
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {points.map((p, idx) => (
            <div
              key={idx}
              className="p-6 rounded-3xl bg-slate-50 border border-slate-100 hover:bg-banana-50/50 hover:border-banana-200 transition-all space-y-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-slate-100">
                {p.icon}
              </div>
              <h3 className="text-base font-bold text-navy-900">{p.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
