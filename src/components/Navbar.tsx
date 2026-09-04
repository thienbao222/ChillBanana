"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  PackageSearch, 
  Sparkles, 
  TrendingUp,
  LayoutDashboard,
  SendHorizontal,
  Menu,
  X
} from "lucide-react";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/data";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      {/* Top Banner Tỷ Giá & Hotline */}
      <div className="bg-navy-900 text-white text-xs py-1.5 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center text-banana-400 font-medium">
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              Tỷ giá hôm nay: 1 JPY = {DEFAULT_EXCHANGE_RATE} VND
            </span>
            <span className="hidden md:inline text-slate-500">|</span>
            <span className="hidden md:inline text-slate-300">
              ✈ Chuyến bay cố định Narita ➔ Hà Nội & TP.HCM (3-5 ngày)
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-slate-300">Hotline: <strong className="text-banana-400">1900 6868</strong> (8h-22h)</span>
            <Link 
              href="/admin" 
              className="inline-flex items-center text-banana-300 hover:text-white transition-colors"
            >
              <LayoutDashboard className="w-3 h-3 mr-1" />
              Admin Portal
            </Link>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo Brand: ChillBanana */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-banana-400 to-banana-600 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
              <span className="text-2xl">🍌</span>
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-2xl font-bold tracking-tight text-navy-900 font-serif">
                  Chill<span className="text-banana-500">Banana</span>
                </span>
                <span className="text-[10px] bg-banana-100 text-banana-800 font-bold px-2 py-0.5 rounded-full border border-banana-200">
                  JP ⇄ VN
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Mua hàng Nhật chuẩn – Thư thái & Thảnh thơi
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            <Link
              href="/#calculator"
              className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-banana-600 hover:bg-banana-50 rounded-xl transition-colors flex items-center"
            >
              <SendHorizontal className="w-4 h-4 mr-1.5 text-banana-600" />
              Dán Link Tính Giá
            </Link>
            <Link
              href="/#categories"
              className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-banana-600 hover:bg-banana-50 rounded-xl transition-colors"
            >
              4 Danh Mục Hot
            </Link>
            <Link
              href="/tracking"
              className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-banana-600 hover:bg-banana-50 rounded-xl transition-colors flex items-center"
            >
              <PackageSearch className="w-4 h-4 mr-1.5 text-blue-600" />
              Tra Cứu Đơn Hàng
            </Link>
            <Link
              href="/#news"
              className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-banana-600 hover:bg-banana-50 rounded-xl transition-colors"
            >
              Cẩm Nang & Lịch Bay
            </Link>
          </nav>

          {/* Action CTA: Gemini AI & Order Now */}
          <div className="hidden lg:flex items-center space-x-3">
            <button
              onClick={() => {
                const chatToggle = document.getElementById("ai-chat-toggle-btn");
                if (chatToggle) chatToggle.click();
              }}
              className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-banana-50 to-amber-100 text-banana-800 border border-banana-300/80 hover:shadow transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-banana-600 animate-pulse" />
              Gemini AI Tư Vấn 24/7
            </button>
            <Link
              href="/#calculator"
              className="inline-flex items-center px-5 py-2.5 rounded-xl text-xs font-bold bg-navy-900 text-white hover:bg-slate-800 shadow-md transition-all"
            >
              Đặt Mua Hộ Ngay
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center space-x-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-600 hover:text-banana-600 hover:bg-slate-100"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-4 space-y-2 shadow-lg">
          <Link
            href="/#calculator"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center px-3 py-2.5 rounded-xl text-slate-700 hover:bg-banana-50 hover:text-banana-600"
          >
            <SendHorizontal className="w-4 h-4 mr-2 text-banana-600" />
            Dán Link Tính Giá Mua Hộ
          </Link>
          <Link
            href="/#categories"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center px-3 py-2.5 rounded-xl text-slate-700 hover:bg-banana-50 hover:text-banana-600"
          >
            4 Danh Mục Chủ Lực
          </Link>
          <Link
            href="/tracking"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center px-3 py-2.5 rounded-xl text-slate-700 hover:bg-banana-50 hover:text-banana-600"
          >
            <PackageSearch className="w-4 h-4 mr-2 text-blue-600" />
            Tra Cứu Đơn Hàng (7 Bước)
          </Link>
          <Link
            href="/#news"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center px-3 py-2.5 rounded-xl text-slate-700 hover:bg-banana-50 hover:text-banana-600"
          >
            Cẩm Nang Săn Deal & Lịch Bay
          </Link>
          <Link
            href="/admin"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center px-3 py-2.5 rounded-xl text-navy-900 bg-banana-50 font-bold"
          >
            <LayoutDashboard className="w-4 h-4 mr-2" />
            Trang Quản Trị Đơn Hàng (Admin)
          </Link>
        </div>
      )}
    </header>
  );
}
