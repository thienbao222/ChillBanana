import { MIN_ORDER_THRESHOLD_VND } from "@/features/orders/policy";

export const DEFAULT_EXCHANGE_RATE = 172;
export const AIR_SHIPPING_PER_KG = 185000;
export const SERVICE_FEE_RATE = 0.04;
export const GROUP_BUY_SHIPPING_DISCOUNT_RATE = 0.25;
export const GROUP_BUY_MAX_WEIGHT_KG = 0.5;
export { MIN_ORDER_THRESHOLD_VND };

/** Canonical estimate used by the storefront and APIs. Actual orders are recalculated server-side. */
export function calculateOrderPrice(
  priceJpy: number,
  weightKg = 0,
  exchangeRate = DEFAULT_EXCHANGE_RATE,
  isGroupBuy = false
) {
  const productPriceVnd = Math.round(priceJpy * exchangeRate);
  const serviceFeeVnd = Math.max(20_000, Math.round(productPriceVnd * SERVICE_FEE_RATE));
  const baseOrderCostVnd = productPriceVnd + serviceFeeVnd;
  const deposit50Vnd = Math.round(baseOrderCostVnd * 0.5);

  let shippingFeeVnd = 0;
  if (weightKg > 0) {
    const shippingRate = isGroupBuy && weightKg <= GROUP_BUY_MAX_WEIGHT_KG
      ? Math.round(AIR_SHIPPING_PER_KG * (1 - GROUP_BUY_SHIPPING_DISCOUNT_RATE))
      : AIR_SHIPPING_PER_KG;
    shippingFeeVnd = Math.round(weightKg * shippingRate);
  }

  const totalVnd = baseOrderCostVnd + shippingFeeVnd;
  const isUnderMinOrder = baseOrderCostVnd < MIN_ORDER_THRESHOLD_VND;
  const minOrderDiffVnd = Math.max(0, MIN_ORDER_THRESHOLD_VND - baseOrderCostVnd);

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
