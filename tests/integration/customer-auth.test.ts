import { describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { GET as me, POST as auth } from "@/app/api/auth/customer/route";
import { POST as verify } from "@/app/api/auth/customer/verify/route";
import { createCustomerEmailVerificationToken } from "@/lib/auth-session";
import { sendCustomerEmailVerification } from "@/lib/mailer";
import { prisma } from "../helpers/db";
import { PASSWORD, makeCustomer, makeOrder } from "../helpers/factories";
import { cookieFrom, get, json, post } from "../helpers/request";

const call = (body: Record<string, unknown>, ip = "5.5.5.5") => auth(post("/api/auth/customer", body, { ip }));
const register = (email: string, over: Record<string, unknown> = {}, ip?: string) =>
  call({ action: "register", email, password: PASSWORD, name: "Khách mới", ...over }, ip);
const login = (email: string, password: string, ip?: string) => call({ action: "login", email, password }, ip);

describe("đăng ký khách hàng", () => {
  it("tạo tài khoản chưa xác minh, băm scrypt và gửi email xác minh", async () => {
    const res = await register("moi@example.test");
    expect(res.status).toBe(200);
    expect((await json(res)).requiresEmailVerification).toBe(true);
    const c = await prisma.customer.findUniqueOrThrow({ where: { email: "moi@example.test" } });
    expect(c.emailVerifiedAt).toBeNull();
    expect(c.passwordHash.startsWith("scrypt$")).toBe(true);
    expect(c.passwordHash).not.toContain(PASSWORD);
    expect(sendCustomerEmailVerification).toHaveBeenCalledTimes(1);
  });

  it("email viết hoa/khoảng trắng được chuẩn hóa", async () => {
    await register("  Moi@Example.TEST ");
    expect(await prisma.customer.count({ where: { email: "moi@example.test" } })).toBe(1);
  });

  it.each([
    ["mật khẩu dưới 8 ký tự", { password: "short" }],
    ["email sai định dạng", { email: "khong-hop-le" }],
    ["thiếu tên", { name: "" }],
    ["mật khẩu quá dài", { password: "x".repeat(257) }],
  ])("từ chối: %s", async (_l, over) => {
    const res = await register("a@example.test", over as Record<string, unknown>);
    expect(res.status).toBe(400);
    expect(await prisma.customer.count()).toBe(0);
  });

  it("email đã đăng ký thì từ chối", async () => {
    await makeCustomer("trung@example.test");
    expect((await register("trung@example.test")).status).toBe(400);
  });

  it("xóa tài khoản vừa tạo nếu không gửi được email xác minh", async () => {
    vi.mocked(sendCustomerEmailVerification).mockRejectedValueOnce(new Error("SMTP down"));
    const res = await register("loi-mail@example.test");
    expect(res.status).toBe(503);
    expect(await prisma.customer.count()).toBe(0);
  });

  it("giới hạn 10 lần đăng ký mỗi giờ cho mỗi IP", async () => {
    for (let i = 0; i < 10; i++) expect((await register(`u${i}@example.test`, {}, "6.6.6.6")).status).toBe(200);
    const blocked = await register("u11@example.test", {}, "6.6.6.6");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect((await register("u12@example.test", {}, "6.6.6.7")).status).toBe(200); // IP khác
  });
});

describe("xác minh email", () => {
  it("token hợp lệ kích hoạt tài khoản, cấp phiên và gắn đơn cũ cùng email", async () => {
    await register("moi@example.test");
    const c = await prisma.customer.findUniqueOrThrow({ where: { email: "moi@example.test" } });
    const old = await makeOrder({ customerEmail: "moi@example.test" });
    const token = createCustomerEmailVerificationToken({ id: c.id, email: c.email });

    const res = await verify(post("/api/auth/customer/verify", { token }));
    expect(res.status).toBe(200);
    expect(cookieFrom(res, "cb_customer_session")).toBeTruthy();
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: c.id } })).emailVerifiedAt).not.toBeNull();
    expect((await prisma.order.findUniqueOrThrow({ where: { id: old.id } })).customerId).toBe(c.id);

    expect((await verify(post("/api/auth/customer/verify", { token }))).status).toBe(409); // dùng lại token
  });

  it("token sai, bị sửa hoặc thiếu thì 400", async () => {
    const c = await makeCustomer("a@example.test", { emailVerifiedAt: null });
    const token = createCustomerEmailVerificationToken({ id: c.id, email: c.email });

    // Token = base64(`${payload}::${chữ ký}`). Thêm ký tự cuối KHÔNG phải giả mạo (base64 bỏ qua phần dư),
    // nên giả mạo thật sự phải đổi nội dung hoặc chữ ký.
    const raw = Buffer.from(token, "base64").toString("utf8");
    const sep = raw.lastIndexOf("::");
    const payload = JSON.parse(raw.slice(0, sep));
    const signature = raw.slice(sep + 2);
    const encode = (s: string) => Buffer.from(s).toString("base64");

    const forgedPayload = encode(JSON.stringify({ ...payload, email: "ke-tan-cong@example.test" }) + "::" + signature);
    const lastChar = signature.slice(-1);
    const forgedSignature = encode(raw.slice(0, sep) + "::" + signature.slice(0, -1) + (lastChar === "0" ? "1" : "0"));

    expect((await verify(post("/api/auth/customer/verify", { token: forgedPayload }))).status).toBe(400);
    expect((await verify(post("/api/auth/customer/verify", { token: forgedSignature }))).status).toBe(400);
    expect((await verify(post("/api/auth/customer/verify", { token: "rac" }))).status).toBe(400);
    expect((await verify(post("/api/auth/customer/verify", {}))).status).toBe(400);
  });
});

describe("đăng nhập khách hàng", () => {
  it("chưa xác minh email thì 403 và gửi lại email", async () => {
    await makeCustomer("chua@example.test", { emailVerifiedAt: null });
    const res = await login("chua@example.test", PASSWORD);
    expect(res.status).toBe(403);
    expect(cookieFrom(res, "cb_customer_session")).toBeUndefined();
    expect(sendCustomerEmailVerification).toHaveBeenCalledTimes(1);
  });

  it("đúng mật khẩu: cấp cookie phiên và /api/auth/customer trả thông tin, không lộ hash", async () => {
    await makeCustomer("ok@example.test");
    const res = await login("OK@example.test", PASSWORD);
    const token = cookieFrom(res, "cb_customer_session");
    expect(res.status).toBe(200);
    expect(token).toBeTruthy();
    expect(JSON.stringify(await json(res))).not.toContain("passwordHash");

    const who = await json(await me(get("/api/auth/customer", { cookies: { cb_customer_session: token! } })));
    expect(who.customer.email).toBe("ok@example.test");
  });

  it("sai mật khẩu và email không tồn tại cho cùng thông báo", async () => {
    await makeCustomer("ok@example.test");
    const a = await json(await login("ok@example.test", "sai"));
    const b = await json(await login("khong-co@example.test", "sai"));
    expect(a.error).toBe(b.error);
  });

  it("khóa sau 5 lần sai (kể cả nhập đúng sau đó)", async () => {
    await makeCustomer("ok@example.test");
    for (let i = 0; i < 5; i++) expect((await login("ok@example.test", "sai")).status).toBe(401);
    const blocked = await login("ok@example.test", PASSWORD);
    expect(blocked.status).toBe(429);
  });

  it("hash SHA-256 đời cũ vẫn đăng nhập được và nâng cấp lên scrypt", async () => {
    const legacy = crypto.createHash("sha256").update(PASSWORD + "chillbanana-secret-salt-2026").digest("hex");
    await makeCustomer("cu@example.test", { passwordHash: legacy });
    expect((await login("cu@example.test", PASSWORD)).status).toBe(200);
    expect((await prisma.customer.findUniqueOrThrow({ where: { email: "cu@example.test" } })).passwordHash.startsWith("scrypt$")).toBe(true);
    expect((await login("cu@example.test", PASSWORD)).status).toBe(200);
  });

  it("đăng nhập gắn các đơn cũ cùng email vào tài khoản", async () => {
    const c = await makeCustomer("ok@example.test");
    const old = await makeOrder({ customerEmail: "ok@example.test" });
    const other = await makeOrder({ customerEmail: "nguoi-khac@example.test" });
    await login("ok@example.test", PASSWORD);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: old.id } })).customerId).toBe(c.id);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: other.id } })).customerId).toBeNull();
  });

  it("hành động không hợp lệ thì 400", async () => {
    expect((await call({ action: "xoa-het" })).status).toBe(400);
  });
});
