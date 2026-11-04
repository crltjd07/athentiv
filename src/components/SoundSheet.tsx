"use client";

import { useEffect, useState } from "react";
import { CloudLightning, CloudRain, Droplets, ExternalLink, Fan, Flame, Pause, Play, Trash2, Trees, Volume2, Waves, Wind, type LucideIcon } from "lucide-react";
import { ambient } from "@/lib/ambient";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useMe } from "@/lib/me";
import { SOUNDS, type SoundKey } from "@/shared/catalog";
import { LockIcon, useApiErrorHandler, useUpgrade } from "./Premium";
import { Sheet } from "./Sheet";
import { Button, Input, cx } from "./ui";

const ICONS: Record<SoundKey, LucideIcon> = { rain: CloudRain, ocean: Waves, forest: Trees, fireplace: Flame, fan: Fan, thunderstorm: CloudLightning, brown: Wind, riverside: Droplets };
// "Thunderstorm" is wider than a tile on small phones (360 px and below). A soft hyphen lets it
// break as "Thunder-storm" only when it doesn't fit; on wider screens it stays on one line.
const TILE_LABEL: Partial<Record<SoundKey, string>> = { thunderstorm: "Thunder\u00ADstorm" };

type AudioPrefs = { soundKey: SoundKey; volume: number; playlists: { id: number; type: string; label: string; url: string; embedUrl: string }[] };

export function useAmbient() {
  const [s, setS] = useState(() => ({ playing: false, sound: "rain" as SoundKey, volume: 0.5, blocked: false }));
  useEffect(() => ambient().subscribe(setS), []);
  return s;
}

export function SoundSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me } = useMe();
  const premium = me.access.features.allSounds;
  const upgrade = useUpgrade();
  const onError = useApiErrorHandler();
  const state = useAmbient();
  const prefs = useApi<AudioPrefs>(open ? "/api/audio" : null);
  const [link, setLink] = useState("");
  const [adding, setAdding] = useState(false);
  const [shown, setShown] = useState<number | null>(null);

  // Load the saved sound/volume once.
  useEffect(() => {
    if (prefs.data && !ambient().playing) {
      ambient().setSound(prefs.data.soundKey);
      ambient().setVolume(prefs.data.volume);
    }
  }, [prefs.data]);

  async function choose(key: SoundKey) {
    const tier = SOUNDS.find((s) => s.key === key)!.tier;
    if (tier === "premium" && !premium) return upgrade("All ambient sounds");
    ambient().play(key);
    api("/api/audio", { method: "PATCH", body: { soundKey: key } }).catch(onError);
  }

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      await api("/api/audio/playlists", { body: { url: link } });
      setLink("");
      await prefs.reload();
    } catch (err) {
      onError(err);
    } finally {
      setAdding(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Study sounds">
      <div className="grid grid-cols-4 gap-2">
        {SOUNDS.map((s) => {
          const Icon = ICONS[s.key];
          const active = state.sound === s.key && state.playing;
          const locked = s.tier === "premium" && !premium;
          return (
            <button key={s.key} onClick={() => choose(s.key)} aria-pressed={active} className={cx("relative flex flex-col items-center gap-1 rounded-2xl border px-1 py-3 text-center text-[11px] leading-tight font-semibold", active ? "border-brand-700 bg-brand-700 text-white" : "border-line bg-white text-ink-2", locked && "text-faint")}>
              <Icon className="size-5" />
              <span>{TILE_LABEL[s.key] ?? s.label}</span>
              {locked && <LockIcon className="absolute top-1 right-1 size-4" />}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button aria-label={state.playing ? "Pause sound" : "Play sound"} onClick={() => ambient().toggle()} className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-700 text-white">
          {state.playing ? <Pause className="size-5" /> : <Play className="size-5" />}
        </button>
        <Volume2 className="size-5 shrink-0 text-faint" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={state.volume}
          aria-label="Volume"
          onChange={(e) => ambient().setVolume(Number(e.target.value))}
          onPointerUp={() => api("/api/audio", { method: "PATCH", body: { volume: ambient().volume } }).catch(() => {})}
          className="h-2 flex-1 accent-[var(--color-brand-700)]"
        />
      </div>
      {state.blocked ? (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Your phone didn&apos;t let the sound play. Turn the volume up, switch off silent mode, then tap the sound again.
        </p>
      ) : (
        <p className="mt-2 text-xs text-faint">Tap a sound to play it. These sounds don&apos;t need Spotify.</p>
      )}

      <div className="mt-6 border-t border-line pt-4">
        <h3 className="flex items-center gap-2 font-bold text-ink">
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden><circle cx="12" cy="12" r="12" fill="#1DB954" /><path d="M6.5 9.5c3.8-1.1 7.6-.8 11 1M7 12.6c3.1-.9 6.2-.6 9 .9M7.6 15.4c2.5-.7 4.9-.5 7.1.7" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
          Spotify playlists
        </h3>
        <p className="mt-1 text-xs text-muted">Optional. Save your study playlists to play them here or open them in Spotify.</p>
        <ul className="mt-3 space-y-2">
          {prefs.data?.playlists.map((p) => (
            <li key={p.id} className="rounded-2xl border border-line bg-white p-2.5">
              <div className="flex items-center gap-2">
                <button onClick={() => setShown(shown === p.id ? null : p.id)} className="flex-1 truncate text-left text-sm font-semibold text-ink">
                  {p.label}
                </button>
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-full bg-[#1DB954] px-3 text-xs font-semibold text-white">
                  Open <ExternalLink className="size-3" />
                </a>
                <button aria-label="Remove playlist" onClick={async () => { await api(`/api/audio/playlists/${p.id}`, { method: "DELETE" }).catch(onError); void prefs.reload(); }} className="grid size-8 place-items-center text-faint">
                  <Trash2 className="size-4" />
                </button>
              </div>
              {shown === p.id && <iframe title={p.label} src={p.embedUrl} className="mt-2 h-[152px] w-full rounded-xl border-0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" />}
            </li>
          ))}
        </ul>
        <form onSubmit={addLink} className="mt-3 flex gap-2">
          <div className="flex-1">
            <Input placeholder="Paste a Spotify playlist link" value={link} onChange={(e) => setLink(e.target.value)} inputMode="url" />
          </div>
          <Button type="submit" size="md" loading={adding} disabled={!link.trim()}>
            Add
          </Button>
        </form>
      </div>
    </Sheet>
  );
}
