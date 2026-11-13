import type { Metadata } from "next";
import Image from "next/image";
import type { ReactNode } from "react";
import { AudioLines, BookOpen, ChartColumn, Crown, House, LifeBuoy, ListChecks, Nfc, Plus, Rocket, Smile, Timer, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/Nav";
import { Card } from "@/components/ui";
import { LIMITS } from "@/shared/limits";

export const metadata: Metadata = {
  title: "User manual",
  description: "How to use ATHENTIV FocusDock: getting started, the FocusDock stand, tasks, the focus timer, study sounds, settings and troubleshooting.",
};

// One manual for everyone. Public (no sign-in needed): linked from the landing page for visitors
// and from Profile → User manual for signed-in users.
// Each section is a card: icon + title + one-line summary, then short groups of numbered steps
// (on a soft panel) and "good to know" points (check marks), an optional app screenshot, and,
// for troubleshooting, expandable questions. Icons come from lucide-react (the app's icon set);
// markers are CSS (globals.css, .manual-steps / .manual-tips). No emoji.
// Screenshots live in public/manual/<name>-light.webp and -dark.webp (390 px wide, from a demo
// account). Retake them when those screens change. Keep the text in step with the app;
// docs/FEATURES.md is the detailed reference.

type Group = { label?: string; steps?: ReactNode[]; tips?: ReactNode[] };
type Shot = { name: string; height: number; alt: string; caption: string };
type Section = {
  id: string;
  title: string;
  short: string;
  summary: string;
  icon: LucideIcon;
  groups?: Group[];
  /** Shown after the first group. */
  shot?: Shot;
  faq?: { q: string; a: ReactNode }[];
};

const SECTIONS: Section[] = [
  {
    id: "start",
    title: "Getting started",
    short: "Getting started",
    summary: "Set up your account. It only takes a few minutes.",
    icon: Rocket,
    groups: [
      {
        label: "With a FocusDock stand",
        steps: [
          <>Sign in with the username and temporary password that came with your stand.</>,
          <>Choose your own password and save the <b>recovery code</b>. It is shown only once.</>,
          <>Tap your phone on the stand. The first tap starts a free 30-day Premium trial (once per account).</>,
          <>Pick an avatar, your subjects and a daily study goal.</>,
        ],
      },
      {
        label: "Without a stand",
        steps: [
          <>Tap <b>Get started</b> and create an account with a username and password.</>,
          <>Save the recovery code. It is the only way to reset a forgotten password.</>,
          <>Choose a plan (Weekly ₱29, Monthly ₱99 or Annual ₱799) and confirm it. An active plan is needed to use the app without a stand.</>,
          <>Pick an avatar, your subjects and a daily study goal.</>,
        ],
      },
      {
        label: "Good to know",
        tips: [
          <>FocusDock runs in your phone&apos;s browser on Android and iPhone. There is nothing to install. Laptops and tablets aren&apos;t supported.</>,
          <>Without a stand you get tasks, the calendar and the summary. The focus timer, study sounds and mood check-in need the stand.</>,
        ],
      },
    ],
  },
  {
    id: "stand",
    title: "Signing in with the stand",
    short: "Stand & NFC",
    summary: "Tap your phone on the stand to sign in and unlock focus sessions.",
    icon: Nfc,
    groups: [
      {
        label: "Tap to sign in",
        steps: [
          <>Make sure NFC is turned on in your phone settings.</>,
          <>Hold the back of your phone near the stand&apos;s tag. FocusDock opens in your browser.</>,
          <>If you&apos;re signed out, enter your password. The tap marks this session as verified.</>,
        ],
      },
      {
        label: "Good to know",
        tips: [
          <>A verified session unlocks the focus timer and the mood check-in.</>,
          <>Verification ends after 30 minutes without using the app, or after 12 hours. Tap again to renew it.</>,
          <>On Android with Chrome you can also use <b>Scan stand in app</b> in <b>Profile → My stand &amp; session</b>.</>,
          <>You can always sign in with your username and password. Forgot it? Tap <b>Forgot password?</b> on the sign-in screen and enter your recovery code.</>,
          <>A stand account is signed in on one phone at a time. Signing in on another phone signs the first one out.</>,
        ],
      },
    ],
  },
  {
    id: "home",
    title: "Home and Profile",
    short: "Home & Profile",
    summary: "Your day at a glance, and your account settings.",
    icon: House,
    groups: [
      {
        label: "Home",
        tips: [
          <>Stand owners see a banner at the top: <b>Tap your stand</b>, or <b>Docked &amp; verified</b> once the tap is done.</>,
          <><b>Today&apos;s Progress</b> shows your study time against your daily goal, plus tasks completed, your streak and today&apos;s focus sessions.</>,
          <>Below it are shortcuts, <b>For you</b> study suggestions, and today&apos;s tasks or your next deadlines.</>,
          <>The tabs at the bottom switch between Home, Tasks, Focus (Calendar without a stand), Summary and Profile.</>,
        ],
      },
      {
        label: "Profile",
        tips: [
          <>Edit your name, avatar and subjects, and see your achievements and streaks.</>,
          <>Stand owners also find <b>My stand &amp; session</b>, <b>Mood history</b> and the <b>Academic calendar</b> here.</>,
          <><b>Settings</b> has Dark mode (saved on this phone), Notification preferences, and Account &amp; security (change password, new recovery code, signed-in devices).</>,
          <><b>User manual</b> opens this page. <b>Sign out</b> is at the bottom.</>,
        ],
      },
    ],
    shot: { name: "home", height: 560, alt: "The Home screen showing the Docked and verified banner, Today's Progress, shortcuts and study suggestions.", caption: "Home, after a stand tap" },
  },
  {
    id: "tasks",
    title: "Tasks and deadlines",
    short: "Tasks",
    summary: "Add your schoolwork and keep track of what's due.",
    icon: ListChecks,
    groups: [
      {
        label: "Add a task",
        steps: [
          <>Tap <b>+</b>.</>,
          <>Enter a title, then choose the type, subject, due date and time, and effort (Light, Moderate or Heavy).</>,
          <>Tap <b>Save Task</b>. Tick the circle next to a task when it&apos;s done.</>,
        ],
      },
      {
        label: "Good to know",
        tips: [
          <>Use the date shortcuts (Today, Tomorrow, This week, Next week), or tap the microphone to say a task. Check it before saving.</>,
          <>Open a task to change its status, add checklist steps, edit or delete it.</>,
          <>Tasks become <b>Overdue</b> automatically once the deadline passes.</>,
          <>Search and filter on the Tasks tab. The Calendar shows deadlines by week or month.</>,
          <>Freemium stand accounts can have {LIMITS.freeOpenTasks} open tasks at a time. Premium has no limit.</>,
        ],
      },
    ],
    shot: { name: "task", height: 620, alt: "The Add task form with title, type, subject, due date and effort.", caption: "Adding a task" },
  },
  {
    id: "focus",
    title: "Focus timer",
    short: "Focus timer",
    summary: "Work in timed sessions with short breaks.",
    icon: Timer,
    groups: [
      {
        label: "Start a session",
        steps: [
          <>Tap your phone on the stand. Focus sessions only start after a tap.</>,
          <>Open the <b>Focus</b> tab and choose a preset: 25/5 (free), or 50/10 and Custom (Premium).</>,
          <>Pick a task or <b>General study</b>, then tap <b>Start</b>.</>,
        ],
      },
      {
        label: "Good to know",
        tips: [
          <>You can pause, resume, end early (the time is kept) or cancel. A session paused for more than 15 minutes is cancelled.</>,
          <>The timer keeps running if you leave the screen or lock your phone.</>,
          <>Breaks can be skipped. Premium can extend a break by 5 minutes, up to twice.</>,
          <>Freemium allows {LIMITS.freeDailyFocusSessions} focus sessions a day. Premium is unlimited.</>,
        ],
      },
    ],
    shot: { name: "focus", height: 620, alt: "The Focus Timer screen with presets and a list of tasks to link the session to.", caption: "Choosing a preset and a task" },
  },
  {
    id: "sounds",
    title: "Study sounds",
    short: "Sounds",
    summary: "Calm background sounds while you work.",
    icon: AudioLines,
    groups: [
      {
        label: "Play a sound",
        steps: [
          <>Open <b>Study sounds</b> from the Focus screen or during a session.</>,
          <>Tap a sound, then press play. Set the level with the volume slider.</>,
        ],
      },
      {
        label: "Good to know",
        tips: [
          <>Free: Rain, Brown noise and Thunderstorm. Premium adds Ocean waves, Forest, Fireplace, Fan and Riverside.</>,
          <>All sounds are steady, with no music or sudden changes, and fade in and out gently.</>,
          <>Your choice is remembered. You can also save Spotify playlist links in the same sheet.</>,
        ],
      },
    ],
    shot: { name: "sounds", height: 514, alt: "The Study sounds sheet with eight sounds, a play button, a volume slider and Spotify playlists.", caption: "The Study sounds sheet" },
  },
  {
    id: "checkin",
    title: "Mood check-in",
    short: "Check-in",
    summary: "A quick check on how you feel before you study.",
    icon: Smile,
    groups: [
      {
        tips: [
          <>After a stand tap you&apos;re asked how you feel. You can skip it.</>,
          <>You get a short suggestion for what to study next. Premium shows your mood history and trends.</>,
          <>Check-ins are for personal reflection, not a medical or psychological assessment.</>,
        ],
      },
    ],
  },
  {
    id: "summary",
    title: "Summary and exports",
    short: "Summary",
    summary: "See how your week is going.",
    icon: ChartColumn,
    groups: [
      {
        tips: [
          <>The Summary tab shows this week&apos;s completed tasks, completion rate, pending and overdue tasks, and focus time for stand owners.</>,
          <>Premium adds month and custom ranges, comparisons, subject breakdowns, and PDF or CSV exports.</>,
        ],
      },
    ],
  },
  {
    id: "plans",
    title: "Plans",
    short: "Plans",
    summary: "Weekly, monthly or annual Premium.",
    icon: Crown,
    groups: [
      {
        tips: [
          <>Plans are Weekly (₱29), Monthly (₱99) or Annual (₱799). They don&apos;t renew automatically, and you get a reminder before one ends.</>,
          <>Buying while a plan is active adds the new time after the current end date.</>,
          <>When a plan ends, your tasks and history are kept.</>,
        ],
      },
    ],
  },
  {
    id: "help",
    title: "Troubleshooting",
    short: "Troubleshooting",
    summary: "Tap a question to see the answer.",
    icon: LifeBuoy,
    faq: [
      { q: "Tapping the stand does nothing", a: <>Turn on NFC in your phone settings, unlock the phone, and hold its back flat against the stand for a second.</> },
      { q: "Focus or Check-in asks me to tap the stand", a: <>Your verification ended (30 minutes idle, or 12 hours). Tap the stand again.</> },
      { q: "I see “Session expired” or was signed out", a: <>Sign in again. A stand account is also signed out when someone signs in to it on another phone.</> },
      { q: "Sign-in is paused", a: <>After 5 wrong passwords in a row, wait a few minutes and try again, or reset your password with your recovery code.</> },
      { q: "The page says it's for smartphones only", a: <>FocusDock only opens on phones. Open the same address in your phone&apos;s browser.</> },
      { q: "No sound plays", a: <>Check the volume slider in Study sounds and your phone&apos;s volume, then press play again.</> },
      { q: "I'm offline", a: <>FocusDock needs an internet connection. Reconnect, then reload the page.</> },
    ],
  },
];

function Screenshot({ name, height, alt, caption }: Shot) {
  const frame = "h-auto w-full";
  return (
    <figure className="mx-auto w-full max-w-[230px]">
      <div className="overflow-hidden rounded-[22px] border border-line bg-canvas shadow-[var(--shadow-card)]">
        <Image src={`/manual/${name}-light.webp`} width={390} height={height} alt={alt} className={`${frame} dark:hidden`} />
        <Image src={`/manual/${name}-dark.webp`} width={390} height={height} alt={alt} className={`${frame} hidden dark:block`} />
      </div>
      <figcaption className="mt-2 text-center text-xs text-muted">{caption}</figcaption>
    </figure>
  );
}

function GroupBlock({ label, steps, tips }: Group) {
  return (
    <div>
      {label && <h3 className="mb-3 text-[13px] font-bold tracking-[0.06em] text-muted uppercase">{label}</h3>}
      {steps && (
        <ol className="manual-steps rounded-2xl bg-canvas p-4">
          {steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
      {tips && (
        <ul className="manual-tips">
          {tips.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Manual() {
  return (
    <main className="mx-auto max-w-[640px] px-4 pb-safe">
      <PageHeader title="User manual" back={{ fallback: "/" }} />

      <div className="flex flex-col items-center px-2 pt-3 pb-6 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          <BookOpen className="size-3.5" aria-hidden />
          Guide
        </span>
        <h2 className="mt-3 text-[26px] font-extrabold leading-tight tracking-tight text-ink">How to use FocusDock</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">Short steps for setting up, using the stand, and getting the most out of tasks, the focus timer and study sounds.</p>
      </div>

      <Card as="section" aria-labelledby="contents-title" className="p-4">
        <h2 id="contents-title" className="px-1 text-[13px] font-bold tracking-[0.06em] text-muted uppercase">
          In this manual
        </h2>
        <nav aria-labelledby="contents-title" className="mt-3 grid grid-cols-2 gap-2">
          {SECTIONS.map(({ id, short, icon: Icon }) => (
            <a key={id} href={`#${id}`} className="flex min-h-12 items-center gap-2.5 rounded-2xl border border-line px-2.5 py-2 text-[13px] font-semibold text-ink-2 transition-colors active:bg-brand-50">
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 leading-tight">{short}</span>
            </a>
          ))}
        </nav>
      </Card>

      <div className="mt-5 space-y-5 pb-12">
        {SECTIONS.map(({ id, title, summary, icon: Icon, groups, shot, faq }) => (
          <Card as="section" key={id} id={id} aria-labelledby={`${id}-title`} className="scroll-mt-16 p-5 sm:p-6">
            <div className="flex items-start gap-3.5">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 pt-0.5">
                <h2 id={`${id}-title`} className="text-lg font-bold leading-snug tracking-tight text-ink">
                  {title}
                </h2>
                <p className="mt-0.5 text-sm text-muted">{summary}</p>
              </div>
            </div>

            <div className="mt-5 space-y-5 text-[15px] leading-relaxed text-ink-2">
              {groups?.map((g, i) => (
                <div key={i} className="space-y-5">
                  {i > 0 && <hr className="border-line" />}
                  <GroupBlock {...g} />
                  {i === 0 && shot && <Screenshot {...shot} />}
                </div>
              ))}

              {faq && (
                <div className="space-y-2.5">
                  {faq.map(({ q, a }) => (
                    <details key={q} className="group rounded-2xl border border-line">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 font-semibold text-ink [&::-webkit-details-marker]:hidden">
                        {q}
                        <Plus className="size-5 shrink-0 text-muted transition-transform group-open:rotate-45" aria-hidden />
                      </summary>
                      <p className="px-4 pb-4 text-ink-2">{a}</p>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
