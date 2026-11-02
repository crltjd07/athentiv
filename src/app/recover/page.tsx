"use client";

import Link from "next/link";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { AuthScaffold, PasswordInput, RecoveryCodeCard } from "@/components/AuthBits";
import { Button, ButtonLink, Input, Label, Notice } from "@/components/ui";

export default function Recover() {
  const [form, setForm] = useState({ username: "", recoveryCode: "", newPassword: "" });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFields({});
    try {
      const r = await api<{ recoveryCode: string }>("/api/auth/recover", { body: form });
      setNewCode(r.recoveryCode);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        setFields(err.fields);
      } else setError("Couldn't reset your password.");
    } finally {
      setLoading(false);
    }
  }

  if (newCode) {
    return (
      <AuthScaffold title="Password updated" subtitle="You've been signed out everywhere. Here's your new recovery code — the old one no longer works.">
        <RecoveryCodeCard code={newCode} />
        <ButtonLink href="/login" full size="lg" className="mt-6">
          Sign in
        </ButtonLink>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold
      title="Reset your password"
      subtitle="Use the recovery code you saved when your account was created."
      footer={
        <Link href="/login" className="font-semibold text-brand-700">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Notice tone="danger">{error}</Notice>}
        <div>
          <Label htmlFor="username">Username</Label>
          <Input id="username" autoCapitalize="none" autoComplete="username" value={form.username} onChange={set("username")} />
        </div>
        <div>
          <Label htmlFor="code">Recovery code</Label>
          <Input id="code" autoCapitalize="characters" placeholder="XXXX-XXXX-XXXX-XXXX" className="font-mono tracking-wider" value={form.recoveryCode} onChange={set("recoveryCode")} error={fields.recoveryCode} />
        </div>
        <div>
          <Label htmlFor="pw" hint="8+ chars, a letter and a number">
            New password
          </Label>
          <PasswordInput id="pw" autoComplete="new-password" value={form.newPassword} onChange={set("newPassword")} error={fields.newPassword} />
        </div>
        <Button type="submit" full size="lg" loading={loading} disabled={!form.username || !form.recoveryCode || !form.newPassword}>
          Reset password
        </Button>
        <Notice>
          Lost your recovery code? Stand owners can contact ATHENTIV support with their stand code; standard accounts can&apos;t be recovered without it, to keep them secure.
        </Notice>
      </form>
    </AuthScaffold>
  );
}
