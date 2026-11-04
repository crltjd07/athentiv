"use client";

import { WifiOff } from "lucide-react";
import { Wordmark } from "@/components/Brand";
import { Button } from "@/components/ui";

export default function Offline() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center px-6 text-center">
      <Wordmark className="mb-12" />
      <div className="grid size-20 place-items-center rounded-3xl bg-slate-100 text-ink-2">
        <WifiOff className="size-9" />
      </div>
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-ink">You&apos;re offline</h1>
      <p className="mt-2 max-w-xs text-sm text-muted">ATHENTIV FocusDock needs an internet connection to save your work. A running timer keeps counting.</p>
      <Button size="lg" className="mt-8 w-full max-w-xs" onClick={() => window.location.replace("/home")}>
        Try again
      </Button>
    </main>
  );
}
