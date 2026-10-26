"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { approveCutlistAction, reopenCutlistAction } from "@/actions/cutlists";
import ConfirmAction from "@/components/ConfirmAction";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ApproveCutlistButton({ workNumber }: { workNumber: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      label="Approve cutlist"
      title={`Approve the cutlist for ${workNumber}?`}
      description="The cutlist and this cutting plan are locked. The job moves on to waiting for material."
      confirmLabel="Approve"
      onConfirm={async () => {
        const result = await approveCutlistAction(workNumber);
        if (result.ok) {
          toast.success("Cutlist approved.");
          router.refresh();
        } else toast.error(result.error);
      }}
    />
  );
}

export function ReopenCutlistButton({ workNumber }: { workNumber: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label="Reopen for changes"
      title={`Reopen the cutlist for ${workNumber}?`}
      description={
        <span className="block space-y-2">
          <span className="block">
            A new draft version is made from the approved one, and the job goes back to draft. The approved version is kept in the history.
          </span>
          <span className="block space-y-1.5 text-left">
            <Label htmlFor="reopen-reason">Reason (recorded)</Label>
            <Textarea id="reopen-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </span>
        </span>
      }
      confirmLabel="Reopen"
      onConfirm={async () => {
        const result = await reopenCutlistAction(workNumber, reason);
        if (result.ok) {
          toast.success("Cutlist reopened.");
          setReason("");
          router.refresh();
        } else toast.error(result.error);
      }}
    />
  );
}
