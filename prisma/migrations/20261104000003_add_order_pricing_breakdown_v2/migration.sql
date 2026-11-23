-- WP3.2: Mở rộng các trường chi tiết cấu trúc giá trên Order (CHỈ THÊM)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "handlingFeeVnd" INTEGER DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "fxFeeVnd" INTEGER DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "taxEstimateVnd" INTEGER DEFAULT 0;

