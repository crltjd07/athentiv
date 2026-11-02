// Supportive, non-clinical messages shown after a check-in. Deliberately avoids diagnoses or
// claims about mental health; it only suggests a gentle study approach.
import type { MindsetKey, MoodKey } from "./catalog";

const MOOD_LINES: Record<MoodKey, string> = {
  great: "Love that energy! Let's put it to good use.",
  good: "Nice — a good day is a great day to make progress.",
  okay: "Okay is a perfectly fine place to start.",
  tired: "Thanks for being honest. Small, steady steps still count.",
  stressed: "That sounds heavy. Let's make the next step small and clear.",
  unmotivated: "Motivation often shows up after you start, not before.",
};

const MINDSET_TIPS: Record<MindsetKey, string> = {
  ready: "Pick your most important task and dive in.",
  need_focus: "Put your phone on the stand, choose one task, and let the timer do the rest.",
  distracted: "Try one short session with a single task — just 25 minutes.",
  pressured: "List what's due soonest and tackle the smallest piece first.",
  starting: "Begin with a quick win to build momentum.",
};

const BASE: Record<MoodKey, number> = { great: 5, good: 4, okay: 3, tired: 2, stressed: 2, unmotivated: 1 };
const ADJ: Record<MindsetKey, number> = { ready: 1, need_focus: 0.5, starting: 0, distracted: -0.5, pressured: -0.5 };

export function checkinResponse(mood: MoodKey, mindset: MindsetKey) {
  const score = Math.max(1, Math.min(5, BASE[mood] + ADJ[mindset]));
  const readiness = score >= 4.5 ? "high" : score >= 3 ? "steady" : "gentle";
  const suggestion = {
    high: { label: "High readiness", text: "A good moment for a large-effort task or a longer focus block.", effort: "L" as const },
    steady: { label: "Steady readiness", text: "A medium task with a standard 25-minute session fits well.", effort: "M" as const },
    gentle: { label: "Take it gently", text: "Start with a small task and a short session. Rest when you need to.", effort: "S" as const },
  }[readiness];
  return { message: MOOD_LINES[mood], tip: MINDSET_TIPS[mindset], readiness, suggestion };
}
