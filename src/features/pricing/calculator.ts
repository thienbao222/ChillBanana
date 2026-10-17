import { MIN_ORDER_THRESHOLD_VND } from "@/features/orders/policy";

export const DEFAULT_EXCHANGE_RATE = 172;
export const AIR_SHIPPING_PER_KG = 185000;
export const SERVICE_FEE_RATE = 0.04;
export const SERVICE_FEE_MINIMUM_VND = 20_000;
export const GROUP_BUY_SHIPPING_DISCOUNT_RATE = 0.25;
export const GROUP_BUY_MAX_WEIGHT_KG = 0.5;
export { MIN_ORDER_THRESHOLD_VND };

export type PricingConfigValues = {
  serviceFeePercent: number;
  serviceFeeMinimumVnd: number;
  airShippingPerKgVnd: number;
  groupBuyShippingDiscountPercent: number;
  groupBuyMaxWeightKg: number;
  minimumBaseOrderVnd: number;
  fallbackJpyVndRate: number;
  usdVndReferenceRate: number;
};

export const DEFAULT_PRICING_CONFIG: PricingConfigValues = {
  serviceFeePercent: SERVICE_FEE_RATE * 100,
  serviceFeeMinimumVnd: SERVICE_FEE_MINIMUM_VND,
  airShippingPerKgVnd: AIR_SHIPPING_PER_KG,
  groupBuyShippingDiscountPercent: GROUP_BUY_SHIPPING_DISCOUNT_RATE * 100,
  groupBuyMaxWeightKg: GROUP_BUY_MAX_WEIGHT_KG,
  minimumBaseOrderVnd: MIN_ORDER_THRESHOLD_VND,
  fallbackJpyVndRate: DEFAULT_EXCHANGE_RATE,
  usdVndReferenceRate: 25_400,
};

/** Canonical estimate used by the storefront and APIs. Actual orders are recalculated server-side. */
export function calculateOrderPrice(
  priceJpy: number,
  weightKg = 0,
  exchangeRate = DEFAULT_EXCHANGE_RATE,
  isGroupBuy = false,
  config: PricingConfigValues = DEFAULT_PRICING_CONFIG
) {
  const productPriceVnd = Math.round(priceJpy * exchangeRate);
  const serviceFeeVnd = Math.max(config.serviceFeeMinimumVnd, Math.round(productPriceVnd * config.serviceFeePercent / 100));
  const baseOrderCostVnd = productPriceVnd + serviceFeeVnd;
  const deposit50Vnd = Math.round(baseOrderCostVnd * 0.5);

  let shippingFeeVnd = 0;
  if (weightKg > 0) {
    const shippingRate = isGroupBuy && weightKg <= config.groupBuyMaxWeightKg
      ? Math.round(config.airShippingPerKgVnd * (1 - config.groupBuyShippingDiscountPercent / 100))
      : config.airShippingPerKgVnd;
    shippingFeeVnd = Math.round(weightKg * shippingRate);
  }

  const totalVnd = baseOrderCostVnd + shippingFeeVnd;
  const isUnderMinOrder = baseOrderCostVnd < config.minimumBaseOrderVnd;
  const minOrderDiffVnd = Math.max(0, config.minimumBaseOrderVnd - baseOrderCostVnd);

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
