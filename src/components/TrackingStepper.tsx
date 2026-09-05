"use client";

import React from "react";
import { 
  CreditCard, 
  ShoppingBag, 
  Warehouse, 
  Globe, 
  Building2, 
  Truck, 
  CheckCircle,
  Clock
} from "lucide-react";
import { OrderStatus } from "@/types";

interface TrackingStepperProps {
  currentStatus: OrderStatus;
}

const STEPS: { status: OrderStatus; label: string; subLabel: string; icon: React.ReactNode }[] = [
  {
    status: "PENDING_DEPOSIT",
    label: "1. Đặt Cọc",
    subLabel: "Chờ cọc VietQR",
    icon: <CreditCard className="w-5 h-5" />,
  },
  {
    status: "PURCHASING_JP",
    label: "2. Mua Tại Nhật",
    subLabel: "Staff Tokyo đang mua",
    icon: <ShoppingBag className="w-5 h-5" />,
  },
  {
    status: "WAREHOUSE_JP",
    label: "3. Nhập Kho Tokyo",
    subLabel: "Kiểm seal & cân đo",
    icon: <Warehouse className="w-5 h-5" />,
  },
  {
    status: "IN_TRANSIT_AIR",
    label: "4. Vận Chuyển Quốc Tế",
    subLabel: "Chuyển tuyến Nhật ➔ VN",
    icon: <Globe className="w-5 h-5" />,
  },
  {
    status: "WAREHOUSE_VN",
    label: "5. Nhập Kho VN",
    subLabel: "Thông quan & phân loại",
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    status: "LOCAL_DELIVERY",
    label: "6. Đang Giao",
    subLabel: "Shipper GHTK/GHN",
    icon: <Truck className="w-5 h-5" />,
  },
  {
    status: "COMPLETED",
    label: "7. Hoàn Tất",
    subLabel: "Đã nhận hàng an toàn",
    icon: <CheckCircle className="w-5 h-5" />,
  },
];

export default function TrackingStepper({ currentStatus }: TrackingStepperProps) {
  const statusOrder: OrderStatus[] = [
    "PENDING_DEPOSIT",
    "PURCHASING_JP",
    "WAREHOUSE_JP",
    "IN_TRANSIT_AIR",
    "WAREHOUSE_VN",
    "LOCAL_DELIVERY",
    "COMPLETED",
  ];

  const currentIndex = statusOrder.indexOf(currentStatus);

  return (
    <div className="w-full py-4">
      {/* Desktop Horizontal Stepper */}
      <div className="hidden lg:grid grid-cols-7 gap-2 relative">
        {/* Progress Line */}
        <div className="absolute top-6 left-[7%] right-[7%] h-1 bg-slate-200 -z-0">
          <div
            className="h-full bg-gradient-to-r from-banana-500 to-emerald-500 transition-all duration-500"
            style={{
              width: `${(Math.max(0, currentIndex) / (STEPS.length - 1)) * 100}%`,
            }}
          />
        </div>

        {STEPS.map((step, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <div key={step.status} className="flex flex-col items-center text-center z-10">
              {/* Circle Icon */}
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm ${
                  isDone
                    ? "bg-emerald-500 text-white shadow-emerald-200"
                    : isCurrent
                    ? "bg-banana-500 text-navy-950 ring-4 ring-banana-200 shadow-banana-300 scale-110 font-bold"
                    : "bg-white text-slate-400 border border-slate-200"
                }`}
              >
                {step.icon}
              </div>

              {/* Text */}
              <div className="mt-3 space-y-0.5">
                <p
                  className={`text-xs font-bold ${
                    isCurrent
                      ? "text-banana-800"
                      : isDone
                      ? "text-emerald-700"
                      : "text-slate-400"
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-[10px] text-slate-500 max-w-[120px] leading-tight">
                  {step.subLabel}
                </p>
              </div>

              {/* Status pill */}
              {isCurrent && (
                <span className="mt-2 text-[9px] bg-banana-100 text-banana-900 font-bold px-2 py-0.5 rounded-full border border-banana-300 animate-pulse">
                  Đang xử lý
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile / Tablet Vertical Stepper */}
      <div className="lg:hidden space-y-3">
        {STEPS.map((step, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <div
              key={step.status}
              className={`flex items-start space-x-3 p-3 rounded-2xl border transition-all ${
                isCurrent
                  ? "bg-banana-50 border-banana-400 shadow-sm"
                  : isDone
                  ? "bg-emerald-50/60 border-emerald-200"
                  : "bg-white border-slate-200 opacity-60"
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isDone
                    ? "bg-emerald-500 text-white"
                    : isCurrent
                    ? "bg-banana-500 text-navy-950 font-bold"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {step.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p
                    className={`text-xs font-bold ${
                      isCurrent
                        ? "text-banana-900"
                        : isDone
                        ? "text-emerald-800"
                        : "text-slate-600"
                    }`}
                  >
                    {step.label}
                  </p>
                  {isCurrent && (
                    <span className="text-[10px] font-bold text-banana-900 bg-banana-200 px-2 py-0.5 rounded-full">
                      Hiện Tại
                    </span>
                  )}
                  {isDone && (
                    <span className="text-[10px] font-semibold text-emerald-700">✓ Xong</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{step.subLabel}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
