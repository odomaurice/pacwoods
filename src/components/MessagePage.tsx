import type { ReactNode } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { buttonVariants } from "@/components/ui/button";

/** Full-page notice for access-denied and not-found. */
export default function MessagePage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-brand-charcoal px-4 py-16 text-center text-white">
      <LogoMark className="h-14 w-auto" />
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="max-w-md text-white/90">{children}</p>
      <Link href="/dashboard" className={buttonVariants({ variant: "secondary", className: "h-11 px-5" })}>
        Go to my home page
      </Link>
    </main>
  );
}
