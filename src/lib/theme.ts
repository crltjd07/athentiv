"use client";

// Light / dark appearance. The choice is stored on this device only (localStorage) and applied as
// a `dark` class on <html>. THEME_INIT_SCRIPT (themeScript.ts) runs before the first paint.

import { useEffect, useState } from "react";
import { THEME_COLOR, THEME_KEY, type Theme } from "./themeScript";

export type { Theme };

const EVENT = "athentiv-theme-change";

function current(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage unavailable (private mode): the theme still applies for this visit */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useTheme() {
  const [theme, set] = useState<Theme>("light");
  useEffect(() => {
    const sync = () => set(current());
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return [theme, setTheme] as const;
}
