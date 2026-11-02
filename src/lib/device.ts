"use client";

type NavigatorUAData = { mobile?: boolean; platform?: string };

export type DeviceVerdict = { supported: boolean; reason: string };

/**
 * Smartphone-only check combining user agent, client hints, input capabilities and screen size.
 * User-agent sniffing alone is not trusted: a phone must also have a coarse (touch) pointer and a
 * phone-sized screen, and tablets are rejected even with a mobile-looking agent.
 */
export function evaluateDevice(): DeviceVerdict {
  const ua = navigator.userAgent;
  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;
  const touchPoints = navigator.maxTouchPoints ?? 0;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const shortSide = Math.min(window.screen.width, window.screen.height);

  const isIPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
  const isIPhone = /iPhone|iPod/.test(ua) && !isIPad;
  const isAndroid = /Android/.test(ua) || uaData?.platform === "Android";
  const isAndroidPhone = isAndroid && (/Mobile/.test(ua) || uaData?.mobile === true);

  if (isIPad) return { supported: false, reason: "tablet" };
  if (isAndroid && !isAndroidPhone) return { supported: false, reason: "tablet" };
  if (!isIPhone && !isAndroidPhone) return { supported: false, reason: "desktop" };
  if (touchPoints < 1 || !coarse) return { supported: false, reason: "no-touch" };
  // Phones report a short side up to ~480 CSS px; small tablets start around 600.
  if (shortSide > 540) return { supported: false, reason: "tablet" };
  return { supported: true, reason: "ok" };
}
