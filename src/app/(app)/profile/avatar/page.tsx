"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { api } from "@/lib/api";
import { useMe } from "@/lib/me";
import { AVATARS, avatarOf } from "@/shared/catalog";
import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/Nav";
import { PremiumBadge, useApiErrorHandler, useUpgrade } from "@/components/Premium";
import { useToast } from "@/components/Toast";
import { Button, cx } from "@/components/ui";

export default function AvatarPage() {
  const { me, refresh } = useMe();
  const upgrade = useUpgrade();
  const onError = useApiErrorHandler();
  const toast = useToast();
  const [preview, setPreview] = useState(me.profile.avatarKey);
  const [saving, setSaving] = useState(false);
  const premium = me.access.features.premiumAvatars;
  const a = avatarOf(preview);
  const locked = a.tier === "premium" && !premium;

  async function save() {
    setSaving(true);
    try {
      await api("/api/profile", { method: "PATCH", body: { avatarKey: preview } });
      await refresh();
      toast(`${a.name} is now your avatar`);
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-[480px] px-4">
      <PageHeader title="Choose avatar" back="/profile" />
      <div className="flex flex-col items-center py-4">
        <Avatar key={preview} avatarKey={preview} size={120} ring className="animate-pop" />
        <p className="mt-3 text-lg font-bold text-ink">{a.name}</p>
        {a.tier === "premium" && <PremiumBadge className="mt-1" />}
      </div>

      {(["free", "premium"] as const).map((tier) => (
        <section key={tier} className="mt-4">
          <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-bold text-ink">
            {tier === "free" ? "Freemium avatars" : "Premium avatars"}
            {tier === "premium" && !premium && <span className="text-xs font-medium text-muted">— tap to preview</span>}
          </h2>
          <div className="grid grid-cols-4 gap-2.5">
            {AVATARS.filter((x) => x.tier === tier).map((x) => {
              const isLocked = x.tier === "premium" && !premium;
              return (
                <button
                  key={x.key}
                  onClick={() => setPreview(x.key)}
                  aria-pressed={preview === x.key}
                  className={cx(
                    "relative flex flex-col items-center gap-1 rounded-2xl border-2 bg-white py-3",
                    preview === x.key ? "border-brand-600" : "border-transparent",
                    x.tier === "premium" && "bg-gradient-to-b from-amber-50 to-white",
                  )}
                >
                  <Avatar avatarKey={x.key} size={52} className={isLocked ? "opacity-70" : undefined} />
                  <span className="text-xs font-medium text-ink-2">{x.name}</span>
                  {isLocked && (
                    <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-amber-100 text-amber-600">
                      <Lock className="size-3" />
                    </span>
                  )}
                  {me.profile.avatarKey === x.key && <span className="absolute top-1.5 left-1.5 rounded-full bg-brand-700 px-1.5 text-[9px] font-bold text-white">YOU</span>}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <div className="mt-6">
        {locked ? (
          <Button full size="lg" variant="secondary" onClick={() => upgrade(`The ${a.name} avatar`)}>
            Unlock {a.name} with Premium
          </Button>
        ) : (
          <Button full size="lg" loading={saving} disabled={preview === me.profile.avatarKey} onClick={save}>
            {preview === me.profile.avatarKey ? "Current avatar" : `Use ${a.name}`}
          </Button>
        )}
      </div>
    </main>
  );
}
