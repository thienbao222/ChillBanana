-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "pricingSnapshot" JSONB;

-- CreateTable
CREATE TABLE "PricingConfig" (
    "id" TEXT NOT NULL,
    "serviceFeeRate" DOUBLE PRECISION NOT NULL,
    "minServiceFeeVnd" INTEGER NOT NULL,
    "airShippingPerKgVnd" INTEGER NOT NULL,
    "groupBuyDiscountRate" DOUBLE PRECISION NOT NULL,
    "groupBuyMaxWeightKg" DOUBLE PRECISION NOT NULL,
    "minOrderThresholdVnd" INTEGER NOT NULL,
    "reservationMinutes" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRateSnapshot" (
    "id" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "roundedRate" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRateSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "orderCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PricingConfig_effectiveFrom_idx" ON "PricingConfig"("effectiveFrom");

-- CreateIndex
CREATE INDEX "ExchangeRateSnapshot_fetchedAt_idx" ON "ExchangeRateSnapshot"("fetchedAt");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_status_createdAt_idx" ON "EmailLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_orderCode_idx" ON "EmailLog"("orderCode");
