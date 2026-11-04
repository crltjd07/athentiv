"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Nfc } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { AuthScaffold, deviceTimezone, PasswordInput, safeNext } from "@/components/AuthBits";
import { Button, Input, Label, Notice } from "@/components/ui";

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api("/api/auth/login", { body: { username, password, timezone: deviceTimezone() } });
      router.replace(safeNext(params.get("next")));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't sign in.");
      setLoading(false);
    }
  }

  return (
    <AuthScaffold
      title="Welcome back"
      subtitle="Sign in to ATHENTIV FocusDock."
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="font-semibold text-brand-700">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Notice tone="danger">{error}</Notice>}
        <div>
          <Label htmlFor="username">Username</Label>
          <Input id="username" autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="password" hint={<Link href="/recover" className="font-semibold text-brand-600">Forgot password?</Link>}>
            Password
          </Label>
          <PasswordInput id="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" full size="lg" loading={loading} disabled={!username || !password}>
          Sign in
        </Button>
      </form>
      <div className="mt-6 flex gap-3 rounded-2xl bg-white p-4 text-sm text-ink-2 shadow-[var(--shadow-card)]">
        <Nfc className="mt-0.5 size-5 shrink-0 text-brand-600" />
        <p>
          <span className="font-semibold text-ink">Stand owners:</span> after signing in, tap your phone on your stand to use Focus and Check-in.
        </p>
      </div>
    </AuthScaffold>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
