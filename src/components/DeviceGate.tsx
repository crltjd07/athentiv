"use client";

import { useEffect, useState, type ReactNode } from "react";
import { evaluateDevice } from "@/lib/device";
import { LoadingScreen, RotateNotice, UnsupportedScreen } from "./SystemScreens";

/**
 * Client-side half of the smartphone-only rule (the proxy handles obvious cases server-side).
 * Nothing from the app renders until the device has been checked.
 */
export function DeviceGate({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [state, setState] = useState<"checking" | "ok" | "unsupported">(enabled ? "checking" : "ok");

  useEffect(() => {
    if (!enabled) return;
    const check = () => setState(evaluateDevice().supported ? "ok" : "unsupported");
    check();
    // Re-check if the window changes size dramatically (e.g. desktop emulation toggled off).
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [enabled]);

  if (state === "checking") return <LoadingScreen />;
  if (state === "unsupported") return <UnsupportedScreen />;
  return (
    <>
      {children}
      <RotateNotice />
    </>
  );
}
