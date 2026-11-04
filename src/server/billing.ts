// Subscription periods and payments. Only the sandbox provider exists today — it never moves
// real money and every transaction it creates is stored with is_test = 1.
import { all, isUniqueViolation, one, run, tx } from "./db";
import { err } from "./http";
import { nextPeriodStart, premiumOf } from "./access";
import { notify } from "./activity";
import { randomToken } from "./crypto";
import { LIMITS, TIME } from "@/shared/limits";

export type PlanRow = {
  code: string;
  name: string;
  period_unit: "day" | "month" | "year";
  period_count: number;
  price_centavos: number;
  currency: string;
  is_public: number;
  sort_order: number;
};

export async function publicPlans() {
  return (await all<PlanRow>("SELECT * FROM subscription_plans WHERE is_public = 1 ORDER BY sort_order")).map((p) => ({
    code: p.code,
    name: p.name,
    priceCentavos: p.price_centavos,
    currency: p.currency,
    period: { unit: p.period_unit, count: p.period_count },
  }));
}

/** Adds a calendar period to `from`. Months clamp to the last day (Jan 31 + 1 month = Feb 28/29). */
export function addPeriod(from: number, unit: PlanRow["period_unit"], count: number): number {
  if (unit === "day") return from + count * TIME.DAY;
  const d = new Date(from);
  const months = unit === "month" ? count : count * 12;
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.getTime();
}

export function paymentMode() {
  return { provider: "sandbox" as const, live: false };
}

export async function createCheckout(userId: number, planCode: string) {
  const plan = await one<PlanRow>("SELECT * FROM subscription_plans WHERE code = ? AND is_public = 1", planCode);
  if (!plan) throw err.badRequest("Unknown plan.");
  const now = Date.now();
  // Expire this user's stale pending checkouts so the history stays tidy.
  await run(
    "UPDATE subscription_transactions SET status = 'cancelled', updated_at = ? WHERE user_id = ? AND status = 'pending' AND created_at < ?",
    now, userId, now - TIME.HOUR,
  );
  const ref = "sbx_" + randomToken(12);
  const { id } = await run(
    `INSERT INTO subscription_transactions (user_id, plan_code, amount_centavos, currency, provider, provider_ref, is_test, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'sandbox', ?, 1, 'pending', ?, ?)`,
    userId, plan.code, plan.price_centavos, plan.currency, ref, now, now,
  );
  return { id, ref };
}

type TxnRow = {
  id: number; user_id: number; plan_code: string; amount_centavos: number; currency: string; provider: string;
  provider_ref: string; is_test: number; status: string; created_at: number; paid_at: number | null;
};
export type TxnWithPlan = TxnRow & { plan_name: string };

export async function getTransaction(userId: number, id: number): Promise<TxnWithPlan> {
  const t = await one<TxnWithPlan>(
    `SELECT t.*, p.name AS plan_name FROM subscription_transactions t JOIN subscription_plans p ON p.code = t.plan_code
      WHERE t.id = ? AND t.user_id = ?`,
    id, userId,
  );
  if (!t) throw err.notFound("Checkout not found.");
  return t;
}

/**
 * Settles a sandbox checkout. Idempotent: a transaction is only ever applied once, enforced by
 * the UNIQUE(transaction_id) constraint on user_subscriptions.
 */
export function settleSandbox(userId: number, id: number, outcome: "success" | "failure" | "cancel") {
  return tx(async () => {
    const t = await getTransaction(userId, id);
    if (t.status !== "pending") return t;
    const now = Date.now();
    if (outcome !== "success") {
      await run("UPDATE subscription_transactions SET status = ?, updated_at = ? WHERE id = ?", outcome === "cancel" ? "cancelled" : "failed", now, id);
      return getTransaction(userId, id);
    }
    const plan = (await one<PlanRow>("SELECT * FROM subscription_plans WHERE code = ?", t.plan_code))!;
    const start = await nextPeriodStart(userId, now);
    const end = addPeriod(start, plan.period_unit, plan.period_count);
    await run("UPDATE subscription_transactions SET status = 'paid', paid_at = ?, updated_at = ? WHERE id = ?", now, now, id);
    await run(
      `INSERT INTO user_subscriptions (user_id, plan_code, source, starts_at, ends_at, transaction_id, created_at)
       VALUES (?, ?, 'purchase', ?, ?, ?, ?)`,
      userId, plan.code, start, end, id, now,
    );
    await notify(userId, {
      kind: "subscription",
      title: "Premium activated (test mode)",
      body: `${plan.name} was added to your account. This was a test payment. No real money was charged.`,
      link: "/premium",
      dedupe: `txn:${id}`,
    });
    return getTransaction(userId, id);
  });
}

/**
 * Grants the one-time 30-day stand-owner trial. Returns true only when the trial was granted
 * by this call. Safe under concurrency: the partial unique index uq_subs_one_trial rejects
 * a second trial row even if two taps race.
 */
export function grantStandTrialOnce(userId: number): Promise<boolean> {
  return tx(async () => {
    const user = await one<{ trial_granted_at: number | null; account_type: string }>(
      "SELECT trial_granted_at, account_type FROM users WHERE id = ?", userId,
    );
    if (!user || user.account_type !== "stand_owner" || user.trial_granted_at) return false;
    const now = Date.now();
    const start = await nextPeriodStart(userId, now);
    try {
      await run(
        `INSERT INTO user_subscriptions (user_id, plan_code, source, starts_at, ends_at, created_at)
         VALUES (?, 'trial', 'trial', ?, ?, ?)`,
        userId, start, start + LIMITS.trialDays * TIME.DAY, now,
      );
    } catch (e) {
      if (isUniqueViolation(e)) return false;
      throw e;
    }
    await run("UPDATE users SET trial_granted_at = ?, updated_at = ? WHERE id = ?", now, now, userId);
    await notify(userId, {
      kind: "subscription",
      title: "Your 30-day Premium trial has started",
      body: "Thanks for docking! Enjoy every Premium feature free for 30 days.",
      link: "/premium",
      dedupe: "trial-granted",
    });
    return true;
  });
}

export async function billingOverview(userId: number) {
  const premium = await premiumOf(userId);
  const periods = (await all<{ plan_code: string; source: string; starts_at: number; ends_at: number }>(
    "SELECT plan_code, source, starts_at, ends_at FROM user_subscriptions WHERE user_id = ? ORDER BY starts_at DESC LIMIT 20",
    userId,
  )).map((p) => ({ plan: p.plan_code, source: p.source, startsAt: p.starts_at, endsAt: p.ends_at }));
  const transactions = (await all<TxnWithPlan>(
    `SELECT t.*, p.name AS plan_name FROM subscription_transactions t JOIN subscription_plans p ON p.code = t.plan_code
      WHERE t.user_id = ? ORDER BY t.created_at DESC LIMIT 20`,
    userId,
  )).map((t) => ({
    id: t.id, plan: t.plan_code, planName: t.plan_name, amountCentavos: t.amount_centavos, status: t.status,
    isTest: !!t.is_test, ref: t.provider_ref, createdAt: t.created_at, paidAt: t.paid_at,
  }));
  return { premium, periods, transactions, plans: await publicPlans(), payment: paymentMode() };
}
