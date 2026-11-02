"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Clock, Smartphone } from "lucide-react";
import { Wordmark } from "@/components/Brand";
import { ButtonLink } from "@/components/ui";

function Expired() {
  const reason = useSearchParams().get("reason");
  const replaced = reason === "replaced";
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center px-6 text-center pt-safe pb-safe">
      <Wordmark className="mb-12" />
      <div className="grid size-20 place-items-center rounded-3xl bg-brand-50 text-brand-700">{replaced ? <Smartphone className="size-9" /> : <Clock className="size-9" />}</div>
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-ink">{replaced ? "Signed in on another device" : "Your session has ended"}</h1>
      <p className="mt-2 max-w-xs text-sm text-muted">
        {replaced
          ? "FocusDock stand accounts can be active on one phone at a time. You were signed out here because your account was used on another device."
          : "For your security, you've been signed out. Sign in again to pick up where you left off — your data is safe."}
      </p>
      <ButtonLink href="/login" size="lg" className="mt-8 w-full max-w-xs">
        Sign in again
      </ButtonLink>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Expired />
    </Suspense>
  );
}
