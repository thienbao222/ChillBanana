import type { Metadata } from "next";
import NeoDaylightCosmos from "@/components/NeoDaylightCosmos";

export const metadata: Metadata = {
  title: "ChillBanana (JP ⇆ VN) | Mua Hộ & Vận Chuyển Hàng Nội Địa Nhật Bản",
  description:
    "Nền tảng mua hộ và vận chuyển hàng nội địa Nhật Bản về Việt Nam tích hợp ChillBanana AI tư vấn 24/7, tự động bóc tách link Amazon JP, Mercari, Rakuten, Yahoo Auctions, Uniqlo, Surugaya, Bic Camera, Yodobashi và báo giá trọn gói.",
};

export default function HomePage() {
  return <NeoDaylightCosmos />;
}