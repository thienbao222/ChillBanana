"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  PackageSearch, 
  Sparkles, 
  LayoutDashboard, 
  SendHorizontal, 
  Menu, 
  X,
  ShieldCheck,
  ShoppingCart,
  User,
  LogOut,
  ChevronDown
} from "lucide-react";
import LiveRateWidget from "./LiveRateWidget";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { WebsitePreferencesTrigger } from "@/components/WebsitePreferencesPanel";
import { useWebsiteText } from "@/context/WebsitePreferencesContext";

export default function Navbar() {
  const pathname = usePathname();
  const isClassicRoute = pathname === "/classic";
  const calculatorHref = isClassicRoute ? "/classic#calculator" : "/#quote";
  const categoriesHref = isClassicRoute ? "/classic#categories" : "/#hot";
  const newsHref = isClassicRoute ? "/classic#news" : "/#news";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const { totalItems, openCart } = useCart();
  const { customer, openAuthModal, logout } = useAuth();
  const t = useWebsiteText();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      {/* Top Banner: Tỷ Giá Live & Hotline */}
      <div className="bg-navy-900 text-white text-xs py-1.5 px-4">
        <div className="max-w-[1600px] w-[95%] mx-auto flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center space-x-3">
            {/* Live Exchange Rate Widget Compact */}
            <LiveRateWidget compact={true} />
            <span className="hidden md:inline text-slate-500">|</span>
            <span className="hidden md:inline text-slate-300 flex items-center">
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-400" />
              {t("Bảo hiểm hàng hóa 100% – Cam kết nội địa Nhật chính hãng")}
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-slate-300">
              Hotline: <strong className="text-banana-400">1900 6868</strong> (8h-22h)
            </span>
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-indigo-300/30 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-indigo-100 transition-colors hover:bg-white/10"
            >
              <Sparkles className="h-3 w-3 text-banana-300" />
              {t("Giao diện NeoDay")}
            </Link>
            <Link 
              href="/admin/login" 
              className="inline-flex items-center text-banana-300 hover:text-white transition-colors"
            >
              <LayoutDashboard className="w-3 h-3 mr-1" />
              {t("Admin Portal")}
            </Link>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-[1600px] w-[95%] mx-auto">
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
                {t("Mua hàng Nhật chuẩn – Thư thái & Thảnh thơi")}
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            <Link
              href={calculatorHref}
              className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-banana-600 hover:bg-banana-50 rounded-xl transition-colors flex items-center"
            >
              <SendHorizontal className="w-4 h-4 mr-1.5 text-banana-600" />
              {t("Dán Link Tính Giá")}
            </Link>
            <Link
              href={categoriesHref}
              className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-banana-600 hover:bg-banana-50 rounded-xl transition-colors"
            >
              {t("4 Danh Mục Hot")}
            </Link>
            <Link
              href="/tracking"
              className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-banana-600 hover:bg-banana-50 rounded-xl transition-colors flex items-center"
            >
              <PackageSearch className="w-4 h-4 mr-1.5 text-blue-600" />
              {t("Tra Cứu Đơn Hàng")}
            </Link>
            <Link
              href={newsHref}
              className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-banana-600 hover:bg-banana-50 rounded-xl transition-colors"
            >
              {t("Cẩm Nang Hàng Nhật")}
            </Link>
          </nav>

          <div className="hidden md:flex lg:hidden">
            <WebsitePreferencesTrigger />
          </div>

          {/* Action CTA: Cart, Customer Auth, AI & Order Now */}
          <div className="hidden lg:flex items-center space-x-3">
            {/* Shopping Cart Button */}
            <button
              onClick={openCart}
              className="relative p-2.5 rounded-xl text-slate-700 hover:text-banana-600 hover:bg-banana-50 transition-all flex items-center gap-1.5 border border-slate-200"
              title="Mở giỏ hàng"
            >
              <ShoppingCart className="w-4 h-4 text-navy-900" />
              <span className="text-xs font-bold hidden xl:inline">{t("Giỏ hàng")}</span>
              {totalItems > 0 && (
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[11px] font-extrabold flex items-center justify-center animate-in zoom-in-75">
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              )}
            </button>

            {/* Customer Auth Button or Dropdown */}
            {customer ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="inline-flex items-center px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-navy-900 border border-slate-200 hover:bg-slate-200/80 transition-all gap-1.5"
                >
                  <div className="w-5 h-5 rounded-full bg-banana-500 text-navy-950 flex items-center justify-center font-bold text-[10px]">
                    {customer.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="max-w-[100px] truncate">{customer.name}</span>
                  <ChevronDown className="w-3 h-3 text-slate-500" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
                    <div className="px-3 py-1.5 border-b border-slate-100">
                      <p className="text-xs font-bold text-navy-900 truncate">{customer.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{customer.email}</p>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center px-3 py-2 text-xs text-slate-700 hover:bg-banana-50 hover:text-banana-700"
                    >
                      <User className="w-3.5 h-3.5 mr-2 text-blue-600" />
                      Hồ Sơ Của Tôi
                    </Link>
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        openCart();
                      }}
                      className="w-full text-left flex items-center px-3 py-2 text-xs text-slate-700 hover:bg-banana-50 hover:text-banana-700"
                    >
                      <ShoppingCart className="w-3.5 h-3.5 mr-2 text-banana-600" />
                      Giỏ Hàng ({totalItems})
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        logout();
                      }}
                      className="w-full text-left flex items-center px-3 py-2 text-xs text-rose-600 hover:bg-rose-50"
                    >
                      <LogOut className="w-3.5 h-3.5 mr-2" />
                      Đăng Xuất
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => openAuthModal("login")}
                className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 text-navy-900 border border-slate-200 hover:bg-banana-50 hover:border-banana-300 transition-all gap-1.5"
              >
                <User className="w-3.5 h-3.5 text-navy-800" />
              <span>{t("Đăng Nhập")}</span>
              </button>
            )}

            {/* AI Assistant Quick Trigger */}
            <button
              onClick={() => {
                const chatToggle = document.getElementById("ai-chat-toggle-btn");
                if (chatToggle) chatToggle.click();
              }}
              className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-banana-50 to-amber-100 text-banana-800 border border-banana-300/80 hover:shadow transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-banana-600 animate-pulse" />
              {t("ChillBanana AI")}
            </button>

            <WebsitePreferencesTrigger />

            <Link
              href={calculatorHref}
              className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-bold bg-navy-900 text-white hover:bg-slate-800 shadow-md transition-all"
            >
              {t("Đặt Mua Hộ Ngay")}
            </Link>
          </div>

          {/* Mobile Right Controls */}
          <div className="md:hidden flex items-center space-x-2">
            {/* Mobile Cart Trigger */}
            <button
              onClick={openCart}
              className="relative p-2 rounded-xl text-slate-700 hover:bg-banana-50 border border-slate-200"
              aria-label="Giỏ hàng"
            >
              <ShoppingCart className="w-5 h-5 text-navy-900" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>

            {/* Mobile Menu Button */}
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
            href={calculatorHref}
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center px-3 py-2.5 rounded-xl text-slate-700 hover:bg-banana-50 hover:text-banana-600"
          >
            <SendHorizontal className="w-4 h-4 mr-2 text-banana-600" />
            {t("Dán Link Tính Giá Mua Hộ")}
          </Link>
          <Link
            href={categoriesHref}
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center px-3 py-2.5 rounded-xl text-slate-700 hover:bg-banana-50 hover:text-banana-600"
          >
            {t("4 Danh Mục Chủ Lực")}
          </Link>
          <Link
            href="/tracking"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center px-3 py-2.5 rounded-xl text-slate-700 hover:bg-banana-50 hover:text-banana-600"
          >
            <PackageSearch className="w-4 h-4 mr-2 text-blue-600" />
            {t("Tra Cứu Đơn Hàng (7 Bước)")}
          </Link>
          <Link
            href={newsHref}
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center px-3 py-2.5 rounded-xl text-slate-700 hover:bg-banana-50 hover:text-banana-600"
          >
            {t("Cẩm Nang Hàng Nhật")}
          </Link>
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 font-bold text-indigo-800 hover:bg-indigo-100"
          >
            <Sparkles className="h-4 w-4" />
            {t("Giao diện chính NeoDay")}
          </Link>
          <WebsitePreferencesTrigger className="w-full" onOpen={() => setMobileMenuOpen(false)} />
          <div className="pt-2 border-t border-slate-200 flex flex-col gap-2">
            {customer ? (
              <div className="flex flex-col gap-2 p-2.5 bg-slate-100 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-navy-900">{customer.name}</p>
                    <p className="text-[10px] text-slate-500">{customer.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                    className="text-xs text-rose-600 font-bold px-2 py-1 bg-white rounded-lg border border-slate-200 shadow-sm"
                  >
                    {t("Đăng xuất")}
                  </button>
                </div>
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  <User className="w-3.5 h-3.5 mr-1.5" />
                  Hồ Sơ Của Tôi
                </Link>
              </div>
            ) : (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuthModal("login");
                }}
                className="w-full flex items-center justify-center py-2.5 bg-banana-500 text-navy-950 font-bold rounded-xl text-xs"
              >
                <User className="w-3.5 h-3.5 mr-1.5" />
                  {t("Đăng Nhập / Đăng Ký")}
              </button>
            )}
            <Link
              href="/admin/login"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center px-3 py-2 rounded-xl text-slate-600 hover:text-navy-900 text-xs font-semibold"
            >
              <LayoutDashboard className="w-3.5 h-3.5 mr-1.5" />
              Đăng Nhập Admin Portal
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
