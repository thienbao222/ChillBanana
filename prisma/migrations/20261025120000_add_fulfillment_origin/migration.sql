-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "fulfillmentOrigin" TEXT NOT NULL DEFAULT 'JP';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "fulfillmentOrigin" TEXT NOT NULL DEFAULT 'JP';
