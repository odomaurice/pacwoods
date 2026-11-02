"use client";

import { useState } from "react";
import { toast } from "sonner";
import ClientForm from "@/app/admin/clients/ClientForm";
import JobForm from "@/app/admin/jobs/JobForm";
import ClientPicker, { type PickerClient } from "@/components/jobs/ClientPicker";
import JobSteps from "@/components/jobs/JobSteps";
import MaterialRows, { readRows, toRow, type CatalogueOption, type MaterialRow } from "@/components/materials/MaterialRows";
import { Button } from "@/components/ui/button";
import type { JobMaterialInput } from "@/lib/job-materials";

/**
 * Creating a job, in three steps on one screen:
 * 1. the client (picked or registered on the spot) and the boards for the job,
 * 2. the job details, saved together with those boards,
 * 3. the cutlist, on the new job's own page.
 */
export default function NewJobFlow({ clients, catalogue, compactHeader = false }: { clients: PickerClient[]; catalogue: CatalogueOption[]; compactHeader?: boolean }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [client, setClient] = useState<{ id: string; label: string } | null>(null);
  const [rows, setRows] = useState<MaterialRow[]>(() => [toRow({})]);
  const [inWorkshop, setInWorkshop] = useState(false);
  const [materials, setMaterials] = useState<JobMaterialInput[]>([]);

  function toJobDetails() {
    const read = readRows(rows);
    if ("error" in read) {
      toast.error(read.error);
      return;
    }
    setMaterials(read.items);
    setStep(2);
  }

  return (
    <div>
      <JobSteps current={step} />

      {step === 2 && client ? (
        <JobForm defaultClientId={client.id} chosenClient={client.label} flow={{ materials, materialsAvailable: inWorkshop, onBack: () => setStep(1) }} />
      ) : !client ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="existing" className="space-y-3">
            <h2 id="existing" className={compactHeader ? "font-semibold" : "text-lg font-semibold"}>
              An existing client
            </h2>
            {clients.length === 0 ? (
              <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">No clients yet. Register the first one.</p>
            ) : (
              <ClientPicker clients={clients} onPick={(c) => setClient({ id: c.id, label: c.label })} />
            )}
          </section>
          <section aria-labelledby="new-client" className="space-y-3">
            <h2 id="new-client" className={compactHeader ? "font-semibold" : "text-lg font-semibold"}>
              Or a new client
            </h2>
            <div className="rounded-lg bg-card p-5">
              <ClientForm onCreated={setClient} />
            </div>
          </section>
        </div>
      ) : (
        <div className="max-w-4xl space-y-5">
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-accent p-3 text-sm">
            <span>
              <span className="block text-muted-foreground">Client</span>
              <span className="font-medium">{client.label}</span>
            </span>
            <button type="button" onClick={() => setClient(null)} className="ml-auto cursor-pointer text-sm font-medium underline-offset-4 hover:underline">
              Change
            </button>
          </div>

          <section aria-labelledby="boards" className="space-y-3">
            <div>
              <h2 id="boards" className="text-lg font-semibold">
                Materials for this job
              </h2>
              <p className="text-sm text-muted-foreground">The boards the client is bringing or that come from stock. Not sure yet? Leave it empty and add them on the job later.</p>
            </div>
            <MaterialRows rows={rows} onChange={setRows} catalogue={catalogue} />
            <label className="flex min-h-11 items-start gap-3 rounded-lg bg-card p-3 text-sm">
              <input type="checkbox" className="mt-0.5 size-5 accent-brand-charcoal" checked={inWorkshop} onChange={(e) => setInWorkshop(e.target.checked)} />
              <span>
                <span className="block font-medium">These boards are in the workshop now</span>
                <span className="block text-muted-foreground">Once the cutlist is approved, the job goes straight into the cutting queue.</span>
              </span>
            </label>
          </section>

          <Button variant="gold" className="h-11 px-6" onClick={toJobDetails}>
            Continue: job details →
          </Button>
        </div>
      )}
    </div>
  );
}
