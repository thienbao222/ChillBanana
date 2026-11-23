-- WP2.1: Mở rộng PaymentTransaction cho thanh toán đảo và thêm bảng OrderCostLine cho chi phí thực tế (CHỈ THÊM)

-- 1. Thêm các trường mới vào PaymentTransaction
ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'LEGACY';
ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "reversalOfId" TEXT;
ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3);
ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "shipmentId" TEXT;

-- 2. Tạo indexes cho PaymentTransaction
CREATE INDEX IF NOT EXISTS "PaymentTransaction_kind_idx" ON "PaymentTransaction"("kind");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_reversalOfId_idx" ON "PaymentTransaction"("reversalOfId");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_shipmentId_idx" ON "PaymentTransaction"("shipmentId");

-- 3. Tạo Foreign Key tự tham chiếu cho PaymentTransaction (reversalOfId)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PaymentTransaction_reversalOfId_fkey'
    ) THEN
        ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_reversalOfId_fkey" 
            FOREIGN KEY ("reversalOfId") REFERENCES "PaymentTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- 4. Tạo bảng OrderCostLine
CREATE TABLE IF NOT EXISTS "OrderCostLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "purchaseTaskId" TEXT,
    "category" TEXT NOT NULL,
    "amountOriginal" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "fxRate" DOUBLE PRECISION,
    "amountVnd" INTEGER NOT NULL,
    "note" TEXT,
    "receiptUrl" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "shipmentId" TEXT,

    CONSTRAINT "OrderCostLine_pkey" PRIMARY KEY ("id")
);

-- 5. Tạo indexes cho OrderCostLine
CREATE INDEX IF NOT EXISTS "OrderCostLine_orderId_category_idx" ON "OrderCostLine"("orderId", "category");
CREATE INDEX IF NOT EXISTS "OrderCostLine_category_idx" ON "OrderCostLine"("category");
CREATE INDEX IF NOT EXISTS "OrderCostLine_shipmentId_idx" ON "OrderCostLine"("shipmentId");
CREATE INDEX IF NOT EXISTS "OrderCostLine_purchaseTaskId_idx" ON "OrderCostLine"("purchaseTaskId");

-- 6. Tạo Foreign Keys cho OrderCostLine
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'OrderCostLine_orderId_fkey'
    ) THEN
        ALTER TABLE "OrderCostLine" ADD CONSTRAINT "OrderCostLine_orderId_fkey" 
            FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'OrderCostLine_purchaseTaskId_fkey'
    ) THEN
        ALTER TABLE "OrderCostLine" ADD CONSTRAINT "OrderCostLine_purchaseTaskId_fkey" 
            FOREIGN KEY ("purchaseTaskId") REFERENCES "PurchaseTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

