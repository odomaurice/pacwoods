"use client";

import { useState } from "react";
import MaterialsEditor, { type CatalogueOption } from "@/components/materials/MaterialsEditor";
import { Button } from "@/components/ui/button";
import { SUPPLIED_BY_LABELS, describeMaterial, type JobMaterialInput } from "@/lib/job-materials";

/** The recorded boards for a job, with an editor behind "Enter materials". */
export default function MaterialsPanel({
  workNumber,
  items,
  catalogue,
  suggested,
}: {
  workNumber: string;
  items: JobMaterialInput[];
  catalogue: CatalogueOption[];
  suggested: JobMaterialInput[];
}) {
  const [editing, setEditing] = useState(false);
  if (editing) return <MaterialsEditor workNumber={workNumber} initial={items} catalogue={catalogue} suggested={suggested} onDone={() => setEditing(false)} />;

  const sheets = items.reduce((n, m) => n + m.sheets, 0);
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No material details recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="[&>th]:px-2 [&>th]:py-1.5 [&>th]:font-medium [&>th]:whitespace-nowrap">
                <th>Material</th>
                <th>Sheet size (mm)</th>
                <th className="text-right">Sheets</th>
                <th>Supplied by</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m, i) => (
                <tr key={i} className="odd:bg-muted/60 [&>td]:px-2 [&>td]:py-1.5">
                  <td className="font-medium">{describeMaterial(m)}</td>
                  <td className="tabular-nums">{m.sheetLengthMm && m.sheetWidthMm ? `${m.sheetLengthMm} × ${m.sheetWidthMm}` : "—"}</td>
                  <td className="text-right tabular-nums">{m.sheets}</td>
                  <td>{m.suppliedBy ? SUPPLIED_BY_LABELS[m.suppliedBy] : "—"}</td>
                  <td className="text-muted-foreground">{m.note || "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="[&>td]:px-2 [&>td]:py-1.5">
                <td colSpan={2} className="font-medium">
                  Total
                </td>
                <td className="text-right font-semibold tabular-nums">{sheets}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <Button variant="outline" onClick={() => setEditing(true)}>
        {items.length ? "Edit materials" : "Enter materials"}
      </Button>
    </div>
  );
}
