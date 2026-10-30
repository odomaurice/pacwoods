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
      large
      label="Mark materials as received"
      title={`Are the boards for ${workNumber} in the workshop?`}
      description={
        approved
          ? "Only confirm once the boards are physically here. The job goes into the cutting queue straight away."
          : "Only confirm once the boards are physically here. The job goes into the cutting queue as soon as its cutlist is approved."
      }
      confirmLabel="Yes, they are here"
      onConfirm={async () => {
        const result = await confirmMaterialsAction(workNumber);
        if (result.ok) {
          toast.success(approved ? "Materials received. The job is in the cutting queue." : "Materials received.");
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
      label="Not received after all"
      destructive
      title={`Mark the boards for ${workNumber} as not received?`}
      description={
        <span className="block space-y-2">
          <span className="block">
            {queued
              ? "The job leaves the cutting queue until the boards arrive. It keeps its original place in the order."
              : "The job goes back to waiting for materials."}
          </span>
          <span className="block space-y-1.5 text-left">
            <Label htmlFor="withdraw-reason">Why? (recorded on the timeline)</Label>
            <Textarea id="withdraw-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </span>
        </span>
      }
      confirmLabel="Mark as not received"
      onConfirm={async () => {
        const result = await withdrawMaterialsAction(workNumber, reason);
        if (result.ok) {
          toast.success("Marked as not received.");
          setReason("");
          router.refresh();
        } else toast.error(result.error);
      }}
    />
  );
}
