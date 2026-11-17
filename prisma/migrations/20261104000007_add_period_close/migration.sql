-- CreateTable
CREATE TABLE IF NOT EXISTS "PeriodClose" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedBy" TEXT NOT NULL,
    "totalGmvVnd" BIGINT NOT NULL DEFAULT 0,
    "totalRevenueVnd" BIGINT NOT NULL DEFAULT 0,
    "totalCostVnd" BIGINT NOT NULL DEFAULT 0,
    "grossProfitVnd" BIGINT NOT NULL DEFAULT 0,
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodClose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PeriodClose_period_key" ON "PeriodClose"("period");
CREATE INDEX IF NOT EXISTS "PeriodClose_period_idx" ON "PeriodClose"("period");

