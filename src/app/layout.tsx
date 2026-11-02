import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { DeviceGate } from "@/components/DeviceGate";
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/components/Sheet";
import { UnsupportedScreen } from "@/components/SystemScreens";
import { isUnsupportedAgent } from "@/shared/deviceAgent";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "ATHENTIV FocusDock", template: "%s · ATHENTIV FocusDock" },
  description: "ATHENTIV FocusDock — the student focus and deadline companion for your phone and FocusDock stand.",
  applicationName: "ATHENTIV FocusDock",
  appleWebApp: { capable: true, title: "FocusDock", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F3F5FA",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const gate = process.env.DEVICE_GATE !== "off";
  // Desktops and tablets get the unsupported screen in the server HTML — no app code is sent.
  const blocked = gate && isUnsupportedAgent((await headers()).get("user-agent") ?? "");
  if (blocked) {
    return (
      <html lang="en" className={`${inter.variable} antialiased`}>
        <body className="min-h-dvh font-sans">
          <UnsupportedScreen />
        </body>
      </html>
    );
  }
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="min-h-dvh font-sans">
        <DeviceGate enabled={gate}>
          <ToastProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </ToastProvider>
        </DeviceGate>
      </body>
    </html>
  );
}
