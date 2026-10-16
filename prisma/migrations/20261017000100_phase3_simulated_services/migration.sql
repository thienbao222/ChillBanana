-- Preserve the existing pricing assumptions as the first immutable config version.
CREATE TABLE "PricingConfig" (
    "version" SERIAL NOT NULL,
    "values" JSONB NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PricingConfig_pkey" PRIMARY KEY ("version")
);

INSERT INTO "PricingConfig" ("version", "values", "changedBy", "changeReason")
VALUES (
  1,
  '{"serviceFeePercent":4,"serviceFeeMinimumVnd":20000,"airShippingPerKgVnd":185000,"groupBuyShippingDiscountPercent":25,"groupBuyMaxWeightKg":0.5,"minimumBaseOrderVnd":300000,"fallbackJpyVndRate":172,"usdVndReferenceRate":25400}'::jsonb,
  'system',
  'Initial snapshot of the existing application pricing constants'
);
SELECT setval('"PricingConfig_version_seq"', 1, true);

ALTER TABLE "Order" ADD COLUMN "pricingConfigVersion" INTEGER;
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_pricingConfigVersion_fkey"
  FOREIGN KEY ("pricingConfigVersion") REFERENCES "PricingConfig"("version")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PricingConfig_createdAt_idx" ON "PricingConfig"("createdAt");

CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "amountVnd" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "idempotencyKey" TEXT NOT NULL,
    "providerReference" TEXT,
    "failureCode" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PaymentAttempt_idempotencyKey_key" ON "PaymentAttempt"("idempotencyKey");
CREATE INDEX "PaymentAttempt_orderId_createdAt_idx" ON "PaymentAttempt"("orderId", "createdAt");
CREATE INDEX "PaymentAttempt_status_expiresAt_idx" ON "PaymentAttempt"("status", "expiresAt");

CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "emailType" TEXT NOT NULL,
    "payload" JSONB,
    "providerMode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastErrorCode" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EmailLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "EmailLog_status_nextRetryAt_idx" ON "EmailLog"("status", "nextRetryAt");
CREATE INDEX "EmailLog_orderId_createdAt_idx" ON "EmailLog"("orderId", "createdAt");
