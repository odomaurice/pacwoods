"use client";

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ListViewIcon, RotateClockwiseIcon, RulerIcon, TextFontIcon, ZoomInAreaIcon, ZoomOutAreaIcon } from "@hugeicons/core-free-icons";
import PlanDrawing, { type DrawPart } from "@/components/cutlist/PlanDrawing";
import type { PlanSheet } from "@/lib/cutting/types";
import { cutLength, cutRows, groupSheets } from "@/lib/plan-view";
import { cn } from "@/lib/utils";

const ZOOMS = [1, 1.5, 2, 3];
const FONTS = [0.7, 0.85, 1, 1.25, 1.5];

// Narrow screens default to portrait drawings.
const NARROW = "(max-width: 640px)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(NARROW);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

export default function PlanViewer({
  sheets,
  parts,
  stockLabels,
  showLabels,
  compact = false,
}: {
  sheets: PlanSheet[];
  parts: DrawPart[];
  stockLabels: Record<string, string>;
  showLabels: boolean;
  /** Smaller drawings, two sheets to a row on wide screens. */
  compact?: boolean;
}) {
  const narrow = useSyncExternalStore(subscribe, () => window.matchMedia(NARROW).matches, () => false);
  const [orientation, setOrientation] = useState<"auto" | "landscape" | "portrait">("auto");
  const portrait = orientation === "auto" ? narrow : orientation === "portrait";
  const [zoom, setZoom] = useState(0);
  const [font, setFont] = useState(2);
  const [rulers, setRulers] = useState(true);
  const [cuts, setCuts] = useState(false);

  const partMap = useMemo(() => new Map(parts.map((p) => [p.ref, p])), [parts]);
  const groups = useMemo(() => groupSheets(sheets), [sheets]);
  const label = (ref: string) => partMap.get(ref)?.label ?? ref;

  return (
    <div className="space-y-6">
      <div role="toolbar" aria-label="Drawing controls" className="sticky top-0 z-10 flex flex-wrap items-center gap-1 rounded-lg bg-card p-1.5 lg:top-2 print:hidden">
        <Tool label="Zoom out" disabled={zoom === 0} onClick={() => setZoom((z) => z - 1)} icon={ZoomOutAreaIcon} />
        <span className="w-12 text-center text-sm tabular-nums" aria-live="polite">
          {zoom === 0 ? "Fit" : `${ZOOMS[zoom]}×`}
        </span>
        <Tool label="Zoom in" disabled={zoom === ZOOMS.length - 1} onClick={() => setZoom((z) => z + 1)} icon={ZoomInAreaIcon} />
        <Divider />
        <Tool label="Smaller text" disabled={font === 0} onClick={() => setFont((f) => f - 1)} icon={TextFontIcon} small />
        <Tool label="Larger text" disabled={font === FONTS.length - 1} onClick={() => setFont((f) => f + 1)} icon={TextFontIcon} />
        <Divider />
        <Tool label="Rulers" pressed={rulers} onClick={() => setRulers((r) => !r)} icon={RulerIcon} />
        <Tool label="Cut sequence" pressed={cuts} onClick={() => setCuts((c) => !c)} icon={ListViewIcon} />
        <Tool label={portrait ? "Show landscape" : "Show portrait"} pressed={portrait} onClick={() => setOrientation(portrait ? "landscape" : "portrait")} icon={RotateClockwiseIcon} />
      </div>

      <div className={cn("space-y-6", compact && "grid gap-4 space-y-0 lg:grid-cols-2")}>
      {groups.map((g) => {
        const sheet = g.sheets[0];
        const rows = cutRows(sheet, label);
        const n = g.sheets.length;
        return (
          <section key={g.first} className="rounded-lg bg-card p-3 sm:p-5 break-inside-avoid">
            <h2 className="mb-3 font-semibold">
              {n > 1 ? `Sheets ${g.sheets.map((s) => s.index).join(", ")}` : `Sheet ${sheet.index}`} of {sheets.length}
              <span className="font-normal text-muted-foreground"> · {stockLabels[sheet.stockRef]}</span>
            </h2>
            <div className="overflow-auto">
              <div style={{ width: `${ZOOMS[zoom] * 100}%` }} className={cn(portrait && zoom === 0 && "mx-auto max-w-md")}>
                <PlanDrawing
                  sheet={sheet}
                  parts={partMap}
                  count={n}
                  stockLabel={stockLabels[sheet.stockRef] ?? ""}
                  portrait={portrait}
                  fontScale={FONTS[font]}
                  rulers={rulers}
                  showCuts={cuts}
                  showLabels={showLabels}
                />
              </div>
            </div>

            <Collapsible title="Sheet statistics">
              <Stats
                rows={[
                  ["Stock sheet", `${sheet.length}×${sheet.width}`],
                  ["Qty", String(n)],
                  ["Used area", `${sheet.usedArea.toLocaleString("en-GB")} · ${(sheet.utilization * 100).toFixed(0)}%`],
                  ["Wasted area", `${(sheet.length * sheet.width - sheet.usedArea).toLocaleString("en-GB")} · ${((1 - sheet.utilization) * 100).toFixed(0)}%`],
                  ["Cuts", String(sheet.cuts.length)],
                  ["Cut length", cutLength(sheet).toLocaleString("en-GB")],
                  ["Panels", String(sheet.placements.length)],
                ]}
              />
            </Collapsible>

            <Collapsible title="Cuts">
              {rows ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground">
                      <tr className="[&>th]:px-2 [&>th]:py-1.5 [&>th]:font-medium">
                        <th>#</th>
                        <th>Panel</th>
                        <th>Cut</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.order} className="odd:bg-muted/60 [&>td]:px-2 [&>td]:py-1.5">
                          <td className="tabular-nums">{r.order}</td>
                          <td className="tabular-nums">{r.piece}</td>
                          <td className="font-mono">{r.cut}</td>
                          <td>
                            {r.results[0]} <span className="text-muted-foreground">\</span>{" "}
                            <span className={r.results[1].startsWith("surplus") ? "text-muted-foreground" : ""}>{r.results[1]}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Positions are measured from the top-left of the piece being cut, as drawn in landscape. “–” means that piece is cut again, or nothing but kerf is left.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">This plan was made before cut details were recorded. Generate it again to see the cut list.</p>
              )}
            </Collapsible>
          </section>
        );
      })}
      </div>
    </div>
  );
}

function Tool({
  label,
  icon,
  onClick,
  disabled,
  pressed,
  small,
}: {
  label: string;
  icon: typeof RulerIcon;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-md text-brand-slate hover:bg-muted disabled:opacity-40",
        pressed && "bg-muted text-brand-charcoal",
      )}
    >
      <HugeiconsIcon icon={icon} className={small ? "size-4" : "size-5"} />
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-6 w-px bg-border" />;
}

export function Collapsible({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group mt-4 overflow-hidden rounded-lg bg-muted/50">
      <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 font-medium [&::-webkit-details-marker]:hidden">
        {title}
        <HugeiconsIcon icon={ArrowDown01Icon} className="ml-auto size-5 text-brand-slate transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

export function Stats({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="divide-y divide-border text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 py-2">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-right font-medium tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
