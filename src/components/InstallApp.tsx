"use client";

import { useSyncExternalStore } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download04Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

// Chrome, Edge and Android offer installation once, early on: keep the offer.
let offer: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    offer = e as InstallPrompt;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    offer = null;
    notify();
  });
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** "browser" can install now, "ios" needs Share → Add to Home Screen, null when installed or not possible. */
function installMode(): "browser" | "ios" | null {
  const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (installed) return null;
  if (offer) return "browser";
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ? "ios" : null;
}

/** Offers to install Pacwoods as an app, where the browser allows it. */
export default function InstallApp({ className }: { className?: string }) {
  const mode = useSyncExternalStore(subscribe, installMode, () => null);
  if (!mode) return null;
  if (mode === "ios") {
    return <p className={cn("px-3 text-xs text-white/70", className)}>Install the app: tap Share, then “Add to Home Screen”.</p>;
  }
  return (
    <button
      type="button"
      onClick={async () => {
        const o = offer;
        if (!o) return;
        await o.prompt();
        await o.userChoice;
        offer = null;
        notify();
      }}
      className={cn("flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-md px-3 text-sm font-medium text-brand-gold hover:bg-white/10", className)}
    >
      <HugeiconsIcon icon={Download04Icon} className="size-5" />
      Install app
    </button>
  );
}
