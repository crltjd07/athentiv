/**
 * Server-side half of the smartphone-only rule: obviously unsupported user agents (desktop OSes,
 * iPads, Android tablets). Ambiguous agents (e.g. iPadOS reporting "Macintosh") are resolved by
 * the client-side capability check in src/lib/device.ts, which also checks touch and screen size.
 */
export function isUnsupportedAgent(ua: string): boolean {
  if (/iPad/.test(ua)) return true;
  if (/Android/.test(ua) && !/Mobile/.test(ua)) return true;
  if (/iPhone|iPod|Android/.test(ua)) return false;
  if (/Macintosh/.test(ua)) return false;
  return /Windows NT|X11|Linux|CrOS/.test(ua);
}
