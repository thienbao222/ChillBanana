import { randomUUID } from "node:crypto";
import { prisma } from "./db";
import {
  ADMIN_COOKIE_NAME,
  CUSTOMER_COOKIE_NAME,
  ORDER_ACCESS_COOKIE_NAME,
  createAdminSessionToken,
  createAdminSessionTokenWithRole,
  createCustomerSessionToken,
  hashAdminPassword,
  hashCustomerPassword,
  computePasswordDigest,
} from "@/lib/auth-session";

export const PASSWORD = "Correct-Horse-9!";

export async function makeProduct(over: Record<string, unknown> = {}) {
  return prisma.product.create({
    data: {
      name: "Sản phẩm test",
      slug: `test-${randomUUID()}`,
      category: "cosmetics",
      categoryName: "Mỹ phẩm",
      priceJpy: 3000,
      priceVnd: 0,
      weightKg: 0.4,
      imageUrl: "https://example.test/x.png",
      description: "Sản phẩm dùng cho test",
      originalStore: "Amazon JP",
      stockSlots: 5,
      ...over,
    },
  });
}

export async function makeAdmin(username = "admin", role = "SUPER_ADMIN", password = PASSWORD) {
  return prisma.adminUser.create({
    data: { username, passwordHash: hashAdminPassword(password), name: `Admin ${username}`, role },
  });
}

export const adminCookies = (username = "admin", role = "SUPER_ADMIN") => {
  const pwdDigest = computePasswordDigest(hashAdminPassword(PASSWORD));
  return { [ADMIN_COOKIE_NAME]: createAdminSessionTokenWithRole(username, role, pwdDigest) };
};

export async function makeCustomer(email = `khach-${randomUUID().slice(0, 8)}@example.test`, over: Record<string, unknown> = {}) {
  return prisma.customer.create({
    data: {
      email,
      passwordHash: hashCustomerPassword(PASSWORD),
      name: "Khách test",
      emailVerifiedAt: new Date(),
      ...over,
    },
  });
}

export const customerCookies = (customer: { id: string; email: string; passwordHash?: string }) => {
  const pwdDigest = customer.passwordHash ? computePasswordDigest(customer.passwordHash) : computePasswordDigest(hashCustomerPassword(PASSWORD));
  return {
    [CUSTOMER_COOKIE_NAME]: createCustomerSessionToken({ id: customer.id, email: customer.email, pwdDigest }),
  };
};

export const guestOrderCookies = (token: string) => ({ [ORDER_ACCESS_COOKIE_NAME]: token });

/** Tạo đơn trực tiếp trong DB (bỏ qua API) cho các test thanh toán/cron. */
export async function makeOrder(over: Record<string, unknown> = {}) {
  const code = `CB-TEST-${randomUUID().slice(0, 8).toUpperCase()}`;
  return prisma.order.create({
    data: {
      orderCode: code,
      customerName: "Khách test",
      customerEmail: "guest@example.test",
      customerPhone: "0901234567",
      customerAddress: "1 Đường Test, TP.HCM",
      productName: "Sản phẩm test (x2)",
      category: "cosmetics",
      priceJpy: 6000,
      weightKg: 0.8,
      exchangeRate: 170,
      productPriceVnd: 1_020_000,
      serviceFeeVnd: 40_800,
      shippingFeeVnd: 148_000,
      totalVnd: 1_208_800,
      depositAmountVnd: 530_400,
      depositPercent: 50,
      paymentStatus: "UNPAID",
      status: "PENDING_DEPOSIT",
      isPriceVerified: true,
      priceVerifiedAt: new Date(),
      reservationExpiresAt: new Date(Date.now() + 30 * 60_000),
      ...over,
    },
  });
}

/** Payload tạo đơn catalog hợp lệ qua POST /api/orders. */
export function orderPayload(items: { id: string; quantity: number }[], over: Record<string, unknown> = {}) {
  return {
    customerName: "Nguyễn Văn Test",
    customerPhone: "0901234567",
    customerAddress: "1 Đường Test, Quận 1, TP.HCM",
    customerEmail: "guest@example.test",
    productName: "Đơn catalog",
    items,
    depositPercent: 50,
    ...over,
  };
}
