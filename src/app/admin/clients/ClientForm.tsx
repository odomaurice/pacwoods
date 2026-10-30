"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClientAction, type CreatedAccount } from "@/actions/accounts";
import FormField from "@/components/FormField";
import TemporaryPassword from "@/components/TemporaryPassword";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { clientAccountSchema, type ClientAccountInput } from "@/lib/schemas";

export default function ClientForm({ wizard = false }: { /** Inside the new-job flow: continue to the job, not back to the client list. */ wizard?: boolean } = {}) {
  const [created, setCreated] = useState<Extract<CreatedAccount, { ok: true }>>();
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClientAccountInput>({ resolver: zodResolver(clientAccountSchema) });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await createClientAction(values);
      if (result.ok) {
        setCreated(result);
        reset();
      } else {
        setServerError(result.error);
      }
    });
  });

  if (created) {
    return (
      <div className="space-y-4">
        <TemporaryPassword
          name={created.name}
          login={created.login}
          password={created.temporaryPassword}
          extra={created.clientNumber}
        />
        {wizard && created.clientId && (
          <Link href={`/admin/jobs/new?client=${created.clientId}`} className={buttonVariants({ variant: "gold", className: "h-11 w-full" })}>
            Continue: job details →
          </Link>
        )}
        <div className={wizard ? "hidden" : "flex flex-wrap gap-2"}>
          {created.clientId && (
            <Link href={`/admin/clients/${created.clientId}/card`} className={buttonVariants()}>
              Print client card
            </Link>
          )}
          <Link href="/admin/clients" className={buttonVariants({ variant: "outline" })}>
            Done
          </Link>
          <Button variant="outline" onClick={() => setCreated(undefined)}>
            Register another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-xl space-y-5">
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      <FormField id="name" label="Contact name" error={errors.name?.message} {...register("name")} />
      <FormField
        id="businessName"
        label="Business name (optional)"
        error={errors.businessName?.message}
        {...register("businessName")}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="phone"
          label="Phone number"
          type="tel"
          placeholder="e.g. 0803 123 4567"
          error={errors.phone?.message}
          {...register("phone")}
        />
        <FormField id="email" label="Email (optional)" type="email" error={errors.email?.message} {...register("email")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address (optional)</Label>
        <Textarea id="address" rows={2} {...register("address")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="staffNotes">Staff notes (never shown to the client)</Label>
        <Textarea id="staffNotes" rows={3} {...register("staffNotes")} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="h-11">
          {pending ? "Registering…" : "Register client"}
        </Button>
        <Link href="/admin/clients" className={buttonVariants({ variant: "outline", className: "h-11" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
