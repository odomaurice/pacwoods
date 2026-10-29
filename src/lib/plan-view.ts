/** Presentation helpers for a stored plan: grouping, the cuts table, colours. */
import { describeEdges } from "@/lib/cutlist";
import type { Cut, Edges, PlanSheet, Rect } from "@/lib/cutting/types";

/** Flat, distinct fills for panel types; dark text reads on all of them. */
export const PART_FILLS = ["#F3E6CF", "#DDE8F0", "#E9DDEB", "#DCEBDD", "#F2DCD6", "#E4E2F2", "#EFEBC9", "#D9ECEA", "#F1E0EC", "#E6E6E1"];

export type SheetGroup = { sheets: PlanSheet[]; first: number; last: number };

/** Identical layouts on the same stock are drawn once with "×N". */
export function groupSheets(sheets: PlanSheet[]): SheetGroup[] {
  const key = (s: PlanSheet) =>
    `${s.stockRef}|${s.placements.map((p) => `${p.partRef}:${p.x},${p.y},${p.w},${p.h},${p.rotated ? 1 : 0}`).join(";")}`;
  const groups = new Map<string, PlanSheet[]>();
  for (const s of sheets) groups.set(key(s), [...(groups.get(key(s)) ?? []), s]);
  return [...groups.values()].map((g) => ({ sheets: g, first: g[0].index, last: g[g.length - 1].index }));
}

const same = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

export type CutRow = { order: number; piece: string; cut: string; results: string[] };

/**
 * One row per saw cut: the piece being cut, where, and what comes off.
 * A result is a panel name, "surplus W×H" for a final offcut, or "–" when the
 * piece is cut again (or the side is only kerf).
 */
export function cutRows(sheet: PlanSheet, partLabel: (ref: string) => string): CutRow[] | null {
  if (!sheet.cuts.every((c: Cut) => c.source && c.pieces && c.axis && c.at !== undefined)) return null;
  const describe = (r: Rect | null) => {
    if (!r) return "–";
    const p = sheet.placements.find((q) => same(q, r));
    if (p) return partLabel(p.partRef);
    if (sheet.offcuts.some((o) => same(o, r))) return `surplus ${r.w}×${r.h}`;
    return "–";
  };
  return sheet.cuts.map((c) => ({
    order: c.order,
    piece: `${c.source!.w}×${c.source!.h}`,
    cut: `${c.axis}=${c.at}`,
    results: c.pieces!.map(describe),
  }));
}

export function cutLength(sheet: PlanSheet) {
  return sheet.cuts.reduce((n, c) => n + Math.abs(c.x2 - c.x1) + Math.abs(c.y2 - c.y1), 0);
}

/** Cutlist parts as the cutting guide shows them; the row number prefixes each panel code (3.2). */
export function guideParts(parts: Array<{ ref: string; label?: string | null; quantity: number; grain: string; edges: Edges }>) {
  return parts.map((p, i) => ({
    ref: p.ref,
    no: i + 1,
    label: p.label || `Part ${i + 1}`,
    fill: PART_FILLS[i % PART_FILLS.length],
    quantity: p.quantity,
    edges: describeEdges(p.edges),
    grain: p.grain !== "NONE",
  }));
}
