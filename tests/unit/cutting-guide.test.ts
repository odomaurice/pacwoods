import { describe, expect, it } from "vitest";
import { optimise } from "@/lib/cutting/engine";
import { cuttingSteps } from "@/lib/cutting/guide";
import type { CutOptions, PartInput, PlanSheet, StockInput } from "@/lib/cutting/types";

const options = (o: Partial<CutOptions> = {}): CutOptions => ({
  kerf: 4,
  edgeTrim: 10,
  considerMaterial: false,
  considerGrain: false,
  deductEdgeBanding: false,
  edgeBandThickness: 1,
  singleSheet: false,
  ...o,
});
const edges = { length1: false, length2: false, width1: false, width2: false };
const part = (ref: string, length: number, width: number, quantity: number): PartInput => ({ ref, length, width, quantity, grain: "NONE", edges });
const stock: StockInput[] = [{ ref: "S", length: 2440, width: 1220, quantity: 50, grained: false }];

/** Every cut is on the board itself or on a piece an earlier step produced, and each cut appears once. */
function assertFollowable(sheet: PlanSheet) {
  const steps = cuttingSteps(sheet)!;
  expect(steps).toHaveLength(sheet.cuts.length);
  expect(new Set(steps.map((s) => s.key)).size).toBe(sheet.cuts.length);
  const k = (r: { x: number; y: number; w: number; h: number }) => `${r.x},${r.y},${r.w},${r.h}`;
  const available = new Set<string>();
  const produced = new Set(sheet.cuts.flatMap((c) => c.pieces!.filter(Boolean).map((p) => k(p!))));
  for (const s of steps) {
    if (s.sourceStep === null) expect(produced.has(k(s.source))).toBe(false);
    else expect(available.has(k(s.source))).toBe(true);
    expect(s.sourceStep === null || s.sourceStep < s.n).toBe(true);
    for (const p of s.cut.pieces!) if (p) available.add(k(p));
  }
  // Every panel comes off in exactly one step.
  const panels = steps.flatMap((s) => s.results.filter((r) => r.kind === "panel"));
  const loose = sheet.placements.filter((p) => !produced.has(k(p)));
  expect(panels.length + loose.length).toBe(sheet.placements.length);
  return steps;
}

describe("cutting guide", () => {
  it("cuts strips off the board first, then cuts each strip up", () => {
    const plan = optimise([part("Shelf", 600, 400, 6)], stock, options({ kerf: 0, edgeTrim: 0 }));
    const steps = assertFollowable(plan.sheets[0]);
    const same = (a?: object | null, b?: object | null) => JSON.stringify(a) === JSON.stringify(b);
    // Steps that cut a strip (the measured piece of an earlier cut) come only
    // after every cut on the board's remainder.
    const onStrip = (s: (typeof steps)[number]) => s.sourceStep !== null && same(steps[s.sourceStep - 1].cut.pieces![0], s.source);
    const firstStrip = steps.findIndex(onStrip);
    expect(firstStrip).toBeGreaterThanOrEqual(1);
    for (const s of steps.slice(1, firstStrip)) expect(same(steps[s.sourceStep! - 1].cut.pieces![1], s.source)).toBe(true);
    for (const s of steps.slice(firstStrip)) expect(onStrip(s) || same(steps[s.sourceStep! - 1].cut.pieces![1], s.source)).toBe(true);
  });

  it("says where to measure from and which way the saw runs", () => {
    const plan = optimise([part("Top", 2420, 600, 1)], stock, options({ kerf: 0, edgeTrim: 0 }));
    const [first] = cuttingSteps(plan.sheets[0])!;
    expect(first.sourceStep).toBeNull();
    expect(first.distance).toBeGreaterThan(0);
    expect(first.lineLength).toBe(first.measureFrom === "top" ? first.source.w : first.source.h);
    expect(["along", "across"]).toContain(first.direction);
  });

  it("returns null for plans made before cut details were recorded", () => {
    const plan = optimise([part("A", 600, 400, 2)], stock, options());
    const old = { ...plan.sheets[0], cuts: plan.sheets[0].cuts.map(({ order, x1, y1, x2, y2 }) => ({ order, x1, y1, x2, y2 })) };
    expect(cuttingSteps(old)).toBeNull();
  });

  it("gives a followable order for 200 random cutlists", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
    for (let run = 0; run < 200; run++) {
      const parts = Array.from({ length: int(1, 8) }, (_, i) => part(`P${i}`, int(50, 2400), int(50, 1200), int(1, 5)));
      const plan = optimise(parts, stock, options({ kerf: int(0, 5), edgeTrim: int(0, 15) }));
      for (const sheet of plan.sheets) assertFollowable(sheet);
    }
  });
});
