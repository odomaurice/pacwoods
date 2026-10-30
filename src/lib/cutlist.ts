/**
 * The cutlist as entered and stored, its validation, and the mapping to the
 * cutting engine. Shared by the editor (browser) and the server.
 */
import { z } from "zod";
import { LENGTH_UNITS } from "@/lib/units";
import { bandedSides } from "@/lib/cutting/engine";
import type { CutOptions, Edges, PartInput, PlanTotals, StockInput } from "@/lib/cutting/types";

export const PART_GRAINS = ["NONE", "ALONG_LENGTH", "ALONG_WIDTH"] as const;

export const GRAIN_LABELS: Record<(typeof PART_GRAINS)[number], string> = {
  NONE: "Any direction",
  ALONG_LENGTH: "Along length",
  ALONG_WIDTH: "Along width",
};

const mm = (label: string, max: number) =>
  z.number({ error: `${label}: enter a number.` }).positive(`${label} must be greater than 0.`).max(max, `${label}: at most ${max} mm.`);
const qty = z.number({ error: "Qty: enter a number." }).int("Qty must be a whole number.").min(1, "Qty must be at least 1.").max(999);

const edgesSchema = z.object({
  length1: z.boolean(),
  length2: z.boolean(),
  width1: z.boolean(),
  width2: z.boolean(),
});

export const cutlistPartSchema = z.object({
  ref: z.string().min(1).max(40),
  label: z.string().trim().max(60).optional(),
  length: mm("Length", 10000),
  width: mm("Width", 10000),
  quantity: qty,
  materialId: z.string().max(40).optional(),
  grain: z.enum(PART_GRAINS),
  edges: edgesSchema,
  /** What the CNC does to this panel (holes, grooves, routing); does not change the layout. */
  machining: z.string().trim().max(300).optional(),
});

export const cutlistStockSchema = z.object({
  ref: z.string().min(1).max(40),
  label: z.string().trim().max(60).optional(),
  length: mm("Length", 10000),
  width: mm("Width", 10000),
  quantity: qty,
  materialId: z.string().max(40).optional(),
  grained: z.boolean(),
});

export const cutlistOptionsSchema = z.object({
  kerf: z.number().min(0).max(10),
  edgeTrim: z.number().min(0).max(50),
  labelsOnPanels: z.boolean(),
  singleSheet: z.boolean(),
  considerMaterial: z.boolean(),
  considerGrain: z.boolean(),
  deductEdgeBanding: z.boolean(),
  edgeBandThickness: z.number().min(0).max(5),
  /** The unit sizes are typed in; stored sizes are always millimetres. */
  unit: z.enum(LENGTH_UNITS).optional(),
});

export const cutlistSchema = z
  .object({
    parts: z.array(cutlistPartSchema).min(1, "Add at least one panel.").max(500),
    stockSheets: z.array(cutlistStockSchema).min(1, "Add at least one stock sheet.").max(50),
    options: cutlistOptionsSchema,
  })
  .superRefine((v, ctx) => {
    const refs = new Set<string>();
    for (const r of [...v.parts, ...v.stockSheets]) {
      if (refs.has(r.ref)) ctx.addIssue({ code: "custom", message: `Duplicate row reference ${r.ref}.` });
      refs.add(r.ref);
    }
    if (v.options.considerMaterial) {
      if (v.parts.some((p) => !p.materialId) || v.stockSheets.some((s) => !s.materialId)) {
        ctx.addIssue({ code: "custom", message: "With “Consider material” on, every panel and sheet needs a material." });
      }
    }
    if (v.options.deductEdgeBanding) {
      const t = v.options.edgeBandThickness;
      for (const p of v.parts) {
        if (p.length - 2 * t <= 0 || p.width - 2 * t <= 0) {
          ctx.addIssue({ code: "custom", message: `Panel ${p.label || p.ref} is too small for the edge-band deduction.` });
        }
      }
    }
  });

export type CutlistInput = z.infer<typeof cutlistSchema>;
export type CutlistPart = z.infer<typeof cutlistPartSchema>;
export type CutlistStock = z.infer<typeof cutlistStockSchema>;
export type CutlistOptions = z.infer<typeof cutlistOptionsSchema>;

/** Conventional workshop defaults; every one can be changed per job. */
export const DEFAULT_OPTIONS: CutlistOptions = {
  kerf: 4,
  edgeTrim: 0,
  labelsOnPanels: true,
  singleSheet: false,
  considerMaterial: false,
  considerGrain: false,
  deductEdgeBanding: false,
  edgeBandThickness: 1,
  unit: "mm",
};

export const NO_EDGES: Edges = { length1: false, length2: false, width1: false, width2: false };

export function toEngine(input: CutlistInput): { parts: PartInput[]; stocks: StockInput[]; options: CutOptions } {
  return {
    parts: input.parts.map((p) => ({
      ref: p.ref,
      label: p.label,
      length: p.length,
      width: p.width,
      quantity: p.quantity,
      materialKey: p.materialId,
      grain: p.grain,
      edges: p.edges,
    })),
    stocks: input.stockSheets.map((s) => ({
      ref: s.ref,
      label: s.label,
      length: s.length,
      width: s.width,
      quantity: s.quantity,
      materialKey: s.materialId,
      grained: s.grained,
    })),
    options: {
      kerf: input.options.kerf,
      edgeTrim: input.options.edgeTrim,
      considerMaterial: input.options.considerMaterial,
      considerGrain: input.options.considerGrain,
      deductEdgeBanding: input.options.deductEdgeBanding,
      edgeBandThickness: input.options.edgeBandThickness,
      singleSheet: input.options.singleSheet,
    },
  };
}

/** "3 sides: both long, one short" style summary for cards and tables. */
export function describeEdges(edges: Edges): string {
  const n = bandedSides(edges);
  if (n === 0) return "None";
  if (n === 4) return "All 4 sides";
  const long = Number(edges.length1) + Number(edges.length2);
  const short = Number(edges.width1) + Number(edges.width2);
  const parts = [long && `${long} long`, short && `${short} short`].filter(Boolean).join(", ");
  return `${n} side${n === 1 ? "" : "s"} (${parts})`;
}

/**
 * Time assumptions behind the estimates. Conventional starting values for a
 * panel saw and an edgebander; replace with the workshop's own figures.
 */
export const ESTIMATE_ASSUMPTIONS = {
  sheetHandlingMin: 3,
  secondsPerCut: 40,
  edgingMetresPerMin: 8,
  secondsPerBandedEdge: 20,
};

export type Estimate = { cuttingMin: number; edgingMin: number; totalMin: number };

/** Estimated machine time. Labelled as an estimate everywhere it is shown. */
export function estimateMinutes(
  totals: Pick<PlanTotals, "sheetsUsed" | "cutCount" | "edgingLengthMm">,
  input: Pick<CutlistInput, "parts">,
  operations: { cutting: boolean; edging: boolean },
  a = ESTIMATE_ASSUMPTIONS,
): Estimate {
  const cuttingMin = operations.cutting ? totals.sheetsUsed * a.sheetHandlingMin + (totals.cutCount * a.secondsPerCut) / 60 : 0;
  const bandedEdges = input.parts.reduce((n, p) => n + bandedSides(p.edges) * p.quantity, 0);
  const edgingMin = operations.edging
    ? totals.edgingLengthMm / 1000 / a.edgingMetresPerMin + (bandedEdges * a.secondsPerBandedEdge) / 60
    : 0;
  return { cuttingMin: Math.ceil(cuttingMin), edgingMin: Math.ceil(edgingMin), totalMin: Math.ceil(cuttingMin + edgingMin) };
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Drops stored material snapshots, leaving exactly the editable fields. */
export function pickPart(p: CutlistPart): CutlistPart {
  return { ref: p.ref, label: p.label, length: p.length, width: p.width, quantity: p.quantity, materialId: p.materialId, grain: p.grain, edges: p.edges, machining: p.machining };
}
export function pickStock(s: CutlistStock): CutlistStock {
  return { ref: s.ref, label: s.label, length: s.length, width: s.width, quantity: s.quantity, materialId: s.materialId, grained: s.grained };
}
