-- AlterTable
ALTER TABLE "VnJpShipment" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "VnJpShipment" ADD COLUMN IF NOT EXISTS "consentAt" TIMESTAMP(3);
ALTER TABLE "VnJpShipment" ADD COLUMN IF NOT EXISTS "consentVersion" TEXT;
ALTER TABLE "VnJpShipment" ADD COLUMN IF NOT EXISTS "maffAcknowledgedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VnJpShipment_customerId_idx" ON "VnJpShipment"("customerId");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VnJpShipment_customerId_fkey') THEN
        ALTER TABLE "VnJpShipment" ADD CONSTRAINT "VnJpShipment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

