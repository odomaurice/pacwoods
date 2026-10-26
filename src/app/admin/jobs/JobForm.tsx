"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createJobAction, updateJobAction } from "@/actions/jobs";
import FormField from "@/components/FormField";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { jobSchema, type JobInput } from "@/lib/schemas";

type ClientOption = { id: string; label: string };

/**
 * Creates a job (with a client picker) or edits a draft's details. The work
 * number and status are assigned by the server, never entered here.
 */
export default function JobForm({
  clients,
  defaultClientId,
  existing,
}: {
  clients?: ClientOption[];
  defaultClientId?: string;
  /** Editing a draft: the client cannot change, so it rides along unseen. */
  existing?: { workNumber: string; values: JobInput };
}) {
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const editing = Boolean(existing);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<JobInput>({
    resolver: zodResolver(jobSchema),
    defaultValues: existing
      ? existing.values
      : { clientId: defaultClientId ?? "", cutting: true, edging: false, title: "", clientNotes: "", internalNotes: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const { clientId, ...details } = values;
      const result = existing ? await updateJobAction(existing.workNumber, details) : await createJobAction({ ...details, clientId });
      if (result && !result.ok) setServerError(result.error);
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
          {pending ? "Saving…" : editing ? "Save changes" : "Create job"}
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
