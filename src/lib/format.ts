// Client-side display formatting (device local time).

const DAY = 86_400_000;

export function startOfDay(d: Date | number) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function localDayKey(d: Date | number) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export function fromDayKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const fmtTime = (t: number) => new Date(t).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
export const fmtDate = (t: number) => new Date(t).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
export const fmtDateLong = (t: number) => new Date(t).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
export const fmtDateTime = (t: number) => `${fmtDate(t)}, ${fmtTime(t)}`;

/** "Today, 2:00 PM" / "Tomorrow, 9:00 AM" / "Thu, Oct 23, 11:59 PM" */
export function fmtDue(t: number) {
  const days = Math.round((startOfDay(t).getTime() - startOfDay(Date.now()).getTime()) / DAY);
  const time = fmtTime(t);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  if (days === -1) return `Yesterday, ${time}`;
  const date = new Date(t).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
  return `${date}, ${time}`;
}

/** "in 3h", "in 2d", "2d ago" */
export function fmtRelative(t: number, now = Date.now()) {
  const diff = t - now;
  const abs = Math.abs(diff);
  const unit = abs < 3_600_000 ? [Math.max(1, Math.round(abs / 60_000)), "m"] : abs < DAY ? [Math.round(abs / 3_600_000), "h"] : [Math.round(abs / DAY), "d"];
  return diff >= 0 ? `in ${unit[0]}${unit[1]}` : `${unit[0]}${unit[1]} ago`;
}

export function fmtClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function fmtMinutes(min: number) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function daysLeftLabel(until: number | null) {
  if (!until) return "";
  const d = Math.ceil((until - Date.now()) / DAY);
  return d <= 1 ? "less than a day left" : `${d} days left`;
}

/** Due-date presets used by the task form. Returns a local Date at the given time. */
export function presetDate(key: "today" | "tomorrow" | "this_week" | "next_week", now = new Date()) {
  const d = startOfDay(now);
  const dow = (d.getDay() + 6) % 7; // 0 = Mon
  if (key === "tomorrow") d.setDate(d.getDate() + 1);
  if (key === "this_week") d.setDate(d.getDate() + (dow < 4 ? 4 - dow : 6 - dow)); // Friday, or Sunday if past Friday
  if (key === "next_week") d.setDate(d.getDate() + (7 - dow) + 4); // next week's Friday
  return d;
}
