import React from "react";
import HeroSection from "@/components/HeroSection";
import OrderCalculator from "@/components/OrderCalculator";
import FeaturedCategories from "@/components/FeaturedCategories";
import CuratedProducts from "@/components/CuratedProducts";
import WhyChooseUs from "@/components/WhyChooseUs";
import NewsCorner from "@/components/NewsCorner";

export default function HomePage() {
  return (
    <div className="space-y-6 sm:space-y-10">
      {/* 1. Hero Banner giao thoa văn hóa Việt - Nhật */}
      <HeroSection />

      {/* 2. Công Cụ Dán Link Đặt Mua & Báo Giá Trọn Gói Tự Động */}
      <OrderCalculator />

      {/* 3. 4 Danh Mục Chủ Lực Tinh Gọn */}
      <FeaturedCategories />

      {/* 4. Danh Sách Sản Phẩm Hot Có Sẵn Slot Gom Đơn */}
      <CuratedProducts />

      {/* 5. 4 Giá Trị Cốt Lõi (Cam kết 100% Nhật, Bay 3-5 ngày, AI 24/7, Gộp đơn) */}
      <WhyChooseUs />

      {/* 6. Góc Bản Tin Văn Hóa, Lịch Bay & Cẩm Nang Săn Deal */}
      <NewsCorner />
    </div>
  );
}
