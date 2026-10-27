import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, Camera01Icon, Menu01Icon, Notification01Icon, QrCodeIcon, Task01Icon } from "@hugeicons/core-free-icons";
import HeroPlan from "@/components/home/HeroPlan";
import Planner from "@/components/home/Planner";
import Reveal from "@/components/home/Reveal";
import WoodGrain from "@/components/home/WoodGrain";
import Logo, { LogoMark } from "@/components/Logo";
import { buttonVariants } from "@/components/ui/button";
import { roleHome } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { getSessionUser } from "@/server/auth/guards";
import { publicStats } from "@/server/services/publicStats";

export const metadata: Metadata = {
  title: "Pacwoods | Industrial Wood Processing Centre",
  description: "Panel cutting, CNC machining and edge-banding services. Every job planned to save board and tracked online from cutlist to collection.",
};

/* Small line drawings for each service, in the brand colours. */
function SawArt() {
  return (
    <svg viewBox="0 0 160 100" className="h-24 w-auto" aria-hidden>
      <rect x="6" y="58" width="148" height="20" rx="2" fill="#D99E56" />
      <path d="M6 64h148M6 71h148" stroke="#B57F3E" strokeWidth="1" />
      <g className="origin-[80px_44px] transition-transform duration-700 group-hover:rotate-180">
        <circle cx="80" cy="44" r="26" fill="#E7E8EA" />
        {Array.from({ length: 16 }, (_, i) => (
          <path key={i} d="M80 15 l4 6 h-8z" fill="#E7E8EA" transform={`rotate(${i * 22.5} 80 44)`} />
        ))}
        <circle cx="80" cy="44" r="6" fill="#1B2328" />
      </g>
      <path d="M80 58v20" stroke="#C0392B" strokeWidth="2" strokeDasharray="3 3" />
    </svg>
  );
}
function CncArt() {
  return (
    <svg viewBox="0 0 160 100" className="h-24 w-auto" aria-hidden>
      <rect x="10" y="20" width="140" height="70" rx="4" fill="#D99E56" />
      <path d="M30 40 h40 a12 12 0 0 1 12 12 v10 a12 12 0 0 0 12 12 h36" fill="none" stroke="#1B2328" strokeWidth="5" strokeLinecap="round" className="[stroke-dasharray:180] [stroke-dashoffset:180] transition-[stroke-dashoffset] duration-1000 group-hover:[stroke-dashoffset:0]" />
      <path d="M30 40 h40 a12 12 0 0 1 12 12 v10 a12 12 0 0 0 12 12 h36" fill="none" stroke="#B57F3E" strokeWidth="5" strokeLinecap="round" opacity="0.35" />
      <rect x="124" y="4" width="12" height="30" rx="2" fill="#E7E8EA" />
      <path d="M130 34 v6" stroke="#E7E8EA" strokeWidth="3" />
    </svg>
  );
}
function EdgeArt() {
  return (
    <svg viewBox="0 0 160 100" className="h-24 w-auto" aria-hidden>
      <rect x="10" y="40" width="110" height="44" rx="2" fill="#F2EDE4" />
      <rect x="10" y="40" width="110" height="8" fill="#D99E56" className="origin-left scale-x-[0.35] transition-transform duration-700 group-hover:scale-x-100" />
      <circle cx="138" cy="34" r="18" fill="#D99E56" />
      <circle cx="138" cy="34" r="7" fill="#1B2328" />
      <path d="M120 44 L138 52" stroke="#D99E56" strokeWidth="6" />
    </svg>
  );
}

const SERVICES = [
  { art: <SawArt />, title: "Panel cutting", text: "Your boards cut to size on the panel saw, from a cutting plan that fits your panels onto as few sheets as possible." },
  { art: <CncArt />, title: "CNC machining", text: "Machined shapes, grooves and details for cabinet and furniture parts." },
  { art: <EdgeArt />, title: "Edge banding", text: "Clean edges on exactly the sides you choose, panel by panel, after cutting." },
];

const STEPS = [
  { title: "Register your order", text: "Bring your sizes to the counter. You get a client number and a work number for every job." },
  { title: "We plan the cutting", text: "Your panels are laid out to waste as little board as possible, and the plan is checked before anything is cut." },
  { title: "Cut, then edged, in order", text: "First come, first served. Edging starts only when cutting is finished." },
  { title: "Collect your work", text: "You are told when it is ready, with photos of the finished panels." },
];

const TRACKING = [
  { icon: Task01Icon, title: "Live progress", text: "Each step of your job with its date and time, and who is cutting it." },
  { icon: QrCodeIcon, title: "Job card with QR code", text: "Your panels, sizes, materials and edged sides on one printable card." },
  { icon: Camera01Icon, title: "Photos", text: "Your wood when it arrives, and the finished work before it leaves the machine." },
  { icon: Notification01Icon, title: "Notifications", text: "A message when cutting starts, when it finishes, and when your job is ready." },
];

const MATERIALS = [
  { name: "MDF", tone: "#C9A77C" },
  { name: "Melamine-faced board", tone: "#F4F1EA" },
  { name: "Plywood", tone: "#D9B887" },
  { name: "Chipboard", tone: "#C2A27A" },
  { name: "Blockboard", tone: "#B88E5A" },
  { name: "OSB", tone: "#C79A57" },
  { name: "Hardboard", tone: "#7E5E40" },
];

/** Large pill-shaped calls to action. */
const pill = "h-16 rounded-full px-9 text-lg font-semibold";

function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <p className={cn("text-xs font-semibold tracking-[0.3em] uppercase", dark ? "text-brand-gold" : "text-brand-gold-deep")}>{children}</p>;
}

/** A phone showing the client's progress view; clearly an example. */
function PhoneExample() {
  const steps: Array<[string, string, "done" | "now" | "next" | "na"]> = [
    ["Order registered", "Mon 09:14", "done"],
    ["Cutlist approved", "Mon 11:02", "done"],
    ["Materials ready", "Mon 11:30", "done"],
    ["Cutting started", "Tue 08:05 · Cutting operator: Olu", "done"],
    ["Cutting completed", "Next", "now"],
    ["Edging", "", "next"],
    ["Ready for collection", "", "next"],
  ];
  return (
    <div className="pw-float mx-auto w-[280px] rounded-[2.5rem] bg-brand-charcoal p-3 shadow-2xl shadow-black/40 ring-1 ring-white/10">
      <div className="overflow-hidden rounded-[2rem] bg-[#F6F6F4] text-brand-charcoal">
        <div className="flex items-center justify-between bg-brand-charcoal px-4 py-3 text-white">
          <span className="text-sm font-extrabold">
            Pa<span className="text-brand-gold">C</span> WOODS
          </span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">Example</span>
        </div>
        <div className="space-y-3 p-4">
          <div>
            <p className="font-mono text-sm font-semibold">PAC-2026-000128</p>
            <p className="text-xs text-brand-slate">Kitchen cabinets · Cutting and edging</p>
          </div>
          <ol className="space-y-2.5">
            {steps.map(([label, sub, state]) => (
              <li key={label} className="flex gap-2.5">
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    state === "done" && "bg-brand-gold text-brand-charcoal",
                    state === "now" && "bg-brand-charcoal text-white ring-4 ring-brand-gold/30",
                    state === "next" && "bg-black/10",
                  )}
                >
                  {state === "done" ? "✓" : ""}
                </span>
                <span className="text-xs leading-tight">
                  <span className={cn("block font-medium", state === "next" && "text-brand-slate")}>{label}</span>
                  {sub && <span className="block text-brand-slate">{sub}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  const [user, stats] = await Promise.all([getSessionUser(), publicStats()]);
  const account = user && !user.mustChangePassword ? { href: roleHome(user.role), label: "Go to my dashboard" } : { href: "/login", label: "Sign in" };
  const nav = [
    { href: "#services", label: "Services" },
    { href: "#planner", label: "Try the planner" },
    { href: "#how", label: "How it works" },
    { href: "#tracking", label: "Track your job" },
  ];

  return (
    <div className="flex flex-1 flex-col bg-brand-charcoal">
      <header className="fixed inset-x-0 top-0 z-40 bg-brand-charcoal/80 text-white backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-8">
          <Link href="/" className="text-lg" aria-label="Pacwoods home">
            <Logo />
          </Link>
          <nav aria-label="Sections" className="ml-auto hidden gap-7 text-sm text-white/80 lg:flex">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className="transition-colors hover:text-brand-gold">
                {n.label}
              </a>
            ))}
          </nav>
          <Link href={account.href} className={buttonVariants({ variant: "gold", className: "ml-auto h-11 rounded-full px-6 text-sm font-semibold lg:ml-0" })}>
            {account.label}
          </Link>
          <details className="relative lg:hidden">
            <summary className="flex size-10 items-center justify-center rounded-md hover:bg-white/10 [&::-webkit-details-marker]:hidden" aria-label="Menu">
              <HugeiconsIcon icon={Menu01Icon} className="size-6" />
            </summary>
            <nav aria-label="Sections" className="absolute right-0 mt-2 w-56 rounded-lg bg-brand-charcoal p-2 shadow-2xl ring-1 ring-white/10">
              {nav.map((n) => (
                <a key={n.href} href={n.href} className="block rounded-md px-3 py-2.5 text-white/90 hover:bg-white/10">
                  {n.label}
                </a>
              ))}
            </nav>
          </details>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section aria-labelledby="hero-title" className="relative isolate flex min-h-[min(100svh,980px)] items-center overflow-hidden px-4 pt-28 pb-16 text-white sm:px-8">
          <WoodGrain className="-z-10 text-white/[0.06]" />
          <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[1fr_1.05fr]">
            <div>
              <div className="mb-6 flex items-center gap-3">
                <LogoMark className="h-12 w-auto" />
                <Eyebrow dark>Industrial Wood Processing Centre</Eyebrow>
              </div>
              <h1 id="hero-title" className="text-5xl leading-[1.02] font-semibold tracking-tight sm:text-7xl xl:text-8xl">
                Precision
                <br />
                processing.
                <br />
                <span className="text-brand-gold">Better production.</span>
              </h1>
              <p className="mt-7 max-w-xl text-lg text-white/85 sm:text-xl">
                Panel cutting, CNC machining and edge banding. Every job planned to save board, worked in order, and tracked online from your cutlist to collection.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link href={account.href} className={buttonVariants({ variant: "gold", size: "lg", className: `${pill} w-full sm:w-auto` })}>
                  {user ? account.label : "Track my job"}
                </Link>
                <a href="#planner" className={buttonVariants({ variant: "onDark", size: "lg", className: `${pill} w-full sm:w-auto` })}>
                  Try the cutting planner
                </a>
              </div>
            </div>
            <HeroPlan />
          </div>
          <a href="#services" aria-label="Scroll to services" className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 text-white/50 hover:text-white sm:block">
            <HugeiconsIcon icon={ArrowDown01Icon} className="size-7 animate-bounce" />
          </a>
        </section>

        {stats && (
          <section aria-label="Pacwoods in numbers" className="border-y border-white/10 px-4 py-10 text-white sm:px-8">
            <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-8 md:grid-cols-4">
              {[
                ["Jobs completed", stats.completed.toLocaleString("en-GB")],
                ["Sheets planned", stats.sheets.toLocaleString("en-GB")],
                ["Average board used", `${Math.round(stats.utilisation * 100)}%`],
                ["Clients", stats.clients.toLocaleString("en-GB")],
              ].map(([k, v]) => (
                <div key={k}>
                  <dd className="text-4xl font-semibold text-brand-gold tabular-nums sm:text-5xl">{v}</dd>
                  <dt className="mt-1 text-sm text-white/70">{k}</dt>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Ticker */}
        <div aria-hidden className="overflow-hidden bg-brand-gold py-4 text-brand-charcoal">
          <div className="pw-marquee flex w-max gap-10 text-xl font-semibold tracking-[0.2em] whitespace-nowrap uppercase sm:text-2xl">
            {Array.from({ length: 2 }, (_, k) => (
              <span key={k} className="flex gap-10">
                {["Panel cutting", "CNC machining", "Edge banding", "Optimised cutting plans", "Job tracking", "Precision processing"].map((t) => (
                  <span key={t} className="flex items-center gap-10">
                    {t} <span className="text-brand-charcoal/40">✦</span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>

        {/* Services */}
        <section id="services" aria-labelledby="services-title" className="scroll-mt-20 bg-[#F6F6F4] px-4 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto max-w-7xl">
            <Reveal>
              <Eyebrow>What we do</Eyebrow>
              <h2 id="services-title" className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-brand-charcoal sm:text-5xl">
                Board processing for cabinet makers, carpenters and interiors.
              </h2>
            </Reveal>
            <ul className="mt-14 grid gap-6 md:grid-cols-3">
              {SERVICES.map((s, i) => (
                <li key={s.title}>
                  <Reveal delay={i * 120} className="h-full">
                    <article className="group flex h-full flex-col rounded-2xl bg-white p-7 shadow-sm ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                      <div className="flex h-32 items-center justify-center rounded-xl bg-brand-charcoal">{s.art}</div>
                      <p className="mt-6 text-sm font-semibold text-brand-gold-deep tabular-nums">0{i + 1}</p>
                      <h3 className="mt-1 text-2xl font-semibold text-brand-charcoal">{s.title}</h3>
                      <p className="mt-3 text-brand-slate">{s.text}</p>
                    </article>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Planner */}
        <section id="planner" aria-labelledby="planner-title" className="relative isolate scroll-mt-20 overflow-hidden px-4 py-20 text-white sm:px-8 sm:py-28">
          <WoodGrain className="-z-10 text-white/[0.05]" />
          <div className="mx-auto max-w-7xl">
            <Reveal>
              <Eyebrow dark>Try the planner</Eyebrow>
              <h2 id="planner-title" className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
                See how your panels fit, before you come in.
              </h2>
              <p className="mt-4 max-w-2xl text-lg text-white/80">The same optimiser we use in the workshop. Type your sizes and watch the layout change.</p>
            </Reveal>
            <div className="mt-12">
              <Planner />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" aria-labelledby="how-title" className="scroll-mt-20 bg-white px-4 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto max-w-7xl">
            <Reveal>
              <Eyebrow>How it works</Eyebrow>
              <h2 id="how-title" className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-brand-charcoal sm:text-5xl">
                From your sizes to finished panels.
              </h2>
            </Reveal>
            <ol className="relative mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
              <span aria-hidden className="absolute top-7 right-8 left-8 hidden h-0.5 bg-brand-gold/40 md:block" />
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative">
                  <Reveal delay={i * 150}>
                    <span className="relative z-10 flex size-14 items-center justify-center rounded-full bg-brand-charcoal text-xl font-semibold text-brand-gold ring-8 ring-white">
                      {i + 1}
                    </span>
                    <h3 className="mt-5 text-xl font-semibold text-brand-charcoal">{s.title}</h3>
                    <p className="mt-2 text-brand-slate">{s.text}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Tracking */}
        <section id="tracking" aria-labelledby="tracking-title" className="relative isolate scroll-mt-20 overflow-hidden px-4 py-20 text-white sm:px-8 sm:py-28">
          <WoodGrain className="-z-10 text-white/[0.05]" />
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <Reveal>
                <Eyebrow dark>Track your job</Eyebrow>
                <h2 id="tracking-title" className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                  Know exactly where your job is. Any time.
                </h2>
                <p className="mt-4 max-w-xl text-lg text-white/80">Sign in with the phone number you registered with and follow every job from the counter to collection.</p>
              </Reveal>
              <ul className="mt-10 grid gap-5 sm:grid-cols-2">
                {TRACKING.map((t, i) => (
                  <li key={t.title}>
                    <Reveal delay={i * 100}>
                      <span className="flex size-11 items-center justify-center rounded-lg bg-brand-gold/15 text-brand-gold">
                        <HugeiconsIcon icon={t.icon} className="size-6" />
                      </span>
                      <h3 className="mt-3 font-semibold">{t.title}</h3>
                      <p className="mt-1 text-sm text-white/75">{t.text}</p>
                    </Reveal>
                  </li>
                ))}
              </ul>
              <Link href={account.href} className={buttonVariants({ variant: "gold", size: "lg", className: `${pill} mt-10` })}>
                {account.label}
              </Link>
            </div>
            <Reveal delay={150}>
              <PhoneExample />
            </Reveal>
          </div>
        </section>

        {/* Materials */}
        <section id="materials" aria-labelledby="materials-title" className="scroll-mt-20 bg-[#F6F6F4] px-4 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto max-w-7xl">
            <Reveal>
              <Eyebrow>Materials</Eyebrow>
              <h2 id="materials-title" className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-brand-charcoal sm:text-5xl">
                The sheet materials we cut and edge.
              </h2>
            </Reveal>
            <ul className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
              {MATERIALS.map((m, i) => (
                <li key={m.name}>
                  <Reveal delay={i * 70}>
                    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-lg">
                      <div className="relative h-24" style={{ background: m.tone }}>
                        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 h-full w-full text-black/10" aria-hidden>
                          <path d="M0 10 C 30 6, 60 14, 100 9 M0 22 C 25 18, 70 27, 100 21 M0 33 C 40 30, 60 37, 100 32" fill="none" stroke="currentColor" strokeWidth="0.8" />
                        </svg>
                      </div>
                      <p className="p-3 text-sm font-medium text-brand-charcoal">{m.name}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-brand-slate">Common thicknesses on standard 2440 × 1220 mm sheets. Ask at the counter about anything else.</p>
          </div>
        </section>

        {/* Workshop */}
        <section aria-label="The workshop" className="bg-[#F6F6F4] px-4 pb-20 sm:px-8 sm:pb-28">
          <Reveal className="mx-auto max-w-7xl">
            <figure className="overflow-hidden rounded-2xl shadow-xl">
              <Image
                src="/workshop-sign.webp"
                alt="The Pacwoods workshop sign: Industrial Wood Processing Centre, panel cutting, CNC machining and edge-banding services."
                width={1080}
                height={360}
                sizes="(min-width: 1280px) 1216px, calc(100vw - 32px)"
                className="h-auto w-full"
              />
            </figure>
          </Reveal>
        </section>

        {/* Call to action */}
        <section aria-labelledby="cta-title" className="bg-brand-gold px-4 py-16 text-brand-charcoal sm:px-8 sm:py-20">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-8">
            <h2 id="cta-title" className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
              Already a Pacwoods client? Your jobs are waiting.
            </h2>
            <Link href={account.href} className={buttonVariants({ variant: "dark", size: "lg", className: `${pill} px-10` })}>
              {account.label}
            </Link>
          </div>
        </section>
      </main>

      <footer className="px-4 py-12 text-white sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 sm:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <span className="text-xl">
              <Logo />
            </span>
            <p className="text-sm text-white/70">Industrial Wood Processing Centre · Panel cutting · CNC machining · Edge-banding services</p>
            <p className="text-sm text-white/50">A joint venture of Ominya Interiors & PAN Gas</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80 sm:flex-col">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className="hover:text-brand-gold">
                {n.label}
              </a>
            ))}
            <Link href={account.href} className="hover:text-brand-gold">
              {account.label}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
