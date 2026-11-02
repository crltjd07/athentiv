"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CalendarClock, ChartColumn, Nfc, Timer } from "lucide-react";
import { Wordmark } from "@/components/Brand";
import { PhoneOnStand } from "@/components/Illustrations";
import { ButtonLink } from "@/components/ui";

const POINTS = [
  { icon: CalendarClock, title: "Every deadline in one place", body: "Add an assignment in seconds — even by voice." },
  { icon: Timer, title: "Focus sessions on your stand", body: "Dock your phone, tap NFC, and start a Pomodoro." },
  { icon: ChartColumn, title: "See your progress", body: "Weekly insights built from what you actually did." },
];

function Welcome() {
  const next = useSearchParams().get("next");
  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-5 pt-safe pb-safe">
      <div className="pt-6">
        <Wordmark />
      </div>
      <div className="mt-6 flex justify-center">
        <PhoneOnStand className="h-52 w-auto animate-float" />
      </div>
      <h1 className="mt-4 text-[30px] font-extrabold leading-[1.1] tracking-tight text-ink animate-fade-up">
        Small steps today,
        <br />
        <span className="text-brand-700">big results tomorrow.</span>
      </h1>
      <p className="mt-3 text-[15px] text-muted">ATHENTIV FocusDock keeps your schoolwork organised and your study sessions focused.</p>
      <ul className="mt-6 space-y-3">
        {POINTS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <Icon className="size-5" />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-ink">{title}</p>
              <p className="text-sm text-muted">{body}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-auto space-y-2.5 pt-8">
        <ButtonLink href={`/register${q}`} full size="lg">
          Create a free account
        </ButtonLink>
        <ButtonLink href={`/login${q}`} full size="lg" variant="secondary">
          Sign in
        </ButtonLink>
        <p className="flex items-center justify-center gap-1.5 pt-2 text-center text-xs text-muted">
          <Nfc className="size-4 text-brand-600" /> Own a FocusDock stand? Tap it with your phone to sign in.
        </p>
        <p className="text-center text-[11px] text-faint">
          © ATHENTIV ·{" "}
          <Link href="/login" className="underline">
            ATHENTIV FocusDock
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Welcome />
    </Suspense>
  );
}
