-- WP3.1: Thêm cột belowMargin để gắn cờ rào chắn lỗ (CHỈ THÊM)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "belowMargin" BOOLEAN DEFAULT false;

