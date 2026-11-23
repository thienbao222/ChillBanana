import { NextResponse } from "next/server";

/**
 * Kiểm tra xem môi trường hiện tại có cho phép chạy các tính năng Mock / Sandbox hay không.
 * Chỉ cho phép khi:
 * - process.env.APP_ENV === "demo" hoặc
 * - process.env.NODE_ENV === "test" hoặc
 * - process.env.APP_ENV === "test" hoặc
 * - process.env.VITEST === "true"
 * 
 * Bắt buộc trả về false cho production hoặc bất kỳ giá trị nào khác.
 */
export function isMockSandboxAllowed(): boolean {
  const rawAppEnv = process.env.APP_ENV ?? process.env.NEXT_PUBLIC_APP_ENV;
  const appEnv = rawAppEnv?.toLowerCase().trim();

  // Nếu APP_ENV được chỉ định: chỉ "demo" và "test" mới hợp lệ; "production" hoặc giá trị khác đều trả về false
  if (appEnv !== undefined && appEnv !== "") {
    return appEnv === "demo" || appEnv === "test";
  }

  // Nếu APP_ENV không được chỉ định: chỉ cho phép trong môi trường test (Vitest / NODE_ENV=test)
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
  return isTest;
}

/**
 * Middleware/Guard chặn các API route mock/sandbox trên production.
 * Trả về HTTP 404 Not Found nếu không được phép, hoặc null nếu được phép.
 */
export function enforceMockSandboxAllowed(): NextResponse | null {
  if (!isMockSandboxAllowed()) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }
  return null;
}
