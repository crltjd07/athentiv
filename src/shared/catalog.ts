// Display catalogues shared by client and server. Keys must match the CHECK constraints in
// db/migrations/001_init.sql.

export const BRAND = {
  company: "ATHENTIV",
  product: "ATHENTIV FocusDock",
  short: "FocusDock",
  tagline: "Small steps today, big results tomorrow.",
} as const;

export type Tier = "free" | "premium";

export const AVATARS = [
  { key: "fox", name: "Fox", emoji: "🦊", tier: "free", bg: "#FFE9DA" },
  { key: "owl", name: "Owl", emoji: "🦉", tier: "free", bg: "#EEE6FF" },
  { key: "panda", name: "Panda", emoji: "🐼", tier: "free", bg: "#E6ECF4" },
  { key: "cat", name: "Cat", emoji: "🐱", tier: "free", bg: "#FFF1CC" },
  { key: "robot", name: "Robot", emoji: "🤖", tier: "premium", bg: "#DCE8FF" },
  { key: "rocket", name: "Rocket", emoji: "🚀", tier: "premium", bg: "#E2E6FF" },
  { key: "frog", name: "Frog", emoji: "🐸", tier: "premium", bg: "#DDF5E3" },
  { key: "star", name: "Star", emoji: "⭐", tier: "premium", bg: "#FFF3C4" },
] as const satisfies readonly { key: string; name: string; emoji: string; tier: Tier; bg: string }[];
export type AvatarKey = (typeof AVATARS)[number]["key"];
export const AVATAR_KEYS = AVATARS.map((a) => a.key) as [AvatarKey, ...AvatarKey[]];
export const avatarOf = (key: string) => AVATARS.find((a) => a.key === key) ?? AVATARS[0];

export const MOODS = [
  { key: "great", label: "Great", emoji: "😄", color: "#16A34A", bg: "#DCFCE7", score: 5 },
  { key: "good", label: "Good", emoji: "🙂", color: "#2563EB", bg: "#DBEAFE", score: 4 },
  { key: "okay", label: "Okay", emoji: "😐", color: "#0891B2", bg: "#CFFAFE", score: 3 },
  { key: "tired", label: "Tired", emoji: "😴", color: "#7C3AED", bg: "#EDE9FE", score: 2 },
  { key: "stressed", label: "Stressed", emoji: "😣", color: "#DC2626", bg: "#FEE2E2", score: 1 },
  { key: "unmotivated", label: "Unmotivated", emoji: "😶", color: "#64748B", bg: "#E2E8F0", score: 1 },
] as const;
export type MoodKey = (typeof MOODS)[number]["key"];
export const MOOD_KEYS = MOODS.map((m) => m.key) as [MoodKey, ...MoodKey[]];
export const moodOf = (key: string) => MOODS.find((m) => m.key === key) ?? MOODS[2];

export const MINDSETS = [
  { key: "ready", label: "Ready to study" },
  { key: "need_focus", label: "Need to focus" },
  { key: "distracted", label: "Feeling distracted" },
  { key: "pressured", label: "Feeling pressured" },
  { key: "starting", label: "Just getting started" },
] as const;
export type MindsetKey = (typeof MINDSETS)[number]["key"];
export const MINDSET_KEYS = MINDSETS.map((m) => m.key) as [MindsetKey, ...MindsetKey[]];
export const mindsetOf = (key: string) => MINDSETS.find((m) => m.key === key) ?? MINDSETS[0];

export const TASK_TYPES = [
  { key: "quiz", label: "Quiz" },
  { key: "report", label: "Report" },
  { key: "project", label: "Project" },
  { key: "exam", label: "Exam" },
  { key: "assignment", label: "Assignment" },
  { key: "other", label: "Other" },
] as const;
export type TaskType = (typeof TASK_TYPES)[number]["key"];
export const TASK_TYPE_KEYS = TASK_TYPES.map((t) => t.key) as [TaskType, ...TaskType[]];
export const taskTypeLabel = (key: string) => TASK_TYPES.find((t) => t.key === key)?.label ?? "Other";

export const EFFORTS = [
  // Stored keys stay S/M/L so existing tasks keep their effort; only the labels changed.
  { key: "S", label: "Light", hint: "Under 1 hour", color: "#15803D", bg: "#DCFCE7" },
  { key: "M", label: "Moderate", hint: "1 to 3 hours", color: "#B45309", bg: "#FEF3C7" },
  { key: "L", label: "Heavy", hint: "Over 3 hours", color: "#BE123C", bg: "#FFE4E6" },
] as const;
export type Effort = (typeof EFFORTS)[number]["key"];
export const EFFORT_KEYS = ["S", "M", "L"] as [Effort, ...Effort[]];
export const effortOf = (key: string) => EFFORTS.find((e) => e.key === key) ?? EFFORTS[0];

export type TaskStatus = "pending" | "in_progress" | "completed" | "overdue";
export const TASK_STATUSES: { key: TaskStatus; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "overdue", label: "Overdue" },
];

export const SUBJECT_COLORS = [
  "#2563EB", "#16A34A", "#7C3AED", "#EA580C", "#DC2626", "#0891B2", "#DB2777", "#4F46E5", "#CA8A04", "#475569",
] as const;

/** Icon keys map to lucide icons in src/components/SubjectIcon.tsx. */
export const SUBJECT_ICONS = [
  "sigma", "code", "atom", "flask", "book", "languages", "landmark", "dumbbell", "users", "cpu", "database",
  "network", "leaf", "palette", "music", "globe", "calculator", "pen",
] as const;
export type SubjectIcon = (typeof SUBJECT_ICONS)[number];

/** Quick picks offered during onboarding and in the subject sheet. */
export const SUBJECT_PRESETS: { name: string; icon: SubjectIcon; color: string }[] = [
  { name: "Mathematics", icon: "sigma", color: "#2563EB" },
  { name: "Science", icon: "atom", color: "#16A34A" },
  { name: "English", icon: "book", color: "#7C3AED" },
  { name: "Programming", icon: "code", color: "#4F46E5" },
  { name: "Filipino", icon: "languages", color: "#CA8A04" },
  { name: "History", icon: "landmark", color: "#EA580C" },
  { name: "Physics", icon: "atom", color: "#0891B2" },
  { name: "Chemistry", icon: "flask", color: "#DB2777" },
  { name: "Data Structures", icon: "database", color: "#7C3AED" },
  { name: "Embedded Systems", icon: "cpu", color: "#475569" },
  { name: "Computer Networks", icon: "network", color: "#16A34A" },
  { name: "PE", icon: "dumbbell", color: "#DC2626" },
  { name: "NSTP", icon: "users", color: "#0891B2" },
];

export const SOUNDS = [
  { key: "rain", label: "Rain", tier: "free" },
  { key: "brown", label: "Brown noise", tier: "free" },
  { key: "white", label: "White noise", tier: "free" },
  { key: "ocean", label: "Ocean waves", tier: "premium" },
  { key: "forest", label: "Forest", tier: "premium" },
  { key: "fireplace", label: "Fireplace", tier: "premium" },
  { key: "fan", label: "Fan", tier: "premium" },
  { key: "pink", label: "Pink noise", tier: "premium" },
] as const satisfies readonly { key: string; label: string; tier: Tier }[];
export type SoundKey = (typeof SOUNDS)[number]["key"];
export const SOUND_KEYS = SOUNDS.map((s) => s.key) as [SoundKey, ...SoundKey[]];

export const PRESETS = [
  { key: "25/5", focus: 25, break: 5, tier: "free" },
  { key: "50/10", focus: 50, break: 10, tier: "premium" },
] as const;
export type PresetKey = "25/5" | "50/10" | "custom";

export const BREAK_ACTIVITIES = [
  "Stretch your shoulders and neck.",
  "Drink a glass of water.",
  "Look at something 6 metres away for 20 seconds.",
  "Stand up and walk around for a minute.",
  "Take five slow, deep breaths.",
  "Tidy one small thing on your desk.",
  "Close your eyes and rest them for a moment.",
];

export const PLAN_COPY: Record<string, { tagline: string; badge?: string }> = {
  weekly: { tagline: "Try it for a busy week" },
  monthly: { tagline: "Best for the whole term", badge: "Popular" },
  annual: { tagline: "A full school year", badge: "Save 33%" },
};

export function formatPeso(centavos: number): string {
  return "₱" + (centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
