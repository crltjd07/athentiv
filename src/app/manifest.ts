import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ATHENTIV FocusDock",
    short_name: "FocusDock",
    description: "Student focus and deadline companion for the ATHENTIV FocusDock stand.",
    start_url: "/home",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F3F5FA",
    theme_color: "#1539B0",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
