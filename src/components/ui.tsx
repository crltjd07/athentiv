"use client";

import Link from "next/link";
import {forwardRef, useRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes} from "react";
import { AlertTriangle, Inbox, LoaderCircle, RefreshCw } from "lucide-react";

import { cx } from "@/lib/cx";

export { cx };

type Variant = "primary" | "secondary" | "ghost" | "danger" | "light";
const variants: Record<Variant, string> = {
  primary: "bg-brand-700 text-white shadow-[0_6px_16px_rgb(21_57_176/0.28)] active:bg-brand-800 disabled:bg-brand-300 disabled:shadow-none",
  secondary: "bg-white text-brand-700 border border-brand-200 active:bg-brand-50 disabled:text-faint",
  ghost: "bg-transparent text-brand-700 active:bg-brand-50 disabled:text-faint",
  danger: "bg-red-600 text-white active:bg-red-700 disabled:bg-red-300",
  light: "bg-white/15 text-white border border-white/25 active:bg-white/25 backdrop-blur",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
  full?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, full, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[transform,background-color] active:scale-[0.98] disabled:cursor-not-allowed",
        size === "sm" ? "h-9 px-4 text-sm" : size === "lg" ? "h-14 px-6 text-base" : "h-12 px-5 text-[15px]",
        full && "w-full",
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function ButtonLink({ href, variant = "primary", size = "md", full, icon, className, children }: { href: string; variant?: Variant; size?: "sm" | "md" | "lg"; full?: boolean; icon?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-transform active:scale-[0.98]",
        size === "sm" ? "h-9 px-4 text-sm" : size === "lg" ? "h-14 px-6 text-base" : "h-12 px-5 text-[15px]",
        full && "w-full",
        variants[variant],
        className,
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button aria-label={label} title={label} className={cx("grid size-11 place-items-center rounded-full text-ink-2 active:bg-black/5", className)} {...rest}>
      {children}
    </button>
  );
}

export function Card({ className, children, as: As = "div", ...rest }: { className?: string; children: ReactNode; as?: "div" | "section" | "li" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={cx("rounded-[20px] border border-line bg-card shadow-[var(--shadow-card)]", className)} {...rest}>
      {children}
    </As>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-6 flex items-center justify-between px-1">
      <h2 className="text-[17px] font-bold text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function Chip({ selected, children, className, locked, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; locked?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  // In horizontally scrolling chip rows, keep the selected chip fully visible.
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [selected]);
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={selected}
      className={cx(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors",
        selected ? "border-brand-700 bg-brand-700 text-white" : "border-line bg-white text-ink-2 active:bg-brand-50",
        locked && !selected && "text-faint",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({ options, value, onChange, className }: { options: { value: T; label: ReactNode; locked?: boolean }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cx("flex rounded-full border border-line bg-white p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex h-10 flex-1 items-center justify-center gap-1 rounded-full text-sm font-semibold transition-colors",
            value === o.value ? "bg-brand-700 text-white shadow-sm" : "text-ink-2",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between px-1">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {children}
      </label>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { error?: string; leading?: ReactNode; trailing?: ReactNode }>(
  function Input({ error, leading, trailing, className, ...rest }, ref) {
    return (
      <div>
        <div
          className={cx(
            "flex h-12 items-center gap-2 rounded-2xl border bg-white px-3.5 transition-colors focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100",
            error ? "border-red-400" : "border-line",
          )}
        >
          {leading}
          <input ref={ref} aria-invalid={!!error} className={cx("h-full w-full min-w-0 bg-transparent text-ink outline-none placeholder:text-faint", className)} {...rest} />
          {trailing}
        </div>
        {error && <p className="mt-1.5 px-1 text-xs font-medium text-red-600">{error}</p>}
      </div>
    );
  },
);

export function Textarea({ error, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
  return (
    <div>
      <textarea
        aria-invalid={!!error}
        className={cx(
          "min-h-24 w-full rounded-2xl border bg-white px-3.5 py-3 text-ink outline-none placeholder:text-faint focus:border-brand-500 focus:ring-4 focus:ring-brand-100",
          error ? "border-red-400" : "border-line",
          className,
        )}
        {...rest}
      />
      {error && <p className="mt-1.5 px-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  return (
    <label className={cx("flex min-h-14 items-center gap-3 px-4 py-3", disabled && "opacity-50")}>
      <span className="flex-1">
        <span className="block text-[15px] font-medium text-ink">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx("relative block h-7 w-12 shrink-0 rounded-full p-0 transition-colors", checked ? "bg-brand-600" : "bg-slate-300")}
      >
        {/* Anchored to the left edge: 2px inset when off, 2px inset from the right when on (48 - 24 - 2 - 2 = 20px travel). */}
        <span
          aria-hidden
          className={cx("pointer-events-none absolute top-0.5 left-0.5 block size-6 rounded-full bg-[#fff] shadow transition-transform duration-200", checked ? "translate-x-5" : "translate-x-0")}
        />
      </button>
    </label>
  );
}

export function Badge({ children, color = "#1539B0", bg = "#EEF3FF", className }: { children: ReactNode; color?: string; bg?: string; className?: string }) {
  return (
    <span className={cx("inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-semibold", className)} style={{ color, background: bg }}>
      {children}
    </span>
  );
}

export function ProgressBar({ value, color = "var(--color-brand-600)", className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cx("h-2 overflow-hidden rounded-full bg-brand-50", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cx("size-6 animate-spin text-brand-600", className)} aria-label="Loading" />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-2xl bg-slate-200/70", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-3 pt-2" aria-busy>
      <Skeleton className="h-28" />
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center animate-fade-up">
      <div className="mb-4 grid size-16 place-items-center rounded-3xl bg-brand-50 text-brand-600">{icon ?? <Inbox className="size-7" />}</div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {body && <p className="mt-1 max-w-xs text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-4 grid size-16 place-items-center rounded-3xl bg-red-50 text-red-600">
        <AlertTriangle className="size-7" />
      </div>
      <h3 className="text-base font-bold text-ink">Couldn&apos;t load this</h3>
      <p className="mt-1 max-w-xs text-sm text-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" icon={<RefreshCw className="size-4" />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Notice({ tone = "info", children, icon }: { tone?: "info" | "warn" | "success" | "danger"; children: ReactNode; icon?: ReactNode }) {
  const tones = {
    info: "bg-brand-50 text-brand-800 border-brand-100",
    warn: "bg-amber-50 text-amber-900 border-amber-200",
    success: "bg-green-50 text-green-800 border-green-200",
    danger: "bg-red-50 text-red-800 border-red-200",
  };
  return (
    <div className={cx("flex gap-2.5 rounded-2xl border px-3.5 py-3 text-sm", tones[tone])}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function ListLink({ href, icon, label, detail, onClick, danger }: { href?: string; icon: ReactNode; label: string; detail?: ReactNode; onClick?: () => void; danger?: boolean }) {
  const inner = (
    <>
      <span className={cx("grid size-9 shrink-0 place-items-center rounded-xl", danger ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-700")}>{icon}</span>
      <span className={cx("flex-1 text-left text-[15px] font-medium", danger ? "text-red-600" : "text-ink")}>{label}</span>
      {detail && <span className="text-sm text-muted">{detail}</span>}
    </>
  );
  const cls = "flex min-h-14 w-full items-center gap-3 px-4 py-2.5 active:bg-slate-50";
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
