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

// `stand` marks the features that come with the FocusDock stand (see the note under the cards).
const FEATURES: { icon: LucideIcon; title: string; body: string; stand?: boolean }[] = [
  { icon: ListChecks, title: "Tasks & deadlines", body: "Track assignments, quizzes, projects and exams by subject and effort." },
  { icon: Timer, title: "Focus timer", body: "Pomodoro sessions with 25/5, 50/10 or custom times, and short breaks.", stand: true },
  { icon: AudioLines, title: "Study sounds", body: "Steady rain, soft noise and other calm backgrounds while you work.", stand: true },
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

/* ---------------------------------------------------------------------------------------------
   Hero background graphics. Purely decorative (aria-hidden, no interaction). Colours come from
   the --hero-* tokens on .hero-panel (globals.css), which switch for dark mode. They are set
   through `style` because Safari ignores CSS variables in SVG presentation attributes.
   --------------------------------------------------------------------------------------------- */

const C = 500; // centre of the 1000 x 1000 ring drawing

/** Point on a ring, angle in degrees clockwise from 12 o'clock. */
function onRing(r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: +(C + r * Math.cos(a)).toFixed(1), y: +(C + r * Math.sin(a)).toFixed(1) };
}

/** Arc along a ring, from `from` spanning `span` degrees (clockwise from 12 o'clock). */
function Arc({ r, from, span, style }: { r: number; from: number; span: number; style: React.CSSProperties }) {
  const len = (2 * Math.PI * r * span) / 360;
  return (
    <circle cx={C} cy={C} r={r} fill="none" strokeLinecap="round" strokeDasharray={`${len.toFixed(1)} 99999`} transform={`rotate(${from - 90} ${C} ${C})`} style={style} />
  );
}

// Rings: radius, line width, opacity, optional dash. Thin and faint outside, firmer inside,
// with one heavier, very faint band for depth.
const RINGS: { r: number; w: number; o: number; dash?: string }[] = [
  { r: 120, w: 1.25, o: 0.9 },
  { r: 165, w: 1, o: 0.75 },
  { r: 215, w: 2, o: 0.8, dash: "0.5 11" },
  { r: 270, w: 1.5, o: 0.6 },
  { r: 330, w: 7, o: 0.12 },
  { r: 330, w: 1, o: 0.45 },
  { r: 395, w: 1, o: 0.4, dash: "5 9" },
  { r: 465, w: 1, o: 0.3 },
];

// Glowing accents: arcs drawn twice, a blurred halo under a crisp line. Only on the outer rings
// and towards the corners, so they never sit behind the heading, text or buttons on a phone.
const GLOW_ARCS = [
  { r: 330, from: 292, span: 46 },
  { r: 395, from: 112, span: 46 },
  { r: 465, from: 205, span: 32 },
];

// Illuminated points on the ring paths (same rule: outer rings, corner areas).
const POINTS = [
  { r: 270, deg: 0, s: 3.5 },
  { r: 330, deg: 45, s: 4 },
  { r: 395, deg: 158, s: 4.5 },
  { r: 330, deg: 228, s: 3 },
  { r: 465, deg: 318, s: 3.5 },
  { r: 465, deg: 120, s: 3 },
];

/**
 * Enlarged concentric focus rings, centred just above the middle of the hero and large enough to
 * run past the panel's edges (the panel clips them). Includes a faint polar grid, glowing arcs,
 * lit points, and a soft light behind the heading that keeps the lines quiet under the text.
 */
function HeroRings() {
  const spokes = Array.from({ length: 24 }, (_, i) => i * 15);
  return (
    <svg
      viewBox="0 0 1000 1000"
      aria-hidden
      className="pointer-events-none absolute top-[46%] left-1/2 -z-2 size-[min(1100px,250vw)] -translate-x-1/2 -translate-y-1/2"
    >
      <defs>
        <radialGradient id="hero-halo">
          <stop offset="0.45" style={{ stopColor: "var(--hero-glow)", stopOpacity: 0 }} />
          <stop offset="0.62" style={{ stopColor: "var(--hero-glow)", stopOpacity: 0.28 }} />
          <stop offset="1" style={{ stopColor: "var(--hero-glow)", stopOpacity: 0 }} />
        </radialGradient>
        <radialGradient id="hero-core">
          <stop offset="0" style={{ stopColor: "var(--hero-core)" }} />
          <stop offset="0.6" style={{ stopColor: "var(--hero-core)", stopOpacity: 0.6 }} />
          <stop offset="1" style={{ stopColor: "var(--hero-core)", stopOpacity: 0 }} />
        </radialGradient>
        <linearGradient id="hero-sweep" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--hero-accent)", stopOpacity: 0 }} />
          <stop offset="0.5" style={{ stopColor: "var(--hero-accent)", stopOpacity: 0.7 }} />
          <stop offset="1" style={{ stopColor: "var(--hero-accent)", stopOpacity: 0 }} />
        </linearGradient>
        <filter id="hero-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* Soft blue illumination around the middle rings. */}
      <circle cx={C} cy={C} r="440" fill="url(#hero-halo)" />

      {/* Faint polar grid between the inner and outer rings. */}
      <g style={{ stroke: "var(--hero-ring)", strokeOpacity: 0.35 }} strokeWidth="1" strokeDasharray="1 7" strokeLinecap="round">
        {spokes.map((deg) => {
          const a = onRing(140, deg);
          const b = onRing(480, deg);
          return <line key={deg} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
      </g>

      {RINGS.map(({ r, w, o, dash }, i) => (
        <circle key={i} cx={C} cy={C} r={r} fill="none" strokeWidth={w} strokeDasharray={dash} strokeLinecap="round" style={{ stroke: "var(--hero-ring)", strokeOpacity: o }} />
      ))}

      {/* A gradient sweep along one ring. */}
      <circle cx={C} cy={C} r="270" fill="none" strokeWidth="1.5" style={{ stroke: "url(#hero-sweep)", strokeOpacity: 0.6 }} />

      {GLOW_ARCS.map(({ r, from, span }) => (
        <g key={r}>
          <Arc r={r} from={from} span={span} style={{ stroke: "var(--hero-glow)", strokeWidth: 8, filter: "url(#hero-blur)" }} />
          <Arc r={r} from={from} span={span} style={{ stroke: "var(--hero-accent)", strokeWidth: 2.25, strokeOpacity: 0.8 }} />
        </g>
      ))}

      {POINTS.map(({ r, deg, s }) => {
        const p = onRing(r, deg);
        return (
          <g key={`${r}-${deg}`}>
            <circle cx={p.x} cy={p.y} r={s * 3} style={{ fill: "var(--hero-glow)", fillOpacity: 0.35 }} filter="url(#hero-blur)" />
            <circle cx={p.x} cy={p.y} r={s} style={{ fill: "var(--hero-accent)" }} />
          </g>
        );
      })}

      {/* Soft light behind the heading, over the inner rings so they stay quiet under the text. */}
      <circle cx={C} cy={C} r="250" fill="url(#hero-core)" />
    </svg>
  );
}

/** Faint flowing curves along the bottom of the hero, for depth below the content. */
function HeroCurves() {
  const line = (o: number, dash?: string): React.CSSProperties => ({ stroke: "var(--hero-ring)", strokeOpacity: o, strokeDasharray: dash });
  return (
    <svg viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-2 h-24 w-full">
      <path d="M0 50 C 30 30, 60 30, 90 48 S 150 70, 190 50 S 250 22, 290 44 S 360 68, 400 46" fill="none" strokeWidth="1.25" vectorEffect="non-scaling-stroke" style={{ stroke: "var(--hero-accent)", strokeOpacity: 0.22 }} />
      <path d="M0 60 C 40 46, 70 48, 110 60 S 170 74, 210 60 S 280 38, 320 56 S 370 68, 400 60" fill="none" strokeWidth="1" vectorEffect="non-scaling-stroke" style={line(0.7)} />
      <path d="M0 40 C 50 26, 80 58, 130 44 S 200 24, 240 40 S 320 58, 400 34" fill="none" strokeWidth="1" vectorEffect="non-scaling-stroke" style={line(0.5, "2 5")} />
    </svg>
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
            content vertically, so the headline and both buttons are the first thing visitors see.
            The background (mesh, rings, dots, edge light) is all decoration behind the content;
            the panel clips it to its rounded edges. */}
        <section aria-labelledby="hero-title" className="hero-fill flex flex-col py-3">
          <div className="hero-panel flex flex-1 flex-col items-center justify-center rounded-[28px] border border-line px-5 py-10 text-center md:px-10">
            <HeroRings />
            <HeroCurves />
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
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-pretty text-muted md:text-[17px]">
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
              <p className="mt-6 inline-flex max-w-sm items-center gap-2.5 rounded-2xl border border-line bg-card/70 py-2 pr-3.5 pl-2 text-left text-xs leading-snug text-muted backdrop-blur-sm">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                  <Nfc className="size-4" aria-hidden />
                </span>
                Have a FocusDock stand? Tap it with your phone to sign in.
              </p>
            </div>
          </div>
        </section>

        <div aria-hidden className="landing-divider mx-auto mt-5 max-w-xs">
          <span className="size-1.5 rounded-full bg-brand-300" />
          <span className="size-1.5 rounded-full bg-brand-500" />
          <span className="size-1.5 rounded-full bg-brand-300" />
        </div>

        <section id="features" aria-labelledby="features-title" className="scroll-mt-20 pt-7 pb-12">
          <div className="flex flex-col items-center text-center">
            <SectionPill icon={LayoutGrid}>Features</SectionPill>
            <h2 id="features-title" className="mt-3 text-[26px] font-extrabold leading-tight tracking-tight text-balance text-ink md:text-3xl">
              Everything for a focused study day
            </h2>
            <p className="mt-2.5 max-w-sm text-sm leading-relaxed text-balance text-muted">Plan what&apos;s due, then work through it one session at a time.</p>
          </div>
          <ul className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {FEATURES.map(({ icon: Icon, title, body, stand }) => (
              <li key={title} className="feature-card flex flex-col rounded-[22px] border border-line bg-card p-4 shadow-[var(--shadow-card)] md:p-5">
                {/* On the narrowest phones (320px) the tag wraps under the icon instead of being clipped. */}
                <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-2">
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  {stand && (
                    <span className="mt-0.5 rounded-full border border-brand-100 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-brand-700">
                      With stand
                    </span>
                  )}
                </div>
                <h3 className="mt-4 text-[15px] font-bold leading-snug text-ink">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ul>
          <p className="mx-auto mt-5 flex max-w-md items-start gap-2.5 rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 px-4 py-3 text-xs leading-relaxed text-ink-2">
            <Nfc className="mt-px size-4 shrink-0 text-brand-600" aria-hidden />
            The focus timer, study sounds and check-ins are part of the FocusDock stand.
          </p>
        </section>
      </main>

      <footer className="border-t border-line bg-card/50 pb-safe">
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
