// Shared by the root layout (server) and the theme hook (client). No client-only code here.

export type Theme = "light" | "dark";

export const THEME_KEY = "athentiv-theme";
export const THEME_COLOR: Record<Theme, string> = { light: "#F3F5FA", dark: "#0B1120" };

/**
 * Runs in <head> before the first paint, so a saved dark theme never flashes light first.
 * Kept tiny and dependency-free.
 */
export const THEME_INIT_SCRIPT = `(function(){try{if(localStorage.getItem("${THEME_KEY}")==="dark"){var d=document.documentElement;d.classList.add("dark");d.style.colorScheme="dark";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","${THEME_COLOR.dark}");}}catch(e){}})();`;
