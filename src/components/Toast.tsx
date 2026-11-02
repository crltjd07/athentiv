"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { cx } from "./ui";

type Tone = "success" | "error" | "info";
type Toast = { id: number; tone: Tone; text: string };
type Push = (text: string, tone?: Tone) => void;

const Ctx = createContext<Push>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback<Push>((text, tone = "success") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { id, tone, text }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), tone === "error" ? 4500 : 2800);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-safe" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={cx(
              "pointer-events-auto flex w-full max-w-[440px] items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg animate-fade-up",
              t.tone === "error" ? "bg-red-600 text-white" : t.tone === "info" ? "bg-ink text-white" : "bg-brand-800 text-white",
            )}
          >
            {t.tone === "error" ? <CircleAlert className="mt-0.5 size-4 shrink-0" /> : t.tone === "info" ? <Info className="mt-0.5 size-4 shrink-0" /> : <CircleCheck className="mt-0.5 size-4 shrink-0" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
