import { test } from "vitest";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import crypto from "node:crypto";
import {
  hashPassword,
  isScryptHash,
  legacyAdminHmac,
  verifyAdminPassword,
  verifyLegacyCustomerSha256,
  verifyScryptPassword,
} from "@/lib/password";

const require = createRequire(import.meta.url);
const seedHasher = require("../../prisma/hash-password.js") as { hashPassword: (p: string) => string };

test("scrypt: hash đúng định dạng, mỗi lần có salt khác nhau", () => {
  const a = hashPassword("Mat-khau-manh-1");
  const b = hashPassword("Mat-khau-manh-1");
  assert.match(a, /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.notEqual(a, b);
  assert.ok(isScryptHash(a));
});

test("scrypt: đúng mật khẩu pass, sai mật khẩu fail", () => {
  const h = hashPassword("Mat-khau-manh-1");
  assert.equal(verifyScryptPassword("Mat-khau-manh-1", h), true);
  assert.equal(verifyScryptPassword("mat-khau-manh-1", h), false);
  assert.equal(verifyScryptPassword("", h), false);
});

test("scrypt: dữ liệu hash hỏng không ném lỗi", () => {
  for (const bad of ["", "scrypt$", "scrypt$abc", "scrypt$abc$zzzz", "scrypt$abc$abcd", "plaintext"]) {
    assert.equal(verifyScryptPassword("x", bad), false, bad);
  }
});

test("admin: hash scrypt không cần secret và không cần rehash", () => {
  const h = hashPassword("Admin-pass-1");
  assert.deepEqual(verifyAdminPassword("Admin-pass-1", h, undefined), { valid: true, needsRehash: false });
  assert.deepEqual(verifyAdminPassword("sai", h, undefined), { valid: false, needsRehash: false });
});

test("admin: hash HMAC cũ vẫn đăng nhập được và được đánh dấu cần nâng cấp", () => {
  const secret = "test-secret";
  const legacy = legacyAdminHmac("Admin-pass-1", secret);
  assert.deepEqual(verifyAdminPassword("Admin-pass-1", legacy, secret), { valid: true, needsRehash: true });
  assert.deepEqual(verifyAdminPassword("sai", legacy, secret), { valid: false, needsRehash: false });
  // Thiếu secret thì không thể xác minh hash cũ.
  assert.deepEqual(verifyAdminPassword("Admin-pass-1", legacy, undefined), { valid: false, needsRehash: false });
  // Sai secret thì không khớp.
  assert.equal(verifyAdminPassword("Admin-pass-1", legacy, "other-secret").valid, false);
});

test("khách: hash SHA-256 đời đầu vẫn xác minh được", () => {
  const legacy = crypto.createHash("sha256").update("Cust-pass-1" + "chillbanana-secret-salt-2026").digest("hex");
  assert.equal(verifyLegacyCustomerSha256("Cust-pass-1", legacy), true);
  assert.equal(verifyLegacyCustomerSha256("sai", legacy), false);
  assert.equal(verifyLegacyCustomerSha256("x", "khong-phai-hex"), false);
});

test("seed: hash do prisma/hash-password.js tạo ra tương thích với src/lib/password.ts", () => {
  const h = seedHasher.hashPassword("Seed-pass-1");
  assert.ok(isScryptHash(h));
  assert.equal(verifyScryptPassword("Seed-pass-1", h), true);
  assert.equal(verifyAdminPassword("Seed-pass-1", h, undefined).valid, true);
});
