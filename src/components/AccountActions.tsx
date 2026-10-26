"use client";

import { useState } from "react";
import { toast } from "sonner";
import { accountAction } from "@/actions/accounts";
import ConfirmAction from "@/components/ConfirmAction";
import TemporaryPassword from "@/components/TemporaryPassword";
import type { UserStatus } from "@/lib/schemas";

/** Suspend, reactivate, deactivate, reset password, sign out everywhere. */
export default function AccountActions({
  userId,
  name,
  login,
  status,
}: {
  userId: string;
  name: string;
  login: string;
  status: UserStatus;
}) {
  const [issued, setIssued] = useState<string>();

  async function run(input: Parameters<typeof accountAction>[0]) {
    const result = await accountAction(input);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    if (result.temporaryPassword) setIssued(result.temporaryPassword);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {status === "ACTIVE" ? (
          <>
            <ConfirmAction
              label="Reset password"
              title={`Reset ${name}'s password?`}
              description="They will be signed out everywhere and given a new temporary password, which you will see once."
              confirmLabel="Reset password"
              onConfirm={() => run({ kind: "reset", userId })}
            />
            <ConfirmAction
              label="Sign out everywhere"
              title={`Sign ${name} out of every device?`}
              description="They can sign straight back in with their password."
              confirmLabel="Sign out"
              onConfirm={() => run({ kind: "revoke", userId })}
            />
            <ConfirmAction
              label="Suspend"
              destructive
              title={`Suspend ${name}?`}
              description="They are signed out at once and cannot sign in until reactivated. Their records are kept."
              confirmLabel="Suspend"
              onConfirm={() => run({ kind: "status", userId, status: "SUSPENDED" })}
            />
          </>
        ) : (
          <ConfirmAction
            label="Reactivate"
            title={`Reactivate ${name}?`}
            description="They will be able to sign in again with their existing password."
            confirmLabel="Reactivate"
            onConfirm={() => run({ kind: "status", userId, status: "ACTIVE" })}
          />
        )}
        {status !== "DEACTIVATED" && (
          <ConfirmAction
            label="Deactivate"
            destructive
            title={`Deactivate ${name}?`}
            description="Use this when they have left for good. They cannot sign in; their history and jobs are kept."
            confirmLabel="Deactivate"
            onConfirm={() => run({ kind: "status", userId, status: "DEACTIVATED" })}
          />
        )}
      </div>
      {issued && <TemporaryPassword name={name} login={login} password={issued} />}
    </div>
  );
}
