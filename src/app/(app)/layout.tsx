"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, ApiClientError, setUnauthorizedHandler } from "@/lib/api";
import { MeContext, type Me } from "@/lib/me";
import { BottomNav } from "@/components/Nav";
import { UpgradeProvider } from "@/components/Premium";
import { LoadingScreen, OfflineBanner } from "@/components/SystemScreens";
import { ErrorState } from "@/components/ui";
import { TIMING } from "@/shared/limits";

const TAB_ROOTS = ["/home", "/tasks", "/focus", "/calendar", "/summary", "/profile", "/subjects", "/notifications", "/mood", "/stand", "/settings", "/premium", "/about"];
// Accounts without a stand need an active Premium plan; until then only these screens are open.
const LOCKED_ALLOWED = ["/premium", "/settings", "/about", "/profile"];
const isUnder = (path: string, roots: string[]) => roots.some((r) => path === r || path.startsWith(r + "/"));
const NO_NAV = ["/focus/session", "/onboarding", "/checkin", "/premium/checkout", "/tasks/new"];

type Heartbeat = { nfc: Me["access"]["nfc"]; premium: { active: boolean; until: number | null }; unreadNotifications: number };

export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const meRef = useRef<Me | null>(null);
  meRef.current = me;

  // Any 401 anywhere in the app lands here: expired or replaced (another device signed in).
  useEffect(() => {
    setUnauthorizedHandler((code) => {
      const reason = code === "SESSION_REPLACED" ? "replaced" : code === "SESSION_EXPIRED" ? "expired" : "signed-out";
      router.replace(`/session-expired?reason=${reason}`);
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  const refresh = useCallback(async () => {
    try {
      setMe(await api<Me>("/api/me"));
      setError(null);
    } catch (e) {
      if (!(e instanceof ApiClientError && e.status === 401)) setError(e instanceof Error ? e.message : "Couldn't load your account.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const locked = !!me?.access.subscriptionRequired;
  const lockedOut = locked && !isUnder(path, LOCKED_ALLOWED);

  // Accounts without a stand go to the Premium page until they subscribe. Everyone else goes
  // through onboarding on first run (and premade stand accounts must change their password).
  useEffect(() => {
    if (!me) return;
    if (lockedOut) {
      router.replace("/premium");
      return;
    }
    if (!locked && (!me.profile.onboarded || me.user.mustChangePassword) && path !== "/onboarding") router.replace("/onboarding");
  }, [me, path, router, locked, lockedOut]);

  // Heartbeat: keeps the session and NFC verification alive, and picks up expiry immediately.
  useEffect(() => {
    if (!me) return;
    let stopped = false;
    const beat = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const hb = await api<Heartbeat>("/api/session/heartbeat", { method: "POST", body: {} });
        if (stopped || !meRef.current) return;
        const cur = meRef.current;
        if (hb.premium.active !== cur.access.isPremium) {
          void refresh(); // Premium started or ended: reload all entitlements.
        } else {
          setMe({ ...cur, unreadNotifications: hb.unreadNotifications, access: { ...cur.access, nfc: hb.nfc } });
        }
      } catch {
        /* offline or signed out — handled elsewhere */
      }
    };
    const id = setInterval(beat, TIMING.heartbeatMs);
    const onVis = () => document.visibilityState === "visible" && void beat();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [me?.user.id, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (error && !me) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] items-center px-4">
        <ErrorState message={error} onRetry={refresh} />
      </main>
    );
  }
  if (!me || lockedOut) return <LoadingScreen />;

  const showNav = !locked && TAB_ROOTS.some((r) => path === r || path.startsWith(r + "/")) && !NO_NAV.some((r) => path.startsWith(r)) && !/^\/tasks\/\d+\/edit/.test(path);

  return (
    <MeContext.Provider value={{ me, refresh }}>
      <UpgradeProvider>
        {!online && <OfflineBanner />}
        <div className={showNav ? "pb-28" : "pb-6"}>{children}</div>
        {showNav && <BottomNav standOwner={me.access.standOwner} />}
      </UpgradeProvider>
    </MeContext.Provider>
  );
}
