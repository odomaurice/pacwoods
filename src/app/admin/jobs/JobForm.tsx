"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { uploadPhoto } from "@/lib/image-resize";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createJobAction, updateJobAction } from "@/actions/jobs";
import FormField from "@/components/FormField";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { jobSchema, type JobInput } from "@/lib/schemas";

type ClientOption = { id: string; label: string };
type OperatorOption = { id: string; name: string };

/**
 * Creates a job (with a client picker) or edits a draft's details. The work
 * number and status are assigned by the server, never entered here.
 */
export default function JobForm({
  clients,
  defaultClientId,
  existing,
  cuttingOperators = [],
  edgingOperators = [],
}: {
  clients?: ClientOption[];
  cuttingOperators?: OperatorOption[];
  edgingOperators?: OperatorOption[];
  defaultClientId?: string;
  /** Editing a draft: the client cannot change, so it rides along unseen. */
  existing?: { workNumber: string; values: JobInput };
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const [photos, setPhotos] = useState<File[]>([]);
  const [progress, setProgress] = useState<string>();
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
      : { clientId: defaultClientId ?? "", cutting: true, edging: false, materialsAvailable: false, cuttingOperatorId: "", edgingOperatorId: "", title: "", clientNotes: "", internalNotes: "" },
  });

  const edging = useWatch({ control, name: "edging" });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const { clientId, ...details } = values;
      if (existing) {
        const result = await updateJobAction(existing.workNumber, details);
        if (result && !result.ok) setServerError(result.error);
        return;
      }
      const result = await createJobAction({
        ...details,
        clientId,
        cuttingOperatorId: details.cuttingOperatorId || undefined,
        edgingOperatorId: details.edging ? details.edgingOperatorId || undefined : undefined,
      });
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      for (const [i, file] of photos.entries()) {
        setProgress(`Uploading photo ${i + 1} of ${photos.length}…`);
        const error = await uploadPhoto(file, { workNumber: result.workNumber, kind: "MATERIAL" });
        if (error) toast.error(error);
      }
      setProgress(undefined);
      router.push(`/admin/jobs/${result.workNumber}`);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-xl space-y-6">
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      {clients && (
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
        <legend className="text-sm font-medium">Work requested</legend>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-brand-charcoal" {...register("cutting")} />
          Cutting
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-brand-charcoal" {...register("edging")} />
          Edging (after cutting)
        </label>
        {errors.cutting && <p className="text-sm text-destructive">{errors.cutting.message}</p>}
      </fieldset>

      {!editing && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Operators (optional, can be set later)</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <OperatorSelect id="cuttingOperatorId" label="Cutting operator" options={cuttingOperators} register={register("cuttingOperatorId")} />
            {edging && (
              <OperatorSelect id="edgingOperatorId" label="Edging operator" options={edgingOperators} register={register("edgingOperatorId")} />
            )}
          </div>
        </fieldset>
      )}

      {!editing && (
        <div className="space-y-2">
          <Label htmlFor="wood-photos">Photos of the wood (optional)</Label>
          <input
            id="wood-photos"
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-4 file:py-2.5 file:font-medium"
            onChange={(e) => setPhotos([...(e.target.files ?? [])].slice(0, 12))}
          />
          {photos.length > 0 && <p className="text-sm text-muted-foreground">{photos.length} photo{photos.length === 1 ? "" : "s"} will be added to the job.</p>}
        </div>
      )}

      {!editing && (
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
        Parts, stock sheets and the cutting plan are added on the job after it is created.
      </p>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="h-11">
          {progress ?? (pending ? "Saving…" : editing ? "Save changes" : "Create job")}
        </Button>
        <Link
          href={existing ? `/admin/jobs/${existing.workNumber}` : "/admin/jobs"}
          className={buttonVariants({ variant: "outline", className: "h-11" })}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function OperatorSelect({
  id,
  label,
  options,
  register,
}: {
  id: string;
  label: string;
  options: OperatorOption[];
  register: ReturnType<ReturnType<typeof useForm<JobInput>>["register"]>;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm" {...register}>
        <option value="">{options.length ? "Assign later" : "No operators with this skill yet"}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}
