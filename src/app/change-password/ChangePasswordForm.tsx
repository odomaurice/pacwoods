"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordAction } from "@/actions/auth";
import FormField from "@/components/FormField";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PASSWORD_MIN, changePasswordSchema, type ChangePasswordInput } from "@/lib/password-policy";

export default function ChangePasswordForm({ temporary }: { temporary: boolean }) {
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await changePasswordAction(values);
      if (result?.error) setServerError(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      <FormField
        id="currentPassword"
        label={temporary ? "Temporary password" : "Current password"}
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register("currentPassword")}
      />
      <FormField
        id="newPassword"
        label={`New password (at least ${PASSWORD_MIN} characters)`}
        type="password"
        autoComplete="new-password"
        error={errors.newPassword?.message}
        {...register("newPassword")}
      />
      <FormField
        id="confirmPassword"
        label="Repeat the new password"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      <Button type="submit" disabled={pending} className="h-11 w-full">
        {pending ? "Saving…" : "Save new password"}
      </Button>
      <p className="text-sm text-muted-foreground">
        Changing your password signs you out on every other device.
      </p>
    </form>
  );
}
