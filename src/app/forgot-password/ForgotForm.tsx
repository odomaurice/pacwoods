"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestResetAction } from "@/actions/passwordReset";
import FormField from "@/components/FormField";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function ForgotForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertDescription>
            If an account uses that email, a link to choose a new password is on its way. It works once and expires in 30 minutes. Check your spam folder too.
          </AlertDescription>
        </Alert>
        <Link href="/login" className="text-sm underline underline-offset-4">
          Back to sign in
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
          const result = await requestResetAction(email);
          if (result.ok) setSent(true);
          else setError(result.error);
        });
      }}
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <FormField id="email" label="Email address" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button type="submit" disabled={pending || !email.trim()} className="h-11 w-full">
        {pending ? "Sending…" : "Send me a reset link"}
      </Button>
      <p className="text-sm text-muted-foreground">
        Signed up with a phone number only? Ask Pacwoods to reset your password at the counter.
      </p>
      <Link href="/login" className="block text-sm underline underline-offset-4">
        Back to sign in
      </Link>
    </form>
  );
}
