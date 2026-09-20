import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import LayoutWrapper from "@/components/LayoutWrapper";

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
          <LayoutWrapper>{children}</LayoutWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}

