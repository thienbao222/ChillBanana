"use client";

import React, { useState, useEffect } from "react";
import { TrendingUp, RefreshCw, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { LiveRateData } from "@/lib/exchange-rate";

interface LiveRateWidgetProps {
  onRateChange?: (rate: number) => void;
  compact?: boolean;
}

export default function LiveRateWidget({ onRateChange, compact = false }: LiveRateWidgetProps) {
  const [rateData, setRateData] = useState<LiveRateData>({
    rate: 172,
    roundedRate: 172,
    previousRate: 171.5,
    changePercent: 0.29,
    updatedAt: "Vừa xong",
    source: "Tỷ giá liên ngân hàng",
  });
  const [loading, setLoading] = useState(false);

  const loadRate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/exchange-rate");
      const json = await res.json();
      if (json.success && json.data) {
        setRateData(json.data);
        if (onRateChange) {
          onRateChange(json.data.roundedRate);
        }
      }
    } catch (e) {
      console.warn("Could not load live rate:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRate();
    // Tự động cập nhật mỗi 5 phút
    const timer = setInterval(loadRate, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  if (compact) {
    return (
      <div className="inline-flex items-center space-x-2 bg-navy-950/60 border border-slate-700/80 px-2.5 py-1 rounded-full text-[11px] text-white">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="font-semibold text-banana-300">
          1 JPY = {rateData.rate} VND
        </span>
        <span className={`text-[10px] font-bold ${rateData.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {rateData.changePercent >= 0 ? `+${rateData.changePercent}%` : `${rateData.changePercent}%`}
        </span>
        <button
          onClick={loadRate}
          className="text-slate-400 hover:text-white transition-colors"
          title="Làm mới tỷ giá"
        >
          <RefreshCw className={`w-2.5 h-2.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-navy-900 via-navy-950 to-slate-900 p-4 rounded-2xl border border-slate-800 text-white shadow-md">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-banana-400">
            Tỷ Giá Ngoại Tệ Thời Gian Thực
          </span>
        </div>
        <button
          onClick={loadRate}
          className="text-[11px] text-slate-400 hover:text-white flex items-center space-x-1"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          <span>Cập nhật ({rateData.updatedAt})</span>
        </button>
      </div>

      <div className="flex items-baseline justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold font-serif text-white tracking-tight">
              1 JPY = {rateData.rate} VND
            </span>
            <span
              className={`inline-flex items-center text-xs font-bold px-1.5 py-0.5 rounded ${
                rateData.changePercent >= 0 ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-rose-950 text-rose-400 border border-rose-800"
              }`}
            >
              {rateData.changePercent >= 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
              {rateData.changePercent >= 0 ? `+${rateData.changePercent}%` : `${rateData.changePercent}%`}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Nguồn: {rateData.source} • Cập nhật trực tiếp
          </p>
        </div>
      </div>
    </div>
  );
}
