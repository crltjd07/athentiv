"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button, cx } from "./ui";

/** Bottom sheet modal — the primary overlay pattern on phones. */
export function Sheet({ open, onClose, title, children, className }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; className?: string }) {
  const panel = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button aria-label="Close" className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-fade-up" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        className={cx("relative max-h-[88dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] bg-white px-5 pt-3 pb-safe shadow-2xl outline-none animate-sheet", className)}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink">{title}</h2>
            <button aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-slate-100 text-ink-2">
              <X className="size-4" />
            </button>
          </div>
        )}
        {children}
        <div className="h-3" />
      </div>
    </div>,
    document.body,
  );
}

type ConfirmOpts = { title: string; body?: string; confirmLabel?: string; danger?: boolean };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Sheet open={!!state} onClose={() => close(false)}>
        {state && (
          <div className="pt-1 text-center">
            <h2 className="text-lg font-bold text-ink">{state.title}</h2>
            {state.body && <p className="mx-auto mt-2 max-w-xs text-sm text-muted">{state.body}</p>}
            <div className="mt-6 space-y-2.5">
              <Button full variant={state.danger ? "danger" : "primary"} onClick={() => close(true)}>
                {state.confirmLabel ?? "Confirm"}
              </Button>
              <Button full variant="ghost" onClick={() => close(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);
