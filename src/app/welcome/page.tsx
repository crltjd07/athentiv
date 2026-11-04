"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AudioLines, BookOpen, LayoutGrid, ListChecks, Nfc, Timer, type LucideIcon } from "lucide-react";
import { LogoMark } from "@/components/Brand";
import { ButtonLink } from "@/components/ui";

// Landing page: what ATHENTIV FocusDock is, the four core features, and the way in (sign up,
// sign in, user manual). Public page: it shows no account data, only generic product content.
// Layout follows a "hero panel + labelled sections" pattern: a soft brand-tinted hero panel that
// fills the first screen with its content centred, then a centred section header and feature cards.

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: ListChecks, title: "Tasks & deadlines", body: "Track assignments, quizzes, projects and exams by subject and effort." },
  { icon: Timer, title: "Focus timer", body: "Pomodoro sessions with 25/5, 50/10 or custom times, and short breaks." },
  { icon: AudioLines, title: "Study sounds", body: "Steady rain, soft noise and other calm backgrounds while you work." },
  { icon: Nfc, title: "FocusDock stand", body: "Tap your phone on the stand to sign in and unlock focus sessions." },
];

const MANUAL = "/manual";

function Brand() {
  return (
    <Link href="/welcome" aria-label="ATHENTIV FocusDock home" className="flex items-center gap-2 rounded-xl">
      <LogoMark className="size-8 shrink-0" />
      {/* The name hides on the narrowest phones so the nav never overflows. */}
      <span className="hidden leading-none min-[380px]:block">
        <span className="block text-[9px] font-bold tracking-[0.22em] text-brand-600">ATHENTIV</span>
        <span className="block text-base font-extrabold tracking-tight text-ink">FocusDock</span>
      </span>
    </Link>
  );
}

/** Small pill label shown above a section heading. */
function SectionPill({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
      <Icon className="size-3.5" aria-hidden />
      {children}
    </span>
  );
}

function Welcome() {
  const next = useSearchParams().get("next");
  const q = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 pt-safe backdrop-blur-md">
        <nav aria-label="Main" className="mx-auto flex h-14 max-w-5xl items-center gap-1 px-3 min-[380px]:px-4">
          <Brand />
          <div className="ml-auto flex shrink-0 items-center text-[13px] font-semibold whitespace-nowrap text-ink-2">
            <a href="#features" className="rounded-full px-2 py-2 transition-colors active:bg-black/5">
              Features
            </a>
            <Link href={MANUAL} className="rounded-full px-2 py-2 transition-colors active:bg-black/5">
              Manual
            </Link>
            <ButtonLink href={`/login${q}`} size="sm" className="ml-1 h-8 px-3.5 text-[13px] whitespace-nowrap">
              Sign in
            </ButtonLink>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        {/* The hero fills the screen below the sticky nav (.hero-fill) and the panel centres its
            content vertically, so the headline and both buttons are the first thing visitors see. */}
        <section aria-labelledby="hero-title" className="hero-fill flex flex-col py-3">
          <div className="hero-panel flex flex-1 flex-col items-center justify-center rounded-[28px] border border-line px-5 py-10 text-center md:px-10">
            <div className="animate-fade-up flex w-full flex-col items-center">
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-card py-1 pr-3 pl-1 text-xs font-semibold text-ink-2 shadow-[var(--shadow-card)]">
                <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[11px] text-white">For students</span>
                Tasks, focus and calm sounds
              </p>
              <h1 id="hero-title" className="mt-5 text-[34px] font-extrabold leading-[1.08] tracking-tight text-ink md:text-5xl">
                Plan your schoolwork.
                <br />
                <span className="text-brand-700">Study with focus.</span>
              </h1>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted md:text-[17px]">
                Keep every deadline in one place, then dock your phone and work in timed sessions with calm sounds in the background.
              </p>
              <div className="mt-7 flex w-full max-w-sm flex-col gap-2.5 sm:w-auto sm:max-w-none sm:flex-row">
                <ButtonLink href={`/register${q}`} size="lg" className="sm:px-8">
                  Get started
                </ButtonLink>
                <ButtonLink href={MANUAL} size="lg" variant="secondary" icon={<BookOpen className="size-5" />} className="sm:px-7">
                  User manual
                </ButtonLink>
              </div>
              <p className="mt-5 max-w-sm text-xs text-balance text-muted">
                <Nfc className="mr-1 inline-block size-4 align-[-4px] text-brand-600" aria-hidden />
                Have a FocusDock stand? Tap it with your phone to sign in.
              </p>
            </div>
          </div>
        </section>

        <section id="features" aria-labelledby="features-title" className="scroll-mt-20 pt-8 pb-10">
          <div className="flex flex-col items-center text-center">
            <SectionPill icon={LayoutGrid}>Features</SectionPill>
            <h2 id="features-title" className="mt-3 text-[26px] font-extrabold leading-tight tracking-tight text-ink md:text-3xl">
              Everything for a focused study day
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">Plan what&apos;s due, then work through it one session at a time.</p>
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-[22px] border border-line bg-card p-4 shadow-[var(--shadow-card)] md:p-5">
                <span className="grid size-10 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-[15px] font-bold leading-snug text-ink">{title}</h3>
                <p className="mt-1 text-[13px] leading-snug text-muted">{body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-center text-xs text-faint">The focus timer, study sounds and check-ins are part of the FocusDock stand.</p>
        </section>
      </main>

      <footer className="border-t border-line pb-safe">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-5 text-xs text-muted">
          <span className="flex items-center gap-2">
            <LogoMark className="size-6" />
            <span className="font-semibold text-ink-2">ATHENTIV FocusDock</span>
          </span>
          <span className="flex items-center gap-4">
            <Link href={MANUAL} className="font-semibold text-brand-700">
              User manual
            </Link>
            <span>© 2026 ATHENTIV</span>
          </span>
        </div>
      </footer>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Welcome />
    </Suspense>
  );
}
