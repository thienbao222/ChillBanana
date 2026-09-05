"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Lock, User, ArrowRight, AlertCircle, Sparkles } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        router.push("/admin");
        router.refresh();
      } else {
        setError(data.error || "Tên đăng nhập hoặc mật khẩu không chính xác.");
      }
    } catch (err) {
      setError("Không thể kết nối với máy chủ. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-950 via-navy-900 to-slate-900 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-banana-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        {/* Card */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-200/80">
          
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-banana-400 to-amber-500 items-center justify-center text-3xl shadow-lg mb-4">
              🍌
            </div>
            <h1 className="text-2xl font-bold text-navy-900 font-serif">
              Chill<span className="text-banana-600">Banana</span> Admin
            </h1>
            <p className="text-xs text-slate-500 mt-1.5">
              Cổng quản trị vận hành đơn hàng &amp; Phân tích xu hướng AI
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Tài khoản quản trị
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập username (ví dụ: admin)"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-navy-900 focus:outline-none focus:ring-2 focus:ring-banana-500 focus:bg-white transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu quản trị"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-navy-900 focus:outline-none focus:ring-2 focus:ring-banana-500 focus:bg-white transition-all font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-navy-900 to-slate-900 hover:from-slate-900 hover:to-navy-950 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Đang xác thực bảo mật...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-banana-400" />
                  <span>Đăng Nhập Quản Trị</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </>
              )}
            </button>
          </form>

          {/* Demo Credentials Box */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <div className="bg-banana-50 border border-banana-200 rounded-2xl p-3 text-[11px] text-banana-900 text-left space-y-1">
              <span className="font-bold flex items-center text-banana-800">
                <Sparkles className="w-3 h-3 mr-1 text-banana-600" />
                Tài khoản mặc định:
              </span>
              <p>Username: <strong className="font-mono text-navy-900">admin</strong></p>
              <p>Mật khẩu: <strong className="font-mono text-navy-900">ChillBanana@2026</strong> (hoặc <strong className="font-mono text-navy-900">admin123</strong>)</p>
            </div>

            <div className="mt-4">
              <Link href="/" className="text-xs text-slate-500 hover:text-navy-900 underline font-medium">
                ← Quay lại Trang Chủ Khách Hàng
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
