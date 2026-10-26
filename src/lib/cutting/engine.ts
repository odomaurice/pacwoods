/**
 * Guillotine cutting-stock heuristic.
 *
 * Every placement splits its free rectangle with two straight, edge-to-edge
 * cuts, so each layout can be produced on a panel saw in the recorded order.
 * Several orderings and split rules are tried and the best result kept. This
 * is a heuristic: good layouts, not a proven minimum. `sheetLowerBound` in
 * the totals shows how far from the theoretical floor a plan is.
 */
import type {
  CutOptions,
  Cut,
  PartInput,
  Placement,
  Plan,
  PlanSheet,
  Rect,
  StockInput,
  Unplaced,
  UnplacedReason,
} from "./types";

export const ENGINE_VERSION = "guillotine-1";

type Item = {
  partRef: string;
  copy: number;
  /** Cut size, before rotation. */
  l: number;
  w: number;
  materialKey?: string;
  grain: PartInput["grain"];
};

type OpenSheet = {
  stock: StockInput;
  free: Rect[];
  placements: Placement[];
  cuts: Cut[];
};

type SortKey = "area" | "longest" | "perimeter" | "width";
type FitRule = "shortSide" | "area";
type SplitRule = "shorterLeftover" | "longerLeftover";

/** Cut size after optional edge-band deduction. */
export function cutSize(part: PartInput, options: CutOptions) {
  if (!options.deductEdgeBanding) return { l: part.length, w: part.width };
  const t = options.edgeBandThickness;
  const e = part.edges;
  // Length-side edges (length1/2) run along the length, so they shrink the width.
  return {
    l: part.length - t * (Number(e.width1) + Number(e.width2)),
    w: part.width - t * (Number(e.length1) + Number(e.length2)),
  };
}

/**
 * Orientations a part may take on a given sheet. "false" keeps the part's
 * length along the sheet length; "true" rotates it 90°.
 */
export function allowedRotations(item: Pick<Item, "grain">, stock: StockInput, options: CutOptions): boolean[] {
  if (!options.considerGrain || item.grain === "NONE" || !stock.grained) return [false, true];
  return item.grain === "ALONG_LENGTH" ? [false] : [true];
}

function compatible(item: Item, stock: StockInput, options: CutOptions) {
  return !options.considerMaterial || (item.materialKey ?? "") === (stock.materialKey ?? "");
}

function usable(stock: StockInput, options: CutOptions) {
  return { w: stock.length - 2 * options.edgeTrim, h: stock.width - 2 * options.edgeTrim };
}

function score(rect: Rect, pw: number, ph: number, rule: FitRule) {
  const dw = rect.w - pw;
  const dh = rect.h - ph;
  return rule === "shortSide" ? Math.min(dw, dh) * 1e6 + Math.max(dw, dh) : (rect.w * rect.h - pw * ph) * 1e3 + Math.min(dw, dh);
}

/** Best free rectangle (and orientation) for the item on this sheet, or null. */
function findSpot(sheet: OpenSheet, item: Item, options: CutOptions, fit: FitRule) {
  let best: { index: number; rotated: boolean; pw: number; ph: number; s: number } | null = null;
  for (const rotated of allowedRotations(item, sheet.stock, options)) {
    const pw = rotated ? item.w : item.l;
    const ph = rotated ? item.l : item.w;
    sheet.free.forEach((rect, index) => {
      if (pw <= rect.w && ph <= rect.h) {
        const s = score(rect, pw, ph, fit);
        if (!best || s < best.s) best = { index, rotated, pw, ph, s };
      }
    });
  }
  return best as { index: number; rotated: boolean; pw: number; ph: number; s: number } | null;
}

function place(sheet: OpenSheet, item: Item, spot: NonNullable<ReturnType<typeof findSpot>>, split: SplitRule, kerf: number) {
  const r = sheet.free[spot.index];
  const { pw, ph } = spot;
  sheet.placements.push({ partRef: item.partRef, copy: item.copy, x: r.x, y: r.y, w: pw, h: ph, rotated: spot.rotated });
  sheet.free.splice(spot.index, 1);

  const restW = r.w - pw - kerf;
  const restH = r.h - ph - kerf;
  const horizontalFirst =
    split === "shorterLeftover" ? r.w - pw < r.h - ph : r.w - pw >= r.h - ph;

  const cut = (x1: number, y1: number, x2: number, y2: number) =>
    sheet.cuts.push({ x1, y1, x2, y2, order: 0 });

  if (horizontalFirst) {
    // Full-width cut under the part's row, then separate the part from the right.
    if (r.h - ph > 0) cut(r.x, r.y + ph, r.x + r.w, r.y + ph);
    if (r.w - pw > 0) cut(r.x + pw, r.y, r.x + pw, r.y + ph);
    if (restW > 0) sheet.free.push({ x: r.x + pw + kerf, y: r.y, w: restW, h: ph });
    if (restH > 0) sheet.free.push({ x: r.x, y: r.y + ph + kerf, w: r.w, h: restH });
  } else {
    // Full-height cut beside the part's column, then separate it from below.
    if (r.w - pw > 0) cut(r.x + pw, r.y, r.x + pw, r.y + r.h);
    if (r.h - ph > 0) cut(r.x, r.y + ph, r.x + pw, r.y + ph);
    if (restW > 0) sheet.free.push({ x: r.x + pw + kerf, y: r.y, w: restW, h: r.h });
    if (restH > 0) sheet.free.push({ x: r.x, y: r.y + ph + kerf, w: pw, h: restH });
  }
}

function sortItems(items: Item[], key: SortKey) {
  const k = (i: Item) =>
    key === "area" ? i.l * i.w : key === "longest" ? Math.max(i.l, i.w) : key === "perimeter" ? i.l + i.w : Math.min(i.l, i.w);
  return [...items].sort((a, b) => k(b) - k(a) || b.l * b.w - a.l * a.w || a.partRef.localeCompare(b.partRef) || a.copy - b.copy);
}

/** Why an item fits no available sheet. */
function reasonFor(item: Item, stocks: StockInput[], options: CutOptions, sheetsOpened: number): UnplacedReason {
  if (!(item.l > 0 && item.w > 0)) return "INVALID_SIZE";
  const matching = stocks.filter((s) => compatible(item, s, options));
  if (matching.length === 0) return "NO_COMPATIBLE_STOCK";
  const fitsWithGrain = matching.some((s) => {
    const u = usable(s, options);
    return allowedRotations(item, s, options).some((rot) => (rot ? item.w : item.l) <= u.w && (rot ? item.l : item.w) <= u.h);
  });
  if (!fitsWithGrain) {
    const fitsAnyWay = matching.some((s) => {
      const u = usable(s, options);
      return (item.l <= u.w && item.w <= u.h) || (item.w <= u.w && item.l <= u.h);
    });
    return fitsAnyWay ? "GRAIN_PREVENTS_ROTATION" : "LARGER_THAN_ANY_SHEET";
  }
  if (options.singleSheet && sheetsOpened >= 1) return "SINGLE_SHEET_LIMIT";
  return "STOCK_EXHAUSTED";
}

function runStrategy(items: Item[], stocks: StockInput[], options: CutOptions, sort: SortKey, fit: FitRule, split: SplitRule) {
  const sheets: OpenSheet[] = [];
  const unplaced: Unplaced[] = [];
  const remaining = new Map(stocks.map((s) => [s.ref, s.quantity]));

  for (const item of sortItems(items, sort)) {
    if (!(item.l > 0 && item.w > 0)) {
      unplaced.push({ partRef: item.partRef, copy: item.copy, reason: "INVALID_SIZE" });
      continue;
    }
    let done = false;
    // 1. An already-open sheet, best fit first.
    let best: { sheet: OpenSheet; spot: NonNullable<ReturnType<typeof findSpot>> } | null = null;
    for (const sheet of sheets) {
      if (!compatible(item, sheet.stock, options)) continue;
      const spot = findSpot(sheet, item, options, fit);
      if (spot && (!best || spot.s < best.spot.s)) best = { sheet, spot };
    }
    if (best) {
      place(best.sheet, item, best.spot, split, options.kerf);
      done = true;
    }
    // 2. Open the smallest available stock sheet that takes it.
    if (!done && !(options.singleSheet && sheets.length >= 1)) {
      const candidates = stocks
        .filter((s) => (remaining.get(s.ref) ?? 0) > 0 && compatible(item, s, options))
        .sort((a, b) => a.length * a.width - b.length * b.width);
      for (const stock of candidates) {
        const u = usable(stock, options);
        if (u.w <= 0 || u.h <= 0) continue;
        const sheet: OpenSheet = {
          stock,
          free: [{ x: options.edgeTrim, y: options.edgeTrim, w: u.w, h: u.h }],
          placements: [],
          cuts: [],
        };
        const spot = findSpot(sheet, item, options, fit);
        if (spot) {
          remaining.set(stock.ref, (remaining.get(stock.ref) ?? 0) - 1);
          sheets.push(sheet);
          place(sheet, item, spot, split, options.kerf);
          done = true;
          break;
        }
      }
    }
    if (!done) {
      unplaced.push({ partRef: item.partRef, copy: item.copy, reason: reasonFor(item, stocks, options, sheets.length) });
    }
  }
  return { sheets, unplaced };
}

export function expandItems(parts: PartInput[], options: CutOptions): Item[] {
  const items: Item[] = [];
  for (const part of parts) {
    const { l, w } = cutSize(part, options);
    for (let copy = 1; copy <= part.quantity; copy++) {
      items.push({ partRef: part.ref, copy, l, w, materialKey: part.materialKey, grain: part.grain });
    }
  }
  return items;
}

const SORTS: SortKey[] = ["area", "longest", "perimeter", "width"];
const FITS: FitRule[] = ["shortSide", "area"];
const SPLITS: SplitRule[] = ["shorterLeftover", "longerLeftover"];

export function optimise(parts: PartInput[], stocks: StockInput[], options: CutOptions): Plan {
  const items = expandItems(parts, options);
  let best: { result: ReturnType<typeof runStrategy>; name: string; key: number[] } | null = null;

  for (const sort of SORTS) {
    for (const fit of FITS) {
      for (const split of SPLITS) {
        const result = runStrategy(items, stocks, options, sort, fit, split);
        const sheetArea = result.sheets.reduce((a, s) => a + s.stock.length * s.stock.width, 0);
        // Most parts placed, then fewest sheets, then least sheet area, then
        // the emptiest last sheet (its offcut is the most useful).
        const last = result.sheets.at(-1);
        const lastUsed = last ? last.placements.reduce((a, p) => a + p.w * p.h, 0) : 0;
        const key = [result.unplaced.length, result.sheets.length, sheetArea, lastUsed];
        if (!best || compareKeys(key, best.key) < 0) {
          best = { result, name: `${sort}/${fit}/${split}`, key };
        }
      }
    }
  }
  return buildPlan(best!.result, best!.name, parts, stocks, options);
}

function compareKeys(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

function buildPlan(result: ReturnType<typeof runStrategy>, strategy: string, parts: PartInput[], stocks: StockInput[], options: CutOptions): Plan {
  const sheets: PlanSheet[] = result.sheets.map((s, i) => {
    const usedArea = s.placements.reduce((a, p) => a + p.w * p.h, 0);
    return {
      index: i + 1,
      stockRef: s.stock.ref,
      length: s.stock.length,
      width: s.stock.width,
      materialKey: s.stock.materialKey,
      placements: s.placements,
      cuts: s.cuts.map((c, order) => ({ ...c, order: order + 1 })),
      offcuts: [...s.free].sort((a, b) => b.w * b.h - a.w * a.h),
      usedArea,
      utilization: usedArea / (s.stock.length * s.stock.width),
    };
  });

  const partsRequested = parts.reduce((a, p) => a + p.quantity, 0);
  const requestedArea = parts.reduce((a, p) => {
    const { l, w } = cutSize(p, options);
    return a + l * w * p.quantity;
  }, 0);
  const sheetArea = sheets.reduce((a, s) => a + s.length * s.width, 0);
  const usedArea = sheets.reduce((a, s) => a + s.usedArea, 0);
  const largest = Math.max(0, ...stocks.map((s) => s.length * s.width));

  return {
    engineVersion: ENGINE_VERSION,
    strategy,
    sheets,
    unplaced: result.unplaced.sort((a, b) => a.partRef.localeCompare(b.partRef) || a.copy - b.copy),
    totals: {
      partsRequested,
      partsPlaced: partsRequested - result.unplaced.length,
      sheetsUsed: sheets.length,
      requestedArea,
      sheetArea,
      wasteArea: sheetArea - usedArea,
      utilization: sheetArea ? usedArea / sheetArea : 0,
      sheetLowerBound: largest ? Math.ceil(requestedArea / largest) : 0,
      edgingLengthMm: edgingLength(parts),
      cutCount: sheets.reduce((a, s) => a + s.cuts.length, 0),
    },
  };
}

/** Total banded edge length across all copies of all parts. */
export function edgingLength(parts: PartInput[]) {
  return parts.reduce((a, p) => {
    const e = p.edges;
    const perPart = (Number(e.length1) + Number(e.length2)) * p.length + (Number(e.width1) + Number(e.width2)) * p.width;
    return a + perPart * p.quantity;
  }, 0);
}

export function bandedSides(edges: PartInput["edges"]) {
  return Number(edges.length1) + Number(edges.length2) + Number(edges.width1) + Number(edges.width2);
}
