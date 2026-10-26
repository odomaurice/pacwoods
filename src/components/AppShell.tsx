import type { ReactNode } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { LockPasswordIcon, Logout01Icon } from "@hugeicons/core-free-icons";
import { signOutAction } from "@/actions/auth";
import { LogoMark } from "@/components/Logo";
import { ROLE_LABELS } from "@/lib/roles";
import type { SessionUser } from "@/server/auth/guards";

export type NavItem = { href: string; label: string };

/** The signed-in frame for every role: charcoal bar, role nav, account actions. */
export default function AppShell({
  user,
  nav,
  children,
}: {
  user: SessionUser;
  nav: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-brand-charcoal text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
            <LogoMark className="h-7 w-auto" />
            <span>
              Pa<span className="text-brand-gold">C</span> WOODS
            </span>
          </Link>

          <nav aria-label="Main" className="flex flex-wrap gap-1 text-sm">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-white/90 hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1 text-sm">
            <span className="mr-2 hidden text-right leading-tight sm:block">
              <span className="block font-medium">{user.name}</span>
              <span className="block text-xs text-brand-gold">{ROLE_LABELS[user.role]}</span>
            </span>
            <Link
              href="/change-password"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-white/90 hover:bg-white/10 hover:text-white"
            >
              <HugeiconsIcon icon={LockPasswordIcon} className="size-4" />
              <span className="sr-only sm:not-sr-only">Password</span>
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-white/90 hover:bg-white/10 hover:text-white"
              >
                <HugeiconsIcon icon={Logout01Icon} className="size-4" />
                <span className="sr-only sm:not-sr-only">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
