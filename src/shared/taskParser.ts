// Turns a spoken or typed sentence into task fields, e.g.
//   "Create a programming project due next Friday, heavy effort"
// The result only pre-fills the form. The user always reviews it before saving.
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
const STOPWORDS = new Set(["and", "the", "of", "for", "in", "to", "a", "an", "with", "on", "at", "lab", "lecture", "class"]);

const TYPE_WORDS: [RegExp, TaskType][] = [
  [/\b(quiz(?:zes)?|long quiz|seatwork)\b/, "quiz"],
  [/\b(exams?|tests?|midterms?|finals?|prelims?)\b/, "exam"],
  [/\b(projects?|capstone|thesis)\b/, "project"],
  [/\b(reports?|essays?|papers?|reflection|research paper)\b/, "report"],
  [/\b(assignments?|homework|hw|worksheets?|problem sets?|activity|activities|lab(?: work)?)\b/, "assignment"],
];

// Effort words. A phrase like "heavy effort" or "light workload" is removed from the title;
// a lone word like "heavy" still sets the effort but stays in the title.
const EFFORT_WORDS: [string, Effort][] = [
  ["heavy|large|big|hard|difficult|long|high|major", "L"],
  ["moderate|medium|average|mid|normal", "M"],
  ["light|small|quick|easy|short|simple|low|minor", "S"],
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
    // "next Friday" = Friday of next week (weeks start on Monday).
    const toNextMonday = ((8 - today) % 7) || 7;
    diff = toNextMonday + ((target + 6) % 7);
  }
  d.setDate(d.getDate() + diff);
  return d;
}

function monthDay(now: Date, month: number, day: number) {
  const d = new Date(now.getFullYear(), month, day);
  if (startOfDay(d) < startOfDay(now)) d.setFullYear(d.getFullYear() + 1);
  return d;
}

const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

function parseDate(text: string, now: Date): { date: Date; phrase: string } | null {
  let m: RegExpMatchArray | null;
  const day = (offset: number) => {
    const d = startOfDay(now);
    d.setDate(d.getDate() + offset);
    return d;
  };
  if ((m = text.match(/\bday after tomorrow\b/))) return { date: day(2), phrase: m[0] };
  if ((m = text.match(/\b(today|tonight|this (?:morning|afternoon|evening))\b/))) return { date: day(0), phrase: m[0] };
  if ((m = text.match(/\b(tomorrow|tomorow|tmrw|tom)\b/))) return { date: day(1), phrase: m[0] };
  if ((m = text.match(/\bin (\d{1,2}|a|an|one|two|three|four|five|six|seven|eight|nine|ten) (day|days|week|weeks)\b/))) {
    const n = NUMBER_WORDS[m[1]] ?? Number(m[1]);
    return { date: day(n * (m[2].startsWith("week") ? 7 : 1)), phrase: m[0] };
  }
  if ((m = text.match(/\b(next|this|on|coming|by)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/))) {
    return { date: nextWeekday(now, WEEKDAYS.indexOf(m[2]), m[1] === "next"), phrase: m[0] };
  }
  if ((m = text.match(/\b(this|end of(?: the)?) weekend\b/))) return { date: nextWeekday(now, 6, false), phrase: m[0] };
  if ((m = text.match(/\bnext week\b/))) return { date: nextWeekday(now, 5, true), phrase: m[0] };
  if ((m = text.match(/\b(end of (?:the )?week|this week)\b/))) return { date: nextWeekday(now, 5, false), phrase: m[0] };
  if ((m = text.match(/\b(next month|end of (?:the )?month)\b/))) {
    const d = m[1] === "next month" ? new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { date: startOfDay(d), phrase: m[0] };
  }
  const monthRe = MONTHS.map((x) => x.slice(0, 3) + "(?:" + x.slice(3) + ")?").join("|");
  if ((m = text.match(new RegExp(`\\b(${monthRe})\\.?\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\b`)))) {
    return { date: monthDay(now, MONTHS.findIndex((x) => x.startsWith(m![1].slice(0, 3))), Number(m[2])), phrase: m[0] };
  }
  if ((m = text.match(new RegExp(`\\b(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${monthRe})\\b`)))) {
    return { date: monthDay(now, MONTHS.findIndex((x) => x.startsWith(m![2].slice(0, 3))), Number(m[1])), phrase: m[0] };
  }
  if ((m = text.match(/\b(\d{1,2})\/(\d{1,2})\b/))) return { date: monthDay(now, Number(m[1]) - 1, Number(m[2])), phrase: m[0] };
  // "on the 23rd": this month, or next month if that day has passed.
  if ((m = text.match(/\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b/))) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 31) {
      let d = new Date(now.getFullYear(), now.getMonth(), n);
      if (startOfDay(d) < startOfDay(now)) d = new Date(now.getFullYear(), now.getMonth() + 1, n);
      return { date: d, phrase: m[0] };
    }
  }
  return null;
}

function parseTime(text: string): { h: number; m: number; phrase: string } | null {
  let m: RegExpMatchArray | null;
  if ((m = text.match(/\b(?:at\s+)?noon\b/))) return { h: 12, m: 0, phrase: m[0] };
  if ((m = text.match(/\b(?:at\s+)?midnight\b/))) return { h: 23, m: 59, phrase: m[0] };
  if ((m = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)/))) {
    let h = Number(m[1]) % 12;
    if (m[3].startsWith("p")) h += 12;
    return { h, m: Number(m[2] ?? 0), phrase: m[0] };
  }
  if ((m = text.match(/\bat\s+(\d{1,2}):(\d{2})\b/))) return { h: Number(m[1]), m: Number(m[2]), phrase: m[0] };
  if ((m = text.match(/\bin the (morning|afternoon|evening)\b/))) {
    return { h: m[1] === "morning" ? 9 : m[1] === "afternoon" ? 15 : 19, m: 0, phrase: m[0] };
  }
  return null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Finds the subject the sentence refers to. Tries, in order: the exact name; a course code
 * spoken with spaces ("cpe 26" for "CPE26"); an acronym ("digital signal processing" for "DSP",
 * or "dsp" for "Digital Signal Processing"); and all key words of the name in any order.
 */
function findSubject(text: string, subjects: { id: number; name: string }[]) {
  const sorted = [...subjects].sort((a, b) => b.name.length - a.name.length);
  const words = text.split(/[^a-z0-9]+/).filter(Boolean);
  const compactText = compact(text);

  for (const s of sorted) {
    if (new RegExp(`\\b${escapeRe(s.name.toLowerCase())}\\b`).test(text)) return s;
  }
  for (const s of sorted) {
    const c = compact(s.name);
    // Codes like "CPE26" or "IT101": letters and digits, long enough not to match by accident.
    if (c.length >= 4 && /\d/.test(c) && compactText.includes(c)) return s;
  }
  for (const s of sorted) {
    const nameWords = s.name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !STOPWORDS.has(w));
    const nameIsAcronym = nameWords.length === 1 && /^[a-z]{2,6}$/.test(nameWords[0]) && s.name === s.name.toUpperCase();
    if (nameIsAcronym) {
      const acr = nameWords[0];
      // Spoken in full: initials of consecutive words ("digital signal processing" -> "dsp").
      for (let i = 0; i + acr.length <= words.length; i++) {
        const initials = words.slice(i, i + acr.length).filter((w) => !STOPWORDS.has(w)).map((w) => w[0]).join("");
        if (initials === acr) return s;
      }
      // Spelled out: "d s p".
      if (new RegExp(`\\b${acr.split("").join("\\s*")}\\b`).test(text)) return s;
    } else if (nameWords.length >= 2) {
      const acr = nameWords.map((w) => w[0]).join("");
      if (acr.length >= 2 && words.includes(acr)) return s;
    }
  }
  for (const s of sorted) {
    const keyWords = s.name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));
    if (keyWords.length && keyWords.every((w) => words.includes(w))) return s;
  }
  return null;
}

function findEffort(text: string): { effort: Effort; phrase: string | null } | null {
  for (const [list, effort] of EFFORT_WORDS) {
    const phrase = text.match(new RegExp(`\\b(?:with\\s+)?(?:a\\s+)?(?:${list})\\s+(?:effort|workload|load|task size)\\b|\\b(?:effort|workload)\\s+(?:is\\s+)?(?:${list})\\b`));
    if (phrase) return { effort, phrase: phrase[0] };
  }
  for (const [list, effort] of EFFORT_WORDS) {
    if (new RegExp(`\\b(?:${list})\\b`).test(text)) return { effort, phrase: null };
  }
  return null;
}

const TRAILING_FILLER = /\s+(that|which|it|is|are|it's|its|due|by|on|at|for|and|with|the|a|an|this|next|of|to)$/;

export function parseTaskText(input: string, subjects: { id: number; name: string }[], now = new Date()): ParsedTask {
  const raw = input.trim().replace(/\s+/g, " ").replace(/[,;]+/g, " ").replace(/\s+/g, " ");
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

  const eff = findEffort(text);
  if (eff) {
    recognised.push("effort");
    if (eff.phrase) consumed.push(eff.phrase);
  }

  const subject = findSubject(text, subjects);
  if (subject) recognised.push("subject");

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
    .replace(/^(please\s+)?(create|add|make|new|set|put|remind me (?:about|of|to)|i have|there is|there's)\s+(an?\s+|the\s+|my\s+)?/, "")
    .replace(/\b(that|which)\s+(is\s+)?due\b/g, " ")
    .replace(/\b(due|deadline(?: is)?)\b\s*(?=$|\s(?:with|and)\b)/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const trailingEffort = new RegExp(`\\s+(?:${EFFORT_WORDS.map(([w]) => w).join("|")})$`);
  for (let changed = true; changed; ) {
    const before = title;
    title = (" " + title).replace(TRAILING_FILLER, "").replace(trailingEffort, "").trim();
    changed = title !== before;
  }
  // Restore the original capitalisation word by word ("cpe 26 quiz" -> "CPE 26 quiz").
  const original = new Map(raw.split(" ").map((w) => [w.toLowerCase(), w] as const));
  title = title.split(" ").map((w) => original.get(w) ?? w).join(" ");
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return { title, type, subjectId: subject?.id ?? null, subjectName: subject?.name ?? null, due, hasTime: !!time, effort: eff?.effort ?? null, recognised };
}
