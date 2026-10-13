import type { Metadata } from "next";
import React from "react";
import HeroSection from "@/components/HeroSection";
import OrderCalculator from "@/components/OrderCalculator";
import FeaturedCategories from "@/components/FeaturedCategories";
import CuratedProducts from "@/components/CuratedProducts";
import WhyChooseUs from "@/components/WhyChooseUs";
import NewsCorner from "@/components/NewsCorner";

export const metadata: Metadata = {
  title: "ChillBanana Classic | Giao diện cũ",
  description: "Giao diện mua hộ hàng Nhật phiên bản cũ của ChillBanana.",
};

export default function ClassicPage() {
  return (
    <div className="space-y-6 sm:space-y-10">
      {/* 1. Hero Banner giao thoa văn hóa Việt - Nhật */}
      <HeroSection />

      {/* 2. Công Cụ Dán Link Đặt Mua & Báo Giá Trọn Gói Tự Động */}
      <OrderCalculator />

      {/* 3. 4 Danh Mục Chủ Lực Tinh Gọn */}
      <FeaturedCategories />

      {/* 4. Danh Sách Sản Phẩm Có Sẵn Tại Kho ChillBanana (Giao Ngay 24H) */}
      <CuratedProducts />

      {/* 5. 4 Giá Trị Cốt Lõi */}
      <WhyChooseUs />

      {/* 6. Góc Bản Tin Văn Hóa, Lịch Bay & Cẩm Nang Săn Deal */}
      <NewsCorner />
    </div>
  );
}
