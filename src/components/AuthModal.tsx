"use client";

import Link from "next/link";
import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  X,
  Lock,
  Mail,
  User,
  Phone,
  MapPin,
  AlertCircle,
  ArrowRight
} from "lucide-react";

export default function AuthModal() {
  const {
    isAuthModalOpen,
    closeAuthModal,
    authModalTab,
    openAuthModal,
    login,
    register,
    refreshSession,
  } = useAuth();

  const [pendingVerifyToken, setPendingVerifyToken] = useState<string | null>(null);

  const handleInstantVerify = async () => {
    if (!pendingVerifyToken) return;
    setIsLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/auth/customer/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: pendingVerifyToken }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await refreshSession();
        setPendingVerifyToken(null);
        const msg = data.message || "Đã kích hoạt tài khoản và đăng nhập thành công!";
        setSuccessMessage(msg);
        toast.success(msg);
        setTimeout(() => {
          closeAuthModal();
        }, 900);
      } else {
        setErrorMessage(data.error || "Không thể kích hoạt nhanh tài khoản.");
      }
    } catch {
      setErrorMessage("Lỗi kết nối máy chủ khi kích hoạt tài khoản.");
    } finally {
      setIsLoading(false);
    }
  };
  const { toast } = useToast();

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regAddress, setRegAddress] = useState("");

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  if (!isAuthModalOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsLoading(true);

    const res = await login(loginEmail, loginPassword);
    setIsLoading(false);
    if (!res.success) {
      setErrorMessage(res.message || "Đăng nhập thất bại.");
      if (res.verificationToken) {
        setPendingVerifyToken(res.verificationToken);
      }
    } else {
      const msg = res.message || "Đăng nhập thành công! Chào mừng trở lại.";
      setSuccessMessage(msg);
      const delay = (res.stitched && res.stitched.orders > 0) ? 2000 : 900;
      setTimeout(() => {
        closeAuthModal();
        toast.success(msg);
      }, delay);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsLoading(true);

    const res = await register({
      name: regName,
      email: regEmail,
      password: regPassword,
      phone: regPhone,
      address: regAddress,
    });
    setIsLoading(false);
    if (!res.success) {
      setErrorMessage(res.message || "Đăng ký thất bại.");
      if (res.verificationToken) {
        setPendingVerifyToken(res.verificationToken);
      }
    } else {
      if (res.requiresEmailVerification) {
        setSuccessMessage(res.message || "Tài khoản đã được tạo. Vui lòng kiểm tra email để xác minh.");
        if (res.verificationToken) {
          setPendingVerifyToken(res.verificationToken);
        }
      } else {
        const msg = res.message || "Đăng ký tài khoản thành công! Chào mừng bạn.";
        setSuccessMessage(msg);
        const delay = (res.stitched && res.stitched.orders > 0) ? 2500 : 1000;
        setTimeout(() => {
          closeAuthModal();
          toast.success(msg);
        }, delay);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative overflow-hidden">
        {/* Top Accent bar */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-banana-400 via-banana-500 to-amber-500" />

        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6 pt-2">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-banana-100 text-2xl items-center justify-center mb-2 shadow-inner">
            🍌
          </div>
          <h3 className="text-xl font-serif font-bold text-navy-900">
            Tài Khoản ChillBanana
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý giỏ hàng, lưu địa chỉ và tra cứu vận đơn hỏa tốc Nhật - Việt
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-100 p-1 rounded-2xl mb-6">
          <button
            type="button"
            onClick={() => {
              setErrorMessage("");
              setSuccessMessage("");
              setPendingVerifyToken(null);
              openAuthModal("login");
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              authModalTab === "login"
                ? "bg-white text-navy-900 shadow-sm"
                : "text-slate-500 hover:text-navy-900"
            }`}
          >
            Đăng Nhập
          </button>
          <button
            type="button"
            onClick={() => {
              setErrorMessage("");
              setSuccessMessage("");
              setPendingVerifyToken(null);
              openAuthModal("register");
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              authModalTab === "register"
                ? "bg-white text-navy-900 shadow-sm"
                : "text-slate-500 hover:text-navy-900"
            }`}
          >
            Đăng Ký Mới
          </button>
        </div>

        {/* 1-Click Instant Verify Button for Demo */}
        {pendingVerifyToken && (
          <div className="mb-4 p-3 bg-gradient-to-r from-amber-50 to-banana-50 border border-amber-300 rounded-2xl text-xs space-y-2 animate-in fade-in">
            <div className="font-bold text-amber-950 flex items-center justify-between">
              <span className="flex items-center gap-1">⚡ Kích Hoạt Nhanh Bằng 1-Click</span>
              <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-mono font-bold">Live Demo</span>
            </div>
            <p className="text-[11px] text-amber-900 leading-relaxed">
              Bạn có thể mở email xác nhận (hoặc bấm nút bên dưới để kích hoạt tài khoản và đăng nhập ngay tức thì mà không cần mở hộp thư):
            </p>
            <button
              type="button"
              disabled={isLoading}
              onClick={handleInstantVerify}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-banana-500 hover:from-amber-600 hover:to-banana-600 text-navy-950 font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
            >
              <span>{isLoading ? "Đang kích hoạt..." : "⚡ Kích Hoạt Tài Khoản & Đăng Nhập Ngay"}</span>
            </button>
          </div>
        )}

        {/* Alert messages */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className={`mb-4 p-3 border text-xs rounded-xl flex items-start space-x-2 ${
            successMessage.includes("đơn hàng") || successMessage.includes("kết nối")
              ? "bg-banana-50 border-banana-300 text-banana-900"
              : "bg-emerald-50 border-emerald-200 text-emerald-700"
          }`}>
            <span className="text-base shrink-0">
              {successMessage.includes("đơn hàng") || successMessage.includes("kết nối") ? "🔗" : "✅"}
            </span>
            <span className="leading-relaxed">{successMessage}</span>
          </div>
        )}

        {/* FORM ĐĂNG NHẬP */}
        {authModalTab === "login" ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-banana-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">
                  Mật khẩu
                </label>
                <Link
                  href="/forgot-password"
                  onClick={closeAuthModal}
                  className="text-xs font-semibold text-amber-600 hover:text-amber-500 transition-colors"
                >
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-banana-500 focus:bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 bg-banana-500 hover:bg-banana-600 disabled:opacity-50 text-navy-950 font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2"
            >
              <span>{isLoading ? "Đang xử lý..." : "Đăng Nhập Ngay"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* FORM ĐĂNG KÝ */
          <form onSubmit={handleRegisterSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Họ và Tên <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-banana-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-banana-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mật khẩu <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  minLength={8}
                  maxLength={256}
                  placeholder="Tối thiểu 8 ký tự"
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-banana-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số Điện Thoại
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="0912 345 678"
                    className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-banana-500 focus:bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Địa Chỉ Nhận Hàng
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                  <input
                    type="text"
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    placeholder="Quận/Huyện, Tỉnh/TP"
                    className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-banana-500 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-3 py-3 bg-banana-500 hover:bg-banana-600 disabled:opacity-50 text-navy-950 font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2"
            >
              <span>{isLoading ? "Đang tạo tài khoản..." : "Hoàn Tất Đăng Ký"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
