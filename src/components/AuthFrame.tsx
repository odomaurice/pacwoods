import type { ReactNode } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import Logo, { LogoMark } from "@/components/Logo";

/**
 * Sign-in and password screens: one rounded card on the charcoal ground.
 * The form on the left; on large screens a line drawing of the workshop on
 * the right. Both lead back to the website.
 */
export default function AuthFrame({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="relative isolate flex min-h-dvh flex-1 items-center justify-center overflow-hidden bg-brand-charcoal p-3 sm:p-6 lg:p-10">
      <LogoMark className="pointer-events-none absolute -top-32 -left-32 -z-10 h-[28rem] w-auto opacity-[0.06]" />
      <LogoMark className="pointer-events-none absolute -right-40 -bottom-40 -z-10 h-[36rem] w-auto opacity-[0.06]" />

      <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] bg-card shadow-2xl lg:min-h-[42rem] lg:grid-cols-2">
        <section className="flex flex-col p-6 sm:p-10">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" aria-label="Pacwoods website" className="text-lg">
              <Logo tone="light" />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
              Website
            </Link>
          </div>

          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
            <div className="mb-8 space-y-2 text-center">
              <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            {children}
          </div>

          <p className="text-center text-xs text-muted-foreground">© {new Date().getFullYear()} Pacwoods · Industrial Wood Processing Centre</p>
        </section>

        <section className="relative hidden flex-col justify-between overflow-hidden bg-brand-gold/10 p-10 lg:flex xl:p-12">
          <figure className="max-w-md space-y-6">
            <span aria-hidden className="block text-6xl leading-none font-bold text-brand-gold-deep">
              &ldquo;
            </span>
            <blockquote className="-mt-6 text-2xl leading-snug font-semibold tracking-tight text-brand-charcoal">
              Panel cutting, CNC machining and edge-banding, done right.
            </blockquote>
            <figcaption className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-card shadow-sm">
                <LogoMark tone="light" className="size-6" />
              </span>
              <span className="text-sm">
                <span className="block font-semibold">Pacwoods</span>
                <span className="text-muted-foreground">Precision Processing. Better Production.</span>
              </span>
            </figcaption>
          </figure>
          <Workshop className="-mx-10 -mb-10 w-[calc(100%+5rem)] text-brand-charcoal xl:-mx-12 xl:-mb-12 xl:w-[calc(100%+6rem)]" />
        </section>
      </div>
    </main>
  );
}

/** Line drawing: boards standing in the rack, a stack of sheets and a saw blade. */
function Workshop({ className = "" }: { className?: string }) {
  const board = "fill-card stroke-current";
  return (
    <svg viewBox="0 0 520 300" aria-hidden className={className} fill="none" strokeWidth="1.5" strokeLinejoin="round">
      {/* Standing boards */}
      <rect x="150" y="70" width="72" height="230" className={board} />
      <path d="M168 84c-4 60 6 130 0 206M186 80c5 70-5 140 2 210M204 90c-3 60 4 120-2 200" className="stroke-current opacity-30" />
      <rect x="214" y="22" width="92" height="278" className="fill-brand-gold/25 stroke-current" />
      <path d="M232 36c6 80-6 160 2 250M258 30c-5 90 5 170-1 260M284 40c4 70-4 150 3 250" className="stroke-current opacity-30" />
      <rect x="298" y="96" width="62" height="204" className={board} />
      <rect x="352" y="48" width="84" height="252" className={board} />
      {/* A cutting plan marked on a board */}
      <path d="M352 120h84M352 190h84M394 48v72M394 190v110M416 120v70" className="stroke-brand-gold-deep" strokeDasharray="5 4" />
      <rect x="430" y="140" width="56" height="160" className={board} />
      <path d="M446 154c-3 50 4 100 0 146M468 150c4 50-3 100 2 150" className="stroke-current opacity-30" />

      {/* A stack of sheets */}
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={24 + i * 2} y={260 - i * 9} width="132" height="9" className={board} />
      ))}
      <rect x="44" y="198" width="54" height="18" className="fill-brand-gold/25 stroke-current" />
      <rect x="52" y="180" width="38" height="18" className={board} />

      {/* Saw blade */}
      <circle cx="120" cy="176" r="30" className="fill-card stroke-brand-gold-deep" strokeWidth="5" strokeDasharray="4 3" />
      <circle cx="120" cy="176" r="20" className="stroke-current" />
      <circle cx="120" cy="176" r="5" className="fill-brand-gold stroke-current" />

      <path d="M0 299.25h520" className="stroke-current" />
    </svg>
  );
}
