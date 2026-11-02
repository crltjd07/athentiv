// Input validation shared by forms (client) and route handlers (server). The server always
// re-validates; client use is only for instant feedback.
import { z } from "zod";
import {
  AVATAR_KEYS, EFFORT_KEYS, MINDSET_KEYS, MOOD_KEYS, SOUND_KEYS, SUBJECT_ICONS, TASK_TYPE_KEYS,
} from "./catalog";
import { LIMITS } from "./limits";

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, min === 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`);

export const username = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(24, "Username must be at most 24 characters.")
  .regex(/^[a-zA-Z0-9_.]+$/, "Use letters, numbers, dots and underscores only.");

export const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be at most 128 characters.")
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Password needs at least one letter and one number.");

export const displayName = trimmed(1, 40, "Display name");
export const timezone = z.string().max(64).optional();

const nfcProof = z.object({ code: z.string().max(32), key: z.string().max(128) });

export const registerSchema = z.object({ username, password, displayName, timezone });
export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required.").max(64),
  password: z.string().min(1, "Password is required.").max(128),
  timezone,
  nfc: nfcProof.optional(),
});
export const recoverSchema = z.object({
  username: z.string().trim().min(1).max(64),
  recoveryCode: z.string().trim().min(8, "Enter your recovery code.").max(40),
  newPassword: password,
});
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: password });
export const nfcVerifySchema = nfcProof;

export const profileSchema = z
  .object({
    displayName,
    avatarKey: z.enum(AVATAR_KEYS),
    school: trimmed(0, 80, "School").nullable(),
    course: trimmed(0, 80, "Course").nullable(),
    yearLevel: trimmed(0, 30, "Year level").nullable(),
    dailyGoalMinutes: z.number().int().min(10).max(960),
    timezone: z.string().max(64),
    onboarded: z.literal(true),
  })
  .partial();

export const preferencesSchema = z
  .object({
    deadlineReminders: z.boolean(),
    reminderLeadHours: z.number().int().min(1).max(168),
    overdueAlerts: z.boolean(),
    sessionSound: z.boolean(),
    sessionVibrate: z.boolean(),
    dailySummary: z.boolean(),
    subscriptionAlerts: z.boolean(),
    weeklyGoalDays: z.number().int().min(1).max(7),
  })
  .partial();

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Pick a colour.");
export const subjectSchema = z.object({
  name: trimmed(1, 40, "Subject name"),
  color: hexColor,
  icon: z.enum(SUBJECT_ICONS),
});
export const subjectBulkSchema = z.object({ subjects: z.array(subjectSchema).min(1).max(20) });

export const taskSchema = z.object({
  title: trimmed(1, 120, "Title"),
  type: z.enum(TASK_TYPE_KEYS),
  subjectId: z.number().int().positive().nullable(),
  dueAt: z.number().int().min(Date.UTC(2000, 0, 1)).max(Date.UTC(2100, 0, 1)),
  effort: z.enum(EFFORT_KEYS),
  description: trimmed(0, 2000, "Description").nullable().optional(),
});
export const taskPatchSchema = taskSchema.partial();
export const taskStatusSchema = z.object({ status: z.enum(["pending", "in_progress", "completed"]) });
export const checklistItemSchema = z.object({ label: trimmed(1, 120, "Item") });
export const checklistPatchSchema = z.object({ label: trimmed(1, 120, "Item"), done: z.boolean() }).partial();

export const checkinSchema = z.object({
  mood: z.enum(MOOD_KEYS),
  mindset: z.enum(MINDSET_KEYS),
  intensity: z.number().int().min(1).max(5).nullable().optional(),
  note: trimmed(0, 500, "Note").nullable().optional(),
  verificationId: z.number().int().positive().nullable().optional(),
});

export const pomodoroStartSchema = z.object({
  preset: z.enum(["25/5", "50/10", "custom"]),
  focusMinutes: z.number().int().min(LIMITS.customFocusMinutes.min).max(LIMITS.customFocusMinutes.max).optional(),
  breakMinutes: z.number().int().min(LIMITS.customBreakMinutes.min).max(LIMITS.customBreakMinutes.max).optional(),
  taskId: z.number().int().positive().nullable().optional(),
});
export const pomodoroActionSchema = z.object({
  action: z.enum(["pause", "resume", "cancel", "end_early", "skip", "extend", "sync", "start_break"]),
});
export const pomodoroConfigSchema = z
  .object({
    preset: z.enum(["25/5", "50/10", "custom"]),
    customFocusMinutes: z.number().int().min(LIMITS.customFocusMinutes.min).max(LIMITS.customFocusMinutes.max),
    customBreakMinutes: z.number().int().min(LIMITS.customBreakMinutes.min).max(LIMITS.customBreakMinutes.max),
    autoStartBreak: z.boolean(),
    dailyGoalSessions: z.number().int().min(1).max(24),
  })
  .partial();

export const audioSchema = z
  .object({ soundKey: z.enum(SOUND_KEYS), volume: z.number().min(0).max(1) })
  .partial();
export const spotifyLinkSchema = z.object({ url: z.string().trim().max(300), label: trimmed(0, 60, "Label").optional() });

export const checkoutSchema = z.object({ plan: z.enum(["weekly", "monthly", "annual"]) });
export const sandboxPaySchema = z.object({ outcome: z.enum(["success", "failure", "cancel"]) });
