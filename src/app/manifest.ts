import type { MetadataRoute } from "next";

/**
 * Makes Pacwoods installable ("Add to Home Screen", or Install in Chrome and
 * Edge): it then opens in its own full-screen window, without the browser's
 * address bar, straight to the user's own dashboard. Nothing is cached for
 * offline use: job, client and payment data stays on the server.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pacwoods",
    short_name: "Pacwoods",
    description: "Pacwoods production: jobs, cutlists, queues and progress.",
    id: "/dashboard",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#1b2328",
    theme_color: "#1b2328",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
