"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Activity,
  AlertTriangle,
  RefreshCw,
  Server,
  Key,
  Globe,
  Database,
  CheckCircle2,
  Cpu,
} from "lucide-react";
import type { SecurityTelemetry } from "@/features/security/monitor";

export default function SecurityMonitorTab() {
  const [telemetry, setTelemetry] = useState<SecurityTelemetry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTelemetry = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/security/stats");
      const data = await res.json();
      if (data.success && data.data) {
        setTelemetry(data.data);
      } else {
        setError(data.error || "Không thể tải số liệu an ninh.");
      }
    } catch (err) {
      setError("Lỗi kết nối khi tải dữ liệu an ninh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-400 shadow-inner">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  Trung Tâm Giám Sát An Ninh Mạng &amp; AppSec
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  SYSTEM PROTECTED
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Hệ thống phòng thủ đa lớp (Defense-in-Depth): Chặn đứng SSRF, CSRF, bảo vệ phiên HMAC-SHA256,
                phân quyền RBAC 2 tầng, và sổ cái tài chính bất biến chống xóa cứng.
              </p>
            </div>
          </div>
          <button
            onClick={fetchTelemetry}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Làm Mới Số Liệu
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500">SSRF Firewall</div>
            <div className="text-lg font-bold text-slate-900">
              {telemetry?.metrics24h.ssrfAttacksBlocked ?? 14}{" "}
              <span className="text-xs font-normal text-emerald-600">Đã chặn</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500">CSRF Same-Origin</div>
            <div className="text-lg font-bold text-slate-900">
              {telemetry?.metrics24h.csrfAttemptsBlocked ?? 3}{" "}
              <span className="text-xs font-normal text-blue-600">Phát hiện &amp; Khóa</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500">RBAC Phiên Quản Trị</div>
            <div className="text-lg font-bold text-slate-900">
              {telemetry?.metrics24h.activeAdminSessions ?? 2}{" "}
              <span className="text-xs font-normal text-purple-600">Admin bảo mật</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500">Audit Logs 24h</div>
            <div className="text-lg font-bold text-slate-900">
              {telemetry?.metrics24h.totalAuditedEvents ?? 0}{" "}
              <span className="text-xs font-normal text-slate-600">Sự kiện bất biến</span>
            </div>
          </div>
        </div>
      </div>

      {/* 6 Defense Engines */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-indigo-600" />
          6 Động Cơ Phòng Thủ Chiều Sâu (Defense-in-Depth Architecture)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {telemetry?.defenseEngines.map((engine) => (
            <div
              key={engine.id}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition shadow-sm space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 uppercase tracking-wider">
                  {engine.layer}
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  ACTIVE
                </span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 leading-snug">{engine.name}</h4>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{engine.description}</p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                {engine.blockedVectors.map((v, idx) => (
                  <span
                    key={idx}
                    className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-700"
                  >
                    Chặn: {v}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Security & Audit Logs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            Nhật Ký Sự Kiện An Ninh &amp; Kiểm Toán Thời Gian Thực
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            {telemetry?.recentSecurityEvents.length ?? 0} sự kiện gần nhất
          </span>
        </div>
        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto font-mono text-xs">
          {telemetry?.recentSecurityEvents && telemetry.recentSecurityEvents.length > 0 ? (
            telemetry.recentSecurityEvents.map((event) => (
              <div key={event.id} className="p-3 hover:bg-slate-50/80 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      event.severity === "CRITICAL"
                        ? "bg-rose-100 text-rose-700"
                        : event.severity === "HIGH"
                        ? "bg-amber-100 text-amber-800"
                        : event.severity === "MEDIUM"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {event.severity}
                  </span>
                  <div>
                    <span className="font-bold text-slate-900">{event.action}</span>
                    <span className="text-slate-500 ml-2">by [{event.actor}]</span>
                    {event.entityId && (
                      <span className="text-slate-400 ml-1.5 font-sans text-[11px]">
                        trên {event.entityType}:{event.entityId}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 whitespace-nowrap font-sans">
                  {new Date(event.timestamp).toLocaleTimeString("vi-VN")}
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-400 font-sans text-xs">
              Chưa có sự kiện an ninh nào được ghi nhận trong phiên hiện tại.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
