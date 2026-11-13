"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { CalendarDays, ChartColumn, ChevronLeft, House, ListChecks, Timer, UserRound } from "lucide-react";
import { cx } from "./ui";

export function BottomNav({ standOwner }: { standOwner: boolean }) {
  const path = usePathname();
  // Non-stand accounts never see Focus in the navigation — it isn't available to them.
  const items = [
    { href: "/home", label: "Home", icon: House },
    { href: "/tasks", label: "Tasks", icon: ListChecks },
    standOwner ? { href: "/focus", label: "Focus", icon: Timer } : { href: "/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/summary", label: "Summary", icon: ChartColumn },
    { href: "/profile", label: "Profile", icon: UserRound },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur" aria-label="Main">
      <ul className="mx-auto flex max-w-[480px] px-2 pb-safe pt-1.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <li key={href} className="flex-1">
              <Link href={href} aria-current={active ? "page" : undefined} className={cx("flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-semibold", active ? "text-brand-700" : "text-faint")}>
                <span className={cx("grid h-8 w-12 place-items-center rounded-full transition-colors", active && "bg-brand-50")}>
                  <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// back: a path links there; `true` goes back in history; `{ fallback }` goes back in history,
// or to `fallback` when the page was opened directly (no earlier page in this tab).
export function PageHeader({ title, back, action, subtitle }: { title: ReactNode; back?: string | true | { fallback: string }; action?: ReactNode; subtitle?: ReactNode }) {
  const router = useRouter();
  const goBack = () => {
    if (typeof back === "object" && window.history.length <= 1) router.push(back.fallback);
    else router.back();
  };
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-2 bg-canvas px-2 pt-safe">
      <div className="flex h-12 items-center">
        <div className="w-11">
          {back &&
            (typeof back === "string" ? (
              <Link href={back} aria-label="Back" className="grid size-11 place-items-center rounded-full text-ink active:bg-black/5">
                <ChevronLeft className="size-6" />
              </Link>
            ) : (
              <button aria-label="Back" onClick={goBack} className="grid size-11 place-items-center rounded-full text-ink active:bg-black/5">
                <ChevronLeft className="size-6" />
              </button>
            ))}
        </div>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-[17px] font-bold text-ink">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
        <div className="flex w-11 justify-end">{action}</div>
      </div>
    </header>
  );
}
