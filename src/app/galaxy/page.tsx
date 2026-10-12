import type { Metadata } from "next";
import GalaxyStorefront from "@/components/GalaxyStorefront";

export const metadata: Metadata = {
  title: "Banana Galaxy | ChillBanana",
  description: "Khám phá giao diện mua hộ hàng Nhật mới của ChillBanana.",
};

export default function GalaxyPage() {
  return <GalaxyStorefront />;
}
