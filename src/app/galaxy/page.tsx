import type { Metadata } from "next";
import NeoDaylightCosmos from "@/components/NeoDaylightCosmos";

export const metadata: Metadata = {
  title: "Neo Daylight Cosmos v8 | ChillBanana",
  description: "Khám phá giao diện mua hộ hàng Nhật mới Neo Daylight Cosmos của ChillBanana.",
};

export default function GalaxyPage() {
  return <NeoDaylightCosmos />;
}
