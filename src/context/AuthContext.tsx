"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface CustomerUser {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  address?: string | null;
}

// Sprint 4: Include stitched info in auth responses
interface AuthResponse {
  success: boolean;
  message?: string;
  stitched?: { orders: number; sessions: number };
  requiresEmailVerification?: boolean;
}

interface AuthContextType {
  customer: CustomerUser | null;
  loading: boolean;
  isAuthModalOpen: boolean;
  authModalTab: "login" | "register";
  openAuthModal: (tab?: "login" | "register") => void;
  closeAuthModal: () => void;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (data: { name: string; email: string; password: string; phone?: string; address?: string }) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<CustomerUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<"login" | "register">("login");

  const refreshSession = async () => {
    try {
      const res = await fetch("/api/auth/customer");
      if (res.ok) {
        const data = await res.json();
        setCustomer(data.customer || null);
      }
    } catch (err) {
      console.warn("Could not check customer session:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("auth") === "login" || params.get("login") === "true") {
        openAuthModal("login");
      }
    }
  }, []);

  const openAuthModal = (tab: "login" | "register" = "login") => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const login = async (email: string, password: string): Promise<AuthResponse> => {
    try {
      const res = await fetch("/api/auth/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.customer) setCustomer(data.customer);
        else setCustomer(null);
        // Keep modal open briefly to show stitching success message
        if (!data.stitched || data.stitched.orders === 0) {
          setIsAuthModalOpen(false);
        }
        return { success: true, message: data.message, stitched: data.stitched, requiresEmailVerification: data.requiresEmailVerification };
      }
      return { success: false, message: data.error || "Đăng nhập thất bại" };
    } catch (err: any) {
      return { success: false, message: err.message || "Lỗi kết nối máy chủ" };
    }
  };

  const register = async (userData: { name: string; email: string; password: string; phone?: string; address?: string }): Promise<AuthResponse> => {
    try {
      const res = await fetch("/api/auth/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", ...userData }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.customer) setCustomer(data.customer);
        else setCustomer(null);
        // Keep modal open briefly to show stitching success message
        if (!data.stitched || data.stitched.orders === 0) {
          setIsAuthModalOpen(false);
        }
        return { success: true, message: data.message, stitched: data.stitched, requiresEmailVerification: data.requiresEmailVerification };
      }
      return { success: false, message: data.error || "Đăng ký thất bại" };
    } catch (err: any) {
      return { success: false, message: err.message || "Lỗi kết nối máy chủ" };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
    } finally {
      setCustomer(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        customer,
        loading,
        isAuthModalOpen,
        authModalTab,
        openAuthModal,
        closeAuthModal,
        login,
        register,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
