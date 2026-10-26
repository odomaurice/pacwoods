import type { ReactNode } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** A plain GET search form: works without JavaScript and keeps the URL shareable. */
export function SearchForm({
  placeholder,
  q,
  children,
}: {
  placeholder: string;
  q?: string;
  children?: ReactNode;
}) {
  return (
    <form role="search" className="mb-4 flex flex-wrap gap-2">
      <Input
        name="q"
        type="search"
        defaultValue={q}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 max-w-sm flex-1 bg-card"
      />
      {children}
      <button type="submit" className={buttonVariants({ variant: "secondary", className: "h-10" })}>
        Search
      </button>
    </form>
  );
}

export function Pagination({
  page,
  pages,
  total,
  href,
}: {
  page: number;
  pages: number;
  total: number;
  href: (page: number) => string;
}) {
  if (pages <= 1) return <p className="mt-3 text-sm text-muted-foreground">{total} total</p>;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-2 text-sm">
      <p className="text-muted-foreground">
        Page {page} of {pages} · {total} total
      </p>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={href(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Previous
          </Link>
        )}
        {page < pages && (
          <Link href={href(page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Next
          </Link>
        )}
      </div>
    </nav>
  );
}

/** Reads ?q= and ?page= safely from searchParams. */
export function listParams(sp: Record<string, string | string[] | undefined>) {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const page = Math.max(1, Number.parseInt(one(sp.page), 10) || 1);
  return { q: one(sp.q).slice(0, 100), page, one };
}

export function withParams(base: string, params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "" && v !== 1) search.set(k, String(v));
  const s = search.toString();
  return s ? `${base}?${s}` : base;
}
