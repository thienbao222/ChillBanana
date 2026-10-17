"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PRICING_CONFIG, validatePricingConfig, type PricingConfigValues } from "@/features/pricing/config";

// Lấy cấu hình giá đang áp dụng từ server để ước tính trên giao diện khớp báo giá thật.
// Trong lúc chờ (hoặc khi lỗi) dùng giá trị mặc định; server luôn tính lại giá khi tạo đơn.
let cached: PricingConfigValues | null = null;
let inflight: Promise<PricingConfigValues> | null = null;

function loadPricingConfig(): Promise<PricingConfigValues> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch("/api/pricing-config")
      .then((res) => res.json())
      .then((data) => {
        const validated = validatePricingConfig(data?.pricing);
        cached = validated.ok ? validated.value : DEFAULT_PRICING_CONFIG;
        return cached;
      })
      .catch(() => DEFAULT_PRICING_CONFIG)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function usePricingConfig(): PricingConfigValues {
  const [config, setConfig] = useState<PricingConfigValues>(cached ?? DEFAULT_PRICING_CONFIG);
  useEffect(() => {
    let active = true;
    loadPricingConfig().then((value) => { if (active) setConfig(value); });
    return () => { active = false; };
  }, []);
  return config;
}
