-- CreateTable
CREATE TABLE "VnJpShipment" (
    "id" TEXT NOT NULL,
    "trackingCode" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderPhone" TEXT NOT NULL,
    "senderAddress" TEXT NOT NULL,
    "senderCity" TEXT NOT NULL DEFAULT 'Hà Nội',
    "pickupDate" TEXT,
    "receiverName" TEXT NOT NULL,
    "receiverPhone" TEXT NOT NULL,
    "receiverPostalCode" TEXT NOT NULL,
    "receiverPrefecture" TEXT NOT NULL,
    "receiverAddress" TEXT NOT NULL,
    "cargoType" TEXT NOT NULL,
    "cargoDetails" TEXT NOT NULL,
    "estimatedWeightKg" DOUBLE PRECISION NOT NULL,
    "actualWeightKg" DOUBLE PRECISION,
    "dimensionLengthCm" DOUBLE PRECISION,
    "dimensionWidthCm" DOUBLE PRECISION,
    "dimensionHeightCm" DOUBLE PRECISION,
    "chargeableWeightKg" DOUBLE PRECISION,
    "unitPricePerKg" INTEGER NOT NULL,
    "totalShippingFeeVnd" INTEGER NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "maffAgreement" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "dispatcherNote" TEXT,
    "flightNumber" TEXT,
    "japanCourier" TEXT DEFAULT 'Yamato Transport',
    "japanTrackingCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VnJpShipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VnJpShipment_trackingCode_key" ON "VnJpShipment"("trackingCode");

-- CreateIndex
CREATE INDEX "VnJpShipment_status_idx" ON "VnJpShipment"("status");

-- CreateIndex
CREATE INDEX "VnJpShipment_trackingCode_idx" ON "VnJpShipment"("trackingCode");

-- CreateIndex
CREATE INDEX "VnJpShipment_senderPhone_idx" ON "VnJpShipment"("senderPhone");

-- CreateIndex
CREATE INDEX "VnJpShipment_createdAt_idx" ON "VnJpShipment"("createdAt");
