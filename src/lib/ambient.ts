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

  /** Noise buffers are built once per colour and reused, so switching sounds is instant. */
  private buffers = new Map<string, AudioBuffer>();

  /**
   * A looping stereo noise source. The buffer is long (12 s) so it doesn't sound repetitive, and
   * its end is cross-faded into its start so the loop point has no click.
   */
  private noise(ctx: AudioContext, kind: "white" | "pink" | "brown") {
    let buf = this.buffers.get(kind);
    if (!buf) {
      const rate = ctx.sampleRate;
      const len = rate * 12;
      const fade = Math.floor(rate * 0.75);
      buf = ctx.createBuffer(2, len, rate);
      const tmp = new Float32Array(len + fade);
      for (let ch = 0; ch < 2; ch++) {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
        for (let i = 0; i < tmp.length; i++) {
          const w = Math.random() * 2 - 1;
          if (kind === "white") tmp[i] = w * 0.5;
          else if (kind === "pink") {
            b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
            b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
            tmp[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
            b6 = w * 0.115926;
          } else {
            last = (last + 0.02 * w) / 1.02;
            tmp[i] = last * 3.5;
          }
        }
        const d = buf.getChannelData(ch);
        d.set(tmp.subarray(0, len));
        // Equal-power blend of the overflow tail into the head: the sample before the loop point
        // flows straight into the one after it.
        for (let i = 0; i < fade; i++) {
          const x = i / fade;
          d[i] = tmp[i] * Math.sqrt(x) + tmp[len + i] * Math.sqrt(1 - x);
        }
      }
      this.buffers.set(kind, buf);
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

  /**
   * Builds one study sound. Every sound is a steady, filtered noise bed: no melodies, no birdsong,
   * no sharp clicks, and any movement is a slow, shallow drift. Each sound fades in over two
   * seconds and fades out when stopped or switched, so nothing starts or ends abruptly.
   */
  private build(key: SoundKey) {
    const { ctx, out } = this.ensure();
    const now = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, now);
    bus.gain.setTargetAtTime(1, now, 0.6);
    bus.connect(out);

    const sources: AudioScheduledSourceNode[] = [];
    const chain = (...nodes: AudioNode[]) => {
      for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
      nodes[nodes.length - 1].connect(bus);
    };
    const start = (src: AudioScheduledSourceNode) => {
      src.start();
      sources.push(src);
    };
    const gain = (v: number) => {
      const g = ctx.createGain();
      g.gain.value = v;
      return g;
    };
    /** A very slow, shallow wobble on an AudioParam (period in seconds, depth as an absolute amount). */
    const drift = (param: AudioParam, period: number, depth: number) => {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 1 / period;
      const amt = gain(depth);
      lfo.connect(amt).connect(param);
      start(lfo);
    };
    const bed = (kind: "white" | "pink" | "brown", level: number, ...filters: BiquadFilterNode[]) => {
      const src = this.noise(ctx, kind);
      const g = gain(level);
      chain(src, ...filters, g);
      start(src);
      return g;
    };

    switch (key) {
      case "thunderstorm": {
        // Heavy, steady rain with thunder rolling far away. There are no sharp thunder cracks:
        // the thunder is a deep low rumble whose level swells and fades slowly. Two slow drifts
        // with different periods (17 s and 29 s) make the swells irregular, like a real storm,
        // without ever going fully silent or suddenly loud.
        bed("pink", 0.55, this.filter(ctx, "highpass", 250), this.filter(ctx, "lowpass", 3800));
        bed("brown", 0.3, this.filter(ctx, "highpass", 40), this.filter(ctx, "lowpass", 600));
        const rumble = bed("brown", 0.42, this.filter(ctx, "highpass", 25), this.filter(ctx, "lowpass", 140));
        drift(rumble.gain, 17, 0.18);
        drift(rumble.gain, 29, 0.14);
        break;
      }
      case "riverside": {
        // A stream flowing over stones: a soft, wide water wash with a gentle babble on top.
        // The babble's tone moves slowly (7 s) and only slightly, so it stays in the background.
        bed("pink", 0.4, this.filter(ctx, "highpass", 200), this.filter(ctx, "lowpass", 4500));
        const babble = this.filter(ctx, "bandpass", 1600, 0.9);
        const flow = bed("pink", 0.3, babble);
        drift(babble.frequency, 7, 350);
        drift(flow.gain, 11, 0.06);
        bed("brown", 0.3, this.filter(ctx, "highpass", 40), this.filter(ctx, "lowpass", 380));
        break;
      }
      case "brown":
        // The highpass removes sub-bass rumble you feel more than hear.
        bed("brown", 0.7, this.filter(ctx, "highpass", 30), this.filter(ctx, "lowpass", 900));
        break;
      case "rain":
        // Steady rain heard through a window: a muffled pink-noise patter over a soft low layer.
        bed("pink", 0.6, this.filter(ctx, "highpass", 350), this.filter(ctx, "lowpass", 3200));
        bed("brown", 0.35, this.filter(ctx, "highpass", 40), this.filter(ctx, "lowpass", 500));
        break;
      case "ocean": {
        // Distant surf: a gentle 14-second swell that only moves the level by about ±15%.
        const swell = bed("brown", 0.55, this.filter(ctx, "highpass", 40), this.filter(ctx, "lowpass", 700));
        drift(swell.gain, 14, 0.08);
        break;
      }
      case "forest": {
        // Leaves in a light breeze, without birdsong. The tone drifts slowly and slightly.
        const tone = this.filter(ctx, "bandpass", 900, 0.5);
        bed("pink", 0.45, this.filter(ctx, "lowpass", 2600), tone);
        drift(tone.frequency, 20, 120);
        bed("brown", 0.25, this.filter(ctx, "highpass", 40), this.filter(ctx, "lowpass", 400));
        break;
      }
      case "fireplace":
        // A warm, low fire bed. Crackles are removed because their sudden pops break focus.
        bed("brown", 0.6, this.filter(ctx, "highpass", 40), this.filter(ctx, "lowpass", 550));
        bed("pink", 0.08, this.filter(ctx, "bandpass", 1200, 0.6));
        break;
      case "fan":
        // Soft, even airflow without the electrical hum.
        bed("brown", 0.7, this.filter(ctx, "highpass", 50), this.filter(ctx, "lowpass", 450));
        bed("pink", 0.12, this.filter(ctx, "bandpass", 700, 0.7));
        break;
    }

    this.stopFns.push(() => {
      // Fade out quickly, then release the nodes.
      const t = ctx.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.setTargetAtTime(0, t, 0.12);
      for (const src of sources) {
        try {
          src.stop(t + 0.6);
        } catch {
          /* already stopped */
        }
      }
      setTimeout(() => bus.disconnect(), 800);
    });
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
