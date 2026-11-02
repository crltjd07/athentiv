"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Crown, FlaskConical, Minus, Nfc } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useMe } from "@/lib/me";
import { daysLeftLabel, fmtDate, fmtDateLong } from "@/lib/format";
import { formatPeso, PLAN_COPY } from "@/shared/catalog";
import { PageHeader } from "@/components/Nav";
import { useApiErrorHandler } from "@/components/Premium";
import { Button, Card, Notice, PageSkeleton, SectionTitle, cx } from "@/components/ui";

type Billing = {
  premium: { active: boolean; until: number | null; source: string | null; daysLeft: number; lastEndedAt: number | null };
  plans: { code: string; name: string; priceCentavos: number; period: { unit: string; count: number } }[];
  transactions: { id: number; planName: string; amountCentavos: number; status: string; isTest: boolean; createdAt: number; paidAt: number | null }[];
  periods: { plan: string; source: string; startsAt: number; endsAt: number }[];
  payment: { provider: string; live: boolean };
  accountType: string;
  trialGrantedAt: number | null;
};

type Row = { label: string; free: string | boolean; premium: string | boolean; standOnly?: boolean };
const ROWS: Row[] = [
  { label: "Avatars", free: "4 basic", premium: "All 8" },
  { label: "Open tasks", free: "3 at a time", premium: "Unlimited" },
  { label: "Filter & sort by subject / effort", free: false, premium: true },
  { label: "Summary dashboard", free: "This week", premium: "Weekly, monthly, custom" },
  { label: "Historical comparisons & subject insights", free: false, premium: true },
  { label: "CSV, PDF & JSON exports", free: false, premium: true },
  { label: "Pomodoro presets", free: "25/5", premium: "25/5, 50/10, custom", standOnly: true },
  { label: "Focus sessions per day", free: "4", premium: "Unlimited", standOnly: true },
  { label: "Session history", free: "Last 5", premium: "Last 20 + statistics", standOnly: true },
  { label: "Ambient sounds", free: "3", premium: "All 8", standOnly: true },
  { label: "Mood check-ins", free: "Check in", premium: "Plus history & trends", standOnly: true },
  { label: "Break extensions & task focus history", free: false, premium: true, standOnly: true },
];

export default function PremiumPage() {
  const { me } = useMe();
  const router = useRouter();
  const onError = useApiErrorHandler();
  const { data } = useApi<Billing>("/api/billing");
  const [plan, setPlan] = useState("monthly");
  const [busy, setBusy] = useState(false);
  const stand = me.access.standOwner;

  async function checkout() {
    setBusy(true);
    try {
      const r = await api<{ checkoutUrl: string }>("/api/billing/checkout", { body: { plan } });
      router.push(r.checkoutUrl);
    } catch (e) {
      onError(e);
      setBusy(false);
    }
  }

  const monthly = data?.plans.find((p) => p.code === "monthly")?.priceCentavos ?? 0;

  return (
    <main className="mx-auto max-w-[480px] px-4">
      <PageHeader title="Premium" back />
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-brand-700 to-brand-900 p-5 text-white shadow-[var(--shadow-float)]">
        <div className="absolute -top-8 -right-8 size-32 rounded-full bg-white/10" />
        <div className="flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-brand-200">ATHENTIV</div>
        <h2 className="mt-1 flex items-center gap-2 text-2xl font-extrabold">
          FocusDock Premium <Crown className="size-6 text-amber-300" />
        </h2>
        {!data ? (
          <p className="mt-2 text-sm text-brand-100">Loading your plan…</p>
        ) : data.premium.active ? (
          <div className="mt-3">
            <p className="text-sm text-brand-100">{data.premium.source === "trial" ? "Stand owner trial" : "Premium"} active until</p>
            <p className="text-lg font-bold">{fmtDateLong(data.premium.until!)}</p>
            <p className="mt-1 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{daysLeftLabel(data.premium.until)}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-brand-100">
            You&apos;re on Freemium{data.premium.lastEndedAt ? ` · Premium ended ${fmtDate(data.premium.lastEndedAt)}` : ""}. Your tasks and history are always kept.
          </p>
        )}
      </div>

      {stand && data && !data.trialGrantedAt && (
        <div className="mt-3">
          <Notice icon={<Nfc className="size-4" />}>
            <b>Stand owner gift:</b> tap your FocusDock stand for the first time to get 30 days of Premium free. The trial can only be used once.
          </Notice>
        </div>
      )}
      {stand && data?.trialGrantedAt && (
        <p className="mt-3 px-1 text-xs text-muted">Your one-time stand trial was activated on {fmtDate(data.trialGrantedAt)}.</p>
      )}

      <div className="mt-4">
        <Notice tone="warn" icon={<FlaskConical className="size-4" />}>
          <b>Test mode.</b> Payments run in a sandbox — no real money is charged. Prices are ATHENTIV&apos;s proposed launch prices for the Philippine student market.
        </Notice>
      </div>

      <SectionTitle>{data?.premium.active ? "Extend Premium" : "Choose a plan"}</SectionTitle>
      {!data ? (
        <PageSkeleton />
      ) : (
        <div className="space-y-2.5" role="radiogroup">
          {data.plans.map((p) => {
            const copy = PLAN_COPY[p.code] ?? { tagline: "" };
            const perMonth = p.code === "annual" ? p.priceCentavos / 12 : p.code === "weekly" ? (p.priceCentavos * 52) / 12 : p.priceCentavos;
            return (
              <button key={p.code} role="radio" aria-checked={plan === p.code} onClick={() => setPlan(p.code)} className={cx("relative flex w-full items-center gap-3 rounded-[20px] border-2 bg-white p-4 text-left", plan === p.code ? "border-brand-700 shadow-[var(--shadow-card)]" : "border-line")}>
                <span className={cx("grid size-6 shrink-0 place-items-center rounded-full border-2", plan === p.code ? "border-brand-700 bg-brand-700" : "border-slate-300")}>{plan === p.code && <Check className="size-3.5 text-white" strokeWidth={3} />}</span>
                <span className="flex-1">
                  <span className="flex items-center gap-2 font-bold text-ink">
                    {p.name}
                    {copy.badge && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">{copy.badge}</span>}
                  </span>
                  <span className="block text-xs text-muted">{copy.tagline}{p.code !== "monthly" && monthly ? ` · ≈ ${formatPeso(Math.round(perMonth))}/month` : ""}</span>
                </span>
                <span className="text-right">
                  <span className="block text-xl font-extrabold text-ink">{formatPeso(p.priceCentavos)}</span>
                  <span className="text-xs text-muted">/{p.code === "weekly" ? "week" : p.code === "monthly" ? "month" : "year"}</span>
                </span>
              </button>
            );
          })}
          <Button full size="lg" loading={busy} onClick={checkout}>
            {data.premium.active ? "Extend with this plan" : "Continue to checkout"}
          </Button>
          <p className="px-2 text-center text-xs text-muted">
            {data.premium.active ? "Buying now adds time after your current expiry date — nothing is lost." : "Plans don't auto-renew in test mode. You'll get a reminder before Premium ends."}
          </p>
        </div>
      )}

      <SectionTitle>Freemium vs Premium</SectionTitle>
      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1fr_76px_88px] bg-slate-50 px-4 py-2.5 text-xs font-bold text-muted">
          <span>Feature</span>
          <span className="text-center">Free</span>
          <span className="text-center text-brand-700">Premium</span>
        </div>
        {ROWS.filter((r) => stand || !r.standOnly).map((r) => (
          <div key={r.label} className="grid grid-cols-[1fr_76px_88px] items-center border-t border-line px-4 py-2.5 text-[13px]">
            <span className="pr-2 text-ink">{r.label}</span>
            <Cell v={r.free} />
            <Cell v={r.premium} strong />
          </div>
        ))}
      </Card>
      {!stand && (
        <p className="mt-3 px-1 text-xs text-muted">
          Focus sessions (Pomodoro), mood check-ins and stand features need an ATHENTIV FocusDock phone stand. Premium alone doesn&apos;t unlock them.
        </p>
      )}

      {data && data.transactions.length > 0 && (
        <>
          <SectionTitle>Billing history</SectionTitle>
          <Card className="divide-y divide-line">
            {data.transactions.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <div className="flex-1">
                  <p className="font-semibold text-ink">{t.planName}</p>
                  <p className="text-xs text-muted">
                    {fmtDate(t.createdAt)}
                    {t.isTest && " · test payment"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-ink">{formatPeso(t.amountCentavos)}</p>
                  <p className={cx("text-xs font-semibold capitalize", t.status === "paid" ? "text-green-600" : t.status === "pending" ? "text-amber-600" : "text-muted")}>{t.status}</p>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}
    </main>
  );
}

function Cell({ v, strong }: { v: string | boolean; strong?: boolean }) {
  if (v === true) return <Check className="mx-auto size-4 text-green-600" strokeWidth={3} />;
  if (v === false) return <Minus className="mx-auto size-4 text-faint" />;
  return <span className={cx("text-center text-[12px]", strong ? "font-semibold text-brand-700" : "text-muted")}>{v}</span>;
}
