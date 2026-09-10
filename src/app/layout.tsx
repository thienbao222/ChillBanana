import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AIChatBot from "@/components/AIChatBot";

import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import AuthModal from "@/components/AuthModal";
import CartDrawer from "@/components/CartDrawer";

export const metadata: Metadata = {
  title: "ChillBanana - Mua Hàng Hộ Nhật Bản Thư Thái & Trợ Lý AI 24/7",
  description: "Nền tảng thương mại điện tử mua hộ hàng Nhật Bản ChillBanana: Tự động bóc tách link Amazon/Mercari, Trợ lý ảo AI tư vấn 24/7, tỷ giá minh bạch, cước bay cố định và thanh toán VietQR Napas 247.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="scroll-smooth">
      <body className="min-h-screen flex flex-col bg-[#FAF8F5] text-slate-900 antialiased selection:bg-banana-200 selection:text-banana-900">
        <AuthProvider>
          <CartProvider>
            <Navbar />
            <main className="flex-grow">{children}</main>
            <Footer />
            <AIChatBot />
            <CartDrawer />
            <AuthModal />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

