"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Award, Bell, CalendarClock, Crown, TriangleAlert, ChartColumn, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useMe } from "@/lib/me";
import { fmtRelative } from "@/lib/format";
import { PageHeader } from "@/components/Nav";
import { Card, EmptyState, ErrorState, PageSkeleton, cx } from "@/components/ui";

type Item = { id: number; kind: string; title: string; body: string; link: string | null; read: boolean; createdAt: number };
const ICON: Record<string, { icon: LucideIcon; cls: string }> = {
  deadline: { icon: CalendarClock, cls: "bg-brand-50 text-brand-700" },
  overdue: { icon: TriangleAlert, cls: "bg-red-50 text-red-600" },
  subscription: { icon: Crown, cls: "bg-amber-50 text-amber-600" },
  achievement: { icon: Award, cls: "bg-amber-50 text-amber-600" },
  summary: { icon: ChartColumn, cls: "bg-green-50 text-green-700" },
};

export default function Notifications() {
  const { refresh } = useMe();
  const { data, error, loading, reload } = useApi<{ items: Item[] }>("/api/notifications");

  // Opening the inbox marks everything as read.
  useEffect(() => {
    if (data?.items.some((i) => !i.read)) {
      void api("/api/notifications", { body: { all: true } }).then(refresh).catch(() => {});
    }
  }, [data, refresh]);

  return (
    <main className="mx-auto max-w-[480px] px-4">
      <PageHeader title="Notifications" back />
      {loading && !data ? (
        <PageSkeleton />
      ) : error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data?.items.length ? (
        <EmptyState icon={<Bell className="size-7" />} title="No notifications" body="Deadline reminders, achievements and plan updates will show up here." />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {data.items.map((n) => {
            const { icon: Icon, cls } = ICON[n.kind] ?? { icon: Bell, cls: "bg-slate-100 text-ink-2" };
            const inner = (
              <div className={cx("flex gap-3 px-4 py-3.5", !n.read && "bg-brand-50/40")}>
                <span className={cx("grid size-10 shrink-0 place-items-center rounded-xl", cls)}>
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{n.title}</p>
                  <p className="text-sm text-ink-2">{n.body}</p>
                  <p className="mt-0.5 text-xs text-muted">{fmtRelative(n.createdAt)}</p>
                </div>
                {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-600" />}
              </div>
            );
            return n.link ? <Link key={n.id} href={n.link} className="block">{inner}</Link> : <div key={n.id}>{inner}</div>;
          })}
        </Card>
      )}
    </main>
  );
}
