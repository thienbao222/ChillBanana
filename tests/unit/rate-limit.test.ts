import { test } from "vitest";
import assert from "node:assert/strict";
import {
  clientIpFromHeaders,
  registerHit,
  retryAfterSeconds,
  LOGIN_FAILURES_PER_ACCOUNT,
  type RateLimitConfig,
  type RateLimitState,
} from "@/lib/rate-limit-core";

const cfg: RateLimitConfig = { max: 3, windowMs: 60_000, blockMs: 120_000 };
const T0 = 1_000_000;

function hits(n: number, start = T0, step = 1000): RateLimitState | null {
  let state: RateLimitState | null = null;
  for (let i = 0; i < n; i++) state = registerHit(state, start + i * step, cfg);
  return state;
}

test("dưới ngưỡng thì không bị khóa", () => {
  const s = hits(2)!;
  assert.equal(s.count, 2);
  assert.equal(s.blockedUntil, null);
  assert.equal(retryAfterSeconds(s, T0 + 5000), 0);
});

test("chạm ngưỡng thì bị khóa đúng thời gian", () => {
  const s = hits(3)!; // lần thứ 3 tại T0+2000
  assert.equal(s.blockedUntil, T0 + 2000 + 120_000);
  assert.equal(retryAfterSeconds(s, T0 + 2000), 120);
  assert.equal(retryAfterSeconds(s, T0 + 62_000), 60);
});

test("hết thời gian khóa thì hết bị chặn", () => {
  const s = hits(3)!;
  assert.equal(retryAfterSeconds(s, s.blockedUntil! + 1), 0);
});

test("đang bị khóa thì ghi thêm không kéo dài khóa", () => {
  const s = hits(3)!;
  const again = registerHit(s, T0 + 3000, cfg);
  assert.deepEqual(again, s);
});

test("hết cửa sổ thì đếm lại từ 1", () => {
  const first = hits(2)!;
  const later = registerHit(first, T0 + 10 * 60_000, cfg);
  assert.equal(later.count, 1);
  assert.equal(later.blockedUntil, null);
});

test("sau khi khóa hết hạn người dùng có lại đủ số lần thử", () => {
  const blocked = hits(3)!;
  const afterBlock = blocked.blockedUntil! + 1000;
  let s: RateLimitState | null = registerHit(blocked, afterBlock, cfg);
  assert.equal(s.count, 1);
  s = registerHit(s, afterBlock + 1000, cfg);
  assert.equal(s.blockedUntil, null);
});

test("cấu hình đăng nhập: khóa ở lần sai thứ 5", () => {
  let s: RateLimitState | null = null;
  for (let i = 0; i < 4; i++) {
    s = registerHit(s, T0 + i, LOGIN_FAILURES_PER_ACCOUNT);
    assert.equal(retryAfterSeconds(s, T0 + i), 0);
  }
  s = registerHit(s, T0 + 4, LOGIN_FAILURES_PER_ACCOUNT);
  assert.equal(retryAfterSeconds(s, T0 + 4), 15 * 60);
});

test("lấy IP client từ header", () => {
  const h = (map: Record<string, string>) => (name: string) => map[name] ?? null;
  assert.equal(clientIpFromHeaders(h({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })), "1.2.3.4");
  assert.equal(clientIpFromHeaders(h({ "x-real-ip": "5.6.7.8" })), "5.6.7.8");
  assert.equal(clientIpFromHeaders(h({})), "unknown");
});
