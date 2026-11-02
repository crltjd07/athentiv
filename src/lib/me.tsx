"use client";

import { createContext, useContext } from "react";
import type { MePayload } from "@/server/users";

export type Me = MePayload;

export const MeContext = createContext<{ me: Me; refresh: () => Promise<void> } | null>(null);

export function useMe() {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMe must be used inside the app shell");
  return ctx;
}
