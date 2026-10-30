"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, Delete02Icon, Layers01Icon, PlayIcon, Settings02Icon, SquareIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import Link from "next/link";
import { generatePlanAction, saveCutlistAction, type PlanSummary } from "@/actions/cutlists";
import EdgePicker from "@/components/cutlist/EdgePicker";
import PlanPreview, { type PreviewData } from "@/components/cutlist/PlanPreview";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  GRAIN_LABELS,
  NO_EDGES,
  PART_GRAINS,
  cutlistPartSchema,
  cutlistSchema,
  cutlistStockSchema,
  type CutlistInput,
  type CutlistOptions,
} from "@/lib/cutlist";
import type { Edges, PartGrain } from "@/lib/cutting/types";
import { LENGTH_UNITS, UNIT_LABELS, convertText, fromMm, toMm, type LengthUnit } from "@/lib/units";
import { cn } from "@/lib/utils";

export type MaterialOption = {
  id: string;
  label: string;
  category: string;
  sheetLengthMm: number;
  sheetWidthMm: number;
  grained: boolean;
};

type PartRow = {
  ref: string;
  label: string;
  length: string;
  width: string;
  quantity: string;
  materialId: string;
  grain: PartGrain;
  edges: Edges;
};

type StockRow = {
  ref: string;
  label: string;
  length: string;
  width: string;
  quantity: string;
  materialId: string;
  grained: boolean;
};

const blankPart = (ref: string): PartRow => ({
  ref,
  label: "",
  length: "",
  width: "",
  quantity: "",
  materialId: "",
  grain: "NONE",
  edges: NO_EDGES,
});
const blankStock = (ref: string): StockRow => ({ ref, label: "", length: "", width: "", quantity: "", materialId: "", grained: false });

const isBlank = (r: { label: string; length: string; width: string; quantity: string }) =>
  !r.label.trim() && !r.length.trim() && !r.width.trim() && !r.quantity.trim();

function nextRef(prefix: string, rows: { ref: string }[]) {
  const n = rows.reduce((max, r) => Math.max(max, Number(r.ref.slice(prefix.length)) || 0), 0);
  return `${prefix}${n + 1}`;
}

const MIN_ROWS = 4;

/**
 * Like a spreadsheet: always at least MIN_ROWS rows, and always a blank row
 * at the end to type the next entry into.
 */
function withTrailingBlank<T extends { ref: string; label: string; length: string; width: string; quantity: string }>(
  rows: T[],
  prefix: string,
  make: (ref: string) => T,
) {
  const trimmed = [...rows];
  while (trimmed.length && isBlank(trimmed[trimmed.length - 1])) trimmed.pop();
  do trimmed.push(make(nextRef(prefix, trimmed)));
  while (trimmed.length < MIN_ROWS);
  return trimmed;
}

const num = (s: string) => (s.trim() === "" ? Number.NaN : Number(s));

function toPart(r: PartRow, unit: LengthUnit) {
  return {
    ref: r.ref,
    label: r.label.trim() || undefined,
    length: toMm(num(r.length), unit),
    width: toMm(num(r.width), unit),
    quantity: num(r.quantity),
    materialId: r.materialId || undefined,
    grain: r.grain,
    edges: r.edges,
  };
}
function toStock(r: StockRow, unit: LengthUnit) {
  return {
    ref: r.ref,
    label: r.label.trim() || undefined,
    length: toMm(num(r.length), unit),
    width: toMm(num(r.width), unit),
    quantity: num(r.quantity),
    materialId: r.materialId || undefined,
    grained: r.grained,
  };
}

const cell = "h-10 w-full min-w-0 rounded-md border border-input bg-card px-2 text-sm tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export default function CutlistEditor({
  workNumber,
  initial,
  materials,
  readOnly,
  preview,
}: {
  workNumber: string;
  initial: CutlistInput;
  materials: MaterialOption[];
  readOnly: boolean;
  /** The last generated plan, shown beside the cutlist. */
  preview: PreviewData | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);
  /** Errors and optimiser results open in a popup. */
  const [notice, setNotice] = useState<{ title: string; body: ReactNode; showPlan?: boolean } | null>(null);
  const setFormError = (message: string | undefined) => setNotice(message ? { title: "Check the cutlist", body: message } : null);
  const unit: LengthUnit = initial.options.unit ?? "mm";

  const [parts, setPartsRaw] = useState<PartRow[]>(() =>
    withTrailingBlank(
      initial.parts.map((p) => ({
        ref: p.ref,
        label: p.label ?? "",
        length: fromMm(p.length, unit),
        width: fromMm(p.width, unit),
        quantity: String(p.quantity),
        materialId: p.materialId ?? "",
        grain: p.grain,
        edges: p.edges,
      })),
      "P",
      blankPart,
    ),
  );
  const [stocks, setStocksRaw] = useState<StockRow[]>(() =>
    withTrailingBlank(
      initial.stockSheets.map((s) => ({
        ref: s.ref,
        label: s.label ?? "",
        length: fromMm(s.length, unit),
        width: fromMm(s.width, unit),
        quantity: String(s.quantity),
        materialId: s.materialId ?? "",
        grained: s.grained,
      })),
      "S",
      blankStock,
    ),
  );
  const [options, setOptionsRaw] = useState<CutlistOptions>({ ...initial.options, unit });
  const current: LengthUnit = options.unit ?? "mm";

  /** Switching units re-expresses every size already typed. */
  function changeUnit(next: LengthUnit) {
    const conv = <T extends { length: string; width: string }>(r: T) => ({ ...r, length: convertText(r.length, current, next), width: convertText(r.width, current, next) });
    setPartsRaw((rows) => rows.map(conv));
    setStocksRaw((rows) => rows.map(conv));
    setOptionsRaw((o) => ({ ...o, unit: next }));
    setDirty(true);
  }

  const setParts = (rows: PartRow[]) => {
    setPartsRaw(withTrailingBlank(rows, "P", blankPart));
    setDirty(true);
  };
  const setStocks = (rows: StockRow[]) => {
    setStocksRaw(withTrailingBlank(rows, "S", blankStock));
    setDirty(true);
  };
  const setOption = <K extends keyof CutlistOptions>(key: K, value: CutlistOptions[K]) => {
    setOptionsRaw((o) => ({ ...o, [key]: value }));
    setDirty(true);
  };

  // Per-row problems, shown under the row; blank rows are simply ignored.
  const partErrors = useMemo(
    () => new Map(parts.filter((r) => !isBlank(r)).map((r) => [r.ref, cutlistPartSchema.safeParse(toPart(r, current)).error?.issues[0]?.message])),
    [parts, current],
  );
  const stockErrors = useMemo(
    () => new Map(stocks.filter((r) => !isBlank(r)).map((r) => [r.ref, cutlistStockSchema.safeParse(toStock(r, current)).error?.issues[0]?.message])),
    [stocks, current],
  );

  const materialById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);
  const materialGroups = useMemo(() => {
    const groups = new Map<string, MaterialOption[]>();
    for (const m of materials) groups.set(m.category, [...(groups.get(m.category) ?? []), m]);
    return [...groups];
  }, [materials]);
  const filledParts = parts.filter((r) => !isBlank(r));
  const totalPanels = filledParts.reduce((n, r) => n + (Number(r.quantity) || 0), 0);

  function collect(): CutlistInput | null {
    setFormError(undefined);
    const input = {
      parts: filledParts.map((r) => toPart(r, current)),
      stockSheets: stocks.filter((r) => !isBlank(r)).map((r) => toStock(r, current)),
      options,
    };
    const parsed = cutlistSchema.safeParse(input);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the highlighted rows.");
      return null;
    }
    return parsed.data;
  }

  function save() {
    const input = collect();
    if (!input) return;
    startTransition(async () => {
      const result = await saveCutlistAction(workNumber, input);
      if (result.ok) {
        setDirty(false);
        toast.success("Cutlist saved.");
      } else setFormError(result.error);
    });
  }

  function optimise() {
    const input = collect();
    if (!input) return;
    startTransition(async () => {
      const result = await generatePlanAction(workNumber, input);
      if (result.ok) {
        setDirty(false);
        router.refresh();
        setNotice(resultNotice(result.summary));
      } else setFormError(result.error);
    });
  }

  const materialSelect = (value: string, onChange: (id: string) => void, label: string) => (
    <select aria-label={label} className={cn(cell, "min-w-36")} value={value} disabled={readOnly} onChange={(e) => onChange(e.target.value)}>
      <option value="">{options.considerMaterial ? "Choose…" : "Any"}</option>
      {materialGroups.map(([category, items]) => (
        <optgroup key={category} label={category}>
          {items.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );

  return (
    <div className="grid gap-6 pb-24 xl:grid-cols-[minmax(0,1fr)_400px]">
    <div className="min-w-0 space-y-4">
      {readOnly && (
        <Alert>
          <AlertDescription>This cutlist is approved and locked. Reopen it from the job page to change it.</AlertDescription>
        </Alert>
      )}
      {materials.length === 0 && !readOnly && (
        <Alert>
          <AlertDescription>
            The materials catalogue is empty, so there is nothing to choose from. A Super Admin can add the standard materials on the Materials page.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-card px-4 py-3">
        <label htmlFor="unit" className="text-sm font-medium">
          Sizes in
        </label>
        <select id="unit" className={cn(cell, "w-auto")} value={current} disabled={readOnly} onChange={(e) => changeUnit(e.target.value as LengthUnit)}>
          {LENGTH_UNITS.map((u) => (
            <option key={u} value={u}>
              {UNIT_LABELS[u]}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">Changing it converts what is already typed. Plans and the workshop always use millimetres.</span>
      </div>

      <Section icon={SquareIcon} title="Panels" summary={`${filledParts.length} rows · ${totalPanels} panels`}>
        <RowHeader labels={[`Length (${current})`, `Width (${current})`, "Qty", "Label"]} />
        <ol className="space-y-1.5">
          {parts.map((row, i) => {
            const error = partErrors.get(row.ref);
            const blank = isBlank(row);
            const update = (patch: Partial<PartRow>) => setParts(parts.map((r, j) => (j === i ? { ...r, ...patch } : r)));
            return (
              <EntryRow key={row.ref} error={error}>
                <div className={FIRST_LINE}>
                  <input aria-label={`Length (${current})`} inputMode="decimal" className={cell} value={row.length} disabled={readOnly} onChange={(e) => update({ length: e.target.value })} />
                  <input aria-label={`Width (${current})`} inputMode="decimal" className={cell} value={row.width} disabled={readOnly} onChange={(e) => update({ width: e.target.value })} />
                  <input aria-label="Quantity" inputMode="numeric" className={cell} value={row.quantity} disabled={readOnly} onChange={(e) => update({ quantity: e.target.value })} />
                  <input aria-label="Label" className={cell} value={row.label} placeholder={blank ? "New panel…" : row.ref} disabled={readOnly} onChange={(e) => update({ label: e.target.value })} />
                </div>
                {!blank && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-40 flex-1">{materialSelect(row.materialId, (materialId) => update({ materialId }), "Material")}</span>
                    <select aria-label="Grain" title="Grain direction" className={cn(cell, "w-auto")} value={row.grain} disabled={readOnly} onChange={(e) => update({ grain: e.target.value as PartGrain })}>
                      {PART_GRAINS.map((g) => (
                        <option key={g} value={g}>
                          Grain: {GRAIN_LABELS[g].toLowerCase()}
                        </option>
                      ))}
                    </select>
                    <EdgePicker value={row.edges} disabled={readOnly} onChange={(edges) => update({ edges })} />
                    {!readOnly && <RemoveButton label={`Remove ${row.label || row.ref}`} onClick={() => setParts(parts.filter((_, j) => j !== i))} />}
                  </div>
                )}
              </EntryRow>
            );
          })}
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">
          Sizes in {UNIT_LABELS[current].toLowerCase()}. Tap the sides of the small rectangle to mark edge banding (the long sides are top and bottom), or press All round.
        </p>
      </Section>

      <Section icon={Layers01Icon} title="Stock sheets" summary={`${stocks.filter((r) => !isBlank(r)).length} sizes`}>
        {!readOnly && materials.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label htmlFor="add-stock" className="text-sm text-muted-foreground">
              Add from catalogue
            </label>
            <select
              id="add-stock"
              className={cn(cell, "w-auto")}
              value=""
              onChange={(e) => {
                const m = materialById.get(e.target.value);
                if (!m) return;
                const filled = stocks.filter((r) => !isBlank(r));
                setStocks([
                  ...filled,
                  {
                    ref: nextRef("S", stocks),
                    label: "",
                    length: fromMm(m.sheetLengthMm, current),
                    width: fromMm(m.sheetWidthMm, current),
                    quantity: "1",
                    materialId: m.id,
                    grained: m.grained,
                  },
                ]);
              }}
            >
              <option value="">Choose a material…</option>
              {materialGroups.map(([category, items]) => (
                <optgroup key={category} label={category}>
                  {items.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} — {m.sheetLengthMm} × {m.sheetWidthMm}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}
        <RowHeader labels={[`Length (${current})`, `Width (${current})`, "Sheets", "Label"]} />
        <ol className="space-y-1.5">
          {stocks.map((row, i) => {
            const error = stockErrors.get(row.ref);
            const blank = isBlank(row);
            const update = (patch: Partial<StockRow>) => setStocks(stocks.map((r, j) => (j === i ? { ...r, ...patch } : r)));
            return (
              <EntryRow key={row.ref} error={error}>
                <div className={FIRST_LINE}>
                  <input aria-label={`Sheet length (${current})`} inputMode="decimal" className={cell} value={row.length} disabled={readOnly} onChange={(e) => update({ length: e.target.value })} />
                  <input aria-label={`Sheet width (${current})`} inputMode="decimal" className={cell} value={row.width} disabled={readOnly} onChange={(e) => update({ width: e.target.value })} />
                  <input aria-label="Sheets available" inputMode="numeric" className={cell} value={row.quantity} disabled={readOnly} onChange={(e) => update({ quantity: e.target.value })} />
                  <input aria-label="Sheet label" className={cell} value={row.label} placeholder={blank ? "New sheet…" : row.ref} disabled={readOnly} onChange={(e) => update({ label: e.target.value })} />
                </div>
                {!blank && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-40 flex-1">
                      {materialSelect(row.materialId, (materialId) => {
                        const m = materialById.get(materialId);
                        update({ materialId, grained: m ? m.grained : row.grained });
                      }, "Sheet material")}
                    </span>
                    <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md bg-card px-3 text-sm">
                      <input type="checkbox" className="size-5 accent-brand-charcoal" checked={row.grained} disabled={readOnly} onChange={(e) => update({ grained: e.target.checked })} />
                      Grain along length
                    </label>
                    {!readOnly && <RemoveButton label={`Remove ${row.label || row.ref}`} onClick={() => setStocks(stocks.filter((_, j) => j !== i))} />}
                  </div>
                )}
              </EntryRow>
            );
          })}
        </ol>
      </Section>

      <Section icon={Settings02Icon} title="Options">
        <div className="divide-y divide-border">
          <NumberOption
            label="Cut / blade / kerf thickness"
            hint="Material lost to each saw cut. Kept between every pair of panels."
            value={options.kerf}
            disabled={readOnly}
            onChange={(v) => setOption("kerf", v)}
          />
          <NumberOption
            label="Edge trim"
            hint="Trimmed off every edge of each sheet before cutting, for damaged or uneven factory edges."
            value={options.edgeTrim}
            disabled={readOnly}
            onChange={(v) => setOption("edgeTrim", v)}
          />
          <ToggleOption label="Labels on panels" hint="Print each panel's label on the cutting plan." checked={options.labelsOnPanels} disabled={readOnly} onChange={(v) => setOption("labelsOnPanels", v)} />
          <ToggleOption label="Use only one sheet from stock" hint="Fit what you can on a single sheet; the rest is listed as not placed." checked={options.singleSheet} disabled={readOnly} onChange={(v) => setOption("singleSheet", v)} />
          <ToggleOption label="Consider material" hint="Panels are only cut from sheets of the same material." checked={options.considerMaterial} disabled={readOnly} onChange={(v) => setOption("considerMaterial", v)} />
          <ToggleOption label="Consider grain direction" hint="Panels with a grain direction keep it on grained sheets and are never turned against it." checked={options.considerGrain} disabled={readOnly} onChange={(v) => setOption("considerGrain", v)} />
          <ToggleOption
            label="Subtract edge-band thickness"
            hint="Panel sizes are finished sizes: banded edges are cut short by the band thickness."
            checked={options.deductEdgeBanding}
            disabled={readOnly}
            onChange={(v) => setOption("deductEdgeBanding", v)}
          />
          {options.deductEdgeBanding && (
            <NumberOption label="Edge-band thickness" hint="Per banded edge, in millimetres." value={options.edgeBandThickness} disabled={readOnly} onChange={(v) => setOption("edgeBandThickness", v)} />
          )}
        </div>
      </Section>

      {!readOnly && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="h-11" disabled={pending} onClick={save}>
              {pending ? "Working…" : "Save draft"}
            </Button>
            {dirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
          </div>
          <button
            type="button"
            onClick={optimise}
            disabled={pending}
            aria-label="Generate cutting plan"
            title="Generate cutting plan"
            className="fixed right-6 bottom-6 z-20 inline-flex size-16 items-center justify-center rounded-full bg-brand-charcoal text-white shadow-lg hover:bg-brand-charcoal/90 disabled:opacity-60 print:hidden"
          >
            <HugeiconsIcon icon={PlayIcon} className={cn("size-7", pending && "animate-pulse")} />
          </button>
        </>
      )}
    </div>
      <aside aria-label="Cutting plan preview" className="min-w-0 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:self-start xl:overflow-y-auto [scrollbar-width:thin]">
        <PlanPreview workNumber={workNumber} data={preview} stale={dirty} />
      </aside>

      <AlertDialog open={notice !== null} onOpenChange={(open) => !open && setNotice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{notice?.title}</AlertDialogTitle>
            <AlertDialogDescription render={<div />}>{notice?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {notice?.showPlan && (
              <Link href={`/admin/jobs/${workNumber}/plan`} className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium underline-offset-4 hover:underline">
                Open full plan
              </Link>
            )}
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function resultNotice(s: PlanSummary): { title: string; body: ReactNode; showPlan: boolean } {
  const usage = `${s.sheets} sheet${s.sheets === 1 ? "" : "s"}, ${(s.utilization * 100).toFixed(0)}% of the board used.`;
  if (s.unplaced.length === 0) return { title: "Cutting plan ready", body: `All ${s.requested} panels placed on ${usage}`, showPlan: true };
  return {
    title: `${s.requested - s.placed} panel${s.requested - s.placed === 1 ? "" : "s"} could not be placed`,
    body: (
      <span className="block space-y-2">
        <span className="block">
          {s.placed} of {s.requested} panels placed on {usage}
        </span>
        <span className="block space-y-1">
          {s.unplaced.map((u) => (
            <span key={`${u.label}|${u.reason}`} className="block">
              <span className="font-medium text-foreground">
                {u.label} ×{u.copies}
              </span>
              : {u.reason}
            </span>
          ))}
        </span>
        <span className="block">Fix these before the cutlist can be approved.</span>
      </span>
    ),
    showPlan: true,
  };
}

function Section({ icon, title, summary, children }: { icon: typeof SquareIcon; title: string; summary?: string; children: ReactNode }) {
  return (
    <details open className="group overflow-hidden rounded-lg bg-card">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 bg-muted px-4 [&::-webkit-details-marker]:hidden">
        <HugeiconsIcon icon={icon} className="size-5 text-brand-slate" />
        <span className="font-medium">{title}</span>
        {summary && <span className="text-sm text-muted-foreground">{summary}</span>}
        <HugeiconsIcon icon={ArrowDown01Icon} className="ml-auto size-5 text-brand-slate transition-transform group-open:rotate-180" />
      </summary>
      <div className="p-3 sm:p-4">{children}</div>
    </details>
  );
}

/** Length, width, quantity and label share one grid so the columns line up under the header. */
const FIRST_LINE = "grid grid-cols-[repeat(3,minmax(0,5.5rem))_minmax(0,1fr)] gap-1.5";

function RowHeader({ labels }: { labels: string[] }) {
  return (
    <div className={cn(FIRST_LINE, "mb-1 px-2 text-xs font-medium text-muted-foreground")} aria-hidden>
      {labels.map((l) => (
        <span key={l}>{l}</span>
      ))}
    </div>
  );
}

function EntryRow({ error, children }: { error?: string; children: ReactNode }) {
  return (
    <li className={cn("space-y-1.5 rounded-md p-2 odd:bg-muted/50", error && "bg-destructive/5 odd:bg-destructive/5")}>
      {children}
      {error && <p className="px-1 text-xs text-destructive">{error}</p>}
    </li>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive">
      <HugeiconsIcon icon={Delete02Icon} className="size-5" />
    </button>
  );
}

function ToggleOption({ label, hint, checked, disabled, onChange }: { label: string; hint: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-muted-foreground">{hint}</span>
      </span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden className="relative h-7 w-12 shrink-0 rounded-full bg-border transition-colors peer-checked:bg-brand-charcoal peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  );
}

function NumberOption({ label, hint, value, disabled, onChange }: { label: string; hint: string; value: number; disabled?: boolean; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  return (
    <label className="flex items-center justify-between gap-4 py-3">
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-muted-foreground">{hint}</span>
      </span>
      <span className="flex items-center gap-2">
        <input
          inputMode="decimal"
          className={cn(cell, "w-20 text-right")}
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value.trim() !== "" && Number.isFinite(n) && n >= 0) onChange(n);
          }}
        />
        <span className="text-sm text-muted-foreground">mm</span>
      </span>
    </label>
  );
}
