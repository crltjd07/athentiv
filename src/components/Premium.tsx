"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Crown, Lock, Sparkles } from "lucide-react";
import { ApiClientError } from "@/lib/api";
import { useToast } from "./Toast";
import { Sheet } from "./Sheet";
import { Button, cx } from "./ui";

export function PremiumBadge({ className, label = "Premium" }: { className?: string; label?: string }) {
  return (
    <span className={cx("inline-flex h-6 items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-2.5 text-[11px] font-bold text-white shadow-sm", className)}>
      <Crown className="size-3.5" strokeWidth={2.5} /> {label}
    </span>
  );
}

export function LockIcon({ className }: { className?: string }) {
  return (
    <span className={cx("grid size-5 place-items-center rounded-full bg-amber-100 text-amber-600", className)}>
      <Lock className="size-3" strokeWidth={2.5} />
    </span>
  );
}

const BENEFITS = [
  "All 8 avatars, including Robot, Rocket, Frog and Star",
  "Unlimited open tasks with subject and effort filters",
  "Detailed weekly, monthly and custom-range analytics",
  "CSV, PDF and JSON exports of your data",
  "Stand owners: 50/10 and custom Pomodoro, unlimited sessions, all sounds and mood history",
];

const Ctx = createContext<(feature?: string) => void>(() => {});

export function UpgradeProvider({ children }: { children: ReactNode }) {
  const [feature, setFeature] = useState<string | null>(null);
  const router = useRouter();
  const open = useCallback((f?: string) => setFeature(f ?? "This feature"), []);
  return (
    <Ctx.Provider value={open}>
      {children}
      <Sheet open={feature !== null} onClose={() => setFeature(null)}>
        <div className="text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-lg animate-pop">
            <Sparkles className="size-8" />
          </div>
          <h2 className="mt-4 text-xl font-extrabold tracking-tight text-ink">Unlock with Premium</h2>
          <p className="mt-1 text-sm text-muted">{feature} is part of ATHENTIV FocusDock Premium.</p>
        </div>
        <ul className="mt-5 space-y-2.5">
          {BENEFITS.map((b) => (
            <li key={b} className="flex gap-2.5 text-sm text-ink-2">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              {b}
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-center text-xs text-muted">Plans from ₱29/week · Your data is kept if Premium ends</p>
        <div className="mt-5 space-y-2">
          <Button
            full
            onClick={() => {
              setFeature(null);
              router.push("/premium");
            }}
          >
            See Premium plans
          </Button>
          <Button full variant="ghost" onClick={() => setFeature(null)}>
            Not now
          </Button>
        </div>
      </Sheet>
    </Ctx.Provider>
  );
}

export const useUpgrade = () => useContext(Ctx);

/** Shows the upgrade sheet for Premium errors and a toast for everything else. */
export function useApiErrorHandler() {
  const upgrade = useUpgrade();
  const toast = useToast();
  return useCallback(
    (e: unknown) => {
      if (e instanceof ApiClientError && e.code === "PREMIUM_REQUIRED") upgrade(String(e.extra.feature ?? "This feature"));
      else if (e instanceof ApiClientError && e.status === 401) return;
      else toast(e instanceof Error ? e.message : "Something went wrong.", "error");
    },
    [upgrade, toast],
  );
}

export function LockedCard({ title, body, feature, className }: { title: string; body: string; feature: string; className?: string }) {
  const upgrade = useUpgrade();
  return (
    <div className={cx("relative overflow-hidden rounded-[20px] border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4", className)}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-600">
          <Lock className="size-5" />
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-ink">{title}</h3>
            <PremiumBadge className="h-5 px-2 text-[10px]" />
          </div>
          <p className="mt-1 text-sm text-muted">{body}</p>
          <button onClick={() => upgrade(feature)} className="mt-3 text-sm font-semibold text-brand-700">
            Unlock with Premium →
          </button>
        </div>
      </div>
    </div>
  );
}
