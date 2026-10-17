import { prisma } from "@/lib/prisma";

const TABLES = [
  "PaymentTransaction",
  "PaymentAttempt",
  "EmailLog",
  "PricingConfig",
  "TrackingLog",
  "OrderItem",
  "PurchaseTask",
  "Order",
  "ChatMessage",
  "ChatSession",
  "Product",
  "News",
  "AdminUser",
  "AdminDailyInsight",
  "Customer",
  "RateLimit",
  "AuditLog",
];

/** Xóa sạch dữ liệu giữa các test. Chỉ gọi sau khi integration-setup đã kiểm tra DATABASE_URL. */
export async function resetDb(): Promise<void> {
  const list = TABLES.map((t) => `"${t}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}

export { prisma };
