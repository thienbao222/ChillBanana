import { describe, expect, it } from "vitest";
import {
  recentVietnamDateKeys,
  vietnamDateKey,
  vietnamDayEnd,
  vietnamDayStart,
} from "@/lib/vietnam-time";

describe("vietnam-time unit tests (Múi giờ Asia/Ho_Chi_Minh UTC+7)", () => {
  it("định dạng chuẩn YYYY-MM-DD theo giờ Việt Nam", () => {
    // 2026-10-19T20:00:00Z là 03:00:00 sáng ngày 2026-10-20 tại Việt Nam
    const utcDate = new Date("2026-10-19T20:00:00.000Z");
    expect(vietnamDateKey(utcDate)).toBe("2026-10-20");

    // 2026-10-20T16:59:59Z là 23:59:59 ngày 2026-10-20 tại Việt Nam
    const lateUtcDate = new Date("2026-10-20T16:59:59.000Z");
    expect(vietnamDateKey(lateUtcDate)).toBe("2026-10-20");

    // 2026-10-20T17:00:00Z là 00:00:00 ngày 2026-10-21 tại Việt Nam
    const nextDayUtcDate = new Date("2026-10-20T17:00:00.000Z");
    expect(vietnamDateKey(nextDayUtcDate)).toBe("2026-10-21");
  });

  it("tạo danh sách các ngày gần nhất liên tục", () => {
    const fixedNow = new Date("2026-10-20T10:00:00.000Z"); // ngày 2026-10-20 giờ VN
    const keys = recentVietnamDateKeys(3, fixedNow);
    expect(keys).toEqual(["2026-10-18", "2026-10-19", "2026-10-20"]);
  });

  it("từ chối số ngày không hợp lệ (< 1 hoặc > 366)", () => {
    expect(recentVietnamDateKeys(0)).toEqual([]);
    expect(recentVietnamDateKeys(-5)).toEqual([]);
    expect(recentVietnamDateKeys(400)).toEqual([]);
  });

  it("vietnamDayStart trả về chính xác thời khắc 00:00:00.000+07:00", () => {
    const start = vietnamDayStart("2026-10-20");
    expect(start).not.toBeNull();
    // 00:00:00 +07:00 tương đương 17:00:00 UTC của ngày hôm trước
    expect(start?.toISOString()).toBe("2026-10-19T17:00:00.000Z");
  });

  it("vietnamDayEnd trả về chính xác thời khắc 23:59:59.999+07:00", () => {
    const end = vietnamDayEnd("2026-10-20");
    expect(end).not.toBeNull();
    // 23:59:59.999 +07:00 tương đương 16:59:59.999 UTC cùng ngày
    expect(end?.toISOString()).toBe("2026-10-20T16:59:59.999Z");
  });

  it("từ chối các chuỗi ngày không đúng định dạng hoặc không tồn tại trong lịch", () => {
    expect(vietnamDayStart("invalid-date")).toBeNull();
    expect(vietnamDayStart("2026-13-45")).toBeNull();
    expect(vietnamDayStart("2026-02-30")).toBeNull(); // Tháng 2 không có ngày 30
    expect(vietnamDayEnd("2026-00-10")).toBeNull();
  });
});
