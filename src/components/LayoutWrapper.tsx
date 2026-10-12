"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AIChatBot from "@/components/AIChatBot";
import CartDrawer from "@/components/CartDrawer";
import AuthModal from "@/components/AuthModal";
import { CartProvider } from "@/context/CartContext";
import { ToastProvider } from "@/context/ToastContext";
import ToastContainer from "@/components/ToastContainer";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");
  const isGalaxyRoute = pathname === "/galaxy";

  if (isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <ToastProvider>
      <CartProvider>
        {!isGalaxyRoute && <Navbar />}
        {isGalaxyRoute ? children : <main className="flex-grow">{children}</main>}
        {!isGalaxyRoute && <Footer />}
        <AIChatBot />
        <CartDrawer />
        <AuthModal />
        <ToastContainer />
      </CartProvider>
    </ToastProvider>
  );
}

