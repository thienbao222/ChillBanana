"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AIChatBot from "@/features/ai/customer/AIChatBot";
import CartDrawer from "@/components/CartDrawer";
import AuthModal from "@/components/AuthModal";
import { CartProvider } from "@/context/CartContext";
import { ToastProvider } from "@/context/ToastContext";
import ToastContainer from "@/components/ToastContainer";
import WebsitePreferencesPanel from "@/components/WebsitePreferencesPanel";
import { WebsitePreferencesProvider } from "@/context/WebsitePreferencesContext";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");
  const isCosmosRoute = pathname === "/" || pathname === "/galaxy" || pathname === "/tracking";

  if (isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <WebsitePreferencesProvider>
      <ToastProvider>
        <CartProvider>
          {!isCosmosRoute && <Navbar />}
          {isCosmosRoute ? children : <main className="flex-grow">{children}</main>}
          {!isCosmosRoute && <Footer />}
          <AIChatBot />
          <CartDrawer />
          <AuthModal />
          <ToastContainer />
          <WebsitePreferencesPanel />
        </CartProvider>
      </ToastProvider>
    </WebsitePreferencesProvider>
  );
}

