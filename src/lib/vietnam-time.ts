const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

export function vietnamDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function recentVietnamDateKeys(days: number, now = new Date()): string[] {
  if (!Number.isSafeInteger(days) || days < 1 || days > 366) return [];
  const [year, month, day] = vietnamDateKey(now).split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day, 12));

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(cursor);
    date.setUTCDate(date.getUTCDate() - (days - index - 1));
    return date.toISOString().slice(0, 10);
  });
}

function vietnamDay(dateKey: string, endOfDay: boolean): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const date = new Date(`${dateKey}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00`);
  if (!Number.isFinite(date.getTime()) || vietnamDateKey(date) !== dateKey) return null;
  return date;
}

export function vietnamDayStart(dateKey: string): Date | null {
  return vietnamDay(dateKey, false);
}

export function vietnamDayEnd(dateKey: string): Date | null {
  return vietnamDay(dateKey, true);
}
