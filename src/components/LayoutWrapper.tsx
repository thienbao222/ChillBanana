"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AIChatBot from "@/components/AIChatBot";
import CartDrawer from "@/components/CartDrawer";
import AuthModal from "@/components/AuthModal";
import { CartProvider } from "@/context/CartContext";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");

  if (isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <CartProvider>
      <Navbar />
      <main className="flex-grow">{children}</main>
      <Footer />
      <AIChatBot />
      <CartDrawer />
      <AuthModal />
    </CartProvider>
  );
}
