"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirmMaterialsAction, withdrawMaterialsAction } from "@/actions/jobs";
import ConfirmAction from "@/components/ConfirmAction";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function MaterialsAvailableButton({ workNumber, approved }: { workNumber: string; approved: boolean }) {
  const router = useRouter();
  return (
    <ConfirmAction
      label="Materials available"
      title={`Materials available for ${workNumber}?`}
      description={
        approved
          ? "Confirm the boards for this job are in the workshop. The job joins the cutting queue now."
          : "Confirm the boards for this job are in the workshop. The job will join the cutting queue as soon as its cutlist is approved."
      }
      confirmLabel="Confirm"
      onConfirm={async () => {
        const result = await confirmMaterialsAction(workNumber);
        if (result.ok) {
          toast.success(approved ? "Materials confirmed. The job is in the cutting queue." : "Materials confirmed.");
          router.refresh();
        } else toast.error(result.error);
      }}
    />
  );
}

export function MaterialsNotAvailableButton({ workNumber, queued }: { workNumber: string; queued: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label="Materials not available"
      destructive
      title={`Withdraw the materials confirmation for ${workNumber}?`}
      description={
        <span className="block space-y-2">
          <span className="block">
            {queued
              ? "The job leaves the cutting queue until materials are confirmed again. It keeps its original place in the order."
              : "The confirmation is removed."}
          </span>
          <span className="block space-y-1.5 text-left">
            <Label htmlFor="withdraw-reason">Reason (recorded)</Label>
            <Textarea id="withdraw-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </span>
        </span>
      }
      confirmLabel="Withdraw"
      onConfirm={async () => {
        const result = await withdrawMaterialsAction(workNumber, reason);
        if (result.ok) {
          toast.success("Materials confirmation withdrawn.");
          setReason("");
          router.refresh();
        } else toast.error(result.error);
      }}
    />
  );
}
