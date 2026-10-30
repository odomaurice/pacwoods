"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";

/** Step 1 of a new job: find an existing client by name, business, number or phone. */
export default function ClientPicker({ clients }: { clients: Array<{ id: string; label: string; search: string }> }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase().replace(/\s+/g, "");
    return term ? clients.filter((c) => c.search.includes(term)) : clients;
  }, [q, clients]);
  return (
    <div className="space-y-3">
      <Input className="h-11 bg-card" placeholder="Search by name, business, client number or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search clients" />
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No client matches. Register them on the right.</p>
      ) : (
        <ul className="max-h-96 divide-y divide-border overflow-y-auto rounded-lg bg-card [scrollbar-width:thin]">
          {shown.slice(0, 100).map((c) => (
            <li key={c.id}>
              <Link href={`/admin/jobs/new?client=${c.id}`} className="flex min-h-12 items-center justify-between gap-3 px-4 text-sm hover:bg-muted/60">
                <span>{c.label}</span>
                <span className="font-medium text-brand-gold-deep">Choose →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
