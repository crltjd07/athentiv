"use client";

// Shapes returned by /api/pomodoro/*.
export type PomodoroState = {
  serverNow: number;
  live: null | {
    id: number;
    kind: "focus" | "break";
    status: "active" | "paused";
    preset: "25/5" | "50/10" | "custom";
    plannedSeconds: number;
    remainingMs: number;
    startedAt: number;
    pausedAt: number | null;
    pauseExpiresInMs: number | null;
    extensions: number;
    canExtend: boolean;
    plannedBreakSeconds: number | null;
    task: null | { id: number; title: string; dueAt: number; effort: string; subject: { name: string; color: string | null; icon: string | null } | null };
  };
  last: null | {
    id: number;
    kind: "focus" | "break";
    status: string;
    endReason: string | null;
    endedAt: number | null;
    focusedSeconds: number | null;
    plannedBreakSeconds: number | null;
    breakPending: boolean;
  };
  today: { started: number; completed: number; focusMinutes: number; limit: number | null; remaining: number | null; goalSessions: number };
  config: { preset: "25/5" | "50/10" | "custom"; customFocusMinutes: number; customBreakMinutes: number; autoStartBreak: boolean; dailyGoalSessions: number };
  nfc: { verified: boolean; until: number | null };
};

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

export function systemNotify(title: string, body: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
      new Notification(title, { body, icon: "/icon.svg", tag: "focusdock-timer" });
    }
  } catch {
    /* some mobile browsers only allow notifications from a service worker */
  }
}

export async function requestNotifyPermission() {
  try {
    if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
  } catch {
    /* ignore */
  }
}
