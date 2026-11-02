"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Lock, Nfc, ShieldAlert, Smartphone, WifiOff } from "lucide-react";
import { LogoMark, Wordmark } from "./Brand";
import { PhoneOnStand, SmartphoneOnly } from "./Illustrations";
import { ButtonLink, cx } from "./ui";

export function LoadingScreen({ label = "Loading" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-canvas" aria-busy aria-label={label}>
      <div className="relative">
        <span className="absolute inset-0 rounded-[18px] bg-brand-300 animate-breathe" />
        <LogoMark className="relative size-16" />
      </div>
      <p className="mt-5 text-sm font-semibold tracking-wide text-brand-700">ATHENTIV FocusDock</p>
    </div>
  );
}

export function UnsupportedScreen() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 py-12 text-center">
      <Wordmark className="mb-10" />
      <SmartphoneOnly className="h-40 w-auto" />
      <h1 className="mt-8 max-w-md text-2xl font-extrabold tracking-tight text-ink">
        ATHENTIV FocusDock is designed exclusively for smartphones.
      </h1>
      <p className="mt-3 max-w-md text-base text-muted">
        For the best experience, please open this website using your Android or iOS device.
      </p>
      <div className="mt-8 w-full max-w-md rounded-[20px] border border-line bg-white p-5 text-left shadow-[var(--shadow-card)]">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <Smartphone className="size-5" />
          </span>
          <div className="text-sm text-ink-2">
            <p className="font-semibold text-ink">Why phones only?</p>
            <p className="mt-1">
              FocusDock pairs with the ATHENTIV phone stand through NFC, keeps your phone docked while you study, and is built
              around one-handed, portrait use. Laptops, desktops and tablets aren&apos;t supported.
            </p>
          </div>
        </div>
      </div>
      <p className="mt-10 text-xs text-faint">© ATHENTIV · ATHENTIV FocusDock</p>
    </main>
  );
}

export function RotateNotice() {
  return (
    <div className="rotate-notice fixed inset-0 z-[70] flex-col items-center justify-center gap-3 bg-brand-800 px-8 text-center text-white">
      <Smartphone className="size-10" />
      <p className="text-lg font-bold">Please rotate your phone</p>
      <p className="text-sm text-brand-100">ATHENTIV FocusDock works in portrait mode.</p>
    </div>
  );
}

export function OfflineBanner() {
  return (
    <div className="fixed inset-x-0 top-0 z-[55] flex justify-center px-4 pt-safe">
      <div className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white shadow-lg">
        <WifiOff className="size-4" /> You&apos;re offline — changes will fail until you reconnect.
      </div>
    </div>
  );
}

function SystemCard({ icon, title, body, children, tone = "brand" }: { icon: ReactNode; title: string; body: ReactNode; children?: ReactNode; tone?: "brand" | "red" | "amber" }) {
  const tones = { brand: "bg-brand-50 text-brand-700", red: "bg-red-50 text-red-600", amber: "bg-amber-50 text-amber-700" };
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center animate-fade-up">
      <div className={cx("mb-5 grid size-16 place-items-center rounded-3xl", tones[tone])}>{icon}</div>
      <h2 className="text-xl font-extrabold tracking-tight text-ink">{title}</h2>
      <div className="mt-2 max-w-sm text-sm text-muted">{body}</div>
      {children && <div className="mt-6 w-full max-w-xs space-y-2.5">{children}</div>}
    </div>
  );
}

/** Shown when a non-stand account reaches a stand-only feature (or the server refuses access). */
export function AccessDenied({ message }: { message?: string }) {
  return (
    <SystemCard
      icon={<Lock className="size-7" />}
      title="This feature needs a FocusDock stand"
      body={message ?? "Check-in, Pomodoro focus sessions and Stand settings are available only to ATHENTIV FocusDock stand owners. Premium doesn't unlock them on its own."}
    >
      <ButtonLink href="/home" full variant="secondary">
        Back to Home
      </ButtonLink>
    </SystemCard>
  );
}

export function GenericDenied({ message }: { message: string }) {
  return (
    <SystemCard icon={<ShieldAlert className="size-7" />} title="Access denied" body={message} tone="red">
      <ButtonLink href="/home" full variant="secondary">
        Back to Home
      </ButtonLink>
    </SystemCard>
  );
}

/** Shown to stand owners whose session isn't NFC-verified yet. */
export function NfcRequired({ onScan, scanning, scanSupported }: { onScan?: () => void; scanning?: boolean; scanSupported?: boolean }) {
  return (
    <div className="flex flex-col items-center px-4 py-6 text-center animate-fade-up">
      <PhoneOnStand className="h-44 w-auto" />
      <h2 className="mt-4 text-xl font-extrabold tracking-tight text-ink">Tap your FocusDock stand</h2>
      <p className="mt-2 max-w-xs text-sm text-muted">
        Hold the top of your phone against the NFC tag on your stand. Your browser will open a FocusDock link that verifies this session.
      </p>
      {scanSupported && onScan && (
        <button
          onClick={onScan}
          disabled={scanning}
          className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-brand-700 px-6 font-semibold text-white shadow-[var(--shadow-float)] disabled:opacity-80"
        >
          <Nfc className={cx("size-5", scanning && "animate-pulse")} />
          {scanning ? "Hold your phone near the stand…" : "Scan stand in app"}
        </button>
      )}
      <p className="mt-4 text-xs text-faint">
        Not tapping? Make sure NFC is turned on in your phone settings.{" "}
        <Link href="/stand" className="font-semibold text-brand-600">
          Stand help
        </Link>
      </p>
    </div>
  );
}
