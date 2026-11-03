"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Cancel01Icon, Home01Icon, LockPasswordIcon, Logout01Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { signOutAction } from "@/actions/auth";
import InstallApp from "@/components/InstallApp";
import { LogoMark } from "@/components/Logo";
import type { NavItem, NavSection } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type Props = { sections: NavSection[]; tabs: NavItem[]; userName: string; roleLabel: string };

function isActive(pathname: string, href: string) {
  // Section roots ("/admin") match exactly; everything else by prefix.
  return href.split("/").length <= 2 ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

const linkClass =
  "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white";

function Wordmark() {
  return (
    <Link href="/" title="Pacwoods website" className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-white">
      <LogoMark className="h-8 w-auto" />
      <span>
        Pa<span className="text-brand-gold">C</span> WOODS
      </span>
    </Link>
  );
}

function SidebarBody({ sections, userName, roleLabel, onNavigate }: Props & { onNavigate?: () => void }) {
  const pathname = usePathname();
  // Only the closest match is lit (New job, not Jobs as well, on /admin/jobs/new).
  const lit = currentItem(pathname, sections.flatMap((s) => s.items));
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
              const active = lit === item && isActive(pathname, item.href);
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
                  {item.badge ? (
                    <span className="ml-auto rounded-full bg-brand-gold px-2 py-0.5 text-xs font-semibold text-brand-charcoal tabular-nums">
                      {item.badge}
                      <span className="sr-only"> open</span>
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-white/10 pt-4">
        <InstallApp />
        <div className="px-3 pb-2">
          <p className="truncate text-sm font-medium text-white">{userName}</p>
          <p className="text-xs text-brand-gold">{roleLabel}</p>
        </div>
        <Link href="/" onClick={onNavigate} className={linkClass}>
          <HugeiconsIcon icon={Home01Icon} className="size-5" />
          Pacwoods website
        </Link>
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

/** The nav item a path belongs to: the longest matching href. */
function currentItem(pathname: string, items: NavItem[]) {
  return items
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

/**
 * Large screens: a fixed sidebar. Phones and tablets: an app-style frame, with
 * a compact top bar (page title, and a back arrow on deeper pages) and a tab
 * bar at the bottom; "More" opens the full menu as a sheet.
 */
export default function Sidebar(props: Props) {
  const [more, setMore] = useState(false);
  const pathname = usePathname();
  const here = currentItem(pathname, [...props.tabs, ...props.sections.flatMap((s) => s.items)]);
  const back = here && pathname !== here.href ? here.href : undefined;
  const tab = currentItem(pathname, props.tabs);

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 bg-brand-charcoal lg:block print:hidden">
        <SidebarBody {...props} />
      </aside>

      <header className="sticky top-0 z-30 flex min-h-14 items-center gap-1 bg-brand-charcoal px-2 pt-[env(safe-area-inset-top)] text-white lg:hidden print:hidden">
        {back ? (
          <Link href={back} aria-label={`Back to ${here!.label}`} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-white/10 active:bg-white/15">
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-6" />
          </Link>
        ) : (
          <Link href="/" aria-label="Pacwoods website" className="inline-flex size-11 items-center justify-center">
            <LogoMark className="h-7 w-auto" />
          </Link>
        )}
        <p className="min-w-0 truncate text-base font-semibold">{here?.label ?? "Pacwoods"}</p>
      </header>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/10 bg-brand-charcoal pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
      >
        {props.tabs.map((t) => {
          // A tab stays lit on its deeper pages too (a job under Jobs).
          const active = tab === t;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium active:bg-white/10",
                active ? "text-brand-gold" : "text-white/70",
              )}
            >
              <HugeiconsIcon icon={t.icon} className="size-6" />
              {t.label}
              {t.badge ? (
                <span className="absolute top-2 left-1/2 ml-2 min-w-5 rounded-full bg-brand-gold px-1.5 text-center text-[11px] leading-5 font-semibold text-brand-charcoal tabular-nums">
                  {t.badge}
                  <span className="sr-only"> new</span>
                </span>
              ) : null}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMore(true)}
          aria-expanded={more}
          className={cn(
            "flex h-16 cursor-pointer flex-col items-center justify-center gap-1 text-[11px] font-medium active:bg-white/10",
            !tab && here ? "text-brand-gold" : "text-white/70",
          )}
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} className="size-6" />
          More
        </button>
      </nav>

      {more && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={() => setMore(false)} />
          <div className="no-scrollbar absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-brand-charcoal pb-[env(safe-area-inset-bottom)]">
            <div className="sticky top-0 z-10 flex justify-center bg-brand-charcoal pt-2">
              <span aria-hidden className="h-1.5 w-12 rounded-full bg-white/25" />
            </div>
            <button
              type="button"
              onClick={() => setMore(false)}
              aria-label="Close menu"
              className="absolute top-3 right-3 z-10 inline-flex size-11 items-center justify-center rounded-full text-white hover:bg-white/10"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-6" />
            </button>
            <SidebarBody {...props} onNavigate={() => setMore(false)} />
          </div>
        </div>
      )}
    </>
  );
}
