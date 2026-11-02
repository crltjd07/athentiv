"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal Web NFC typings (Chrome for Android only).
type NdefRecord = { recordType: string; data?: DataView; encoding?: string };
type NdefReadingEvent = Event & { message: { records: NdefRecord[] } };
type NdefReader = EventTarget & {
  scan: (opts?: { signal?: AbortSignal }) => Promise<void>;
  onreading: ((e: NdefReadingEvent) => void) | null;
  onreadingerror: ((e: Event) => void) | null;
};

/** Parses a FocusDock tag URL: https://host/nfc/FD-1001#k=SECRET */
export function parseTagUrl(url: string): { code: string; key: string } | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/^\/nfc\/([A-Za-z0-9-]{3,32})\/?$/);
    const key = new URLSearchParams(u.hash.replace(/^#/, "")).get("k");
    return m && key ? { code: m[1], key } : null;
  } catch {
    return null;
  }
}

/**
 * Lets Android Chrome users scan the stand from inside the app. On iPhone (no Web NFC) the
 * system reads the tag's URL itself and opens the /nfc landing page, so this is optional.
 */
export function useWebNfc() {
  const [supported, setSupported] = useState(false);
  const [scanning, setScanning] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "NDEFReader" in window);
    return () => abort.current?.abort();
  }, []);

  const scan = useCallback(async (): Promise<{ code: string; key: string }> => {
    const Reader = (window as unknown as { NDEFReader: new () => NdefReader }).NDEFReader;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setScanning(true);
    try {
      const reader = new Reader();
      await reader.scan({ signal: ctrl.signal });
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          ctrl.abort();
          reject(new Error("No stand detected. Hold your phone closer to the NFC tag and try again."));
        }, 30_000);
        reader.onreading = (e) => {
          for (const r of e.message.records) {
            if (r.recordType !== "url" || !r.data) continue;
            const parsed = parseTagUrl(new TextDecoder().decode(r.data));
            if (parsed) {
              clearTimeout(timer);
              ctrl.abort();
              resolve(parsed);
              return;
            }
          }
          clearTimeout(timer);
          ctrl.abort();
          reject(new Error("That tag isn't a FocusDock stand."));
        };
        reader.onreadingerror = () => {
          clearTimeout(timer);
          ctrl.abort();
          reject(new Error("Couldn't read the tag. Try again."));
        };
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "NotAllowedError") throw new Error("NFC permission was denied.");
      throw e;
    } finally {
      setScanning(false);
    }
  }, []);

  return { supported, scanning, scan };
}
