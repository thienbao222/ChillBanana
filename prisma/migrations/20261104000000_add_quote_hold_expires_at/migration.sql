-- AlterTable
ALTER TABLE "Order" ADD COLUMN "quoteHoldExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_status_paymentStatus_quoteHoldExpiresAt_idx" ON "Order"("status", "paymentStatus", "quoteHoldExpiresAt");

