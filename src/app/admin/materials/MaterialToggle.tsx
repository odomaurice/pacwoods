"use client";

import { toast } from "sonner";
import { setMaterialActiveAction } from "@/actions/catalogue";
import ConfirmAction from "@/components/ConfirmAction";

export default function MaterialToggle({ id, name, active }: { id: string; name: string; active: boolean }) {
  return (
    <ConfirmAction
      label={active ? "Retire" : "Restore"}
      destructive={active}
      title={active ? `Retire ${name}?` : `Restore ${name}?`}
      description={
        active
          ? "It will no longer be offered for new cutlists. Existing jobs keep it."
          : "It will be offered for new cutlists again."
      }
      confirmLabel={active ? "Retire" : "Restore"}
      onConfirm={async () => {
        const result = await setMaterialActiveAction(id, !active);
        if (result.ok) toast.success(active ? `${name} retired.` : `${name} restored.`);
        else toast.error(result.error);
      }}
    />
  );
}
