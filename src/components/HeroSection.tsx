"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, ShieldCheck, CheckCircle2, ShoppingBag, Zap, Bot } from "lucide-react";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-8 pb-16 bg-gradient-to-b from-banana-50/60 via-white to-[#FAF8F5]">
      {/* Visual Accent Glows */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-banana-200/40 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 rounded-full bg-amber-100/40 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Hero Content (7 cols) */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            {/* Tagline Badge */}
            <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-banana-100 to-amber-100 border border-banana-300/80 px-3.5 py-1.5 rounded-full text-xs font-bold text-banana-900 shadow-sm">
              <span className="text-base">🍌</span>
              <span>Mua Hàng Nhật Chuẩn – Thư Thái Cùng ChillBanana</span>
              <span className="text-base">🇯🇵</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-extrabold text-navy-900 tracking-tight leading-[1.2]">
              Ủy Thác Mua Hộ Hàng Nhật <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-banana-600 via-amber-500 to-banana-500 bg-clip-text text-transparent">
                Tự Động Bóc Tách Link &amp; AI Tư Vấn
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              Dán link từ <strong>Amazon JP, Mercari, Rakuten, Yahoo Auctions</strong> — Hệ thống tự động lấy giá Yên gốc, tính trọn gói minh bạch theo tỷ giá ngày, tích hợp <strong>Trợ lý Google Gemini AI</strong> tư vấn chuyên sâu 24/7 và giải pháp <strong>Gộp đơn giảm 25% cước bay</strong>.
            </p>

            {/* Key Value Badges */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-1 text-xs text-slate-700 font-medium">
              <span className="inline-flex items-center bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1.5" />
                Bay thẳng Narita ✈ VN chỉ 3-5 ngày
              </span>
              <span className="inline-flex items-center bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1.5" />
                Thanh toán VietQR chuẩn Napas 247
              </span>
              <span className="inline-flex items-center bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1.5" />
                Google Gemini AI kiểm duyệt chặt chẽ
              </span>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Link
                href="#calculator"
                className="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-banana-500 to-amber-600 hover:from-banana-600 hover:to-amber-700 text-white font-bold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2 group"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Dán Link Tính Giá Tự Động</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>

              <button
                onClick={() => {
                  const chatToggle = document.getElementById("ai-chat-toggle-btn");
                  if (chatToggle) chatToggle.click();
                }}
                className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-slate-50 text-navy-900 border border-slate-200 font-bold text-sm rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center space-x-2"
              >
                <Bot className="w-4 h-4 text-banana-600" />
                <span>Trò Chuyện Cùng Gemini AI</span>
              </button>
            </div>
          </div>

          {/* Right Visual Card (5 cols) */}
          <div className="lg:col-span-5">
            <div className="relative mx-auto max-w-md bg-white p-6 rounded-3xl border border-banana-200 shadow-2xl space-y-4">
              {/* Header Box */}
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-banana-100 flex items-center justify-center text-lg">
                    🍌
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-navy-900">ChillBanana Gemini AI</h4>
                    <p className="text-[10px] text-emerald-600 flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                      Google AI Studio Connected
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-banana-100 text-banana-900 border border-banana-300">
                  Phạm vi chuyên sâu Nhật – Việt
                </span>
              </div>

              {/* Chat Simulation Bubble */}
              <div className="space-y-2.5 text-xs">
                <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-sm text-slate-700">
                  <p className="font-semibold text-slate-900 text-[11px] mb-0.5">Khách hàng hỏi:</p>
                  "Mình muốn mua nồi cơm điện Zojirushi trên Amazon Nhật, về Việt Nam cắm điện thế nào và có được bảo hiểm không?"
                </div>

                <div className="bg-gradient-to-br from-banana-50 to-amber-50 p-3.5 rounded-2xl rounded-tr-sm border border-banana-200 text-slate-800 space-y-1.5">
                  <p className="font-bold text-banana-800 text-[11px] flex items-center">
                    <Sparkles className="w-3 h-3 mr-1 text-banana-600" />
                    ChillBanana AI (Omotenashi Mode):
                  </p>
                  <p className="leading-relaxed">
                    "Kính chào Quý khách! Nồi cơm điện nội địa Nhật sử dụng nguồn điện <strong>100V</strong>. Khi dùng tại Việt Nam, Quý khách cần cắm qua <strong>bộ biến áp đổi nguồn (Lioa công suất 1500W - 2000W)</strong> để đảm bảo an toàn tuyệt đối ạ. Mọi đơn hàng tại ChillBanana đều được <strong>bảo hiểm đền bù 100%</strong> nếu bị va đập, bể vỡ trong quá trình bay hỏa tốc 3-5 ngày ạ! 🍌"
                  </p>
                </div>
              </div>

              {/* Bottom Quick Feature Tag */}
              <div className="pt-2 border-t flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center text-banana-700 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Guardrail chặn 100% câu hỏi ngoài luồng
                </span>
                <span className="text-slate-400">Phản hồi &lt; 0.8s</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
