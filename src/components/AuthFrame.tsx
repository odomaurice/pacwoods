import type { ReactNode } from "react";
import Logo from "@/components/Logo";

/** Sign-in and password screens: the sign on the left, the form on the right. */
export default function AuthFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="grid flex-1 lg:grid-cols-2">
      <section className="flex flex-col justify-between gap-10 bg-brand-charcoal px-4 py-10 text-white sm:px-10 lg:py-14">
        <span className="text-2xl sm:text-3xl">
          <Logo />
        </span>
        <div className="space-y-5">
          <p className="text-sm font-semibold tracking-[0.25em] text-brand-gold uppercase">
            Industrial Wood Processing Centre
          </p>
          <div className="h-0.5 w-16 bg-brand-gold" />
          <p className="max-w-sm text-white/90">
            Panel cutting, CNC machining and edge-banding services.
          </p>
        </div>
        <p className="hidden text-sm text-white/70 lg:block">
          Precision Processing. Better Production.
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
