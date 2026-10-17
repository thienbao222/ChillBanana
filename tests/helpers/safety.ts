// Chốt an toàn dùng chung cho integration test và E2E: các bài test này XÓA toàn bộ dữ liệu.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function assertSafeTestDatabase(): void {
  let host = "";
  try {
    host = new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    /* host trống sẽ bị từ chối bên dưới */
  }
  if (!LOCAL_HOSTS.has(host) && process.env.ALLOW_TEST_DB_RESET !== "1") {
    throw new Error(
      `[TEST SAFETY] DATABASE_URL (host "${host || "trống"}") không trỏ về máy cục bộ. ` +
        "Test sẽ XÓA toàn bộ dữ liệu nên bị từ chối. " +
        "Dùng PostgreSQL cục bộ/Docker, hoặc đặt ALLOW_TEST_DB_RESET=1 nếu CHẮC CHẮN đây là database test riêng."
    );
  }
  if (process.env.VERCEL_ENV === "production" || process.env.APP_ENV === "production") {
    throw new Error("[TEST SAFETY] Không chạy test trong môi trường production.");
  }
}
