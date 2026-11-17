-- CreateTable
CREATE TABLE IF NOT EXISTS "Campaign" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "marketplace" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "minParticipants" INTEGER NOT NULL DEFAULT 1,
    "maxSlots" INTEGER,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CampaignItem" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceJpy" INTEGER NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "maxSlots" INTEGER,
    "claimedSlots" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "originalUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CampaignEntry" (
    "id" TEXT NOT NULL,
    "campaignItemId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Campaign_slug_key" ON "Campaign"("slug");
CREATE INDEX IF NOT EXISTS "Campaign_status_idx" ON "Campaign"("status");
CREATE INDEX IF NOT EXISTS "Campaign_slug_idx" ON "Campaign"("slug");
CREATE INDEX IF NOT EXISTS "Campaign_closesAt_idx" ON "Campaign"("closesAt");

CREATE INDEX IF NOT EXISTS "CampaignItem_campaignId_idx" ON "CampaignItem"("campaignId");

CREATE UNIQUE INDEX IF NOT EXISTS "CampaignEntry_orderItemId_key" ON "CampaignEntry"("orderItemId");
CREATE INDEX IF NOT EXISTS "CampaignEntry_campaignItemId_idx" ON "CampaignEntry"("campaignItemId");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CampaignItem_campaignId_fkey') THEN
        ALTER TABLE "CampaignItem" ADD CONSTRAINT "CampaignItem_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CampaignEntry_campaignItemId_fkey') THEN
        ALTER TABLE "CampaignEntry" ADD CONSTRAINT "CampaignEntry_campaignItemId_fkey" FOREIGN KEY ("campaignItemId") REFERENCES "CampaignItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CampaignEntry_orderItemId_fkey') THEN
        ALTER TABLE "CampaignEntry" ADD CONSTRAINT "CampaignEntry_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

