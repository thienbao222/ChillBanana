import { NextRequest, NextResponse } from "next/server";
import { checkAndRecordHit, getClientIp } from "@/lib/rate-limit";
import { searchRakuten } from "@/features/purchasing/sources/rakuten";
import { searchYahooShopping } from "@/features/purchasing/sources/yahoo-shopping";
import { ExternalProductSearchResult } from "@/features/purchasing/sources/types";

export const dynamic = "force-dynamic";

const EXTERNAL_SEARCH_LIMIT = { max: 30, windowMs: 60 * 1000, blockMs: 2 * 60 * 1000 };

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const blockedSeconds = await checkAndRecordHit(`external-search:${ip}`, EXTERNAL_SEARCH_LIMIT);
  if (blockedSeconds > 0) {
    return NextResponse.json(
      { error: `Bạn đang tìm kiếm quá nhanh. Vui lòng thử lại sau ${blockedSeconds} giây.` },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const source = (searchParams.get("source") || "all").toLowerCase();

  if (!q) {
    return NextResponse.json({ success: true, items: [], total: 0 });
  }

  if (q.length > 100) {
    return NextResponse.json({ error: "Từ khóa tìm kiếm không được vượt quá 100 ký tự." }, { status: 400 });
  }

  try {
    let allItems: ExternalProductSearchResult[] = [];
    let errors: string[] = [];

    if (source === "all" || source === "rakuten") {
      const rakutenRes = await searchRakuten(q, 15);
      if (rakutenRes.success) {
        allItems = allItems.concat(rakutenRes.items);
      } else if (rakutenRes.error) {
        errors.push(rakutenRes.error);
      }
    }

    if (source === "all" || source === "yahoo") {
      const yahooRes = await searchYahooShopping(q, 15);
      if (yahooRes.success) {
        allItems = allItems.concat(yahooRes.items);
      } else if (yahooRes.error) {
        errors.push(yahooRes.error);
      }
    }

    return NextResponse.json({
      success: true,
      items: allItems,
      total: allItems.length,
      errors: errors.length > 0 ? errors : undefined,
      yahooCredit: '<a href="https://developer.yahoo.co.jp/sitemap/" target="_blank" rel="noopener noreferrer">Web Services by Yahoo! JAPAN</a>',
    });
  } catch (err: any) {
    console.error("[ExternalSearch] Lỗi xử lý tìm kiếm:", err);
    return NextResponse.json({ error: "Lỗi hệ thống khi tìm kiếm." }, { status: 500 });
  }
}
