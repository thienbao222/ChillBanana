import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/news/route";
import { NextRequest } from "next/server";

describe("News API (/api/news)", () => {
  it("GET returns formatted news list from fallback/database", async () => {
    const req = new NextRequest("http://localhost:3000/api/news");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.count).toBeGreaterThanOrEqual(4);
    expect(Array.isArray(body.news)).toBe(true);
    expect(body.news[0]).toHaveProperty("title");
    expect(body.news[0]).toHaveProperty("slug");
    expect(body.news[0]).toHaveProperty("category");
  });

  it("GET supports category filtering", async () => {
    const req = new NextRequest("http://localhost:3000/api/news?category=MeoSangSale");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.news.every((item: { category: string }) => item.category === "MeoSangSale")).toBe(true);
  });

  it("POST requires admin authentication (rejects guest with 401)", async () => {
    const req = new NextRequest("http://localhost:3000/api/news", {
      method: "POST",
      body: JSON.stringify({
        title: "Test",
        slug: "test-slug",
        category: "Review",
        categoryName: "Kinh Nghiệm",
        excerpt: "Tóm tắt",
        content: "Nội dung",
        coverImage: "https://example.com/test.jpg",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
