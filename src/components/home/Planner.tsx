"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import PlanDrawing from "@/components/cutlist/PlanDrawing";
import { optimise } from "@/lib/cutting/engine";
import { PART_FILLS, groupSheets } from "@/lib/plan-view";

type Row = { id: number; length: string; width: string; qty: string };

const SHEETS = [
  { label: "2440 × 1220 mm (8 × 4 ft)", length: 2440, width: 1220 },
  { label: "2800 × 2070 mm", length: 2800, width: 2070 },
  { label: "3050 × 1220 mm", length: 3050, width: 1220 },
];

// Fits on one 2440 × 1220 sheet with about 93% of the board used.
const START: Row[] = [
  { id: 1, length: "800", width: "600", qty: "3" },
  { id: 2, length: "600", width: "400", qty: "4" },
  { id: 3, length: "400", width: "300", qty: "3" },
];

// Phones get the sheet drawn upright, so it fills the width.
const NARROW = "(max-width: 640px)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(NARROW);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

const field = "h-11 w-full rounded-md border border-white/15 bg-white/5 px-3 text-white tabular-nums outline-none placeholder:text-white/40 focus-visible:ring-3 focus-visible:ring-brand-gold/50";

/**
 * The real cutting engine, running in the visitor's browser: type sizes and
 * see how they fit. Nothing is saved or sent anywhere.
 */
export default function Planner() {
  const [rows, setRows] = useState<Row[]>(START);
  const [sheetIndex, setSheetIndex] = useState(0);
  const narrow = useSyncExternalStore(subscribe, () => window.matchMedia(NARROW).matches, () => false);
  const stock = SHEETS[sheetIndex];

  const result = useMemo(() => {
    const parts = rows
      .map((r, i) => ({ r, i, l: Number(r.length), w: Number(r.width), q: Math.floor(Number(r.qty)) }))
      .filter((x) => x.l > 0 && x.w > 0 && x.q > 0 && x.l <= 5000 && x.w <= 5000 && x.q <= 50)
      .map((x) => ({
        ref: `P${x.r.id}`,
        label: String.fromCharCode(65 + x.i),
        length: x.l,
        width: x.w,
        quantity: x.q,
        grain: "NONE" as const,
        edges: { length1: false, length2: false, width1: false, width2: false },
        fill: PART_FILLS[x.i % PART_FILLS.length],
      }));
    if (parts.length === 0) return null;
    const plan = optimise(parts, [{ ref: "S", length: stock.length, width: stock.width, quantity: 40, grained: false }], {
      kerf: 4,
      edgeTrim: 0,
      considerMaterial: false,
      considerGrain: false,
      deductEdgeBanding: false,
      edgeBandThickness: 1,
      singleSheet: false,
    });
    return { plan, draw: new Map(parts.map((p) => [p.ref, { ref: p.ref, label: p.label, fill: p.fill, edges: p.edges }])) };
  }, [rows, stock]);

  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const groups = result ? groupSheets(result.plan.sheets) : [];
  const first = groups[0];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_1fr_5rem_2.75rem] gap-2 text-xs font-medium tracking-wide text-white/60 uppercase">
          <span>Length mm</span>
          <span>Width mm</span>
          <span>Qty</span>
          <span />
        </div>
        {rows.map((r, i) => (
          <div key={r.id} className="relative grid grid-cols-[1fr_1fr_5rem_2.75rem] gap-2">
            <span aria-hidden className="absolute top-1/2 -left-6 hidden -translate-y-1/2 text-sm font-semibold text-brand-gold sm:block">
              {String.fromCharCode(65 + i)}
            </span>
            <input aria-label="Length in millimetres" inputMode="numeric" className={field} value={r.length} onChange={(e) => update(r.id, { length: e.target.value })} />
            <input aria-label="Width in millimetres" inputMode="numeric" className={field} value={r.width} onChange={(e) => update(r.id, { width: e.target.value })} />
            <input aria-label="Quantity" inputMode="numeric" className={field} value={r.qty} onChange={(e) => update(r.id, { qty: e.target.value })} />
            <button
              type="button"
              aria-label="Remove this row"
              disabled={rows.length === 1}
              onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
              className="inline-flex size-11 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30"
            >
              <HugeiconsIcon icon={Delete02Icon} className="size-5" />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={rows.length >= 6}
            onClick={() => setRows((rs) => [...rs, { id: Math.max(0, ...rs.map((x) => x.id)) + 1, length: "", width: "", qty: "1" }])}
            className="inline-flex h-11 items-center gap-2 rounded-md bg-white/10 px-4 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-40"
          >
            <HugeiconsIcon icon={Add01Icon} className="size-4" />
            Add a panel
          </button>
          <label className="flex items-center gap-2 text-sm text-white/80">
            Sheet
            <select value={sheetIndex} onChange={(e) => setSheetIndex(Number(e.target.value))} className="h-11 rounded-md border border-white/15 bg-brand-charcoal px-3 text-white">
              {SHEETS.map((s, i) => (
                <option key={s.label} value={i}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-sm text-white/60">This runs on your device and saves nothing. For your real job we also plan grain, edge banding and your exact boards.</p>
      </div>

      <div className={`rounded-xl bg-white p-3 text-brand-charcoal sm:p-5 ${narrow ? "mx-auto w-full max-w-sm" : ""}`}>
        {result && first ? (
          <>
            <dl className="mb-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted p-2">
                <dt className="text-xs text-muted-foreground">Sheets</dt>
                <dd className="text-2xl font-semibold tabular-nums">{result.plan.totals.sheetsUsed}</dd>
              </div>
              <div className="rounded-lg bg-muted p-2">
                <dt className="text-xs text-muted-foreground">Panels</dt>
                <dd className="text-2xl font-semibold tabular-nums">
                  {result.plan.totals.partsPlaced}
                  {result.plan.unplaced.length > 0 && <span className="text-base text-destructive"> / {result.plan.totals.partsRequested}</span>}
                </dd>
              </div>
              <div className="rounded-lg bg-muted p-2">
                <dt className="text-xs text-muted-foreground">Board used</dt>
                <dd className="text-2xl font-semibold tabular-nums">{Math.round(result.plan.totals.utilization * 100)}%</dd>
              </div>
            </dl>
            <PlanDrawing
              sheet={first.sheets[0]}
              parts={result.draw}
              count={first.sheets.length}
              stockLabel={groups.length > 1 ? `Sheet 1 of ${result.plan.sheets.length}` : "Your sheet"}
              portrait={narrow}
              fontScale={narrow ? 1.3 : 1}
              rulers
              showCuts={false}
              showLabels
            />
            {result.plan.unplaced.length > 0 && <p className="mt-2 text-sm text-destructive">Some panels are larger than the sheet.</p>}
            {groups.length > 1 && <p className="mt-2 text-sm text-muted-foreground">Showing the first layout of {groups.length}.</p>}
          </>
        ) : (
          <p className="py-16 text-center text-muted-foreground">Enter a panel size to see the layout.</p>
        )}
      </div>
    </div>
  );
}
