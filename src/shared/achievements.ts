export const ACHIEVEMENTS = [
  { key: "first_task", title: "First step", desc: "Create your first task", icon: "flag", standOnly: false },
  { key: "tasks_10", title: "Getting things done", desc: "Complete 10 tasks", icon: "check", standOnly: false },
  { key: "tasks_50", title: "Unstoppable", desc: "Complete 50 tasks", icon: "trophy", standOnly: false },
  { key: "early_bird", title: "Ahead of schedule", desc: "Finish 5 tasks at least a day early", icon: "sunrise", standOnly: false },
  { key: "streak_3", title: "On a roll", desc: "Study 3 days in a row", icon: "flame", standOnly: false },
  { key: "streak_7", title: "Week warrior", desc: "Study 7 days in a row", icon: "flame", standOnly: false },
  { key: "first_focus", title: "Deep diver", desc: "Complete your first focus session", icon: "timer", standOnly: true },
  { key: "focus_25", title: "Focus regular", desc: "Complete 25 focus sessions", icon: "target", standOnly: true },
  { key: "hours_10", title: "Ten-hour club", desc: "Focus for 10 hours in total", icon: "clock", standOnly: true },
  { key: "checkin_7", title: "Self-aware", desc: "Do 7 mood check-ins", icon: "heart", standOnly: true },
] as const;
export type AchievementKey = (typeof ACHIEVEMENTS)[number]["key"];
