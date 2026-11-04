"use client";

import { useRouter } from "next/navigation";
import { CircleCheck, CircleX, Gift, Nfc, ShieldCheck, Smartphone } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useMe } from "@/lib/me";
import { useWebNfc } from "@/lib/webnfc";
import { fmtDate, fmtDateTime, fmtTime } from "@/lib/format";
import { PageHeader } from "@/components/Nav";
import { PhoneOnStand } from "@/components/Illustrations";
import { AccessDenied } from "@/components/SystemScreens";
import { useToast } from "@/components/Toast";
import { Button, Card, ErrorState, PageSkeleton, SectionTitle, cx } from "@/components/ui";

type StandInfo = {
  stand: { code: string; model: string; status: string; assignedAt: number } | null;
  device: { label: string; firstSeenAt: number; lastSeenAt: number } | null;
  session: { startedAt: number; lastSeenAt: number; expiresAt: number };
  trialGrantedAt: number | null;
  history: { id: number; result: string; trialGranted: boolean; at: number }[];
  nfc: { verified: boolean; verifiedAt: number | null; until: number | null };
  rules: { nfcGraceMs: number; nfcMaxMs: number; heartbeatMs: number };
};

const RESULT: Record<string, string> = {
  verified: "Verified (new session)",
  refreshed: "Verification renewed",
  wrong_owner: "Tapped while signed in to another account",
  login_required: "Tapped while signed out",
};

export default function StandPage() {
  const { me, refresh } = useMe();
  const router = useRouter();
  const toast = useToast();
  const nfc = useWebNfc();
  const { data, error, reload } = useApi<StandInfo>(me.access.standOwner ? "/api/stand" : null);
  if (!me.access.standOwner) return <AccessDenied />;

  async function scan() {
    try {
      const r = await api<{ newSession: boolean; verificationId: number; trialGranted: boolean }>("/api/nfc/verify", { body: await nfc.scan() });
      await Promise.all([refresh(), reload()]);
      toast(r.trialGranted ? "Stand verified. Your 30-day Premium trial has started." : "Stand verified");
      if (r.newSession) router.push(`/checkin?v=${r.verificationId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't verify the stand.", "error");
    }
  }

  return (
    <main className="mx-auto max-w-[480px] px-4">
      <PageHeader title="My Stand" back />
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data ? (
        <PageSkeleton />
      ) : (
        <>
          <Card className="flex items-center gap-4 p-4">
            <PhoneOnStand className="size-24 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{data.stand?.model ?? "FocusDock Stand"}</p>
              <p className="text-2xl font-extrabold tracking-tight text-ink">{data.stand?.code ?? "Not linked"}</p>
              {data.stand && <p className="text-xs text-muted">Linked {fmtDate(data.stand.assignedAt)}</p>}
            </div>
          </Card>

          <div className={cx("mt-3 rounded-[20px] p-4", data.nfc.verified ? "bg-green-50" : "bg-brand-50")}>
            <div className="flex items-center gap-3">
              {data.nfc.verified ? <ShieldCheck className="size-7 text-green-600" /> : <Nfc className="size-7 text-brand-700" />}
              <div className="flex-1">
                <p className={cx("font-bold", data.nfc.verified ? "text-green-800" : "text-brand-800")}>{data.nfc.verified ? "This session is verified" : "Not verified"}</p>
                <p className="text-xs text-ink-2">
                  {data.nfc.verified
                    ? `Since ${fmtTime(data.nfc.verifiedAt!)} · stays active while the app is open (up to ${data.rules.nfcMaxMs / 3_600_000}h)`
                    : "Tap your phone on the stand's NFC tag to unlock Focus and Check-in."}
                </p>
              </div>
            </div>
            {nfc.supported && (
              <Button full variant={data.nfc.verified ? "secondary" : "primary"} className="mt-3" loading={nfc.scanning} icon={<Nfc className="size-4" />} onClick={scan}>
                {nfc.scanning ? "Hold near the stand…" : data.nfc.verified ? "Renew with in-app scan" : "Scan stand in app"}
              </Button>
            )}
          </div>

          <SectionTitle>How verification works</SectionTitle>
          <Card className="space-y-2 p-4 text-sm text-ink-2">
            <p>• Tap your phone on the stand to unlock Focus and Check-in.</p>
            <p>• Verification stays active while the app is open. If it&apos;s closed for more than {data.rules.nfcGraceMs / 60_000} minutes, or after {data.rules.nfcMaxMs / 3_600_000} hours, tap again.</p>
            <p>• Your stand account can be signed in on one phone at a time. Signing in elsewhere ends this session.</p>
                      </Card>

          <SectionTitle>This device</SectionTitle>
          <Card className="divide-y divide-line">
            <div className="flex items-center gap-3 px-4 py-3">
              <Smartphone className="size-5 text-brand-600" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-ink">{data.device?.label ?? "This phone"}</p>
                <p className="text-xs text-muted">Signed in {fmtDateTime(data.session.startedAt)} · session ends by {fmtDate(data.session.expiresAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <Gift className="size-5 text-amber-500" />
              <p className="flex-1 text-sm text-ink-2">
                {data.trialGrantedAt ? <>30-day trial used on <b>{fmtDate(data.trialGrantedAt)}</b> (one per account)</> : "Your first verified tap unlocks a one-time 30-day Premium trial."}
              </p>
            </div>
          </Card>

          <SectionTitle>Recent taps</SectionTitle>
          <Card className="divide-y divide-line">
            {data.history.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted">No taps recorded yet.</p>
            ) : (
              data.history.map((h) => (
                <div key={h.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  {h.result === "verified" || h.result === "refreshed" ? <CircleCheck className="size-4 text-green-600" /> : <CircleX className="size-4 text-red-500" />}
                  <span className="flex-1 text-ink-2">
                    {RESULT[h.result] ?? h.result}
                    {h.trialGranted && <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">TRIAL</span>}
                  </span>
                  <span className="text-xs text-muted">{fmtDateTime(h.at)}</span>
                </div>
              ))
            )}
          </Card>
        </>
      )}
    </main>
  );
}
