import {
  type PricingConfigValues,
  DEFAULT_PRICING_CONFIG,
  calculateOrderPrice,
} from "./calculator";

/**
 * Giả định chi phí thực tế cho bộ mô phỏng đơn vị kinh tế (Unit Economics).
 * Mặc định theo giả định minh họa:
 *   - Chi phí đổi ngoại tệ: 1.2% tiền hàng
 *   - Xử lý kho Tokyo: 300 ¥/đơn
 *   - Cước bay quốc tế Tokyo → VN: 130.000 đ/kg
 *   - Phí cổng thanh toán trực tuyến: 1.5% tiền cọc
 *   - Giao hàng nội địa kèm thu hộ COD: 35.000 đ
 *   - Rào chắn lỗ tối thiểu: max(15.000 đ, 3% GMV)
 *
 * GHI CHÚ QUAN TRỌNG: Mọi số liệu trong này là giả định minh họa kỹ thuật.
 * Chủ doanh nghiệp cần thay bằng báo giá thương thảo thực tế với đối tác.
 */
export interface CostAssumptions {
  fxFeePercent: number;              // Mặc định 1.2 (%)
  tokyoHandlingFeeJpy: number;       // Mặc định 300 (JPY)
  actualAirShippingPerKgVnd: number; // Mặc định 130,000 (VND/kg)
  paymentGatewayFeePercent: number;  // Mặc định 1.5 (%)
  vnDomesticDeliveryVnd: number;     // Mặc định 35,000 (VND)
  minTargetMarginVnd: number;        // Mặc định 15,000 (VND)
  minTargetMarginGmvPercent: number; // Mặc định 3 (%)
}

export const DEFAULT_COST_ASSUMPTIONS: CostAssumptions = {
  fxFeePercent: 1.2,
  tokyoHandlingFeeJpy: 300,
  actualAirShippingPerKgVnd: 130_000,
  paymentGatewayFeePercent: 1.5,
  vnDomesticDeliveryVnd: 35_000,
  minTargetMarginVnd: 15_000,
  minTargetMarginGmvPercent: 3,
};

export interface MarginEstimateResult {
  productPriceVnd: number;
  serviceFeeVnd: number;
  shippingFeeVnd: number;
  totalVnd: number;
  companyRevenueVnd: number;
  estimatedCosts: {
    fxCostVnd: number;
    tokyoHandlingVnd: number;
    actualFreightVnd: number;
    vnDeliveryVnd: number;
    paymentFeeVnd: number;
    totalCostVnd: number;
  };
  grossProfitVnd: number;
  marginPercentOfGmv: number;
  targetMarginThresholdVnd: number;
  isBelowMargin: boolean;
}

/**
 * Hàm thuần tính toán ước lượng biên đóng góp / lãi gộp của đơn hàng (Unit Economics).
 */
export function estimateMargin(
  order: {
    priceJpy: number;
    weightKg: number;
    exchangeRate?: number;
    isGroupBuy?: boolean;
    fulfillmentOrigin?: string;
  },
  costAssumptions: CostAssumptions = DEFAULT_COST_ASSUMPTIONS,
  pricing: PricingConfigValues = DEFAULT_PRICING_CONFIG
): MarginEstimateResult {
  const exchangeRate = order.exchangeRate ?? pricing.fallbackJpyVndRate;
  const priceDetails = calculateOrderPrice(
    order.priceJpy,
    order.weightKg,
    exchangeRate,
    order.isGroupBuy ?? false,
    pricing,
    order.fulfillmentOrigin ?? "JP"
  );

  const productPriceVnd = priceDetails.productPriceVnd;
  const serviceFeeVnd = priceDetails.serviceFeeVnd;
  const shippingFeeVnd = priceDetails.shippingFeeVnd;
  const totalVnd = priceDetails.totalVnd;
  const deposit50Vnd = priceDetails.deposit50Vnd;

  // 1. Doanh thu dịch vụ của công ty = Phí dịch vụ mua hộ + Cước bay thu từ khách
  const companyRevenueVnd = serviceFeeVnd + shippingFeeVnd;

  // 2. Chi phí vận hành ước tính
  const fxCostVnd = Math.round((productPriceVnd * costAssumptions.fxFeePercent) / 100);
  const tokyoHandlingVnd =
    order.fulfillmentOrigin === "VN"
      ? 0
      : Math.round(costAssumptions.tokyoHandlingFeeJpy * exchangeRate);
  const actualFreightVnd =
    order.fulfillmentOrigin === "VN"
      ? 0
      : Math.round(order.weightKg * costAssumptions.actualAirShippingPerKgVnd);
  const vnDeliveryVnd = costAssumptions.vnDomesticDeliveryVnd;
  const paymentFeeVnd = Math.round(
    (deposit50Vnd * costAssumptions.paymentGatewayFeePercent) / 100
  );

  const totalCostVnd =
    fxCostVnd + tokyoHandlingVnd + actualFreightVnd + vnDeliveryVnd + paymentFeeVnd;

  // 3. Lãi gộp = Doanh thu công ty - Chi phí vận hành ước tính
  const grossProfitVnd = companyRevenueVnd - totalCostVnd;

  // 4. % Lãi trên GMV
  const marginPercentOfGmv =
    productPriceVnd > 0
      ? Number(((grossProfitVnd / productPriceVnd) * 100).toFixed(2))
      : 0;

  // 5. Ngưỡng rào chắn lỗ = max(15.000đ, 3% GMV)
  const targetMarginThresholdVnd = Math.max(
    costAssumptions.minTargetMarginVnd,
    Math.round((productPriceVnd * costAssumptions.minTargetMarginGmvPercent) / 100)
  );

  const isBelowMargin = grossProfitVnd < targetMarginThresholdVnd;

  return {
    productPriceVnd,
    serviceFeeVnd,
    shippingFeeVnd,
    totalVnd,
    companyRevenueVnd,
    estimatedCosts: {
      fxCostVnd,
      tokyoHandlingVnd,
      actualFreightVnd,
      vnDeliveryVnd,
      paymentFeeVnd,
      totalCostVnd,
    },
    grossProfitVnd,
    marginPercentOfGmv,
    targetMarginThresholdVnd,
    isBelowMargin,
  };
}

