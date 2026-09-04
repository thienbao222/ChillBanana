"use client";

import React from "react";
import { Sparkles, HeartPulse, Cpu, Gamepad2, ArrowUpRight } from "lucide-react";
import { CATEGORIES } from "@/lib/data";

export default function FeaturedCategories() {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "Sparkles":
        return <Sparkles className="w-6 h-6 text-pink-500" />;
      case "HeartPulse":
        return <HeartPulse className="w-6 h-6 text-emerald-500" />;
      case "Cpu":
        return <Cpu className="w-6 h-6 text-banana-600" />;
      case "Gamepad2":
        return <Gamepad2 className="w-6 h-6 text-purple-500" />;
      default:
        return <Sparkles className="w-6 h-6 text-banana-500" />;
    }
  };

  return (
    <section id="categories" className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-banana-800 bg-banana-100 px-3 py-1 rounded-full uppercase tracking-wider mb-2 border border-banana-200">
            <span className="w-2 h-2 rounded-full bg-banana-500 animate-ping" />
            <span>4 Danh Mục Chủ Lực Tuyển Chọn</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-navy-900">
            Hàng Nội Địa Nhật Đang Có Sẵn Slot Gom
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Tập trung các nhóm mặt hàng được ưa chuộng nhất, đảm bảo 100% nguồn gốc rõ ràng từ Tokyo & Osaka.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {CATEGORIES.map((cat) => (
          <div
            key={cat.id}
            className="group bg-white p-6 rounded-3xl border border-slate-200 hover:border-banana-400 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between"
          >
            {/* Badge */}
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                {getIcon(cat.icon)}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-banana-100 text-banana-900 border border-banana-200">
                {cat.badge}
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-navy-900 group-hover:text-banana-600 transition-colors">
                {cat.name}
              </h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                {cat.description}
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-banana-600">
              <span>Xem sản phẩm hot</span>
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
