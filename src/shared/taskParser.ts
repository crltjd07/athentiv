// Turns a spoken or typed sentence into task fields, e.g.
//   "Create a programming project due next Friday with large effort"
// The result only pre-fills the form — the user always reviews before saving.
import type { Effort, TaskType } from "./catalog";

export type ParsedTask = {
  title: string;
  type: TaskType | null;
  subjectId: number | null;
  subjectName: string | null;
  due: Date | null;
  hasTime: boolean;
  effort: Effort | null;
  recognised: string[];
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

const TYPE_WORDS: [RegExp, TaskType][] = [
  [/\b(quiz(?:zes)?|long quiz|seatwork)\b/, "quiz"],
  [/\b(exams?|tests?|midterms?|finals?|prelims?)\b/, "exam"],
  [/\b(projects?|capstone|thesis)\b/, "project"],
  [/\b(reports?|essays?|papers?|reflection|research paper)\b/, "report"],
  [/\b(assignments?|homework|hw|worksheets?|problem sets?|activity|activities|lab(?: work)?)\b/, "assignment"],
];

const EFFORT_WORDS: [RegExp, Effort][] = [
  [/\b(large|big|heavy|long|hard|high)(?:\s+effort)?\b|\beffort\s+(?:is\s+)?(?:large|high|big)\b|\b(?:size\s+)?l\b(?=\s*effort)/, "L"],
  [/\b(medium|moderate|average|mid)(?:\s+effort)?\b|\beffort\s+(?:is\s+)?medium\b/, "M"],
  [/\b(small|light|quick|easy|short|low)(?:\s+effort)?\b|\beffort\s+(?:is\s+)?(?:small|low)\b/, "S"],
];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function nextWeekday(from: Date, target: number, forceNextWeek: boolean) {
  const d = startOfDay(from);
  const today = d.getDay();
  let diff = (target - today + 7) % 7;
  if (forceNextWeek) {
    // "next Friday" = Friday of next week (Mon-start weeks).
    const toNextMonday = ((8 - today) % 7) || 7;
    diff = toNextMonday + ((target + 6) % 7);
  }
  d.setDate(d.getDate() + diff);
  return d;
}

function parseDate(text: string, now: Date): { date: Date; phrase: string } | null {
  let m: RegExpMatchArray | null;
  if ((m = text.match(/\bday after tomorrow\b/))) {
    const d = startOfDay(now);
    d.setDate(d.getDate() + 2);
    return { date: d, phrase: m[0] };
  }
  if ((m = text.match(/\b(today|tonight)\b/))) return { date: startOfDay(now), phrase: m[0] };
  if ((m = text.match(/\b(tomorrow|tmrw|tom)\b/))) {
    const d = startOfDay(now);
    d.setDate(d.getDate() + 1);
    return { date: d, phrase: m[0] };
  }
  if ((m = text.match(/\bin (\d{1,2}|a|one|two|three|four|five|six|seven) (day|days|week|weeks)\b/))) {
    const words: Record<string, number> = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
    const n = words[m[1]] ?? Number(m[1]);
    const d = startOfDay(now);
    d.setDate(d.getDate() + n * (m[2].startsWith("week") ? 7 : 1));
    return { date: d, phrase: m[0] };
  }
  if ((m = text.match(/\b(next|this|on|coming)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/))) {
    return { date: nextWeekday(now, WEEKDAYS.indexOf(m[2]), m[1] === "next"), phrase: m[0] };
  }
  if ((m = text.match(/\b(this|end of(?: the)?) weekend\b/))) return { date: nextWeekday(now, 6, false), phrase: m[0] };
  if ((m = text.match(/\bnext week\b/))) return { date: nextWeekday(now, 5, true), phrase: m[0] };
  if ((m = text.match(/\b(end of (?:the )?week|this week)\b/))) return { date: nextWeekday(now, 5, false), phrase: m[0] };
  const monthRe = MONTHS.map((x) => x.slice(0, 3) + "(?:" + x.slice(3) + ")?").join("|");
  if ((m = text.match(new RegExp(`\\b(${monthRe})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`)))) {
    return { date: monthDay(now, MONTHS.findIndex((x) => x.startsWith(m![1].slice(0, 3))), Number(m[2])), phrase: m[0] };
  }
  if ((m = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${monthRe})\\b`)))) {
    return { date: monthDay(now, MONTHS.findIndex((x) => x.startsWith(m![2].slice(0, 3))), Number(m[1])), phrase: m[0] };
  }
  if ((m = text.match(/\b(\d{1,2})\/(\d{1,2})\b/))) return { date: monthDay(now, Number(m[1]) - 1, Number(m[2])), phrase: m[0] };
  return null;
}

function monthDay(now: Date, month: number, day: number) {
  const d = new Date(now.getFullYear(), month, day);
  if (startOfDay(d) < startOfDay(now)) d.setFullYear(d.getFullYear() + 1);
  return d;
}

function parseTime(text: string): { h: number; m: number; phrase: string } | null {
  let m: RegExpMatchArray | null;
  if ((m = text.match(/\b(?:at\s+)?noon\b/))) return { h: 12, m: 0, phrase: m[0] };
  if ((m = text.match(/\b(?:at\s+)?midnight\b/))) return { h: 23, m: 59, phrase: m[0] };
  if ((m = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/))) {
    let h = Number(m[1]) % 12;
    if (m[3].startsWith("p")) h += 12;
    return { h, m: Number(m[2] ?? 0), phrase: m[0] };
  }
  if ((m = text.match(/\bat\s+(\d{1,2}):(\d{2})\b/))) return { h: Number(m[1]), m: Number(m[2]), phrase: m[0] };
  return null;
}

export function parseTaskText(input: string, subjects: { id: number; name: string }[], now = new Date()): ParsedTask {
  const raw = input.trim().replace(/\s+/g, " ");
  const text = raw.toLowerCase();
  const recognised: string[] = [];
  const consumed: string[] = [];

  let type: TaskType | null = null;
  for (const [re, t] of TYPE_WORDS) {
    if (re.test(text)) {
      type = t;
      recognised.push("type");
      break;
    }
  }

  let effort: Effort | null = null;
  const effortPhrase = text.match(/\b(?:with\s+)?(?:a\s+)?(\w+)\s+effort\b|\beffort\s+(?:is\s+)?(\w+)\b/);
  const effortScope = effortPhrase ? effortPhrase[0] : "";
  for (const [re, e] of EFFORT_WORDS) {
    if (effortScope && re.test(effortScope)) {
      effort = e;
      recognised.push("effort");
      consumed.push(effortScope);
      break;
    }
  }

  // Longest subject names first, so "Data Structures" wins over "Data".
  let subject: { id: number; name: string } | null = null;
  for (const s of [...subjects].sort((a, b) => b.name.length - a.name.length)) {
    const re = new RegExp(`\\b${s.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    if (re.test(text)) {
      subject = s;
      recognised.push("subject");
      break;
    }
  }

  const date = parseDate(text, now);
  const time = parseTime(text);
  let due: Date | null = null;
  if (date) {
    due = new Date(date.date);
    consumed.push(date.phrase);
    recognised.push("date");
  }
  if (time) {
    due ??= startOfDay(now);
    due.setHours(time.h, time.m, 0, 0);
    consumed.push(time.phrase);
    recognised.push("time");
  } else if (due) due.setHours(23, 59, 0, 0);

  // Title: strip command words, the due phrase and the effort phrase from the original wording.
  let title = text;
  for (const c of consumed) title = title.replace(c, " ");
  title = title
    .replace(/^(please\s+)?(create|add|make|new|set|remind me (?:about|of|to)|i have)\s+(an?\s+|the\s+|my\s+)?/, "")
    .replace(/\b(due|by|on|at|deadline(?: is)?|for)\s*$/g, "")
    .replace(/\b(due|deadline(?: is)?|by)\b\s*(?=$|\s(?:with|and)\b)/g, "")
    .replace(/\s+(with|and)\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  // Restore original capitalisation where possible.
  const idx = raw.toLowerCase().indexOf(title);
  title = idx >= 0 ? raw.slice(idx, idx + title.length) : title;
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return { title, type, subjectId: subject?.id ?? null, subjectName: subject?.name ?? null, due, hasTime: !!time, effort, recognised };
}
