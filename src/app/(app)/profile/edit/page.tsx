"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useMe, type Me } from "@/lib/me";
import { PageHeader } from "@/components/Nav";
import { useToast } from "@/components/Toast";
import { Button, Input, Label, Notice } from "@/components/ui";

const GOALS = [30, 60, 90, 120, 180, 240, 300];

export default function EditProfile() {
  const { me, refresh } = useMe();
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({
    displayName: me.profile.displayName,
    school: me.profile.school ?? "",
    course: me.profile.course ?? "",
    yearLevel: me.profile.yearLevel ?? "",
    dailyGoalMinutes: me.profile.dailyGoalMinutes,
  });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api<Me>("/api/profile", { method: "PATCH", body: f });
      await refresh();
      toast("Profile updated");
      router.back();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFields(err.fields);
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-[480px] px-4">
      <PageHeader title="Edit profile" back="/profile" />
      <form onSubmit={save} className="space-y-4">
        {error && <Notice tone="danger">{error}</Notice>}
        <div>
          <Label htmlFor="dn">Display name</Label>
          <Input id="dn" maxLength={40} value={f.displayName} onChange={set("displayName")} error={fields.displayName} />
        </div>
        <div>
          <Label htmlFor="school">School</Label>
          <Input id="school" maxLength={80} placeholder="e.g. Polytechnic University of the Philippines" value={f.school} onChange={set("school")} />
        </div>
        <div className="grid grid-cols-[1fr_120px] gap-2">
          <div>
            <Label htmlFor="course">Course / strand</Label>
            <Input id="course" maxLength={80} placeholder="e.g. BS Computer Engineering" value={f.course} onChange={set("course")} />
          </div>
          <div>
            <Label htmlFor="yl">Year</Label>
            <Input id="yl" maxLength={30} placeholder="e.g. 2nd" value={f.yearLevel} onChange={set("yearLevel")} />
          </div>
        </div>
        <div>
          <Label>Daily study goal</Label>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <button key={g} type="button" onClick={() => setF({ ...f, dailyGoalMinutes: g })} className={`h-10 rounded-full border px-4 text-sm font-semibold ${f.dailyGoalMinutes === g ? "border-brand-700 bg-brand-700 text-white" : "border-line bg-white text-ink-2"}`}>
                {g < 60 ? `${g}m` : `${g / 60}h`}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-white p-4 text-sm text-ink-2">
          <p><span className="text-muted">Username:</span> <b>@{me.user.username}</b></p>
          <p className="mt-1"><span className="text-muted">Time zone:</span> {me.profile.timezone}</p>
          <p className="mt-1 text-xs text-muted">Your time zone updates automatically from your phone when you sign in.</p>
        </div>
        <Button type="submit" full size="lg" loading={saving}>
          Save
        </Button>
      </form>
    </main>
  );
}
