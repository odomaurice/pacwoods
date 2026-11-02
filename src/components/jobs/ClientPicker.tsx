"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

export type PickerClient = { id: string; label: string; search: string };

/** Find an existing client by name, business, client number or phone. */
export default function ClientPicker({ clients, onPick }: { clients: PickerClient[]; onPick: (client: PickerClient) => void }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase().replace(/\s+/g, "");
    return term ? clients.filter((c) => c.search.includes(term)) : clients;
  }, [q, clients]);
  return (
    <div className="space-y-3">
      <Input className="h-11 bg-card" placeholder="Search by name, business, client number or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search clients" />
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No client matches. Register them alongside.</p>
      ) : (
        <ul className="max-h-96 divide-y divide-border overflow-y-auto rounded-lg bg-card [scrollbar-width:thin]">
          {shown.slice(0, 100).map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onPick(c)} className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 px-4 text-left text-sm hover:bg-muted/60">
                <span>{c.label}</span>
                <span className="shrink-0 font-medium text-brand-gold-deep">Choose →</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
