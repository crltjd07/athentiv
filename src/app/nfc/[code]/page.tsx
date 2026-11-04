"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CircleCheckBig, Nfc, ShieldAlert, Sparkles } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { AuthScaffold, deviceTimezone, PasswordInput } from "@/components/AuthBits";
import { Wordmark } from "@/components/Brand";
import { Button, ButtonLink, Input, Label, Notice, Spinner } from "@/components/ui";

type Verified = { status: "verified"; standCode: string; verificationId: number; newSession: boolean; trialGranted: boolean; premiumUntil: number | null };
type LoginRequired = { status: "login_required"; standCode: string; username: string };
type LoginResult = { mustChangePassword: boolean; nfc: ({ ok: true } & Omit<Verified, "status" | "standCode" | "premiumUntil">) | { ok: false; code: string; message: string } | null };

/**
 * NFC landing page. The stand's tag holds  /nfc/{code}#k={secret}. The secret is read from the URL
 * fragment (never sent to the server in the URL), posted to /api/nfc/verify, then wiped from history.
 */
export default function NfcLanding() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const key = useRef<string | null>(null);
  const [state, setState] = useState<
    | { kind: "checking" }
    | { kind: "login"; standCode: string; username: string }
    | { kind: "verified"; standCode: string; trial: boolean; newSession: boolean; verificationId: number; mustChange?: boolean }
    | { kind: "error"; title: string; message: string; wrongOwner?: boolean }
  >({ kind: "checking" });
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const k = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("k");
    if (k) {
      key.current = k;
      window.history.replaceState(null, "", window.location.pathname);
    }
    if (!key.current) {
      setState({ kind: "error", title: "Incomplete stand link", message: "This NFC link is missing its security key. Tap your FocusDock stand again." });
      return;
    }
    api<Verified | LoginRequired>("/api/nfc/verify", { body: { code, key: key.current } })
      .then((r) => {
        if (r.status === "login_required") {
          setUsername(r.username);
          setState({ kind: "login", standCode: r.standCode, username: r.username });
        } else {
          setState({ kind: "verified", standCode: r.standCode, trial: r.trialGranted, newSession: r.newSession, verificationId: r.verificationId });
        }
      })
      .catch((e) => {
        const ae = e instanceof ApiClientError ? e : null;
        setState({
          kind: "error",
          title: ae?.code === "WRONG_OWNER" ? "This isn't your stand" : "Stand not verified",
          message: ae?.message ?? "Something went wrong.",
          wrongOwner: ae?.code === "WRONG_OWNER",
        });
      });
  }, [code]);

  // After a successful verification, continue automatically (check-in prompt for new NFC sessions).
  useEffect(() => {
    if (state.kind !== "verified" || state.trial) return;
    const t = setTimeout(() => router.replace(nextRoute(state)), 1400);
    return () => clearTimeout(t);
  }, [state, router]);

  function nextRoute(s: { newSession: boolean; verificationId: number; mustChange?: boolean }) {
    if (s.mustChange) return "/onboarding";
    return s.newSession ? `/checkin?v=${s.verificationId}` : "/focus";
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setLoginError(null);
    try {
      const r = await api<LoginResult>("/api/auth/login", { body: { username, password, timezone: deviceTimezone(), nfc: { code, key: key.current } } });
      if (r.nfc && r.nfc.ok) {
        setState({ kind: "verified", standCode: code.toUpperCase(), trial: r.nfc.trialGranted, newSession: r.nfc.newSession, verificationId: r.nfc.verificationId, mustChange: r.mustChangePassword });
      } else if (r.nfc && !r.nfc.ok) {
        setState({ kind: "error", title: "Signed in, but not verified", message: r.nfc.message, wrongOwner: r.nfc.code === "WRONG_OWNER" });
      } else router.replace("/home");
    } catch (err) {
      setLoginError(err instanceof ApiClientError ? err.message : "Couldn't sign in.");
    } finally {
      setLoading(false);
    }
  }

  async function switchAccount() {
    await api("/api/auth/logout", { body: {} }).catch(() => {});
    router.replace("/login");
  }

  if (state.kind === "checking") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
        <span className="relative grid size-20 place-items-center">
          <span className="absolute inset-0 rounded-full bg-brand-200 animate-breathe" />
          <Nfc className="relative size-9 text-brand-700" />
        </span>
        <p className="font-semibold text-ink">Verifying your FocusDock stand…</p>
        <Spinner />
      </main>
    );
  }

  if (state.kind === "login") {
    return (
      <AuthScaffold title="Sign in to your stand" subtitle={<>Stand <span className="font-semibold text-ink">{state.standCode}</span> recognised. Enter your password to unlock Focus.</>}>
        <form onSubmit={login} className="space-y-4">
          {loginError && <Notice tone="danger">{loginError}</Notice>}
          <div>
            <Label htmlFor="u">Username</Label>
            <Input id="u" autoCapitalize="none" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="p">Password</Label>
            <PasswordInput id="p" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" full size="lg" loading={loading} disabled={!password}>
            Sign in & verify stand
          </Button>
          <p className="text-center text-xs text-muted">Signing in here signs out any other phone using this account.</p>
        </form>
      </AuthScaffold>
    );
  }

  if (state.kind === "verified") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center px-6 text-center pt-safe pb-safe">
        <Wordmark className="absolute top-8" />
        {state.trial ? (
          <>
            <div className="grid size-24 place-items-center rounded-[32px] bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-xl animate-pop">
              <Sparkles className="size-12" />
            </div>
            <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-ink">Your 30-day Premium trial has started!</h1>
            <p className="mt-2 max-w-xs text-sm text-muted">
              Every Premium feature is free for the next 30 days. This trial is given once per account.
            </p>
            <Button size="lg" className="mt-8 w-full max-w-xs" onClick={() => router.replace(nextRoute(state))}>
              Let&apos;s go
            </Button>
          </>
        ) : (
          <>
            <div className="grid size-24 place-items-center rounded-full bg-green-50 text-green-600 animate-pop">
              <CircleCheckBig className="size-12" />
            </div>
            <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-ink">{state.newSession ? "Stand verified" : "Session renewed"}</h1>
            <p className="mt-2 text-sm text-muted">Stand {state.standCode} · {state.newSession ? "Taking you to a quick check-in…" : "Back to focusing…"}</p>
          </>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center px-6 text-center">
      <div className="grid size-20 place-items-center rounded-3xl bg-red-50 text-red-600">
        <ShieldAlert className="size-9" />
      </div>
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-ink">{state.title}</h1>
      <p className="mt-2 max-w-xs text-sm text-muted">{state.message}</p>
      <div className="mt-8 w-full max-w-xs space-y-2.5">
        {state.wrongOwner && (
          <Button full onClick={switchAccount}>
            Sign out and use the stand&apos;s account
          </Button>
        )}
        <ButtonLink href="/home" full variant="secondary">
          Go to Home
        </ButtonLink>
      </div>
    </main>
  );
}
