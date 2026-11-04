"use client";

// Procedural ambient sound engine (Web Audio API). Every sound is synthesised in the browser,
// so there are no audio files to host or license. A single module-level instance keeps playing
// while the user moves between the Focus screens.

import type { SoundKey } from "@/shared/catalog";

type Listener = (s: { playing: boolean; sound: SoundKey; volume: number; blocked: boolean }) => void;

/** A short silent WAV, built once. Playing it as normal media keeps iPhones from muting the sound. */
let silentWavUrl: string | null = null;
function silentWav() {
  if (silentWavUrl) return silentWavUrl;
  const rate = 8000;
  const samples = rate / 2;
  const buf = new ArrayBuffer(44 + samples);
  const v = new DataView(buf);
  const str = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + samples, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); str(36, "data"); v.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) v.setUint8(44 + i, 128);
  silentWavUrl = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  return silentWavUrl;
}

class AmbientEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private stopFns: (() => void)[] = [];
  private listeners = new Set<Listener>();
  playing = false;
  /** True when the browser refused to start audio (for example a phone setting). */
  blocked = false;
  private keepAlive: HTMLAudioElement | null = null;
  sound: SoundKey = "rain";
  volume = 0.5;

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => {
      this.listeners.delete(fn);
    };
  }
  private snapshot() {
    return { playing: this.playing, sound: this.sound, volume: this.volume, blocked: this.blocked };
  }
  private emit() {
    for (const l of this.listeners) l(this.snapshot());
  }

  private ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    // iPhones mute Web Audio when the ring/silent switch is on, but not media playback.
    // A looping silent track makes the phone treat this as media, so the sounds can be heard.
    if (!this.keepAlive) {
      this.keepAlive = new Audio(silentWav());
      this.keepAlive.loop = true;
      this.keepAlive.setAttribute("playsinline", "");
    }
    if (this.keepAlive.paused) void this.keepAlive.play().catch(() => {});
    return { ctx: this.ctx, out: this.master! };
  }

  private noise(ctx: AudioContext, kind: "white" | "pink" | "brown", seconds = 6) {
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === "white") d[i] = w * 0.5;
        else if (kind === "pink") {
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        } else {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        }
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  }

  private filter(ctx: AudioContext, type: BiquadFilterType, freq: number, q = 0.7) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  /** Random short events (droplets, crackles, chirps), rescheduled until stopped. */
  private every(minMs: number, maxMs: number, fn: () => void) {
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      if (!alive) return;
      fn();
      t = setTimeout(loop, minMs + Math.random() * (maxMs - minMs));
    };
    t = setTimeout(loop, minMs);
    this.stopFns.push(() => {
      alive = false;
      clearTimeout(t);
    });
  }

  private build(key: SoundKey) {
    const { ctx, out } = this.ensure();
    const chain = (...nodes: AudioNode[]) => {
      for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
      nodes[nodes.length - 1].connect(out);
    };
    const start = (src: AudioScheduledSourceNode) => {
      src.start();
      this.stopFns.push(() => {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
        src.disconnect();
      });
    };
    const gain = (v: number) => {
      const g = ctx.createGain();
      g.gain.value = v;
      return g;
    };
    const burst = (dur: number, freq: number, type: BiquadFilterType, level: number) => {
      const src = this.noise(ctx, "white", 0.2);
      src.loop = false;
      const g = gain(0);
      const now = ctx.currentTime;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(level, now + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      chain(src, this.filter(ctx, type, freq, 1.2), g);
      src.start(now);
      src.stop(now + dur + 0.05);
    };

    switch (key) {
      case "white":
      case "pink":
      case "brown": {
        const src = this.noise(ctx, key);
        chain(src, gain(key === "white" ? 0.35 : 0.7));
        start(src);
        break;
      }
      case "rain": {
        const src = this.noise(ctx, "pink");
        chain(src, this.filter(ctx, "highpass", 500), this.filter(ctx, "lowpass", 7000), gain(0.8));
        start(src);
        this.every(25, 90, () => burst(0.04 + Math.random() * 0.05, 2500 + Math.random() * 4000, "bandpass", 0.08 + Math.random() * 0.12));
        break;
      }
      case "ocean": {
        const src = this.noise(ctx, "brown");
        const swell = gain(0.5);
        const lfo = ctx.createOscillator();
        const depth = gain(0.45);
        lfo.frequency.value = 0.09;
        lfo.connect(depth).connect(swell.gain);
        chain(src, this.filter(ctx, "lowpass", 900), swell);
        start(src);
        start(lfo);
        break;
      }
      case "forest": {
        const src = this.noise(ctx, "pink");
        chain(src, this.filter(ctx, "bandpass", 1800, 0.4), gain(0.25));
        start(src);
        this.every(1800, 5200, () => {
          const now = ctx.currentTime;
          const base = 2200 + Math.random() * 2000;
          for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
            const o = ctx.createOscillator();
            const g = gain(0);
            const t0 = now + i * 0.13;
            o.frequency.setValueAtTime(base, t0);
            o.frequency.exponentialRampToValueAtTime(base * 1.35, t0 + 0.08);
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.05, t0 + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
            chain(o, g);
            o.start(t0);
            o.stop(t0 + 0.12);
          }
        });
        break;
      }
      case "fireplace": {
        const src = this.noise(ctx, "brown");
        chain(src, this.filter(ctx, "lowpass", 600), gain(0.75));
        start(src);
        this.every(60, 420, () => burst(0.015 + Math.random() * 0.03, 1800 + Math.random() * 3000, "highpass", 0.15 + Math.random() * 0.3));
        break;
      }
      case "fan": {
        const src = this.noise(ctx, "brown");
        chain(src, this.filter(ctx, "lowpass", 380), gain(0.9));
        start(src);
        const hum = ctx.createOscillator();
        hum.frequency.value = 118;
        chain(hum, gain(0.015));
        start(hum);
        break;
      }
    }
  }

  play(key: SoundKey = this.sound) {
    this.stopSources();
    this.sound = key;
    this.build(key);
    this.playing = true;
    this.blocked = false;
    // If the browser still hasn't started audio shortly after a tap, tell the user why.
    const ctx = this.ctx;
    setTimeout(() => {
      if (this.playing && ctx && ctx.state !== "running") {
        this.blocked = true;
        this.emit();
      }
    }, 800);
    this.emit();
  }

  private stopSources() {
    for (const f of this.stopFns) f();
    this.stopFns = [];
  }

  stop() {
    this.stopSources();
    this.playing = false;
    this.blocked = false;
    this.keepAlive?.pause();
    this.emit();
  }

  toggle() {
    if (this.playing) this.stop();
    else this.play();
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    this.emit();
  }

  setSound(key: SoundKey) {
    this.sound = key;
    if (this.playing) this.play(key);
    else this.emit();
  }

  /** Short two-note chime used for session transitions. */
  chime(kind: "focus-done" | "break-done") {
    const { ctx, out } = this.ensure();
    const notes = kind === "focus-done" ? [659.25, 880] : [523.25, 659.25, 783.99];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t = ctx.currentTime + i * 0.18;
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.35 / Math.max(this.volume, 0.3), t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 1);
    });
    setTimeout(() => {
      if (!this.playing) this.keepAlive?.pause();
    }, 2000);
  }
}

let engine: AmbientEngine | null = null;
export function ambient() {
  engine ??= new AmbientEngine();
  return engine;
}
