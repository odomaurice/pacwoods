"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { completeResetAction } from "@/actions/passwordReset";
import FormField from "@/components/FormField";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { PASSWORD_MIN } from "@/lib/password-policy";

export default function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertDescription>Your password is changed. You have been signed out everywhere else.</AlertDescription>
        </Alert>
        <Link href="/login" className={buttonVariants({ className: "h-11 w-full" })}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        startTransition(async () => {
          const result = await completeResetAction(token, password, confirm);
          if (result.ok) setDone(true);
          else setError(result.error);
        });
      }}
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <FormField id="password" label={`New password (at least ${PASSWORD_MIN} characters)`} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <FormField id="confirm" label="Repeat the new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <Button type="submit" disabled={pending} className="h-11 w-full">
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
