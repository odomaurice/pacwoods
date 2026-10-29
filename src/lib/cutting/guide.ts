/**
 * Turns a sheet's recorded guillotine cuts into steps an operator can follow
 * at the saw.
 *
 * The engine records cuts in the order it placed panels, which jumps around
 * the board. Every cut splits one existing piece into two, so the cuts form a
 * tree, and any order that cuts a piece only after it exists is valid. The
 * guide walks that tree the way a workshop works: keep cutting strips off the
 * board until it is used up, then take each strip in turn and do the same.
 */
import type { Cut, PlanSheet, Rect } from "@/lib/cutting/types";

export type GuideResult =
  | { kind: "panel"; rect: Rect; partRef: string; copy: number; rotated: boolean }
  | { kind: "piece"; rect: Rect; nextStep: number }
  | { kind: "offcut"; rect: Rect };

export type GuideStep = {
  /** Stable id for progress: "<sheet index>:<engine cut order>". */
  key: string;
  /** 1-based position in the guide. */
  n: number;
  cut: Cut;
  source: Rect;
  /** The step that produced the piece being cut; null when it is the (trimmed) board. */
  sourceStep: number | null;
  /** "along": the saw runs parallel to the piece's longer side (a rip); "across": a crosscut. */
  direction: "along" | "across";
  /** Measure from this edge of the piece, as drawn (board's long side left to right). */
  measureFrom: "top" | "left";
  /** Distance from that edge to the cut, mm: the size of the piece next to the fence. */
  distance: number;
  /** Length of the saw line, mm. */
  lineLength: number;
  /** What the cut leaves: the measured piece first, then the rest. Kerf-only sides are omitted. */
  results: GuideResult[];
};

const key = (r: Rect) => `${r.x},${r.y},${r.w},${r.h}`;

/** Null when the plan predates recorded cut details (regenerate it). */
export function cuttingSteps(sheet: PlanSheet): GuideStep[] | null {
  if (!sheet.cuts.every((c) => c.source && c.pieces && c.axis && c.at !== undefined)) return null;

  const bySource = new Map(sheet.cuts.map((c) => [key(c.source!), c]));
  const produced = new Set(sheet.cuts.flatMap((c) => c.pieces!.filter((p): p is Rect => p !== null).map(key)));
  const roots = sheet.cuts.filter((c) => !produced.has(key(c.source!))).map((c) => c.source!);

  // Strips off the current piece first (following the remainder), then each strip.
  const ordered: Cut[] = [];
  const taken = new Set<Cut>();
  const walk = (start: Rect) => {
    const strips: Rect[] = [];
    let cur: Rect | null = start;
    while (cur) {
      const c = bySource.get(key(cur));
      if (!c || taken.has(c)) break;
      taken.add(c);
      ordered.push(c);
      strips.push(c.pieces![0]);
      cur = c.pieces![1];
    }
    for (const s of strips) walk(s);
  };
  for (const r of roots) walk(r);
  // Anything the walk missed (not expected) keeps the engine's own order, which is always valid.
  const sequence = ordered.length === sheet.cuts.length ? ordered : sheet.cuts;

  const stepOf = new Map<string, number>(); // piece -> the step that cuts it
  sequence.forEach((c, i) => stepOf.set(key(c.source!), i + 1));
  const madeBy = new Map<string, number>(); // piece -> the step that produced it
  sequence.forEach((c, i) => c.pieces!.forEach((p) => p && madeBy.set(key(p), i + 1)));
  const panelAt = new Map(sheet.placements.map((p) => [key(p), p]));

  return sequence.map((c, i) => {
    const s = c.source!;
    const horizontal = c.axis === "y"; // a line across the drawing at y = at
    const lineLength = horizontal ? s.w : s.h;
    const results: GuideResult[] = [];
    for (const p of c.pieces!) {
      if (!p) continue;
      const panel = panelAt.get(key(p));
      const next = stepOf.get(key(p));
      if (next) results.push({ kind: "piece", rect: p, nextStep: next });
      else if (panel) results.push({ kind: "panel", rect: p, partRef: panel.partRef, copy: panel.copy, rotated: panel.rotated });
      else results.push({ kind: "offcut", rect: p });
    }
    return {
      key: `${sheet.index}:${c.order}`,
      n: i + 1,
      cut: c,
      source: s,
      sourceStep: madeBy.get(key(s)) ?? null,
      direction: lineLength >= (horizontal ? s.h : s.w) ? "along" : "across",
      measureFrom: horizontal ? "top" : "left",
      distance: c.at!,
      lineLength,
      results,
    };
  });
}
