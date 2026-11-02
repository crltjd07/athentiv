"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { Wordmark } from "./Brand";
import { Input } from "./ui";
import { useToast } from "./Toast";

export function AuthScaffold({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-5 pt-safe pb-safe">
      <div className="pt-6">
        <Wordmark />
      </div>
      <div className="mt-10 animate-fade-up">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px] text-muted">{subtitle}</p>}
      </div>
      <div className="mt-8 flex-1">{children}</div>
      {footer && <div className="pt-6 text-center text-sm text-muted">{footer}</div>}
    </main>
  );
}

export function PasswordInput({ error, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  const [show, setShow] = useState(false);
  return (
    <Input
      {...rest}
      error={error}
      type={show ? "text" : "password"}
      trailing={
        <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((s) => !s)} className="text-faint">
          {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      }
    />
  );
}

export function RecoveryCodeCard({ code }: { code: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-[20px] border-2 border-dashed border-brand-200 bg-brand-50/60 p-5 text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Your recovery code</p>
      <p className="mt-2 select-all font-mono text-xl font-bold tracking-wider text-ink">{code}</p>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            toast("Recovery code copied");
          } catch {
            toast("Couldn't copy — please write it down.", "error");
          }
        }}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-sm"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy code"}
      </button>
      <p className="mt-3 text-xs text-muted">
        Save this somewhere safe. It&apos;s the only way to reset your password, and it won&apos;t be shown again.
      </p>
    </div>
  );
}

/** Only allow same-site relative redirects after login. */
export function safeNext(next: string | null, fallback = "/home") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export const deviceTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};
