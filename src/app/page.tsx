import type { Metadata } from "next";
import NeoDaylightCosmos from "@/components/NeoDaylightCosmos";

export const metadata: Metadata = {
  title: "Neo Daylight Cosmos | ChillBanana",
  description: "Khám phá giao diện mua hộ hàng Nhật Neo Daylight Cosmos của ChillBanana.",
};

export default function HomePage() {
  return <NeoDaylightCosmos />;
}
