"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useMe } from "@/lib/me";
import { PageHeader } from "@/components/Nav";
import { useApiErrorHandler } from "@/components/Premium";
import { Card, PageSkeleton, SectionTitle, Toggle } from "@/components/ui";

type Prefs = {
  deadlineReminders: boolean; reminderLeadHours: number; overdueAlerts: boolean; sessionSound: boolean;
  sessionVibrate: boolean; dailySummary: boolean; subscriptionAlerts: boolean; weeklyGoalDays: number;
};

const LEADS = [3, 12, 24, 48, 72];

export default function NotificationPrefs() {
  const { me, refresh } = useMe();
  const onError = useApiErrorHandler();
  const { data, setData } = useApi<Prefs>("/api/preferences");
  const [perm, setPerm] = useState<string>("unsupported");

  useEffect(() => {
    if ("Notification" in window) setPerm(Notification.permission);
  }, []);

  async function patch(p: Partial<Prefs>) {
    if (!data) return;
    setData({ ...data, ...p });
    try {
      setData(await api<Prefs>("/api/preferences", { method: "PATCH", body: p }));
      if ("sessionSound" in p || "sessionVibrate" in p) void refresh();
    } catch (e) {
      onError(e);
    }
  }

  return (
    <main className="mx-auto max-w-[480px] px-4">
      <PageHeader title="Notifications" back="/profile" />
      {!data ? (
        <PageSkeleton />
      ) : (
        <>
          <SectionTitle>Reminders</SectionTitle>
          <Card className="divide-y divide-line">
            <Toggle label="Upcoming deadlines" description="Remind me before a task is due." checked={data.deadlineReminders} onChange={(v) => patch({ deadlineReminders: v })} />
            {data.deadlineReminders && (
              <div className="flex flex-wrap gap-2 px-4 py-3">
                {LEADS.map((h) => (
                  <button key={h} onClick={() => patch({ reminderLeadHours: h })} className={`h-9 rounded-full border px-3 text-sm font-semibold ${data.reminderLeadHours === h ? "border-brand-700 bg-brand-700 text-white" : "border-line text-ink-2"}`}>
                    {h < 24 ? `${h}h` : `${h / 24}d`} before
                  </button>
                ))}
              </div>
            )}
            <Toggle label="Overdue tasks" description="Let me know when a deadline passes." checked={data.overdueAlerts} onChange={(v) => patch({ overdueAlerts: v })} />
            <Toggle label="Daily recap" description="A summary of yesterday's progress." checked={data.dailySummary} onChange={(v) => patch({ dailySummary: v })} />
            <Toggle label="Subscription updates" description="Before Premium ends, and when it does." checked={data.subscriptionAlerts} onChange={(v) => patch({ subscriptionAlerts: v })} />
          </Card>
          {me.access.standOwner && (
            <>
              <SectionTitle>Focus sessions</SectionTitle>
              <Card className="divide-y divide-line">
                <Toggle label="Chime" description="Play a sound when focus or break ends." checked={data.sessionSound} onChange={(v) => patch({ sessionSound: v })} />
                <Toggle label="Vibrate" description="On phones that support it." checked={data.sessionVibrate} onChange={(v) => patch({ sessionVibrate: v })} />
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="flex-1">
                    <span className="block text-[15px] font-medium text-ink">Phone notifications</span>
                    <span className="block text-xs text-muted">
                      {perm === "granted" ? "Allowed — shown when the app is in the background." : perm === "denied" ? "Blocked in your browser settings." : perm === "unsupported" ? "Not supported by this browser." : "Get an alert when a session ends."}
                    </span>
                  </span>
                  {perm === "default" && (
                    <button onClick={async () => setPerm(await Notification.requestPermission())} className="h-9 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white">
                      Allow
                    </button>
                  )}
                </div>
              </Card>
            </>
          )}
          <p className="mt-4 px-1 text-xs text-muted">Reminders appear in your FocusDock inbox. Push notifications to a closed app aren&apos;t available on the web yet.</p>
        </>
      )}
    </main>
  );
}
