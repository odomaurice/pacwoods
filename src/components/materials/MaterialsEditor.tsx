"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveJobMaterialsAction } from "@/actions/jobs";
import MaterialRows, { readRows, toRow, type CatalogueOption, type MaterialRow } from "@/components/materials/MaterialRows";
import { Button } from "@/components/ui/button";
import type { JobMaterialInput } from "@/lib/job-materials";

export type { CatalogueOption };

/** Edits an existing job's material list and saves it. */
export default function MaterialsEditor({
  workNumber,
  initial,
  catalogue,
  suggested,
  onDone,
}: {
  workNumber: string;
  initial: JobMaterialInput[];
  catalogue: CatalogueOption[];
  /** From the cutting plan, offered when the list is empty. */
  suggested: JobMaterialInput[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<MaterialRow[]>(() => (initial.length ? initial : suggested.length ? suggested : [{}]).map(toRow));
  const [pending, startTransition] = useTransition();

  function save() {
    const read = readRows(rows);
    if ("error" in read) {
      toast.error(read.error);
      return;
    }
    startTransition(async () => {
      const result = await saveJobMaterialsAction(workNumber, read.items);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Materials saved.");
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {initial.length === 0 && suggested.length > 0 && (
        <p className="text-sm text-muted-foreground">Filled in from the cutting plan. Change anything that differs from what actually arrived.</p>
      )}
      <MaterialRows rows={rows} onChange={setRows} catalogue={catalogue} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={save} disabled={pending} className="ml-auto">
          {pending ? "Saving…" : "Save materials"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
