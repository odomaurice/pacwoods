"use client";

import { useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Briefcase01Icon } from "@hugeicons/core-free-icons";
import { lookupClientAction } from "@/actions/accounts";
import ClientForm from "@/app/admin/clients/ClientForm";
import JobForm from "@/app/admin/jobs/JobForm";
import type { CatalogueOption } from "@/components/materials/MaterialRows";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Found = NonNullable<Awaited<ReturnType<typeof lookupClientAction>>>;
type Phase = "client" | "new-client" | "job";

const labelOf = (c: { name: string; businessName?: string; clientNumber: string }) => `${c.businessName ? `${c.businessName} — ` : ""}${c.name} (${c.clientNumber})`;

/**
 * Creating a job, one dialog at a time over a blurred page:
 * 1. the client's phone or client number: a known client is shown to confirm,
 *    an unknown one opens the new-client form with that number filled in;
 * 2. the job, with its materials (in the unit of choice) and wood photos;
 * then the job's cutlist opens. Closing a dialog keeps what was entered.
 */
export default function NewJobFlow({ catalogue }: { catalogue: CatalogueOption[] }) {
  const [phase, setPhase] = useState<Phase>("client");
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [client, setClient] = useState<{ id: string; label: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const go = (next: Phase) => {
    setPhase(next);
    setOpen(true);
  };

  function lookUp() {
    const q = query.trim();
    if (!q) return;
    setNotFound(false);
    setFound(null);
    startTransition(async () => {
      const result = await lookupClientAction(q);
      if (result) setFound(result);
      else {
        setNotFound(true);
        go("new-client");
      }
    });
  }

  const looksLikePhone = /^[+0-9 ()-]{7,}$/.test(query.trim());

  return (
    <>
      <section className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 rounded-2xl bg-card p-8 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-brand-charcoal text-brand-gold" aria-hidden>
          <HugeiconsIcon icon={Briefcase01Icon} className="size-8" />
        </span>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">{client ? `New job for ${client.label}` : "Start a new job"}</h2>
          <p className="text-sm text-muted-foreground">
            {client ? "Carry on with the job details, its materials and photos." : "Begin with the client's phone number or client number."}
          </p>
        </div>
        <Button variant="gold" className="h-12 rounded-full px-8 text-base" onClick={() => setOpen(true)}>
          {client ? "Continue the job" : "Enter the client's number"}
        </Button>
      </section>

      {/* 1. Who is it for? */}
      <Dialog open={open && phase === "client"} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Who is this job for?</DialogTitle>
            <DialogDescription>Enter the client&apos;s phone number or client number.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                lookUp();
              }}
            >
              <span className="flex-1 space-y-1">
                <Label htmlFor="client-number" className="sr-only">
                  Phone number or client number
                </Label>
                <Input
                  id="client-number"
                  autoFocus
                  inputMode="tel"
                  className="h-12 bg-card text-base"
                  placeholder="e.g. 0803 123 4567 or PCL-000012"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setFound(null);
                  }}
                />
              </span>
              <Button type="submit" className="h-12 px-5" disabled={pending || !query.trim()}>
                {pending ? "Finding…" : "Find"}
              </Button>
            </form>

            {found && (
              <div className="space-y-3 rounded-xl bg-accent p-4 duration-200 animate-in fade-in-0 slide-in-from-bottom-2">
                <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                  <Fact label="Name">{found.name}</Fact>
                  {found.businessName && <Fact label="Business">{found.businessName}</Fact>}
                  <Fact label="Client number">
                    <span className="font-mono">{found.clientNumber}</span>
                  </Fact>
                  {found.phone && <Fact label="Phone">{found.phone}</Fact>}
                  {found.email && <Fact label="Email">{found.email}</Fact>}
                </dl>
                {found.active ? (
                  <Button
                    variant="gold"
                    className="h-11 w-full"
                    onClick={() => {
                      setClient({ id: found.id, label: labelOf(found) });
                      go("job");
                    }}
                  >
                    Continue: the job →
                  </Button>
                ) : (
                  <p className="text-sm font-medium text-destructive">This client&apos;s account is not active, so a job cannot be created for them.</p>
                )}
              </div>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* 1b. Not known yet: register them, with the number already filled in. */}
      <Dialog open={open && phase === "new-client"} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New client</DialogTitle>
            <DialogDescription>
              {notFound ? `No client has “${query.trim()}”. Register them to carry on with the job.` : "Register the client to carry on with the job."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <ClientForm
              key={query}
              initialPhone={looksLikePhone ? query.trim() : undefined}
              onCreated={(c) => {
                setClient(c);
                go("job");
              }}
            />
            <button type="button" onClick={() => go("client")} className="mt-4 cursor-pointer text-sm font-medium underline-offset-4 hover:underline">
              ← Search for another number
            </button>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* 2. The job, its materials and photos. */}
      <Dialog open={open && phase === "job" && client !== null} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>The job</DialogTitle>
            <DialogDescription>What to do, the boards it uses and photos of the wood. Saving opens the cutlist.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {client && <JobForm defaultClientId={client.id} chosenClient={client.label} flow={{ catalogue, onBack: () => go("client") }} />}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
