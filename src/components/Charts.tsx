// Lightweight SVG charts. All values come straight from API data; empty data renders an empty state.
import { cx } from "@/lib/cx";

export function BarChart({
  data,
  height = 140,
  color = "#2F5BEA",
  highlight,
  unit = "",
  goal,
}: {
  data: { label: string; value: number; key: string }[];
  height?: number;
  color?: string;
  highlight?: string;
  unit?: string;
  goal?: number;
}) {
  const max = Math.max(1, goal ?? 0, ...data.map((d) => d.value));
  const dense = data.length > 14;
  return (
    <div>
      <div className="relative flex items-end gap-[3px]" style={{ height }}>
        {goal ? (
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-brand-300" style={{ bottom: (goal / max) * height }}>
            <span className="absolute -top-4 right-0 text-[10px] font-medium text-brand-500">goal</span>
          </div>
        ) : null}
        {data.map((d) => (
          <div key={d.key} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.label}: ${d.value}${unit}`}>
            {!dense && d.value > 0 && <span className="mb-0.5 text-center text-[10px] font-semibold text-ink-2 tabular">{d.value}</span>}
            <div
              className="w-full rounded-t-md transition-[height] duration-500"
              style={{ height: d.value > 0 ? Math.max(3, (d.value / max) * (height - 16)) : 2, background: d.value > 0 ? (highlight === d.key ? "var(--chart-highlight)" : color) : "var(--chart-track)" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {data.map((d, i) => (
          <div key={d.key} className="flex-1 text-center text-[10px] text-muted">
            {!dense || i % Math.ceil(data.length / 8) === 0 ? d.label : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HBarList({ items, unit = "", total }: { items: { label: string; value: number; color: string; sub?: string }[]; unit?: string; total?: number }) {
  const max = total ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="flex min-w-0 items-center gap-2 font-medium text-ink">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: i.color }} />
              <span className="truncate">{i.label}</span>
            </span>
            <span className="shrink-0 text-ink-2 tabular">
              {i.value}
              {unit}
              {i.sub && <span className="ml-1 text-xs text-muted">{i.sub}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: i.color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Donut({ segments, size = 120, stroke = 16, center }: { segments: { value: number; color: string; label: string }[]; size?: number; stroke?: number; center?: React.ReactNode }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: "var(--chart-track-soft)" }} />
        {total > 0 &&
          segments.map((s) => {
            const len = (s.value / total) * c;
            const el = (
              <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
                strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-offset} />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{center}</div>
    </div>
  );
}

export function StatTile({ label, value, sub, icon, tone = "brand", className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode; tone?: "brand" | "green" | "amber" | "red"; className?: string }) {
  const tones = { brand: "bg-brand-50 text-brand-700", green: "bg-green-50 text-green-700", amber: "bg-amber-50 text-amber-700", red: "bg-red-50 text-red-600" };
  return (
    <div className={cx("rounded-2xl border border-line bg-white p-3.5", className)}>
      <div className="flex items-center gap-2">
        {icon && <span className={cx("grid size-7 place-items-center rounded-lg", tones[tone])}>{icon}</span>}
        <span className="text-xs font-medium text-muted">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight text-ink tabular">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}
