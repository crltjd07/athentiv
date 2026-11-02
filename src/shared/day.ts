// Time-zone aware calendar-day helpers (no dependencies). A "day" is a "YYYY-MM-DD" string
// in a given IANA time zone, e.g. Asia/Manila.

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatters.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function parts(tz: string, at: number) {
  const out: Record<string, string> = {};
  for (const p of partsFormatter(tz).formatToParts(new Date(at))) out[p.type] = p.value;
  return out;
}

/** Offset of `tz` from UTC at instant `at`, in ms. */
export function tzOffsetMs(tz: string, at: number): number {
  const p = parts(tz, at);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(at / 1000) * 1000;
}

export function dayOf(tz: string, at: number): string {
  const p = parts(tz, at);
  return `${p.year}-${p.month}-${p.day}`;
}

/** UTC instant at which local `day` begins in `tz`. */
export function dayStart(tz: string, day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const off1 = tzOffsetMs(tz, guess);
  let t = guess - off1;
  const off2 = tzOffsetMs(tz, t);
  if (off2 !== off1) t = guess - off2;
  return t;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday */
export function weekdayIndex(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function weekStartOf(day: string): string {
  return addDays(day, -weekdayIndex(day));
}

export function monthStartOf(day: string): string {
  return day.slice(0, 8) + "01";
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(from + "T00:00:00Z");
  const b = Date.parse(to + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

export function eachDay(from: string, toInclusive: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= toInclusive; d = addDays(d, 1)) out.push(d);
  return out;
}

export function isDayString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
}
