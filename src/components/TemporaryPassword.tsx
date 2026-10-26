"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Shows a freshly issued temporary password exactly once. It is not stored
 * anywhere; leaving the page loses it, and a reset is the only way to get
 * another.
 */
export default function TemporaryPassword({
  name,
  login,
  password,
  extra,
}: {
  name: string;
  login: string;
  password: string;
  extra?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div role="status" className="space-y-4 rounded-lg bg-accent p-5">
      <div>
        <p className="font-semibold">Hand these sign-in details to {name}</p>
        <p className="text-sm text-muted-foreground">
          This password is shown once and is not stored. They must choose their own at first sign-in.
        </p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        {extra && (
          <div>
            <dt className="text-xs text-muted-foreground uppercase">Client number</dt>
            <dd className="font-mono text-lg">{extra}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-muted-foreground uppercase">Sign in with</dt>
          <dd className="font-mono text-lg break-all">{login}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground uppercase">Temporary password</dt>
          <dd className="font-mono text-lg tracking-wider">{password}</dd>
        </div>
      </dl>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(password);
          setCopied(true);
        }}
      >
        {copied ? "Copied" : "Copy password"}
      </Button>
    </div>
  );
}
