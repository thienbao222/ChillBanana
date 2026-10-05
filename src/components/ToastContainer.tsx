"use client";

import React, { useEffect, useState } from "react";
import { useToast, Toast, ToastVariant } from "@/context/ToastContext";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 className="w-5 h-5 shrink-0" />,
  error:   <XCircle className="w-5 h-5 shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 shrink-0" />,
  info:    <Info className="w-5 h-5 shrink-0" />,
};

const STYLES: Record<ToastVariant, string> = {
  success: "bg-emerald-50 border-emerald-200 text-emerald-800",
  error:   "bg-rose-50 border-rose-200 text-rose-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  info:    "bg-blue-50 border-blue-200 text-blue-800",
};

const ICON_STYLES: Record<ToastVariant, string> = {
  success: "text-emerald-600",
  error:   "text-rose-600",
  warning: "text-amber-600",
  info:    "text-blue-600",
};

const PROGRESS_STYLES: Record<ToastVariant, string> = {
  success: "bg-emerald-400",
  error:   "bg-rose-400",
  warning: "bg-amber-400",
  info:    "bg-blue-400",
};

function ToastItem({ toast }: { toast: Toast }) {
  const { dismiss } = useToast();
  const [progress, setProgress] = useState(100);
  const duration = toast.duration || 4000;

  useEffect(() => {
    const step = 50; // update every 50ms
    const decrement = (100 * step) / duration;
    const interval = setInterval(() => {
      setProgress((prev) => Math.max(prev - decrement, 0));
    }, step);
    return () => clearInterval(interval);
  }, [duration]);

  return (
    <div
      className={`relative flex items-start gap-3 px-4 py-3.5 rounded-2xl border shadow-lg max-w-sm w-full overflow-hidden animate-in slide-in-from-right-full fade-in duration-300 ${STYLES[toast.variant]}`}
    >
      <span className={ICON_STYLES[toast.variant]}>{ICONS[toast.variant]}</span>
      <p className="text-sm font-medium flex-1 leading-snug pt-0.5">{toast.message}</p>
      <button
        onClick={() => dismiss(toast.id)}
        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity mt-0.5"
      >
        <X className="w-4 h-4" />
      </button>
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/5">
        <div
          className={`h-full transition-all ease-linear ${PROGRESS_STYLES[toast.variant]}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  );
}
