"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUPPLIED_BY, SUPPLIED_BY_LABELS, jobMaterialsSchema, type JobMaterialInput, type SuppliedBy } from "@/lib/job-materials";

export type CatalogueOption = { id: string; name: string; thicknessMm: number; sheetLengthMm: number; sheetWidthMm: number };

/** One material line as typed: numbers stay strings until it is saved. */
export type MaterialRow = { materialId: string; name: string; thicknessMm: string; sheetLengthMm: string; sheetWidthMm: string; sheets: string; suppliedBy: SuppliedBy | ""; note: string };

const OTHER = "__other";

export const toRow = (m: Partial<JobMaterialInput>): MaterialRow => ({
  materialId: m.materialId ?? (m.name ? OTHER : ""),
  name: m.name ?? "",
  thicknessMm: m.thicknessMm?.toString() ?? "",
  sheetLengthMm: m.sheetLengthMm?.toString() ?? "",
  sheetWidthMm: m.sheetWidthMm?.toString() ?? "",
  sheets: m.sheets?.toString() ?? "1",
  suppliedBy: m.suppliedBy ?? "",
  note: m.note ?? "",
});

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

/** The filled-in rows, validated: the items to save, or the first problem. */
export function readRows(rows: MaterialRow[]): { items: JobMaterialInput[] } | { error: string } {
  const items = rows
    .filter((r) => r.name.trim() || r.materialId)
    .map((r) => ({
      materialId: r.materialId && r.materialId !== OTHER ? r.materialId : undefined,
      name: r.name,
      thicknessMm: num(r.thicknessMm),
      sheetLengthMm: num(r.sheetLengthMm),
      sheetWidthMm: num(r.sheetWidthMm),
      sheets: Number(r.sheets),
      suppliedBy: r.suppliedBy || undefined,
      note: r.note || undefined,
    }));
  const parsed = jobMaterialsSchema.safeParse(items);
  return parsed.success ? { items: parsed.data } : { error: parsed.error.issues[0]?.message ?? "Check the materials." };
}

/**
 * The boards for a job, one line per material: pick from the catalogue
 * (which fills thickness and sheet size) or type any material, then say how
 * many sheets and who supplied them.
 */
export default function MaterialRows({ rows, onChange, catalogue }: { rows: MaterialRow[]; onChange: (rows: MaterialRow[]) => void; catalogue: CatalogueOption[] }) {
  const set = (i: number, patch: Partial<MaterialRow>) => onChange(rows.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  function pick(i: number, id: string) {
    const m = catalogue.find((c) => c.id === id);
    if (m) set(i, { materialId: id, name: m.name, thicknessMm: String(m.thicknessMm), sheetLengthMm: String(m.sheetLengthMm), sheetWidthMm: String(m.sheetWidthMm) });
    else set(i, { materialId: id, name: id === OTHER ? "" : rows[i].name });
  }

  const field = "h-10 w-full rounded-md border border-input bg-card px-3 text-sm";
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <fieldset key={i} className="grid gap-3 rounded-lg bg-muted/60 p-3 sm:grid-cols-6">
          <legend className="sr-only">Material {i + 1}</legend>
          <div className="space-y-1 sm:col-span-3">
            <Label htmlFor={`m-${i}-pick`}>Material</Label>
            <select id={`m-${i}-pick`} className={field} value={r.materialId} onChange={(e) => pick(i, e.target.value)}>
              <option value="">Choose…</option>
              {catalogue.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.thicknessMm} mm · {c.sheetLengthMm} × {c.sheetWidthMm}
                </option>
              ))}
              <option value={OTHER}>Other (type it in)</option>
            </select>
          </div>
          {r.materialId === OTHER && (
            <div className="space-y-1 sm:col-span-3">
              <Label htmlFor={`m-${i}-name`}>Material name</Label>
              <Input id={`m-${i}-name`} className="h-10 bg-card" placeholder="e.g. Grey melamine" value={r.name} onChange={(e) => set(i, { name: e.target.value })} />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor={`m-${i}-sheets`}>Sheets</Label>
            <Input id={`m-${i}-sheets`} inputMode="numeric" className="h-10 bg-card" value={r.sheets} onChange={(e) => set(i, { sheets: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`m-${i}-t`}>Thickness (mm)</Label>
            <Input id={`m-${i}-t`} inputMode="decimal" className="h-10 bg-card" value={r.thicknessMm} onChange={(e) => set(i, { thicknessMm: e.target.value })} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`m-${i}-l`}>Sheet size (mm)</Label>
            <span className="flex items-center gap-1.5">
              <Input id={`m-${i}-l`} aria-label="Sheet length" inputMode="numeric" className="h-10 bg-card" placeholder="2440" value={r.sheetLengthMm} onChange={(e) => set(i, { sheetLengthMm: e.target.value })} />
              <span aria-hidden>×</span>
              <Input aria-label="Sheet width" inputMode="numeric" className="h-10 bg-card" placeholder="1220" value={r.sheetWidthMm} onChange={(e) => set(i, { sheetWidthMm: e.target.value })} />
            </span>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`m-${i}-by`}>Supplied by</Label>
            <select id={`m-${i}-by`} className={field} value={r.suppliedBy} onChange={(e) => set(i, { suppliedBy: e.target.value as MaterialRow["suppliedBy"] })}>
              <option value="">Not recorded</option>
              {SUPPLIED_BY.map((s) => (
                <option key={s} value={s}>
                  {SUPPLIED_BY_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-5">
            <Label htmlFor={`m-${i}-note`}>Note</Label>
            <Input id={`m-${i}-note`} className="h-10 bg-card" placeholder="e.g. colour code, condition, supplier" value={r.note} onChange={(e) => set(i, { note: e.target.value })} />
          </div>
          <div className="flex items-end">
            <Button type="button" variant="outline" className="h-10 w-full" onClick={() => onChange(rows.length > 1 ? rows.filter((_, j) => j !== i) : [toRow({})])}>
              <HugeiconsIcon icon={Delete02Icon} className="size-4" />
              Remove
            </Button>
          </div>
        </fieldset>
      ))}
      <Button type="button" variant="outline" onClick={() => onChange([...rows, toRow({})])} disabled={rows.length >= 30}>
        <HugeiconsIcon icon={Add01Icon} className="size-4" />
        Add another material
      </Button>
    </div>
  );
}
