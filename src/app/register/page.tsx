"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { AuthScaffold, deviceTimezone, PasswordInput, RecoveryCodeCard } from "@/components/AuthBits";
import { Button, Input, Label, Notice } from "@/components/ui";
import { registerSchema } from "@/shared/schemas";

export default function Register() {
  const router = useRouter();
  const [form, setForm] = useState({ displayName: "", username: "", password: "" });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      setFields(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setFields({});
    setLoading(true);
    try {
      const res = await api<{ recoveryCode: string }>("/api/auth/register", { body: { ...parsed.data, timezone: deviceTimezone() } });
      setCode(res.recoveryCode);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFields(err.code === "USERNAME_TAKEN" ? { username: err.message } : err.fields);
        if (err.code !== "USERNAME_TAKEN") setError(err.message);
      } else setError("Couldn't create your account.");
    } finally {
      setLoading(false);
    }
  }

  if (code) {
    return (
      <AuthScaffold title="You're in! 🎉" subtitle="One last thing before you start.">
        <RecoveryCodeCard code={code} />
        <Button full size="lg" className="mt-6" onClick={() => router.replace("/premium")}>
          I&apos;ve saved it
        </Button>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold
      title="Create your account"
      subtitle="Without a FocusDock stand, the app works with a Premium plan. You'll choose one next."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand-700">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Notice tone="danger">{error}</Notice>}
        <div>
          <Label htmlFor="displayName">What should we call you?</Label>
          <Input id="displayName" autoComplete="nickname" placeholder="e.g. Alex" value={form.displayName} onChange={set("displayName")} error={fields.displayName} />
        </div>
        <div>
          <Label htmlFor="username" hint="Letters, numbers, . and _">
            Username
          </Label>
          <Input id="username" autoComplete="username" autoCapitalize="none" value={form.username} onChange={set("username")} error={fields.username} />
        </div>
        <div>
          <Label htmlFor="password" hint="8+ chars, a letter and a number">
            Password
          </Label>
          <PasswordInput id="password" autoComplete="new-password" value={form.password} onChange={set("password")} error={fields.password} />
        </div>
        <Button type="submit" full size="lg" loading={loading}>
          Create account
        </Button>
        <p className="px-2 text-center text-xs text-faint">
          Have a FocusDock stand? Your account comes with the stand. Sign in with it instead.
        </p>
      </form>
    </AuthScaffold>
  );
}
