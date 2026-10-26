"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { assignOperatorAction } from "@/actions/production";
import ConfirmAction from "@/components/ConfirmAction";
import { Button } from "@/components/ui/button";

export default function AssignOperator({
  taskId,
  current,
  operators,
  inProgress,
}: {
  taskId: string;
  current?: string;
  operators: Array<{ id: string; name: string }>;
  inProgress: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [pending, startTransition] = useTransition();

  if (operators.length === 0) {
    return <p className="text-sm text-muted-foreground">No active operator has this capability yet.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Operator"
        className="h-10 min-w-48 rounded-md border border-input bg-card px-3 text-sm"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      >
        <option value="">Choose an operator…</option>
        {operators.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {inProgress ? (
        <ConfirmAction
          label="Reassign"
          disabled={!value || value === current}
          title="Reassign work in progress?"
          description="The current operator's work is paused, keeping the time already spent. The new operator resumes it from their queue."
          confirmLabel="Reassign"
          onConfirm={async () => {
            const result = await assignOperatorAction(taskId, value);
            if (result.ok) {
              toast.success("Reassigned.");
              router.refresh();
              return true;
            }
            toast.error(result.error);
            return false;
          }}
        />
      ) : (
        <Button
          variant="outline"
          disabled={pending || !value || value === current}
          onClick={() =>
            startTransition(async () => {
              const result = await assignOperatorAction(taskId, value);
              if (result.ok) {
                toast.success(current ? "Reassigned." : "Assigned.");
                router.refresh();
              } else toast.error(result.error);
            })
          }
        >
          {current ? "Reassign" : "Assign"}
        </Button>
      )}
    </div>
  );
}
