import { describe, expect, it } from "vitest";
import { optimise } from "@/lib/cutting/engine";
import type { CutOptions, PartInput, StockInput } from "@/lib/cutting/types";
import { cutRows, groupSheets } from "@/lib/plan-view";

const options: CutOptions = {
  kerf: 0,
  edgeTrim: 0,
  considerMaterial: false,
  considerGrain: false,
  deductEdgeBanding: false,
  edgeBandThickness: 1,
  singleSheet: false,
};
const edges = { length1: false, length2: false, width1: false, width2: false };
const part = (ref: string, length: number, width: number, quantity: number): PartInput => ({ ref, length, width, quantity, grain: "NONE", edges });
const stock: StockInput[] = [{ ref: "S", length: 2440, width: 1220, quantity: 20, grained: false }];

describe("groupSheets", () => {
  it("draws identical sheets once with a count", () => {
    const plan = optimise([part("Full", 2440, 1220, 3), part("Half", 1220, 1220, 1)], stock, options);
    const groups = groupSheets(plan.sheets);
    expect(groups.map((g) => g.sheets.length).sort()).toEqual([1, 3]);
  });
});

describe("cutRows", () => {
  it("describes each cut by piece, position and result", () => {
    const plan = optimise([part("A", 1220, 1220, 1)], stock, options);
    const rows = cutRows(plan.sheets[0], (ref) => (ref === "A" ? "Door" : ref));
    expect(rows).toEqual([{ order: 1, piece: "2440×1220", cut: "x=1220", results: ["Door", "surplus 1220×1220"] }]);
  });

  it("names every placed panel somewhere in the results", () => {
    const plan = optimise([part("A", 700, 400, 5), part("B", 500, 300, 3)], stock, { ...options, kerf: 4 });
    for (const sheet of plan.sheets) {
      const rows = cutRows(sheet, (ref) => ref)!;
      const named = rows.flatMap((r) => r.results).filter((x) => x === "A" || x === "B").length;
      const wholeSheet = sheet.placements.length === 1 && sheet.cuts.length === 0 ? 1 : 0;
      expect(named + wholeSheet).toBe(sheet.placements.length);
    }
  });

  it("returns null for plans saved before cut records existed", () => {
    const plan = optimise([part("A", 700, 400, 1)], stock, options);
    const old = { ...plan.sheets[0], cuts: plan.sheets[0].cuts.map(({ x1, y1, x2, y2, order }) => ({ x1, y1, x2, y2, order })) };
    expect(cutRows(old, (r) => r)).toBeNull();
  });
});
