"use client";

import { useRef, useState, type ReactNode } from "react";
import { Check, Copy, Download, Eye, EyeOff } from "lucide-react";
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

/**
 * Copies text to the clipboard. The modern Clipboard API only exists on secure pages (HTTPS or
 * localhost), so on a plain-http address such as a phone opening the dev server over Wi-Fi it is
 * missing. In that case fall back to the older copy command on a hidden, selected text field,
 * which phone browsers still support. Returns whether the copy worked.
 */
async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* permission refused: try the fallback below */
    }
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", ""); // no on-screen keyboard
  Object.assign(field.style, { position: "fixed", top: "0", left: "0", opacity: "0", fontSize: "16px" });
  document.body.appendChild(field);
  field.focus();
  field.select();
  field.setSelectionRange(0, text.length); // iPhone needs an explicit range
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  field.remove();
  return ok;
}

export function RecoveryCodeCard({ code }: { code: string }) {
  const toast = useToast();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const codeRef = useRef<HTMLParagraphElement>(null);

  async function copy() {
    if (await copyText(code)) {
      setState("copied");
      toast("Recovery code copied");
      return;
    }
    // Copying isn't allowed here: select the code so the phone's own Copy option can be used,
    // and offer a text file as another way to keep it.
    setState("failed");
    const el = codeRef.current;
    const sel = window.getSelection();
    if (el && sel) {
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([`ATHENTIV FocusDock recovery code\n\n${code}\n\nKeep this somewhere safe. It is the only way to reset your password.\n`], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "focusdock-recovery-code.txt" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="rounded-[20px] border-2 border-dashed border-brand-200 bg-brand-50/60 p-5 text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Your recovery code</p>
      <p ref={codeRef} className="mt-2 select-all font-mono text-xl font-bold tracking-wider text-ink">
        {code}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-sm">
          {state === "copied" ? <Check className="size-4" /> : <Copy className="size-4" />} {state === "copied" ? "Copied" : "Copy code"}
        </button>
        {state === "failed" && (
          <button type="button" onClick={download} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-sm">
            <Download className="size-4" /> Save as file
          </button>
        )}
      </div>
      <p role="status" aria-live="polite" className={state === "failed" ? "mt-3 text-xs font-medium text-amber-700" : "sr-only"}>
        {state === "failed" ? "This browser blocked copying. The code is selected, so use your phone's Copy option, save it as a file, or write it down." : state === "copied" ? "Recovery code copied." : ""}
      </p>
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
