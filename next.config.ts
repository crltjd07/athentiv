import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
  poweredByHeader: false,
  // Development only: lets phones on the home Wi-Fi load the dev server even when this PC's
  // local IP changes (e.g. 192.168.0.115 → 192.168.0.111). Has no effect on production builds.
  allowedDevOrigins: ["192.168.*.*"],
  // Migrations are read from disk at runtime, so ship them with every server function (Vercel).
  outputFileTracingIncludes: {
    "/**": ["./db/migrations/*.sql"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
