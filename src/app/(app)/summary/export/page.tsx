"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { useMe } from "@/lib/me";
import { fmtDateTime, localDayKey } from "@/lib/format";
import { PageHeader } from "@/components/Nav";
import { LockedCard } from "@/components/Premium";
import { Button, Card, Chip, Input, Label, SectionTitle, cx } from "@/components/ui";
import { useToast } from "@/components/Toast";

type Kind = "tasks" | "pomodoro" | "stats" | "mood" | "full";
type Format = "csv" | "pdf";

const KINDS: { key: Kind; label: string; desc: string; formats: Format[]; standOnly?: boolean; moodOnly?: boolean }[] = [
  { key: "full", label: "Full activity report", desc: "Summary, tasks and focus sessions", formats: ["pdf"] },
  { key: "stats", label: "Productivity summary", desc: "Totals for each day", formats: ["pdf", "csv"] },
  { key: "tasks", label: "Tasks", desc: "Titles, subjects, deadlines and status", formats: ["csv"] },
  { key: "pomodoro", label: "Focus sessions", desc: "Every Pomodoro session", formats: ["csv"], standOnly: true },
  { key: "mood", label: "Mood check-ins", desc: "Your check-in history", formats: ["csv"], moodOnly: true },
];
const FORMAT_ICON = { csv: FileSpreadsheet, pdf: FileText };
const RANGES = [
  { key: 7, label: "Last 7 days" },
  { key: 30, label: "Last 30 days" },
  { key: 90, label: "Last 90 days" },
  { key: 0, label: "Custom" },
];

export default function ExportPage() {
  const { me } = useMe();
  const kinds = KINDS.filter((k) => (!k.standOnly || me.access.standOwner) && (!k.moodOnly || me.access.features.moodHistory));
  const [kind, setKind] = useState<Kind>("full");
  const [format, setFormat] = useState<Format>("pdf");
  const [preset, setPreset] = useState(30);
  const today = localDayKey(new Date());
  const [from, setFrom] = useState(localDayKey(Date.now() - 29 * 86_400_000));
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const history = useApi<{ items: { id: number; kind: string; format: string; status: string; rows: number | null; createdAt: number }[] }>(me.access.features.exports ? "/api/export?history=1" : null);

  if (!me.access.features.exports) {
    return (
      <main className="mx-auto max-w-[480px] px-4">
        <PageHeader title="Export Data" back="/summary" />
        <LockedCard title="Exports are a Premium feature" body="Download your tasks, focus sessions and productivity reports as CSV, PDF or JSON for any date range." feature="Data exports" />
      </main>
    );
  }

  const current = kinds.find((k) => k.key === kind)!;
  const fmt = current.formats.includes(format) ? format : current.formats[0];
  const range = preset ? { from: localDayKey(Date.now() - (preset - 1) * 86_400_000), to: today } : { from, to };
  const href = `/api/export?kind=${kind}&format=${fmt}&from=${range.from}&to=${range.to}`;

  // Fetch the file and save it with its real name. Opening the URL directly made phone
  // browsers show the PDF in a tab instead of saving it.
  async function download() {
    setBusy(true);
    try {
      const res = await fetch(href, { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? "The file couldn't be created. Please try again.");
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? `focusdock-${kind}.${fmt}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast(`Saved ${name}`);
      void history.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "The file couldn't be created.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-[480px] px-4">
      <PageHeader title="Export Data" back="/summary" />
      <Label>What to export</Label>
      <Card className="divide-y divide-line">
        {kinds.map((k) => (
          <button key={k.key} onClick={() => setKind(k.key)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
            <span className={cx("grid size-5 place-items-center rounded-full border-2", kind === k.key ? "border-brand-700" : "border-slate-300")}>{kind === k.key && <span className="size-2.5 rounded-full bg-brand-700" />}</span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold text-ink">{k.label}</span>
              <span className="block text-xs text-muted">{k.desc}</span>
            </span>
          </button>
        ))}
      </Card>

      <div className="mt-5">
        <Label>Format</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["pdf", "csv"] as Format[]).map((f) => {
            const Icon = FORMAT_ICON[f];
            const ok = current.formats.includes(f);
            return (
              <button key={f} disabled={!ok} onClick={() => setFormat(f)} className={cx("flex flex-col items-center gap-1 rounded-2xl border py-3 text-xs font-bold uppercase", fmt === f ? "border-brand-700 bg-brand-700 text-white" : "border-line bg-white text-ink-2", !ok && "opacity-35")}>
                <Icon className="size-5" />
                {f}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <Label>Date range</Label>
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => <Chip key={r.key} selected={preset === r.key} onClick={() => setPreset(r.key)}>{r.label}</Chip>)}
        </div>
        {preset === 0 && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Input type="date" aria-label="From" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" aria-label="To" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
      </div>

      <Button full size="lg" className="mt-6" loading={busy} icon={<Download className="size-5" />} onClick={download}>
        Download {fmt.toUpperCase()}
      </Button>

      {history.data && history.data.items.length > 0 && (
        <>
          <SectionTitle>Recent exports</SectionTitle>
          <Card className="divide-y divide-line">
            {history.data.items.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-ink">
                  {KINDS.find((k) => k.key === e.kind)?.label ?? e.kind} · <span className="uppercase">{e.format}</span>
                </span>
                <span className={cx("text-xs", e.status === "completed" ? "text-muted" : "text-red-600")}>{e.status === "completed" ? fmtDateTime(e.createdAt) : e.status}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </main>
  );
}
