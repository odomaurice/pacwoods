import { describe, expect, it } from "vitest";
import { bandedSides, cutSize, edgingLength, optimise } from "@/lib/cutting/engine";
import type { CutOptions, Edges, PartInput, StockInput } from "@/lib/cutting/types";
import { validatePlan } from "@/lib/cutting/validate";

const noEdges: Edges = { length1: false, length2: false, width1: false, width2: false };
const opts = (o: Partial<CutOptions> = {}): CutOptions => ({
  kerf: 0,
  edgeTrim: 0,
  considerMaterial: false,
  considerGrain: false,
  deductEdgeBanding: false,
  edgeBandThickness: 1,
  singleSheet: false,
  ...o,
});
const part = (ref: string, length: number, width: number, quantity = 1, extra: Partial<PartInput> = {}): PartInput => ({
  ref,
  length,
  width,
  quantity,
  grain: "NONE",
  edges: noEdges,
  ...extra,
});
const sheet = (ref: string, length = 2440, width = 1220, quantity = 10, extra: Partial<StockInput> = {}): StockInput => ({
  ref,
  length,
  width,
  quantity,
  grained: false,
  ...extra,
});

function run(parts: PartInput[], stocks: StockInput[], o: CutOptions) {
  const plan = optimise(parts, stocks, o);
  expect(validatePlan(plan, parts, stocks, o)).toEqual([]);
  return plan;
}

describe("optimise", () => {
  it("packs four quarter-sheets onto one sheet", () => {
    const plan = run([part("A", 1200, 600, 4)], [sheet("S")], opts());
    expect(plan.totals.sheetsUsed).toBe(1);
    expect(plan.unplaced).toEqual([]);
  });

  it("keeps the kerf between parts", () => {
    const plan = run([part("A", 1218, 610, 4)], [sheet("S")], opts({ kerf: 4 }));
    // 1218 + 4 + 1218 = 2440 fits; 610 + 4 + 610 = 1224 > 1220 does not.
    expect(plan.totals.sheetsUsed).toBe(2);
  });

  it("subtracts the edge trim from every side", () => {
    const plan = run([part("A", 2440, 1220)], [sheet("S")], opts({ edgeTrim: 10 }));
    expect(plan.unplaced[0]?.reason).toBe("LARGER_THAN_ANY_SHEET");
  });

  it("explains parts larger than every sheet", () => {
    const plan = run([part("Big", 3000, 500)], [sheet("S")], opts());
    expect(plan.unplaced).toEqual([{ partRef: "Big", copy: 1, reason: "LARGER_THAN_ANY_SHEET" }]);
  });

  it("rotates a part to fit when grain allows", () => {
    const plan = run([part("Tall", 1000, 2000)], [sheet("S")], opts());
    expect(plan.sheets[0].placements[0].rotated).toBe(true);
  });

  it("refuses to rotate against the grain, and says so", () => {
    const parts = [part("Tall", 1000, 2000, 1, { grain: "ALONG_LENGTH" })];
    const plan = run(parts, [sheet("S", 2440, 1220, 1, { grained: true })], opts({ considerGrain: true }));
    expect(plan.unplaced[0]?.reason).toBe("GRAIN_PREVENTS_ROTATION");
  });

  it("turns parts whose grain runs across them", () => {
    const parts = [part("Door", 700, 400, 1, { grain: "ALONG_WIDTH" })];
    const plan = run(parts, [sheet("S", 2440, 1220, 1, { grained: true })], opts({ considerGrain: true }));
    expect(plan.sheets[0].placements[0].rotated).toBe(true);
  });

  it("matches materials only when asked to", () => {
    const parts = [part("Oak", 500, 500, 1, { materialKey: "oak" })];
    const stocks = [sheet("MDF", 2440, 1220, 1, { materialKey: "mdf" })];
    expect(run(parts, stocks, opts({ considerMaterial: true })).unplaced[0]?.reason).toBe("NO_COMPATIBLE_STOCK");
    expect(run(parts, stocks, opts()).unplaced).toEqual([]);
  });

  it("reports stock running out", () => {
    const plan = run([part("A", 2000, 1000, 3)], [sheet("S", 2440, 1220, 2)], opts());
    expect(plan.totals.sheetsUsed).toBe(2);
    expect(plan.unplaced).toEqual([{ partRef: "A", copy: 3, reason: "STOCK_EXHAUSTED" }]);
  });

  it("honours the one-sheet limit", () => {
    const plan = run([part("A", 2000, 1000, 2)], [sheet("S")], opts({ singleSheet: true }));
    expect(plan.totals.sheetsUsed).toBe(1);
    expect(plan.unplaced[0]?.reason).toBe("SINGLE_SHEET_LIMIT");
  });

  it("prefers the smaller sheet when it is enough", () => {
    const plan = run([part("A", 500, 500)], [sheet("Big", 3050, 1525), sheet("Small", 1220, 610)], opts());
    expect(plan.sheets[0].stockRef).toBe("Small");
  });

  it("records two guillotine cuts at most per placement, numbered in order", () => {
    const plan = run([part("A", 600, 400, 6)], [sheet("S")], opts({ kerf: 4 }));
    const cuts = plan.sheets[0].cuts;
    expect(cuts.length).toBeLessThanOrEqual(12);
    expect(cuts.map((c) => c.order)).toEqual(cuts.map((_, i) => i + 1));
    for (const c of cuts) expect(c.x1 === c.x2 || c.y1 === c.y2).toBe(true);
  });

  it("reports totals and a lower bound", () => {
    const plan = run([part("A", 1200, 600, 5)], [sheet("S")], opts());
    expect(plan.totals.partsRequested).toBe(5);
    expect(plan.totals.sheetLowerBound).toBe(2);
    expect(plan.totals.sheetsUsed).toBeGreaterThanOrEqual(plan.totals.sheetLowerBound);
    expect(plan.totals.wasteArea).toBe(plan.totals.sheetArea - 5 * 1200 * 600);
  });
});

describe("edge banding", () => {
  const edges: Edges = { length1: true, length2: true, width1: true, width2: false };

  it("counts sides and length", () => {
    expect(bandedSides(edges)).toBe(3);
    expect(edgingLength([part("A", 1000, 500, 2, { edges })])).toBe(2 * (1000 * 2 + 500));
  });

  it("deducts band thickness from the cut size only when enabled", () => {
    const p = part("A", 1000, 500, 1, { edges });
    expect(cutSize(p, opts())).toEqual({ l: 1000, w: 500 });
    expect(cutSize(p, opts({ deductEdgeBanding: true, edgeBandThickness: 2 }))).toEqual({ l: 998, w: 496 });
  });
});

describe("random layouts always validate", () => {
  // Small deterministic PRNG so failures are reproducible.
  function rng(seed: number) {
    return () => {
      seed = (seed * 1664525 + 1013904223) % 2 ** 32;
      return seed / 2 ** 32;
    };
  }

  it("300 random cutlists produce valid plans", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = rng(seed);
      const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
      const materials = ["mdf", "ply"];
      const parts = Array.from({ length: int(1, 8) }, (_, i) =>
        part(`P${i}`, int(50, 2600), int(50, 1300), int(1, 6), {
          materialKey: materials[int(0, 1)],
          grain: (["NONE", "ALONG_LENGTH", "ALONG_WIDTH"] as const)[int(0, 2)],
        }),
      );
      const stocks = [
        sheet("S1", 2440, 1220, int(1, 6), { materialKey: "mdf", grained: r() < 0.5 }),
        sheet("S2", int(1000, 3050), int(600, 1525), int(0, 4), { materialKey: "ply", grained: r() < 0.5 }),
      ];
      const o = opts({
        kerf: int(0, 5),
        edgeTrim: int(0, 15),
        considerGrain: r() < 0.5,
        considerMaterial: r() < 0.5,
        singleSheet: r() < 0.1,
      });
      const plan = optimise(parts, stocks, o);
      const errors = validatePlan(plan, parts, stocks, o);
      if (errors.length) throw new Error(`seed ${seed}: ${errors.join("; ")}`);
    }
  });
});

describe("leftover is kept together", () => {
  const empty = (r: { x: number; y: number; w: number; h: number }, ps: Array<{ x: number; y: number; w: number; h: number }>) =>
    !ps.some((p) => p.x < r.x + r.w && r.x < p.x + p.w && p.y < r.y + r.h && r.y < p.y + p.h);

  it("leaves one offcut when the panels fill the board's full width", () => {
    const plan = run([part("Side", 600, 1220, 3)], [sheet("S")], opts({ kerf: 0, edgeTrim: 0 }));
    expect(plan.sheets[0].offcuts).toEqual([{ x: 1800, y: 0, w: 640, h: 1220 }]);
  });

  it("never cuts inside leftover, and offcuts never overlap panels", () => {
    const plan = run([part("A", 700, 500, 3), part("B", 300, 300, 2)], [sheet("S")], opts({ kerf: 4, edgeTrim: 10 }));
    for (const s of plan.sheets) {
      for (const c of s.cuts) expect(empty(c.source!, s.placements)).toBe(false);
      for (const o of s.offcuts) expect(empty(o, s.placements)).toBe(true);
    }
  });

  it("prefers the layout with the leftover in fewer, larger pieces", () => {
    const plan = run([part("Door", 716, 396, 4), part("Shelf", 764, 540, 2)], [sheet("S")], opts({ kerf: 4, edgeTrim: 10 }));
    const s = plan.sheets[0];
    const total = s.offcuts.reduce((n, o) => n + o.w * o.h, 0);
    // Most of the leftover is one usable piece, not scraps spread over the board.
    expect(s.offcuts[0].w * s.offcuts[0].h).toBeGreaterThan(total * 0.6);
  });
});
