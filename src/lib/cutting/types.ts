/**
 * Cutting engine types. All dimensions are millimetres. "Length" is the
 * X axis of a sheet as drawn; sheet grain, when present, runs along it.
 */

/** Which way the grain must run on the finished part. */
export type PartGrain = "NONE" | "ALONG_LENGTH" | "ALONG_WIDTH";

/** Banded edges: the two long edges (length sides) and two short edges (width sides). */
export type Edges = { length1: boolean; length2: boolean; width1: boolean; width2: boolean };

export type PartInput = {
  ref: string;
  label?: string;
  length: number;
  width: number;
  quantity: number;
  materialKey?: string;
  grain: PartGrain;
  edges: Edges;
};

export type StockInput = {
  ref: string;
  label?: string;
  length: number;
  width: number;
  quantity: number;
  materialKey?: string;
  /** True when the sheet has grain along its length. */
  grained: boolean;
};

export type CutOptions = {
  kerf: number;
  /** Trimmed off every sheet edge before parts are placed. */
  edgeTrim: number;
  considerMaterial: boolean;
  considerGrain: boolean;
  /** Subtract edge-band thickness from the cut size of banded edges. */
  deductEdgeBanding: boolean;
  edgeBandThickness: number;
  /** Use at most one stock sheet in total. */
  singleSheet: boolean;
};

export type Placement = {
  partRef: string;
  /** 1-based copy number within the part's quantity. */
  copy: number;
  x: number;
  y: number;
  /** Placed size on the sheet (cut size, after any rotation). */
  w: number;
  h: number;
  rotated: boolean;
};

export type Cut = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  order: number;
  /** "y": a horizontal cut at y = at; "x": a vertical cut at x = at (both from the source's top-left). */
  axis?: "x" | "y";
  at?: number;
  /** The piece being cut, and the two pieces it leaves (null = only kerf). Absent in plans made before guillotine-2. */
  source?: Rect;
  pieces?: [Rect, Rect | null];
};

export type Rect = { x: number; y: number; w: number; h: number };

export type PlanSheet = {
  index: number;
  stockRef: string;
  length: number;
  width: number;
  materialKey?: string;
  placements: Placement[];
  cuts: Cut[];
  /** Leftover rectangles inside the trimmed area. */
  offcuts: Rect[];
  usedArea: number;
  utilization: number;
};

export type UnplacedReason =
  | "LARGER_THAN_ANY_SHEET"
  | "GRAIN_PREVENTS_ROTATION"
  | "NO_COMPATIBLE_STOCK"
  | "STOCK_EXHAUSTED"
  | "SINGLE_SHEET_LIMIT"
  | "INVALID_SIZE";

export type Unplaced = { partRef: string; copy: number; reason: UnplacedReason };

export type PlanTotals = {
  partsRequested: number;
  partsPlaced: number;
  sheetsUsed: number;
  requestedArea: number;
  sheetArea: number;
  wasteArea: number;
  utilization: number;
  /** Σ part area ÷ largest sheet area: no plan can use fewer sheets. */
  sheetLowerBound: number;
  edgingLengthMm: number;
  cutCount: number;
  /** Total length of all saw cuts, mm. */
  cutLength?: number;
};

export type Plan = {
  engineVersion: string;
  strategy: string;
  sheets: PlanSheet[];
  unplaced: Unplaced[];
  totals: PlanTotals;
};
