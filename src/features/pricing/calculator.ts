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
  fxSpreadPercent?: number;
  groupBuyEnabled?: boolean;

  // WP3.2 extensions:
  handlingFeeVnd?: number;         // Phí xử lý cố định (VND, mặc định 0)
  fxFeePercent?: number;           // Phí chuyển đổi ngoại tệ hiển thị dòng riêng (%, mặc định 0)
  minBillableWeightKg?: number;    // Cân tính cước tối thiểu (kg, mặc định 0)
  taxEstimateEnabled?: boolean;    // Cờ hiển thị ước tính thuế (mặc định false)
  vatPercent?: number;             // Thuế GTGT ước tính (%, mặc định 0)
  importTaxPercent?: number;       // Thuế nhập khẩu ước tính (%, mặc định 0)
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
  fxSpreadPercent: 0,
  handlingFeeVnd: 0,
  fxFeePercent: 0,
  minBillableWeightKg: 0,
  taxEstimateEnabled: false,
  vatPercent: 0,
  importTaxPercent: 0,
};

export interface PricingBreakdown {
  goods: number;
  serviceFee: number;
  handlingFee: number;
  fxFee: number;
  shipping: number;
  billableWeightKg: number;
  taxEstimate: number;
  total: number;
}

/** Canonical estimate used by the storefront and APIs. Actual orders are recalculated server-side. */
export function calculateOrderPrice(
  priceJpy: number,
  weightKg = 0,
  exchangeRate = DEFAULT_EXCHANGE_RATE,
  isGroupBuy = false,
  config: PricingConfigValues = DEFAULT_PRICING_CONFIG,
  fulfillmentOrigin: string = "JP"
) {
  const productPriceVnd = Math.round(priceJpy * exchangeRate);
  const serviceFeeVnd = Math.max(
    config.serviceFeeMinimumVnd,
    Math.round((productPriceVnd * config.serviceFeePercent) / 100)
  );

  // WP3.2 extensions:
  const handlingFeeVnd = Math.round(config.handlingFeeVnd ?? 0);
  const fxFeeVnd = Math.round((productPriceVnd * (config.fxFeePercent ?? 0)) / 100);

  const baseOrderCostVnd = productPriceVnd + serviceFeeVnd + handlingFeeVnd + fxFeeVnd;
  const deposit50Vnd = Math.round(baseOrderCostVnd * 0.5);

  let shippingFeeVnd = 0;
  let billableWeightKg = weightKg;

  // Hàng sẵn tại kho Việt Nam không phát sinh cước bay quốc tế Tokyo ⇄ VN
  if (weightKg > 0 && fulfillmentOrigin !== "VN") {
    // Áp dụng cân tối thiểu tính cước (minBillableWeightKg) nếu được cấu hình
    billableWeightKg = Math.max(weightKg, config.minBillableWeightKg ?? 0);

    // WP1.2: calculator bỏ qua isGroupBuy khi cấu hình groupBuyEnabled bị tắt (false)
    const isEffectiveGroupBuy = config.groupBuyEnabled === false ? false : Boolean(isGroupBuy);
    const shippingRate =
      isEffectiveGroupBuy && billableWeightKg <= config.groupBuyMaxWeightKg
        ? Math.round(config.airShippingPerKgVnd * (1 - config.groupBuyShippingDiscountPercent / 100))
        : config.airShippingPerKgVnd;
    shippingFeeVnd = Math.round(billableWeightKg * shippingRate);
  }

  // Thuế ước tính (nếu bật cấu hình taxEstimateEnabled)
  let taxEstimateVnd = 0;
  if (config.taxEstimateEnabled) {
    const vatVnd = Math.round((productPriceVnd * (config.vatPercent ?? 0)) / 100);
    const importTaxVnd = Math.round((productPriceVnd * (config.importTaxPercent ?? 0)) / 100);
    taxEstimateVnd = vatVnd + importTaxVnd;
  }

  const totalVnd = baseOrderCostVnd + shippingFeeVnd + taxEstimateVnd;
  const isUnderMinOrder = baseOrderCostVnd < config.minimumBaseOrderVnd;
  const minOrderDiffVnd = Math.max(0, config.minimumBaseOrderVnd - baseOrderCostVnd);

  const breakdown: PricingBreakdown = {
    goods: productPriceVnd,
    serviceFee: serviceFeeVnd,
    handlingFee: handlingFeeVnd,
    fxFee: fxFeeVnd,
    shipping: shippingFeeVnd,
    billableWeightKg,
    taxEstimate: taxEstimateVnd,
    total: totalVnd,
  };

  return {
    priceJpy,
    exchangeRate,
    productPriceVnd,
    serviceFeeVnd,
    handlingFeeVnd,
    fxFeeVnd,
    taxEstimateVnd,
    baseOrderCostVnd,
    shippingFeeVnd,
    weightKg,
    billableWeightKg,
    totalVnd,
    deposit50Vnd,
    isUnderMinOrder,
    minOrderDiffVnd,
    canGroupBuy: weightKg <= 0.8 || isUnderMinOrder,
    fulfillmentOrigin,
    breakdown,
  };
}
