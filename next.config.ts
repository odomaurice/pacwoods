import type { NextConfig } from "next";

// No images.remotePatterns, on purpose: every image on the site is a local
// file in public/.
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // The service worker must never be cached, or phones keep an old one.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
