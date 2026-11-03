"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { uploadPhoto } from "@/lib/image-resize";
import UploadPreviews, { type UploadState } from "@/components/photos/UploadPreviews";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createJobAction, updateJobAction } from "@/actions/jobs";
import FormField from "@/components/FormField";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/payments";
import MaterialRows, { readRows, toRow, type CatalogueOption, type MaterialRow } from "@/components/materials/MaterialRows";
import { LENGTH_UNITS, UNIT_LABELS, type LengthUnit } from "@/lib/units";
import { jobSchema, type JobInput } from "@/lib/schemas";

type ClientOption = { id: string; label: string };

/**
 * Creates a job (with a client picker) or edits a draft's details. The work
 * number and status are assigned by the server, never entered here.
 */
export default function JobForm({
  clients,
  defaultClientId,
  chosenClient,
  flow,
  existing,
}: {
  clients?: ClientOption[];
  defaultClientId?: string;
  /** Picked in the client step: shown, with a link back to change it. */
  chosenClient?: string;
  /**
   * The new-job dialog: the job's boards (in a chosen unit, with photos of the
   * wood) are entered here too, and saving goes straight on to the cutlist.
   */
  flow?: { catalogue: CatalogueOption[]; onBack: () => void };
  /** Editing a draft: the client cannot change, so it rides along unseen. */
  existing?: { workNumber: string; values: JobInput };
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [progress, setProgress] = useState<string>();
  const [unit, setUnit] = useState<LengthUnit>("mm");
  const [rows, setRows] = useState<MaterialRow[]>(() => [toRow({})]);
  const [pending, startTransition] = useTransition();
  const editing = Boolean(existing);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<JobInput>({
    resolver: zodResolver(jobSchema),
    defaultValues: existing
      ? existing.values
      : { clientId: defaultClientId ?? "", cutting: true, edging: false, cnc: false, materialsAvailable: false, title: "", clientNotes: "", internalNotes: "", payment: { status: "UNPAID", amount: "", method: "", paidOn: new Date().toISOString().slice(0, 10), note: "" } },
  });
  const paymentStatus = useWatch({ control, name: "payment.status" });

  const woodPhotos = (
    <div className="space-y-2">
      <Label htmlFor="wood-photos">Photos of the wood (optional)</Label>
      <input
        id="wood-photos"
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-secondary file:px-5 file:py-2.5 file:font-semibold"
        onChange={(e) => {
          setPhotos((prev) => [...prev, ...(e.target.files ?? [])].slice(0, 12));
          e.target.value = "";
        }}
      />
      {photos.length > 0 && (
        <>
          <UploadPreviews
            files={photos}
            states={uploads}
            onRemove={pending ? undefined : (i) => setPhotos((prev) => prev.filter((_, j) => j !== i))}
          />
          <p className="text-sm text-muted-foreground">
            {photos.length} photo{photos.length === 1 ? "" : "s"} will be added to the job{photos.length === 12 ? " (12 at most)" : ""}.
          </p>
        </>
      )}
    </div>
  );
  const payErrors = errors.payment;

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const { clientId, ...details } = values;
      if (existing) {
        const result = await updateJobAction(existing.workNumber, details);
        if (result && !result.ok) setServerError(result.error);
        return;
      }
      let materials;
      if (flow) {
        const read = readRows(rows, unit);
        if ("error" in read) {
          setServerError(read.error);
          return;
        }
        materials = read.items;
      }
      const result = await createJobAction(flow ? { ...details, clientId, materials } : { ...details, clientId });
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      const mark = (i: number, s: UploadState) => setUploads((prev) => prev.map((p, j) => (j === i ? s : p)));
      setUploads(photos.map(() => ({})));
      for (const [i, file] of photos.entries()) {
        const error = await uploadPhoto(file, { workNumber: result.workNumber, kind: "MATERIAL" }, (percent) => {
          mark(i, { percent });
          setProgress(`Uploading photo ${i + 1} of ${photos.length} · ${percent}%`);
        });
        if (error) toast.error(error);
        mark(i, error ? { error: true } : { done: true });
      }
      setProgress(undefined);
      // The cutlist opens in the unit chosen for the materials.
      router.push(flow ? `/admin/jobs/${result.workNumber}/cutlist?unit=${unit}` : `/admin/jobs/${result.workNumber}`);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className={flow ? "space-y-6" : "max-w-xl space-y-6"}>
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      {chosenClient && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-accent p-3 text-sm">
          <span>
            <span className="block text-muted-foreground">Client</span>
            <span className="font-medium">{chosenClient}</span>
          </span>
          {flow ? (
            <button type="button" onClick={flow.onBack} className="ml-auto cursor-pointer text-sm font-medium underline-offset-4 hover:underline">
              Change
            </button>
          ) : (
            <Link href="/admin/jobs/new" className="ml-auto text-sm font-medium underline-offset-4 hover:underline">
              Change
            </Link>
          )}
        </div>
      )}
      {clients && !chosenClient && (
        <div className="space-y-2">
          <Label htmlFor="clientId">Client</Label>
          <select
            id="clientId"
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
            aria-invalid={errors.clientId ? true : undefined}
            {...register("clientId")}
          >
            <option value="">Choose a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {errors.clientId && <p className="text-sm text-destructive">{errors.clientId.message}</p>}
        </div>
      )}

      <FormField id="title" label="Title (optional)" placeholder="e.g. Kitchen cabinets" error={errors.title?.message} {...register("title")} />

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Work requested</legend>
        {/* In work order: cutting, then CNC machining, then edging. */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["cutting", "Cutting"],
              ["cnc", "CNC machining"],
              ["edging", "Edging"],
            ] as const
          ).map(([name, label]) => (
            <label
              key={name}
              className="flex h-11 cursor-pointer items-center gap-2.5 rounded-full border border-border bg-card px-5 text-sm font-medium transition-colors select-none hover:bg-muted has-checked:border-brand-charcoal has-checked:bg-brand-charcoal has-checked:text-white"
            >
              <input type="checkbox" className="size-4 accent-brand-gold" {...register(name)} />
              {label}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">CNC machining is drilling, routing or grooves, done after cutting and before edging; add the details per panel in the cutlist.</p>
        {errors.cutting && <p className="text-sm text-destructive">{errors.cutting.message}</p>}
      </fieldset>

      {flow && (
        <section aria-labelledby="job-materials" className="space-y-3 rounded-xl bg-muted/50 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 id="job-materials" className="font-semibold">
                Materials
              </h3>
              <p className="text-sm text-muted-foreground">The boards for this job. Not sure yet? Leave them empty and add them on the job later.</p>
            </div>
            <label className="space-y-1 text-sm">
              <span className="block font-medium">Measure in</span>
              <select className="h-10 rounded-md border border-input bg-card px-3 text-sm" value={unit} onChange={(e) => setUnit(e.target.value as LengthUnit)}>
                {LENGTH_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <MaterialRows rows={rows} onChange={setRows} catalogue={flow.catalogue} unit={unit} />
          <label className="flex min-h-11 items-start gap-3 rounded-lg bg-card p-3 text-sm">
            <input type="checkbox" className="mt-0.5 size-5 accent-brand-charcoal" {...register("materialsAvailable")} />
            <span>
              <span className="block font-medium">These boards are in the workshop now</span>
              <span className="block text-muted-foreground">Once the cutlist is approved, the job goes straight into the cutting queue.</span>
            </span>
          </label>
          {woodPhotos}
          <p className="text-xs text-muted-foreground">The cutlist opens in the same unit.</p>
        </section>
      )}

      {!editing && !flow && woodPhotos}

      {!editing && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Has the client paid for this job?</legend>
          <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ["UNPAID", "Not yet"],
                ["PART", "Part payment"],
                ["FULL", "Paid in full"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-muted px-3 text-sm has-checked:bg-accent has-checked:font-medium">
                <input type="radio" value={value} className="size-4 accent-brand-charcoal" {...register("payment.status")} />
                {label}
              </label>
            ))}
          </div>
          {paymentStatus && paymentStatus !== "UNPAID" && (
            <div className="grid gap-3 rounded-lg bg-muted/60 p-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="pay-amount">Amount (optional)</Label>
                <input id="pay-amount" inputMode="decimal" placeholder="e.g. 150000" className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm" {...register("payment.amount")} />
                {payErrors?.amount && <p className="text-sm text-destructive">{payErrors.amount.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="pay-method">How it was paid</Label>
                <select id="pay-method" className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm" {...register("payment.method")}>
                  <option value="">Not recorded</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pay-date">Date paid</Label>
                <input id="pay-date" type="date" max={new Date().toISOString().slice(0, 10)} className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm" {...register("payment.paidOn")} />
                {payErrors?.paidOn && <p className="text-sm text-destructive">{payErrors.paidOn.message}</p>}
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="pay-note">Note (optional)</Label>
                <input id="pay-note" placeholder="e.g. receipt number" className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm" {...register("payment.note")} />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">More payments can be recorded later on the job page, for example when a part payment is completed.</p>
            </div>
          )}
        </fieldset>
      )}

      {!editing && !flow && (
        <label className="flex min-h-11 items-start gap-3 rounded-lg bg-accent p-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-5 accent-brand-charcoal" {...register("materialsAvailable")} />
          <span>
            <span className="block font-medium">Materials available</span>
            <span className="block text-muted-foreground">
              The boards for this job are already in the workshop. Once the cutlist is approved, the job goes straight into the cutting queue.
            </span>
          </span>
        </label>
      )}

      <div className="space-y-2">
        <Label htmlFor="clientNotes">Notes for the client (they can see these)</Label>
        <Textarea id="clientNotes" rows={3} {...register("clientNotes")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="internalNotes">Internal notes (staff only)</Label>
        <Textarea id="internalNotes" rows={3} {...register("internalNotes")} />
      </div>

      <p className="text-sm text-muted-foreground">
        {flow ? "Next: the cutlist (panels, stock sheets and the cutting plan)." : "Parts, stock sheets and the cutting plan are added on the job after it is created."}
      </p>

      <div className="flex gap-2">
        {flow && (
          <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={flow.onBack}>
            ← Client
          </Button>
        )}
        <Button type="submit" disabled={pending} className="h-11">
          {progress ?? (pending ? "Saving…" : editing ? "Save changes" : flow ? "Create job, then cutlist →" : "Create job")}
        </Button>
        {!flow && (
          <Link href={existing ? `/admin/jobs/${existing.workNumber}` : "/admin/jobs"} className={buttonVariants({ variant: "outline", className: "h-11" })}>
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
