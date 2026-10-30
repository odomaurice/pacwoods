"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createStaffAccountAction, type CreatedAccount } from "@/actions/accounts";
import FormField from "@/components/FormField";
import TemporaryPassword from "@/components/TemporaryPassword";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { staffAccountSchema, type StaffAccountInput } from "@/lib/schemas";

const CAPABILITY_TEXT = {
  CUTTING: "Cutting — can work the cutting queue",
  CNC: "CNC machining — can work the CNC queue",
  EDGING: "Edging — can work the edging queue",
} as const;

export default function StaffAccountForm({ role, backHref }: { role: "ADMIN" | "OPERATOR"; backHref: string }) {
  const [created, setCreated] = useState<Extract<CreatedAccount, { ok: true }>>();
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StaffAccountInput>({
    resolver: zodResolver(staffAccountSchema),
    defaultValues: { role, name: "", phone: "", email: "", permissions: [], capabilities: [] },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await createStaffAccountAction(values);
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
        <TemporaryPassword name={created.name} login={created.login} password={created.temporaryPassword} />
        <div className="flex gap-2">
          <Link href={backHref} className={buttonVariants({ variant: "default" })}>
            Done
          </Link>
          <Button variant="outline" onClick={() => setCreated(undefined)}>
            Create another
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
      <FormField id="name" label="Full name" error={errors.name?.message} {...register("name")} />
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

      {role === "OPERATOR" && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Capabilities</legend>
          {(["CUTTING", "CNC", "EDGING"] as const).map((c) => (
            <label key={c} className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" value={c} className="size-5 accent-brand-charcoal" {...register("capabilities")} />
              {CAPABILITY_TEXT[c]}
            </label>
          ))}
          {errors.capabilities && <p className="text-sm text-destructive">{errors.capabilities.message}</p>}
        </fieldset>
      )}

      {role === "ADMIN" && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Extra permissions</legend>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              value="operators.manage"
              className="size-5 accent-brand-charcoal"
              {...register("permissions")}
            />
            Can create and manage operator accounts
          </label>
        </fieldset>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="h-11">
          {pending ? "Creating…" : role === "ADMIN" ? "Create administrator" : "Create operator"}
        </Button>
        <Link href={backHref} className={buttonVariants({ variant: "outline", className: "h-11" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
