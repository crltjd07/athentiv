"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center px-6 text-center">
      <div className="grid size-20 place-items-center rounded-3xl bg-red-50 text-red-600">
        <TriangleAlert className="size-9" />
      </div>
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-ink">Something went wrong</h1>
      <p className="mt-2 max-w-xs text-sm text-muted">ATHENTIV FocusDock hit an unexpected problem. Your saved data is safe.</p>
      <div className="mt-8 w-full max-w-xs space-y-2.5">
        <Button full onClick={reset}>
          Try again
        </Button>
        <Button full variant="ghost" onClick={() => window.location.replace("/home")}>
          Go to Home
        </Button>
      </div>
    </main>
  );
}
