"use client";

import { toast } from "sonner";
import { addStandardMaterialsAction } from "@/actions/catalogue";
import ConfirmAction from "@/components/ConfirmAction";

export default function StandardMaterialsButton() {
  return (
    <ConfirmAction
      label="Add standard materials"
      title="Add the standard materials?"
      description="Adds common sheet materials (MDF, HDF, melamine-faced board, plywood, chipboard, blockboard, OSB, hardboard) in their usual thicknesses on 2440 × 1220 mm sheets. Materials you already have are left as they are."
      confirmLabel="Add materials"
      onConfirm={async () => {
        const result = await addStandardMaterialsAction();
        toast.success(result.added ? `${result.added} materials added.` : "All standard materials are already in the catalogue.");
      }}
    />
  );
}
