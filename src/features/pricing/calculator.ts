import { MIN_ORDER_THRESHOLD_VND } from "@/features/orders/policy";
import { DEFAULT_PRICING_CONFIG, type PricingConfigValues } from "@/features/pricing/config";

export const DEFAULT_EXCHANGE_RATE = 172;
// Giá trị mặc định. Giá đang áp dụng thật được đọc từ PricingConfig (database) và truyền vào calculateOrderPrice.
export const AIR_SHIPPING_PER_KG = DEFAULT_PRICING_CONFIG.airShippingPerKgVnd;
export const SERVICE_FEE_RATE = DEFAULT_PRICING_CONFIG.serviceFeeRate;
export const GROUP_BUY_SHIPPING_DISCOUNT_RATE = DEFAULT_PRICING_CONFIG.groupBuyDiscountRate;
export const GROUP_BUY_MAX_WEIGHT_KG = DEFAULT_PRICING_CONFIG.groupBuyMaxWeightKg;
export { MIN_ORDER_THRESHOLD_VND };

/** Canonical estimate used by the storefront and APIs. Actual orders are recalculated server-side. */
export function calculateOrderPrice(
  priceJpy: number,
  weightKg = 0,
  exchangeRate = DEFAULT_EXCHANGE_RATE,
  isGroupBuy = false,
  config: PricingConfigValues = DEFAULT_PRICING_CONFIG
) {
  const productPriceVnd = Math.round(priceJpy * exchangeRate);
  const serviceFeeVnd = Math.max(config.minServiceFeeVnd, Math.round(productPriceVnd * config.serviceFeeRate));
  const baseOrderCostVnd = productPriceVnd + serviceFeeVnd;
  const deposit50Vnd = Math.round(baseOrderCostVnd * 0.5);

  let shippingFeeVnd = 0;
  if (weightKg > 0) {
    const shippingRate = isGroupBuy && weightKg <= config.groupBuyMaxWeightKg
      ? Math.round(config.airShippingPerKgVnd * (1 - config.groupBuyDiscountRate))
      : config.airShippingPerKgVnd;
    shippingFeeVnd = Math.round(weightKg * shippingRate);
  }

  const totalVnd = baseOrderCostVnd + shippingFeeVnd;
  const isUnderMinOrder = baseOrderCostVnd < config.minOrderThresholdVnd;
  const minOrderDiffVnd = Math.max(0, config.minOrderThresholdVnd - baseOrderCostVnd);

  return {
    priceJpy,
    exchangeRate,
    productPriceVnd,
    serviceFeeVnd,
    baseOrderCostVnd,
    shippingFeeVnd,
    weightKg,
    totalVnd,
    deposit50Vnd,
    isUnderMinOrder,
    minOrderDiffVnd,
    canGroupBuy: weightKg <= 0.8 || isUnderMinOrder,
  };
}
