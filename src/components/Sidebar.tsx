"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, LockPasswordIcon, Logout01Icon, Menu01Icon } from "@hugeicons/core-free-icons";
import { signOutAction } from "@/actions/auth";
import { LogoMark } from "@/components/Logo";
import type { NavSection } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type Props = { sections: NavSection[]; userName: string; roleLabel: string };

function isActive(pathname: string, href: string) {
  // Section roots ("/admin") match exactly; everything else by prefix.
  return href.split("/").length <= 2 ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

const linkClass =
  "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white";

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-white">
      <LogoMark className="h-8 w-auto" />
      <span>
        Pa<span className="text-brand-gold">C</span> WOODS
      </span>
    </Link>
  );
}

function SidebarBody({ sections, userName, roleLabel, onNavigate }: Props & { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col gap-6 px-3 py-5">
      <div className="px-3">
        <Wordmark />
      </div>

      <nav aria-label="Main" className="no-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto">
        {sections.map((section, i) => (
          <div key={section.title ?? i} className="space-y-1">
            {section.title && (
              <p className="px-3 pb-1 text-xs font-semibold tracking-[0.15em] text-brand-gold uppercase">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(linkClass, active && "bg-white/10 text-white")}
                >
                  <HugeiconsIcon icon={item.icon} className={cn("size-5", active && "text-brand-gold")} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-white/10 pt-4">
        <div className="px-3 pb-2">
          <p className="truncate text-sm font-medium text-white">{userName}</p>
          <p className="text-xs text-brand-gold">{roleLabel}</p>
        </div>
        <Link href="/change-password" onClick={onNavigate} className={linkClass}>
          <HugeiconsIcon icon={LockPasswordIcon} className="size-5" />
          Change password
        </Link>
        <form action={signOutAction}>
          <button type="submit" className={cn(linkClass, "w-full")}>
            <HugeiconsIcon icon={Logout01Icon} className="size-5" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

/** Fixed sidebar on large screens; a top bar with a slide-in drawer below that. */
export default function Sidebar(props: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 bg-brand-charcoal lg:block print:hidden">
        <SidebarBody {...props} />
      </aside>

      <div className="sticky top-0 z-30 flex items-center justify-between bg-brand-charcoal px-4 py-3 lg:hidden print:hidden">
        <Wordmark />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="inline-flex size-11 items-center justify-center rounded-md text-white hover:bg-white/10"
        >
          <HugeiconsIcon icon={Menu01Icon} className="size-6" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-brand-charcoal">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute top-4 right-3 inline-flex size-11 items-center justify-center rounded-md text-white hover:bg-white/10"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-6" />
            </button>
            <SidebarBody {...props} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
