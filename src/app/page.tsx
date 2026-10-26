import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Camera01Icon,
  Layers01Icon,
  Notification01Icon,
  QrCodeIcon,
  RulerIcon,
  Task01Icon,
} from "@hugeicons/core-free-icons";
import PlanDrawing from "@/components/cutlist/PlanDrawing";
import Logo, { LogoMark } from "@/components/Logo";
import { buttonVariants } from "@/components/ui/button";
import { optimise } from "@/lib/cutting/engine";
import { PART_FILLS } from "@/lib/plan-view";
import { roleHome } from "@/lib/roles";
import { STANDARD_MATERIALS } from "@/lib/standard-materials";
import { getSessionUser } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Pacwoods | Industrial Wood Processing Centre",
  description: "Panel cutting, CNC machining and edge-banding services, with every job tracked from cutlist to collection.",
};

/**
 * A real layout from the cutting engine, drawn by the same component the
 * workshop uses: kitchen carcass panels on one 2440 × 1220 sheet.
 */
function exampleSheet() {
  const edges = (l1: boolean, l2: boolean) => ({ length1: l1, length2: l2, width1: false, width2: false });
  const parts = [
    { ref: "A", label: "Side", length: 720, width: 560, quantity: 2, grain: "NONE" as const, edges: edges(true, false) },
    { ref: "B", label: "Shelf", length: 764, width: 520, quantity: 2, grain: "NONE" as const, edges: edges(true, false) },
    { ref: "C", label: "Door", length: 715, width: 396, quantity: 2, grain: "NONE" as const, edges: edges(true, true) },
  ];
  const plan = optimise(parts, [{ ref: "S", length: 2440, width: 1220, quantity: 1, grained: false }], {
    kerf: 4,
    edgeTrim: 0,
    considerMaterial: false,
    considerGrain: false,
    deductEdgeBanding: false,
    edgeBandThickness: 1,
    singleSheet: true,
  });
  return {
    sheet: plan.sheets[0],
    parts: new Map(parts.map((p, i) => [p.ref, { ref: p.ref, label: p.label, fill: PART_FILLS[i], edges: p.edges }])),
    utilisation: plan.sheets[0]?.utilization ?? 0,
  };
}

const SERVICES = [
  {
    icon: RulerIcon,
    title: "Panel cutting",
    text: "Boards cut to your sizes on the panel saw, from a cutting plan that fits your panels onto as few sheets as possible.",
  },
  {
    icon: Layers01Icon,
    title: "CNC machining",
    text: "Machined shapes and details for cabinet and furniture parts.",
  },
  {
    icon: Task01Icon,
    title: "Edge banding",
    text: "Clean, banded edges on exactly the sides you choose, panel by panel.",
  },
];

const STEPS = [
  { title: "Register your order", text: "Bring your sizes to the counter. You get a client number and a work number for every job." },
  { title: "We plan the cutting", text: "Your panels are laid out on the sheets to waste as little board as possible, and the plan is checked before anything is cut." },
  { title: "Cut, then edged, in order", text: "Jobs are worked first come, first served. Edging starts only after cutting is finished." },
  { title: "Collect your finished work", text: "You are notified when your job is complete, with photos of the finished panels." },
];

const TRACKING = [
  { icon: Task01Icon, title: "Live progress", text: "See each step of your job as it happens, with dates and times, and who is cutting it." },
  { icon: QrCodeIcon, title: "Job card with QR code", text: "Every job has a printable card listing your panels, sizes, materials and edged sides." },
  { icon: Camera01Icon, title: "Photos", text: "Pictures of your wood when it arrives and of the finished work before it leaves the machine." },
  { icon: Notification01Icon, title: "Notifications", text: "A message when cutting starts, when it finishes, and when your job is ready." },
];

function Section({ id, eyebrow, title, children, tone = "light" }: { id: string; eyebrow: string; title: string; children: ReactNode; tone?: "light" | "white" | "dark" }) {
  const bg = tone === "dark" ? "bg-brand-charcoal text-white" : tone === "white" ? "bg-white" : "bg-background";
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`${bg} scroll-mt-16 px-4 py-16 sm:px-8 sm:py-24`}>
      <div className="mx-auto max-w-6xl">
        <p className={`text-xs font-semibold tracking-[0.25em] uppercase ${tone === "dark" ? "text-brand-gold" : "text-brand-gold-deep"}`}>{eyebrow}</p>
        <h2 id={`${id}-title`} className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h2>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

export default async function Home() {
  const user = await getSessionUser();
  const account = user && !user.mustChangePassword ? { href: roleHome(user.role), label: "Go to my dashboard" } : { href: "/login", label: "Sign in" };
  const example = exampleSheet();
  const materials = [...new Set(STANDARD_MATERIALS.map((m) => m.category))];

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 bg-brand-charcoal/95 text-white backdrop-blur supports-[backdrop-filter]:bg-brand-charcoal/85">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-8">
          <Link href="/" className="text-lg" aria-label="Pacwoods home">
            <Logo />
          </Link>
          <nav aria-label="Sections" className="ml-auto hidden gap-6 text-sm text-white/85 md:flex">
            <a href="#services" className="hover:text-white">
              Services
            </a>
            <a href="#how" className="hover:text-white">
              How it works
            </a>
            <a href="#tracking" className="hover:text-white">
              Track your job
            </a>
            <a href="#materials" className="hover:text-white">
              Materials
            </a>
          </nav>
          <Link href={account.href} className={buttonVariants({ className: "ml-auto bg-brand-gold text-brand-charcoal hover:bg-brand-gold/90 md:ml-0" })}>
            {account.label}
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section aria-labelledby="hero-title" className="bg-brand-charcoal px-4 pt-12 pb-16 text-white sm:px-8 sm:pt-20 sm:pb-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-semibold tracking-[0.25em] text-brand-gold uppercase sm:text-sm">Industrial Wood Processing Centre</p>
              <h1 id="hero-title" className="mt-4 text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
                Precision processing.
                <br />
                <span className="text-brand-gold">Better production.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-white/90">
                Panel cutting, CNC machining and edge banding, with every job planned to save board and tracked from your cutlist to collection.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={account.href} className={buttonVariants({ size: "lg", className: "h-12 bg-brand-gold px-6 text-base text-brand-charcoal hover:bg-brand-gold/90" })}>
                  {user ? account.label : "Sign in to track your job"}
                </Link>
                <a href="#services" className={buttonVariants({ size: "lg", variant: "outline", className: "h-12 border-white/30 bg-transparent px-6 text-base text-white hover:bg-white/10 hover:text-white" })}>
                  Our services
                </a>
              </div>
              <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
                <li>Panel cutting</li>
                <li aria-hidden>·</li>
                <li>CNC machining</li>
                <li aria-hidden>·</li>
                <li>Edge-banding services</li>
              </ul>
            </div>

            {example.sheet && (
              <figure className="rounded-xl bg-white p-3 text-brand-charcoal shadow-2xl shadow-black/30 sm:p-4">
                <PlanDrawing
                  sheet={example.sheet}
                  parts={example.parts}
                  count={1}
                  stockLabel="MDF 18 mm"
                  portrait={false}
                  fontScale={1}
                  rulers
                  showCuts={false}
                  showLabels
                />
                <figcaption className="mt-2 flex flex-wrap justify-between gap-2 px-1 text-xs text-brand-slate">
                  <span>A cutting plan from our optimiser: six kitchen panels on one sheet, edged sides in gold.</span>
                  <span className="font-semibold text-brand-charcoal">{Math.round(example.utilisation * 100)}% of the sheet used</span>
                </figcaption>
              </figure>
            )}
          </div>
        </section>

        <Section id="services" eyebrow="What we do" title="Board processing for cabinet makers, carpenters and interior projects" tone="white">
          <ul className="grid gap-6 md:grid-cols-3">
            {SERVICES.map((s) => (
              <li key={s.title} className="rounded-xl bg-background p-6">
                <span className="flex size-12 items-center justify-center rounded-lg bg-brand-charcoal text-brand-gold">
                  <HugeiconsIcon icon={s.icon} className="size-6" />
                </span>
                <h3 className="mt-5 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-brand-slate">{s.text}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="how" eyebrow="How it works" title="From your sizes to finished panels">
          <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-xl bg-white p-6">
                <span className="text-4xl font-semibold text-brand-gold tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-brand-slate">{s.text}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="tracking" eyebrow="Track your job" title="See exactly where your job is, any time" tone="dark">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-5 text-white/90">
              <p className="text-lg">
                Every client gets their own account. Sign in with the phone number you registered with and follow each job from the counter to collection.
              </p>
              <Link href={account.href} className={buttonVariants({ size: "lg", className: "h-12 bg-brand-gold px-6 text-base text-brand-charcoal hover:bg-brand-gold/90" })}>
                {account.label}
              </Link>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {TRACKING.map((t) => (
                <li key={t.title} className="rounded-xl bg-white/5 p-5">
                  <HugeiconsIcon icon={t.icon} className="size-6 text-brand-gold" />
                  <h3 className="mt-3 font-semibold">{t.title}</h3>
                  <p className="mt-1 text-sm text-white/80">{t.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section id="materials" eyebrow="Materials" title="The sheet materials we cut and edge" tone="white">
          <ul className="flex flex-wrap gap-3">
            {materials.map((m) => (
              <li key={m} className="rounded-full bg-background px-5 py-2.5 font-medium">
                {m}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-brand-slate">Common thicknesses on standard 2440 × 1220 mm sheets. Ask at the counter about anything else.</p>
        </Section>

        <section aria-label="Our workshop" className="bg-background px-4 pb-16 sm:px-8 sm:pb-24">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-xl">
            <Image
              src="/workshop-sign.webp"
              alt="The Pacwoods workshop sign: Industrial Wood Processing Centre, panel cutting, CNC machining and edge-banding services."
              width={1080}
              height={360}
              sizes="(min-width: 1152px) 1088px, calc(100vw - 32px)"
              className="h-auto w-full"
            />
          </div>
        </section>
      </main>

      <footer className="bg-brand-charcoal px-4 py-10 text-white sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6">
          <LogoMark className="h-10 w-auto" />
          <div className="text-sm">
            <p className="font-semibold">Pacwoods · Industrial Wood Processing Centre</p>
            <p className="text-white/70">A joint venture of Ominya Interiors & PAN Gas</p>
          </div>
          <Link href={account.href} className="ml-auto text-sm text-white/85 underline-offset-4 hover:text-white hover:underline">
            {account.label}
          </Link>
        </div>
      </footer>
    </div>
  );
}
