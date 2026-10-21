const { PrismaClient } = require("@prisma/client");

async function main() {
  const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!dbUrl) return;
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  try {
    await prisma.$executeRawUnsafe(`
      SELECT pg_terminate_backend(pid)
      FROM pg_locks
      WHERE locktype = 'advisory' AND objid = 72707369 AND pid <> pg_backend_pid();
    `);
  } catch (_err) {
    // Non-blocking
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch(() => {});
