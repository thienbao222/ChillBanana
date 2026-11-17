/**
 * Kiểm tra xem chế độ tự phục hồi (Self-Healing) cho tài khoản admin demo có được kích hoạt hay không.
 *
 * QUY TẮC BẢO MẬT:
 * - Chỉ trả về true DUY NHẤT khi cờ ENABLE_DEMO_SELF_HEAL được cấu hình là 'true'
 *   VÀ môi trường chạy hiện tại (APP_ENV) được chỉ định rõ ràng là 'demo'.
 * - Trên môi trường production, staging hoặc development, hàm này luôn trả về false.
 */
export function isDemoSelfHealEnabled(): boolean {
  return (
    process.env.ENABLE_DEMO_SELF_HEAL === "true" &&
    process.env.APP_ENV === "demo"
  );
}

