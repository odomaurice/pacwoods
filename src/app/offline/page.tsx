import type { Metadata } from "next";
import Logo from "@/components/Logo";
import TryAgain from "./TryAgain";

export const metadata: Metadata = { title: "Offline | Pacwoods" };

/**
 * Shown by the service worker (public/sw.js) for a page that was never opened
 * on this device while the connection is down. Static: it is saved at install.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-8 bg-brand-charcoal px-6 text-center text-white">
      <span className="text-2xl">
        <Logo />
      </span>
      <div className="max-w-md space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">You&rsquo;re offline</h1>
        <p className="text-white/75">
          This page hasn&rsquo;t been opened on this device yet, so there is no saved copy. Pages you have already opened still work: go back and pick one, or try again
          when the connection returns.
        </p>
        <p className="text-sm text-white/60">Cuts you tick off and photos you take are kept on this device and sent when you&rsquo;re back online.</p>
      </div>
      <TryAgain />
    </main>
  );
}
