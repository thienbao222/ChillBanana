-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "quoteSource" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "quoteVerifiedAt" TIMESTAMP(3);
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "quoteVerifiedBy" TEXT;

-- Dữ liệu cũ: catalog gán CATALOG, external gán SCRAPE
UPDATE "OrderItem" SET "quoteSource" = 'CATALOG', "quoteVerifiedAt" = "createdAt", "quoteVerifiedBy" = 'SYSTEM_MIGRATION' WHERE "itemType" = 'CATALOG' AND "quoteSource" IS NULL;
UPDATE "OrderItem" SET "quoteSource" = 'SCRAPE' WHERE "itemType" = 'EXTERNAL' AND "quoteSource" IS NULL;

