"use client";

import { useEffect } from "react";

/**
 * Installs public/sw.js, which keeps opened pages readable offline. Only in
 * production builds: under `next dev` saved pages would hide code changes.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}
