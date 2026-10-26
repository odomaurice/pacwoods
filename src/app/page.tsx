import Logo from "@/components/Logo";

// Holding page until the operations platform's sign-in exists (Phase 1).
// The wording is the workshop sign's own; add nothing it does not say.
const SERVICES = ["Panel cutting", "CNC machining", "Edge-banding services"];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col bg-brand-charcoal text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-8 px-4 py-16 sm:px-8">
        <h1 className="text-4xl sm:text-6xl">
          <Logo />
        </h1>
        <p className="text-sm font-semibold tracking-[0.25em] text-brand-gold uppercase sm:text-base">
          Industrial Wood Processing Centre
        </p>
        <div className="h-0.5 w-full bg-brand-gold" />
        <ul className="flex flex-col gap-2 text-lg font-medium text-brand-steel sm:flex-row sm:gap-6">
          {SERVICES.map((service) => (
            <li key={service}>{service}</li>
          ))}
        </ul>
        <p className="text-white/90">Precision Processing. Better Production.</p>
      </div>
    </main>
  );
}
