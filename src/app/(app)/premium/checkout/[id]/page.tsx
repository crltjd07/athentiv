"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { CircleCheckBig, CircleX } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useMe } from "@/lib/me";
import { fmtDateLong } from "@/lib/format";
import { formatPeso } from "@/shared/catalog";
import { PageHeader } from "@/components/Nav";
import { useApiErrorHandler } from "@/components/Premium";
import { Button, ButtonLink, Card, ErrorState, PageSkeleton } from "@/components/ui";

type Txn = { transaction: { id: number; planName: string; amountCentavos: number; status: string; isTest: boolean; ref: string; createdAt: number }; premium: { active: boolean; until: number | null } };

/**
 * Checkout confirmation. No payment gateway is connected yet: confirming settles the transaction
 * through the sandbox provider (stored with is_test = 1), and no payment details are collected.
 * Replace the settle call with the gateway redirect when one is added (see docs/SUBSCRIPTION.md).
 */
export default function SandboxCheckout() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { refresh } = useMe();
  const onError = useApiErrorHandler();
  const { data, error, reload, setData } = useApi<Txn>(`/api/billing/sandbox/${id}`);
  const [busy, setBusy] = useState<string | null>(null);

  async function settle(outcome: "success" | "failure" | "cancel") {
    setBusy(outcome);
    try {
      const r = await api<Txn>(`/api/billing/sandbox/${id}`, { body: { outcome } });
      setData(r);
      if (outcome === "success") await refresh();
      if (outcome === "cancel") router.replace("/premium");
    } catch (e) {
      onError(e);
    } finally {
      setBusy(null);
    }
  }

  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return <main className="mx-auto max-w-[480px] px-4"><PageHeader title="Checkout" back="/premium" /><PageSkeleton /></main>;
  const t = data.transaction;

  if (t.status === "paid") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center px-6 text-center">
        <div className="grid size-24 place-items-center rounded-full bg-green-50 text-green-600 animate-pop">
          <CircleCheckBig className="size-12" />
        </div>
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-ink">Premium activated</h1>
        <p className="mt-2 text-sm text-muted">{t.planName} is on your account{data.premium.until ? ` until ${fmtDateLong(data.premium.until)}` : ""}.</p>
        <ButtonLink href="/home" size="lg" className="mt-8 w-full max-w-xs">Continue</ButtonLink>
      </main>
    );
  }

  if (t.status === "failed" || t.status === "cancelled") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center px-6 text-center">
        <div className="grid size-24 place-items-center rounded-full bg-red-50 text-red-600">
          <CircleX className="size-12" />
        </div>
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-ink">{t.status === "failed" ? "Payment failed" : "Checkout cancelled"}</h1>
        <p className="mt-2 text-sm text-muted">Nothing was charged and your plan hasn&apos;t changed.</p>
        <ButtonLink href="/premium" size="lg" className="mt-8 w-full max-w-xs">Back to plans</ButtonLink>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[480px] px-4">
      <PageHeader title="Checkout" back="/premium" />
      <Card className="mt-2 divide-y divide-line">
        <div className="flex justify-between px-4 py-3 text-sm">
          <span className="text-muted">Plan</span>
          <span className="font-semibold text-ink">{t.planName}</span>
        </div>
        <div className="flex justify-between px-4 py-3 text-sm">
          <span className="text-muted">Amount</span>
          <span className="font-semibold text-ink">{formatPeso(t.amountCentavos)}</span>
        </div>
        <div className="flex justify-between px-4 py-3 text-sm">
          <span className="text-muted">Reference</span>
          <span className="font-mono text-xs text-ink-2">{t.ref}</span>
        </div>
        {data.premium.active && (
          <div className="px-4 py-3 text-xs text-muted">Your current Premium runs until {fmtDateLong(data.premium.until!)}; this purchase is added after that date.</div>
        )}
      </Card>
      <div className="mt-6 space-y-2.5">
        <Button full size="lg" loading={busy === "success"} disabled={!!busy} onClick={() => settle("success")}>
          Confirm payment
        </Button>
        <Button full variant="ghost" disabled={!!busy} onClick={() => settle("cancel")}>
          Cancel
        </Button>
      </div>
    </main>
  );
}
