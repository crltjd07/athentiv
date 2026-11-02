import { one, run, tx, isUniqueViolation } from "./db";
import { err } from "./http";
import { hashPassword, recoveryCode, normaliseRecoveryCode, sha256 } from "./crypto";
import type { Auth, UserRow } from "./auth";
import { accessFor } from "./access";
import { isValidTimeZone } from "@/shared/day";

export type ProfileRow = {
  user_id: number;
  display_name: string;
  avatar_key: string;
  school: string | null;
  course: string | null;
  year_level: string | null;
  daily_goal_minutes: number;
  timezone: string;
  onboarded_at: number | null;
  updated_at: number;
};

export const hashRecoveryCode = (code: string) => sha256("recovery:" + normaliseRecoveryCode(code));

/** Creates a user with all of their per-user rows. Returns the plaintext recovery code (shown once). */
export async function createAccount(input: {
  username: string;
  password: string;
  displayName: string;
  accountType: UserRow["account_type"];
  timezone?: string;
  mustChangePassword?: boolean;
}) {
  const passwordHash = await hashPassword(input.password);
  const code = recoveryCode();
  const tz = input.timezone && isValidTimeZone(input.timezone) ? input.timezone : "Asia/Manila";
  const now = Date.now();
  try {
    const userId = tx(() => {
      const id = run(
        `INSERT INTO users (username, password_hash, account_type, recovery_code_hash, must_change_password, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        input.username, passwordHash, input.accountType, hashRecoveryCode(code), !!input.mustChangePassword, now, now,
      ).id;
      run("INSERT INTO user_profiles (user_id, display_name, timezone, updated_at) VALUES (?, ?, ?, ?)", id, input.displayName, tz, now);
      run("INSERT INTO user_preferences (user_id, updated_at) VALUES (?, ?)", id, now);
      run("INSERT INTO pomodoro_configurations (user_id, updated_at) VALUES (?, ?)", id, now);
      run("INSERT INTO study_audio_preferences (user_id, updated_at) VALUES (?, ?)", id, now);
      return id;
    });
    return { user: one<UserRow>("SELECT * FROM users WHERE id = ?", userId)!, recoveryCode: code };
  } catch (e) {
    if (isUniqueViolation(e)) throw err.conflict("USERNAME_TAKEN", "That username is already taken.");
    throw e;
  }
}

export function profileOf(userId: number): ProfileRow {
  return one<ProfileRow>("SELECT * FROM user_profiles WHERE user_id = ?", userId)!;
}

export function profileCompletion(p: ProfileRow, subjectCount: number) {
  const checks = [
    { key: "name", label: "Display name", done: !!p.display_name },
    { key: "avatar", label: "Avatar", done: p.avatar_key !== "fox" || !!p.onboarded_at },
    { key: "school", label: "School", done: !!p.school },
    { key: "course", label: "Course or strand", done: !!p.course },
    { key: "year", label: "Year level", done: !!p.year_level },
    { key: "subjects", label: "At least one subject", done: subjectCount > 0 },
  ];
  return { percent: Math.round((checks.filter((c) => c.done).length / checks.length) * 100), checks };
}

export function mePayload(auth: Auth) {
  const p = profileOf(auth.user.id);
  const access = accessFor(auth);
  const subjectCount = one<{ n: number }>("SELECT COUNT(*) AS n FROM subjects WHERE user_id = ?", auth.user.id)!.n;
  const unread = one<{ n: number }>("SELECT COUNT(*) AS n FROM user_notifications WHERE user_id = ? AND read_at IS NULL", auth.user.id)!.n;
  const stand = access.standOwner
    ? one<{ stand_code: string }>(
        "SELECT s.stand_code FROM stand_assignments a JOIN phone_stands s ON s.id = a.stand_id WHERE a.user_id = ? AND a.unassigned_at IS NULL",
        auth.user.id,
      )
    : undefined;
  const prefs = one<{ session_sound: number; session_vibrate: number }>(
    "SELECT session_sound, session_vibrate FROM user_preferences WHERE user_id = ?", auth.user.id,
  );
  return {
    serverNow: auth.now,
    user: {
      id: auth.user.id,
      username: auth.user.username,
      accountType: auth.user.account_type,
      createdAt: auth.user.created_at,
      mustChangePassword: !!auth.user.must_change_password,
      trialGrantedAt: auth.user.trial_granted_at,
    },
    profile: {
      displayName: p.display_name,
      avatarKey: p.avatar_key,
      school: p.school,
      course: p.course,
      yearLevel: p.year_level,
      dailyGoalMinutes: p.daily_goal_minutes,
      timezone: p.timezone,
      onboarded: !!p.onboarded_at,
    },
    completion: profileCompletion(p, subjectCount),
    subjectCount,
    access,
    stand: stand ? { code: stand.stand_code } : null,
    unreadNotifications: unread,
    alerts: { sound: !!prefs?.session_sound, vibrate: !!prefs?.session_vibrate },
  };
}
export type MePayload = ReturnType<typeof mePayload>;
