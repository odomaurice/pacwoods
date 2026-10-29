"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { releaseTaskAction } from "@/actions/production";
import ConfirmAction from "@/components/ConfirmAction";

/** Staff hand a taken stage back to the shared queue, e.g. when its operator is away. */
export default function ReleaseTask({ taskId, operatorName, inProgress }: { taskId: string; operatorName: string; inProgress: boolean }) {
  const router = useRouter();
  return (
    <ConfirmAction
      label="Release to queue"
      title={`Take this work away from ${operatorName}?`}
      description={
        inProgress
          ? `${operatorName}'s work is paused, keeping the time already spent. Any operator who can do this stage can then resume it, in queue order.`
          : "Any operator who can do this stage can then take it, in queue order."
      }
      confirmLabel="Release"
      onConfirm={async () => {
        const result = await releaseTaskAction(taskId);
        if (result.ok) {
          toast.success("Released to the queue.");
          router.refresh();
          return true;
        }
        toast.error(result.error);
        return false;
      }}
    />
  );
}
