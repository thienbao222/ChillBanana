import { describe, expect, it, vi } from "vitest";
import { POST as resetPassword } from "@/app/api/auth/customer/reset-password/route";
import { prisma } from "../helpers/db";
import { makeCustomer, PASSWORD } from "../helpers/factories";
import { json, post } from "../helpers/request";
import { verifyCustomerPassword } from "@/lib/auth-session";

describe("Luồng Quên & Đặt lại mật khẩu khách hàng (Integration Tests)", () => {
  it("yêu cầu link đặt lại mật khẩu với email không tồn tại vẫn trả về 200 (chống enum email)", async () => {
    const res = await resetPassword(
      post("/api/auth/customer/reset-password", {
        action: "request",
        email: "nonexistent-user-123456@example.com",
      })
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
  });

  it("đặt lại mật khẩu thành công bằng token hợp lệ và vô hiệu hóa link ngay sau khi dùng", async () => {
    const customer = await makeCustomer();
    const mailer = await import("@/lib/mailer");
    let capturedResetUrl = "";
    vi.spyOn(mailer, "sendPasswordResetEmail").mockImplementation(async (email, name, url) => {
      capturedResetUrl = url;
    });

    // 1. Request reset link
    const reqRes = await resetPassword(
      post("/api/auth/customer/reset-password", {
        action: "request",
        email: customer.email,
      })
    );
    expect(reqRes.status).toBe(200);
    expect(capturedResetUrl).toBeTruthy();

    const parsedUrl = new URL(capturedResetUrl);
    const token = parsedUrl.searchParams.get("token");
    expect(token).toBeTruthy();

    // 2. Reset mật khẩu mới
    const newPassword = "SuperSecureNewPassword2026!";
    const resetRes = await resetPassword(
      post("/api/auth/customer/reset-password", {
        action: "reset",
        token,
        newPassword,
      })
    );
    expect(resetRes.status).toBe(200);
    const resetBody = await json(resetRes);
    expect(resetBody.success).toBe(true);

    // Xác minh mật khẩu trong DB đã thay đổi
    const updatedCust = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(verifyCustomerPassword(newPassword, updatedCust.passwordHash).valid).toBe(true);
    expect(verifyCustomerPassword(PASSWORD, updatedCust.passwordHash).valid).toBe(false);

    // 3. Thử dùng lại token cũ -> phải bị từ chối 400 (vì pwdDigest đã thay đổi)
    const reuseRes = await resetPassword(
      post("/api/auth/customer/reset-password", {
        action: "reset",
        token,
        newPassword: "AnotherNewPassword123!",
      })
    );
    expect(reuseRes.status).toBe(400);
    const reuseBody = await json(reuseRes);
    expect(reuseBody.error).toContain("đã được sử dụng");
  });
});
