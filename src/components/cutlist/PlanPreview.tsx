"use client";

import Link from "next/link";
import PlanDrawing, { type DrawPart } from "@/components/cutlist/PlanDrawing";
import type { PlanSheet, PlanTotals } from "@/lib/cutting/types";
import { groupSheets } from "@/lib/plan-view";
import { cn } from "@/lib/utils";

export type PreviewData = {
  sheets: PlanSheet[];
  totals: PlanTotals;
  unplaced: number;
  parts: DrawPart[];
  stockLabels: Record<string, string>;
  /** False when the cutlist changed after this plan was generated. */
  current: boolean;
};

/** A small, always-visible version of the cutting plan beside the cutlist. */
export default function PlanPreview({ workNumber, data, stale }: { workNumber: string; data: PreviewData | null; stale: boolean }) {
  if (!data) {
    return (
      <div className="rounded-lg bg-card p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">No cutting plan yet</p>
        <p className="mt-1">Enter panels and stock sheets, then press ▶ to see the layout here.</p>
      </div>
    );
  }
  const parts = new Map(data.parts.map((p) => [p.ref, p]));
  const outOfDate = stale || !data.current;
  return (
    <div className="space-y-3 rounded-lg bg-card p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-semibold">Cutting plan</h2>
        <span className="text-sm text-muted-foreground">
          {data.totals.sheetsUsed} sheet{data.totals.sheetsUsed === 1 ? "" : "s"} · {(data.totals.utilization * 100).toFixed(0)}% used
        </span>
        <Link href={`/admin/jobs/${workNumber}/plan`} className="ml-auto text-sm font-medium underline-offset-4 hover:underline">
          Full plan →
        </Link>
      </div>
      {outOfDate && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">The cutlist has changed since this plan. Press ▶ to update it.</p>}
      {data.unplaced > 0 && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {data.unplaced} panel{data.unplaced === 1 ? "" : "s"} could not be placed.
        </p>
      )}
      <ul className={cn("grid gap-3", outOfDate && "opacity-60")}>
        {groupSheets(data.sheets).map((g) => (
          <li key={g.first}>
            <p className="mb-1 text-xs text-muted-foreground">
              {g.sheets.length > 1 ? `Sheets ${g.sheets.map((s) => s.index).join(", ")}` : `Sheet ${g.first}`} · {(g.sheets[0].utilization * 100).toFixed(0)}% used
            </p>
            <PlanDrawing
              sheet={g.sheets[0]}
              parts={parts}
              count={g.sheets.length}
              stockLabel={data.stockLabels[g.sheets[0].stockRef] ?? ""}
              portrait={false}
              fontScale={0.8}
              rulers={false}
              showCuts={false}
              showLabels={false}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
