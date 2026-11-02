import { cx } from "@/lib/cx";

/** ATHENTIV FocusDock mark: a phone resting on a dock, inside a focus ring. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cx("size-10", className)} aria-hidden>
      <rect width="48" height="48" rx="14" fill="#1539B0" />
      <circle cx="24" cy="21" r="13" fill="none" stroke="#8EA9FB" strokeWidth="2.5" strokeDasharray="60 22" strokeLinecap="round" transform="rotate(-90 24 21)" />
      <rect x="19" y="11" width="10" height="17" rx="2.5" fill="#fff" />
      <rect x="22.5" y="12.6" width="3" height="1.2" rx="0.6" fill="#1539B0" />
      <path d="M13 36h22" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M20 30.5 18 36M28 30.5 30 36" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ light, className }: { light?: boolean; className?: string }) {
  return (
    <div className={cx("flex items-center gap-2.5", className)}>
      <LogoMark />
      <div className="leading-tight">
        <div className={cx("text-[10px] font-bold tracking-[0.22em]", light ? "text-brand-200" : "text-brand-600")}>ATHENTIV</div>
        <div className={cx("text-lg font-extrabold tracking-tight", light ? "text-white" : "text-ink")}>FocusDock</div>
      </div>
    </div>
  );
}
