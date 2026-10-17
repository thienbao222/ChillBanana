import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/mailer", () => ({ sendPaymentSuccessEmail: vi.fn() }));

import { verifyVnpaySignature } from "@/lib/vnpay-payment";
import { signVnpay } from "../helpers/vnpay";

const SECRET = "bi-mat-test";
const base = { vnp_TxnRef: "CB-1", vnp_Amount: "53040000", vnp_ResponseCode: "00", vnp_OrderInfo: "Thanh toan don hang CB-1" };

const query = (params: Record<string, string>, hash: string) =>
  new URLSearchParams({ ...params, vnp_SecureHash: hash });

describe("verifyVnpaySignature", () => {
  beforeEach(() => {
    vi.stubEnv("VNPAY_HASH_SECRET", SECRET);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("chấp nhận chữ ký đúng (kể cả giá trị có khoảng trắng)", () => {
    expect(verifyVnpaySignature(query(base, signVnpay(base, SECRET)))).toBe(true);
  });

  it("bỏ qua vnp_SecureHashType khi tính chữ ký", () => {
    const q = query(base, signVnpay(base, SECRET));
    q.set("vnp_SecureHashType", "HmacSHA512");
    expect(verifyVnpaySignature(q)).toBe(true);
  });

  it("từ chối khi bất kỳ trường nào bị sửa", () => {
    const q = query(base, signVnpay(base, SECRET));
    q.set("vnp_Amount", "100");
    expect(verifyVnpaySignature(q)).toBe(false);
  });

  it("từ chối khi thêm trường vnp_ mới", () => {
    const q = query(base, signVnpay(base, SECRET));
    q.set("vnp_Extra", "1");
    expect(verifyVnpaySignature(q)).toBe(false);
  });

  it("từ chối chữ ký ký bằng khóa khác, rỗng, sai độ dài, hoặc thiếu", () => {
    expect(verifyVnpaySignature(query(base, signVnpay(base, "khoa-khac")))).toBe(false);
    expect(verifyVnpaySignature(query(base, ""))).toBe(false);
    expect(verifyVnpaySignature(query(base, "abc"))).toBe(false);
    expect(verifyVnpaySignature(new URLSearchParams(base))).toBe(false);
  });

  it("từ chối tất cả khi chưa cấu hình khóa bí mật", () => {
    const q = query(base, signVnpay(base, SECRET));
    vi.stubEnv("VNPAY_HASH_SECRET", "");
    expect(verifyVnpaySignature(q)).toBe(false);
  });
});
