import { expect, test } from "@playwright/test";

const PAGES = ["/", "/classic", "/galaxy", "/tracking", "/profile", "/admin/login", "/verify-email"];

test.describe("trang chính tải được trên bản build production", () => {
  for (const path of PAGES) {
    test(`GET ${path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.status(), `${path} phải trả 200`).toBe(200);
      await expect(page.locator("body")).toBeVisible();
      expect(await page.title()).not.toBe("");
      expect(errors, `lỗi JavaScript chưa bắt trên ${path}`).toEqual([]);
    });
  }

  test("đường dẫn không tồn tại trả 404", async ({ page }) => {
    const res = await page.goto("/trang-khong-ton-tai");
    expect(res?.status()).toBe(404);
  });

  test("trang đăng nhập admin có ô mật khẩu", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("API công khai trả JSON hợp lệ", async ({ request }) => {
    const res = await request.get("/api/exchange-rate");
    expect(res.status()).toBe(200);
    expect(await res.json()).toBeTruthy();
  });
});
