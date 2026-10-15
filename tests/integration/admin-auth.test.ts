import { describe, expect, it } from "vitest";
import { GET as session, POST as login, DELETE as logout } from "@/app/api/admin/auth/route";
import { legacyAdminHmac } from "@/lib/password";
import { prisma } from "../helpers/db";
import { adminCookies, makeAdmin, PASSWORD } from "../helpers/factories";
import { cookieFrom, del, get, json, post } from "../helpers/request";

const doLogin = (username: string, password: unknown, ip = "9.9.9.9") =>
  login(post("/api/admin/auth", { username, password }, { ip }));

describe("đăng nhập admin", () => {
  it("đăng nhập đúng: cấp cookie httpOnly và ghi audit log", async () => {
    await makeAdmin("admin");
    const res = await doLogin("admin", PASSWORD);
    expect(res.status).toBe(200);
    expect(cookieFrom(res, "chillbanana_admin_session")).toBeTruthy();
    const setCookie = res.headers.getSetCookie().join(";").toLowerCase();
    expect(setCookie).toContain("httponly");
    expect(setCookie).toContain("samesite=lax");
    expect(await prisma.auditLog.count({ where: { action: "ADMIN_LOGIN", actor: "admin" } })).toBe(1);
  });

  it("tên đăng nhập không phân biệt hoa thường và bỏ khoảng trắng", async () => {
    await makeAdmin("admin");
    expect((await doLogin("  ADMIN ", PASSWORD)).status).toBe(200);
  });

  it("sai mật khẩu: 401, không cấp cookie, ghi audit và bộ đếm", async () => {
    await makeAdmin("admin");
    const res = await doLogin("admin", "sai-mat-khau");
    expect(res.status).toBe(401);
    expect(cookieFrom(res, "chillbanana_admin_session")).toBeUndefined();
    expect(await prisma.auditLog.count({ where: { action: "ADMIN_LOGIN_FAILED" } })).toBe(1);
    expect(await prisma.rateLimit.count()).toBe(2); // theo tài khoản và theo IP
  });

  it("tài khoản không tồn tại: cùng thông báo lỗi như sai mật khẩu", async () => {
    await makeAdmin("admin");
    const a = await json(await doLogin("khong-co", PASSWORD));
    const b = await json(await doLogin("admin", "sai"));
    expect(a.error).toBe(b.error);
  });

  it("khóa sau 5 lần sai: lần sau bị chặn (429) kể cả khi nhập đúng", async () => {
    await makeAdmin("admin");
    for (let i = 0; i < 5; i++) expect((await doLogin("admin", `sai-${i}`)).status).toBe(401);
    const blocked = await doLogin("admin", PASSWORD);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(14 * 60);
  });

  it("khóa theo IP khi dò nhiều tên đăng nhập khác nhau", async () => {
    await makeAdmin("admin");
    for (let i = 0; i < 20; i++) await doLogin(`nguoi-la-${i}`, "sai", "7.7.7.7");
    expect((await doLogin("admin", PASSWORD, "7.7.7.7")).status).toBe(429);
    // IP khác không bị ảnh hưởng.
    expect((await doLogin("admin", PASSWORD, "8.8.8.8")).status).toBe(200);
  });

  it("đăng nhập đúng xóa bộ đếm sai của tài khoản", async () => {
    await makeAdmin("admin");
    for (let i = 0; i < 4; i++) await doLogin("admin", "sai");
    expect((await doLogin("admin", PASSWORD)).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await doLogin("admin", "sai")).status).toBe(401);
  });

  it("hash HMAC cũ vẫn đăng nhập được và tự nâng cấp lên scrypt", async () => {
    const legacy = legacyAdminHmac(PASSWORD, process.env.ADMIN_SESSION_SECRET!);
    await prisma.adminUser.create({ data: { username: "admin", passwordHash: legacy, name: "Admin" } });
    expect((await doLogin("admin", PASSWORD)).status).toBe(200);
    const upgraded = await prisma.adminUser.findUniqueOrThrow({ where: { username: "admin" } });
    expect(upgraded.passwordHash.startsWith("scrypt$")).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: "ADMIN_PASSWORD_REHASHED" } })).toBe(1);
    expect((await doLogin("admin", PASSWORD)).status).toBe(200); // vẫn đăng nhập được sau khi nâng cấp
    expect((await doLogin("admin", "sai")).status).toBe(401);
  });

  it.each([
    ["mật khẩu không phải chuỗi", "admin", 12345],
    ["mật khẩu quá dài", "admin", "x".repeat(257)],
    ["tên đăng nhập quá dài", "u".repeat(101), "x"],
  ])("từ chối đầu vào xấu: %s", async (_label, username, password) => {
    expect((await doLogin(username as string, password)).status).toBe(400);
  });

  it("thiếu thông tin thì 400", async () => {
    expect((await login(post("/api/admin/auth", {}))).status).toBe(400);
  });
});

describe("phiên admin", () => {
  it("GET trả authenticated khi có cookie hợp lệ, 401 khi không", async () => {
    await makeAdmin("admin");
    expect((await session(get("/api/admin/auth"))).status).toBe(401);
    const ok = await session(get("/api/admin/auth", { cookies: adminCookies("admin") }));
    expect(ok.status).toBe(200);
    expect((await json(ok)).authenticated).toBe(true);
  });

  it("cookie bị sửa chữ ký thì không hợp lệ", async () => {
    await makeAdmin("admin");
    const token = adminCookies("admin").chillbanana_admin_session;
    const forged = Buffer.from(Buffer.from(token, "base64").toString().replace("admin", "root")).toString("base64");
    const res = await session(get("/api/admin/auth", { cookies: { chillbanana_admin_session: forged } }));
    expect(res.status).toBe(401);
  });

  it("đăng xuất ghi audit log", async () => {
    await makeAdmin("admin");
    const res = await logout(del("/api/admin/auth", { cookies: adminCookies("admin") }));
    expect(res.status).toBe(200);
    expect(await prisma.auditLog.count({ where: { action: "ADMIN_LOGOUT" } })).toBe(1);
  });
});
