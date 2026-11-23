import { MIN_ORDER_THRESHOLD_VND } from "@/features/orders/policy";

export const DEFAULT_EXCHANGE_RATE = 172;
export const AIR_SHIPPING_PER_KG = 185000;
export const SERVICE_FEE_TIER1_RATE = 0.06; // 6% cho 5 triệu đầu
export const SERVICE_FEE_TIER2_RATE = 0.05; // 5% cho phần vượt trên 5 triệu (Đặc quyền VIP)
export const SERVICE_FEE_TIER1_THRESHOLD_VND = 5_000_000;
export const SERVICE_FEE_MINIMUM_VND = 80_000;
export const SERVICE_FEE_RATE = SERVICE_FEE_TIER1_RATE; // Giữ hằng số tương thích ngược
export const GROUP_BUY_SHIPPING_DISCOUNT_RATE = 0.25;
export const GROUP_BUY_MAX_WEIGHT_KG = 0.5;
export { MIN_ORDER_THRESHOLD_VND };

export interface ProgressiveServiceFeeBreakdown {
  totalFeeVnd: number;
  tier1BaseVnd: number;
  tier1RatePercent: number;
  tier1FeeVnd: number;
  tier2BaseVnd: number;
  tier2RatePercent: number;
  tier2FeeVnd: number;
  appliedMinimumFloor: boolean;
  isVipEligible: boolean;
  remainingToVipVnd: number;
}

/**
 * Tính toán phí dịch vụ mua hộ theo mô hình lũy tiến 2 bậc (Progressive Service Fee):
 * - Bậc 1 (<= 5.000.000 đ): 6% tiền hàng (sàn tối thiểu 80.000 đ).
 * - Bậc 2 (> 5.000.000 đ): 5 triệu đầu tính 6% (300.000 đ), phần tiền hàng vượt trên 5 triệu tính ưu đãi VIP 5%.
 */
export function calculateProgressiveServiceFee(
  productPriceVnd: number,
  tier1Rate = SERVICE_FEE_TIER1_RATE,
  tier2Rate = SERVICE_FEE_TIER2_RATE,
  thresholdVnd = SERVICE_FEE_TIER1_THRESHOLD_VND,
  minFloorVnd = SERVICE_FEE_MINIMUM_VND
): ProgressiveServiceFeeBreakdown {
  const safePrice = Math.max(0, Math.round(productPriceVnd));
  const tier1BaseVnd = Math.min(safePrice, thresholdVnd);
  const tier2BaseVnd = Math.max(0, safePrice - thresholdVnd);
  const isVipEligible = tier2BaseVnd > 0;
  const remainingToVipVnd = Math.max(0, thresholdVnd - safePrice);

  const tier1RawFee = Math.round(tier1BaseVnd * tier1Rate);
  const tier2FeeVnd = Math.round(tier2BaseVnd * tier2Rate);
  const totalRawFee = tier1RawFee + tier2FeeVnd;

  const appliedMinimumFloor = totalRawFee < minFloorVnd;
  const totalFeeVnd = appliedMinimumFloor ? minFloorVnd : totalRawFee;
  const tier1FeeVnd = appliedMinimumFloor ? minFloorVnd : tier1RawFee;

  return {
    totalFeeVnd,
    tier1BaseVnd,
    tier1RatePercent: Math.round(tier1Rate * 100),
    tier1FeeVnd,
    tier2BaseVnd,
    tier2RatePercent: Math.round(tier2Rate * 100),
    tier2FeeVnd,
    appliedMinimumFloor,
    isVipEligible,
    remainingToVipVnd,
  };
}

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
  serviceFeePercent: SERVICE_FEE_TIER1_RATE * 100, // 6%
  serviceFeeMinimumVnd: SERVICE_FEE_MINIMUM_VND,   // 80.000 đ
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
  
  // Tính phí dịch vụ theo cơ chế phân bậc lũy tiến (6% cho 5M đầu, 5% cho phần vượt)
  const serviceFeeBreakdown = calculateProgressiveServiceFee(
    productPriceVnd,
    (config.serviceFeePercent ?? 6) / 100,
    SERVICE_FEE_TIER2_RATE,
    SERVICE_FEE_TIER1_THRESHOLD_VND,
    config.serviceFeeMinimumVnd ?? SERVICE_FEE_MINIMUM_VND
  );
  const serviceFeeVnd = serviceFeeBreakdown.totalFeeVnd;

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
    serviceFeeBreakdown,
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
