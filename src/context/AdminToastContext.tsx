"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "warning" | "info";

interface AdminToast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface AdminToastContextType {
  adminToast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    warning: (msg: string) => void;
    info: (msg: string) => void;
  };
}

const AdminToastContext = createContext<AdminToastContextType | null>(null);

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />,
  error:   <XCircle className="w-4.5 h-4.5 shrink-0" />,
  warning: <AlertTriangle className="w-4.5 h-4.5 shrink-0" />,
  info:    <Info className="w-4.5 h-4.5 shrink-0" />,
};

const STYLES: Record<ToastVariant, string> = {
  success: "bg-emerald-50 border-emerald-200 text-emerald-800",
  error:   "bg-rose-50 border-rose-200 text-rose-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  info:    "bg-blue-50 border-blue-200 text-blue-800",
};

export function AdminToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<AdminToast[]>([]);

  const add = useCallback((message: string, variant: ToastVariant) => {
    const id = `t-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const adminToast = {
    success: (msg: string) => add(msg, "success"),
    error:   (msg: string) => add(msg, "error"),
    warning: (msg: string) => add(msg, "warning"),
    info:    (msg: string) => add(msg, "info"),
  };

  return (
    <AdminToastContext.Provider value={{ adminToast }}>
      {children}
      {/* Toast Container */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 px-4 py-3.5 rounded-2xl border shadow-lg max-w-sm w-full ${STYLES[t.variant]} animate-in slide-in-from-right-full fade-in duration-300`}
            >
              <span>{ICONS[t.variant]}</span>
              <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
              <button
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="opacity-50 hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </AdminToastContext.Provider>
  );
}

export function useAdminToast(): AdminToastContextType {
  const ctx = useContext(AdminToastContext);
  if (!ctx) throw new Error("useAdminToast must be used within AdminToastProvider");
  return ctx;
}
