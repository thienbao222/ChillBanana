// Hash mật khẩu admin cho seed: PHẢI cùng định dạng với src/lib/password.ts (scrypt$<salt>$<hash>).
// Có unit test (tests/unit/password.test.ts) bảo đảm hai bên luôn tương thích.
const crypto = require("crypto");

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

module.exports = { hashPassword };
