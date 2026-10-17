"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, ShieldCheck, CheckCircle2, ShoppingBag, Bot, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { useCart } from "@/context/CartContext";

export default function HeroSection() {
  const { pricingConfig } = useCart();
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 100, damping: 15 },
    },
  };

  return (
    <section className="relative overflow-hidden pt-8 pb-16 bg-gradient-to-b from-banana-50/60 via-white to-[#FAF8F5]">
      {/* Visual Accent Glows */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-banana-200/40 blur-3xl pointer-events-none" 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
        className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 rounded-full bg-amber-100/40 blur-3xl pointer-events-none" 
      />

      <div className="max-w-[1600px] w-[95%] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Hero Content (7 cols) */}
          <motion.div 
            className="lg:col-span-7 space-y-6 text-center lg:text-left"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Tagline Badge */}
            <motion.div variants={itemVariants} className="inline-flex items-center space-x-2 bg-gradient-to-r from-banana-100 to-amber-100 border border-banana-300/80 px-3.5 py-1.5 rounded-full text-xs font-bold text-banana-900 shadow-sm">
              <span className="text-base">🍌</span>
              <span>Mua Hàng Nhật Chuẩn – Thư Thái Cùng ChillBanana</span>
              <span className="text-base">🇯🇵</span>
            </motion.div>

            {/* Main Headline */}
            <motion.h1 variants={itemVariants} className="text-3xl sm:text-4xl lg:text-5xl font-serif font-extrabold text-navy-900 tracking-tight leading-[1.2]">
              Ủy Thác Mua Hộ Hàng Nhật <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-banana-600 via-amber-500 to-banana-500 bg-clip-text text-transparent">
                Tự Động Bóc Tách Link &amp; ChillBanana AI
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p variants={itemVariants} className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              Dán link từ <strong>Amazon JP, Mercari, Rakuten, Yahoo Auctions</strong> — hệ thống hỗ trợ ước tính chi phí theo tỷ giá hiện hành, tích hợp <strong>Trợ lý ChillBanana AI Agent</strong> tư vấn và giải pháp <strong>Gộp đơn tiết kiệm {pricingConfig.groupBuyShippingDiscountPercent}% cước</strong>.
            </motion.p>

            {/* Key Value Badges */}
            <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-1 text-xs text-slate-700 font-medium">
              <span className="inline-flex items-center bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm hover:border-banana-300 transition-colors cursor-default">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1.5" />
                Cam kết 100% chính hãng nội địa Nhật
              </span>
              <span className="inline-flex items-center bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm hover:border-banana-300 transition-colors cursor-default">
                <Activity className="w-3.5 h-3.5 text-banana-600 mr-1.5" />
                Tỷ giá cập nhật liên tục theo thời gian thực
              </span>
              <span className="inline-flex items-center bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm hover:border-banana-300 transition-colors cursor-default">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 mr-1.5" />
                Bảo hiểm đền bù 100% khi mất mát, bể vỡ
              </span>
            </motion.div>

            {/* Action Buttons */}
            <motion.div variants={itemVariants} className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Link
                href="#calculator"
                className="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-banana-500 to-amber-600 hover:from-banana-600 hover:to-amber-700 text-navy-950 font-bold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2 group"
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
                <span>Trò Chuyện Cùng ChillBanana AI</span>
              </button>
            </motion.div>
          </motion.div>

          {/* Right Visual Card (5 cols) */}
          <motion.div 
            className="lg:col-span-5"
            initial={{ opacity: 0, x: 30, rotate: 2 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.3 }}
          >
            <div className="relative mx-auto max-w-md bg-white p-6 rounded-3xl border border-banana-200 shadow-2xl space-y-4 hover:shadow-banana-500/10 transition-shadow duration-500">
              {/* Header Box */}
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-banana-100 flex items-center justify-center text-lg">
                    🍌
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-navy-900">ChillBanana Gemini AI Agent</h4>
                    <p className="text-[10px] text-emerald-600 flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                      Google AI Studio Connected
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-banana-100 text-banana-900 border border-banana-300">
                  Tư vấn chuyên sâu 24/7
                </span>
              </div>

              {/* Chat Simulation Bubble */}
              <div className="space-y-2.5 text-xs">
                <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-sm text-slate-700 shadow-sm">
                  <p className="font-semibold text-slate-900 text-[11px] mb-0.5">Khách hàng hỏi:</p>
                  "Mình muốn mua mô hình Gundam RG RX-78-2 Ver 2.0 trên Amazon Nhật, bên bạn có nhận mua hộ không và bảo quản hộp seal thế nào?"
                </div>

                <div className="bg-gradient-to-br from-banana-50 to-amber-50 p-3.5 rounded-2xl rounded-tr-sm border border-banana-200 text-slate-800 space-y-1.5 shadow-sm">
                  <p className="font-bold text-banana-800 text-[11px] flex items-center">
                    <Sparkles className="w-3 h-3 mr-1 text-banana-600" />
                    ChillBanana Gemini AI:
                  </p>
                  <p className="leading-relaxed">
                    "Dạ chào bạn! ChillBanana chuyên săn deal Gunpla Bandai và Figure chính hãng từ Amazon JP/Surugaya. Mọi kiện hàng đều được đóng gói bọc xốp bóng khí 4 lớp bảo vệ hộp nguyên seal, không móp méo khi vận chuyển. Bạn chỉ cần dán link sản phẩm vào ô tính giá là hệ thống tự động bóc tách giá Yên và tính chi phí trọn gói ngay ạ! 🍌"
                  </p>
                </div>
              </div>

              {/* Bottom Quick Feature Tag */}
              <div className="pt-2 border-t flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center text-banana-700 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Guardrail chuyên sâu mua sắm Nhật – Việt
                </span>
                <span className="text-slate-400">Phản hồi tức thì</span>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
