import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { POST as scrapeLink } from "@/app/api/scrape-link/route";
import { prisma } from "../helpers/db";
import { json, post } from "../helpers/request";

describe("giới hạn API trích xuất link sản phẩm", () => {
  it("cho phép tối đa 10 yêu cầu trong cửa sổ rồi trả 429 với Retry-After", async () => {
    const ip = "203.0.113.42";
    const key = `scrape-link:${createHash("sha256").update(ip).digest("hex")}`;
    const request = () => scrapeLink(post("/api/scrape-link", { url: "https://example.com/item" }, { ip }));

    for (let i = 0; i < 10; i++) expect((await request()).status).toBe(400); // URL ngoài allowlist; không gọi dịch vụ ngoài.
    const blocked = await request();
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await prisma.rateLimit.findUnique({ where: { key } })).toBeTruthy();

    const otherIp = await scrapeLink(post("/api/scrape-link", { url: "https://example.com/item" }, { ip: "203.0.113.43" }));
    expect(otherIp.status).toBe(400);
    expect((await json(blocked)).error).toContain("quá nhiều");

    const simultaneous = await Promise.all(Array.from({ length: 15 }, () =>
      scrapeLink(post("/api/scrape-link", { url: "https://example.com/item" }, { ip: "203.0.113.44" }))
    ));
    expect(simultaneous.filter((response) => response.status === 400)).toHaveLength(10);
    expect(simultaneous.filter((response) => response.status === 429)).toHaveLength(5);
  });
});
