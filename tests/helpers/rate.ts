export type RateData = {
  rate: number;
  roundedRate: number;
  previousRate: number;
  changePercent: number;
  updatedAt: string;
  source: string;
  isFallback: boolean;
  isStale: boolean;
  isVolatile: boolean;
};

export function freshRate(value = 170): RateData {
  return {
    rate: value,
    roundedRate: value,
    previousRate: value,
    changePercent: 0,
    updatedAt: new Date().toISOString(),
    source: "test-fixed-rate",
    isFallback: false,
    isStale: false,
    isVolatile: false,
  };
}

export function staleRate(value = 172): RateData {
  return { ...freshRate(value), source: "fallback", isFallback: true, isStale: true };
}
