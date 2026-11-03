/**
 * Guillotine cutting-stock heuristic.
 *
 * Every placement splits its free rectangle with two straight, edge-to-edge
 * cuts, so each layout can be produced on a panel saw in the recorded order.
 * Several orderings and split rules are tried and the best result kept: the
 * fewest sheets first, then the leftover kept together in as few, as large
 * pieces as possible. Cuts that would only divide leftover are not made. This
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

export const ENGINE_VERSION = "guillotine-4";

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

/** "given" keeps the order passed in (a seeded shuffle). */
type SortKey = "area" | "longest" | "perimeter" | "width" | "given";
/**
 * "corner" packs row by row from the top-left and "column" column by column,
 * so the leftover gathers at the bottom or the right of the board.
 */
type FitRule = "shortSide" | "area" | "corner" | "column";
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
  if (rule === "corner") return (rect.y * 1e5 + rect.x) * 1e6 + Math.min(dw, dh);
  if (rule === "column") return (rect.x * 1e5 + rect.y) * 1e6 + Math.min(dw, dh);
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

  // A straight cut across `source` at `at` from its top/left edge. The pieces
  // either side exclude the kerf; a side narrower than the kerf is sawdust.
  const cutY = (source: Rect, at: number) => {
    const below = source.h - at - kerf;
    sheet.cuts.push({
      x1: source.x, y1: source.y + at, x2: source.x + source.w, y2: source.y + at,
      order: 0, axis: "y", at, source,
      pieces: [{ x: source.x, y: source.y, w: source.w, h: at }, below > 0 ? { x: source.x, y: source.y + at + kerf, w: source.w, h: below } : null],
    });
  };
  const cutX = (source: Rect, at: number) => {
    const right = source.w - at - kerf;
    sheet.cuts.push({
      x1: source.x + at, y1: source.y, x2: source.x + at, y2: source.y + source.h,
      order: 0, axis: "x", at, source,
      pieces: [{ x: source.x, y: source.y, w: at, h: source.h }, right > 0 ? { x: source.x + at + kerf, y: source.y, w: right, h: source.h } : null],
    });
  };

  if (horizontalFirst) {
    // Full-width cut under the part's row, then separate the part from the right.
    if (r.h - ph > 0) cutY(r, ph);
    if (r.w - pw > 0) cutX({ x: r.x, y: r.y, w: r.w, h: ph }, pw);
    if (restW > 0) sheet.free.push({ x: r.x + pw + kerf, y: r.y, w: restW, h: ph });
    if (restH > 0) sheet.free.push({ x: r.x, y: r.y + ph + kerf, w: r.w, h: restH });
  } else {
    // Full-height cut beside the part's column, then separate it from below.
    if (r.w - pw > 0) cutX(r, pw);
    if (r.h - ph > 0) cutY({ x: r.x, y: r.y, w: pw, h: r.h }, ph);
    if (restW > 0) sheet.free.push({ x: r.x + pw + kerf, y: r.y, w: restW, h: r.h });
    if (restH > 0) sheet.free.push({ x: r.x, y: r.y + ph + kerf, w: pw, h: restH });
  }
}

function sortItems(items: Item[], key: SortKey) {
  if (key === "given") return [...items];
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

/**
 * Packs as many of `pool` as fit onto one fresh sheet of `stock`. With
 * `within`, the panels are kept to the first `at` millimetres along that
 * axis: the board is first cut across there, and the rest is one offcut.
 */
function fillSheet(
  pool: Item[],
  stock: StockInput,
  options: CutOptions,
  sort: SortKey,
  fit: FitRule,
  split: SplitRule,
  within?: { axis: "x" | "y"; at: number },
): OpenSheet | null {
  const u = usable(stock, options);
  if (u.w <= 0 || u.h <= 0) return null;
  const board = { x: options.edgeTrim, y: options.edgeTrim, w: u.w, h: u.h };
  const sheet: OpenSheet = { stock, free: [board], placements: [], cuts: [] };
  if (within) {
    const { axis, at } = within;
    const rest = (axis === "x" ? board.w : board.h) - at - options.kerf;
    const first = axis === "x" ? { ...board, w: at } : { ...board, h: at };
    const offcut = rest > 0 ? (axis === "x" ? { ...board, x: board.x + at + options.kerf, w: rest } : { ...board, y: board.y + at + options.kerf, h: rest }) : null;
    sheet.free = [first];
    sheet.cuts.push(
      axis === "x"
        ? { x1: board.x + at, y1: board.y, x2: board.x + at, y2: board.y + board.h, order: 0, axis, at, source: board, pieces: [first, offcut] }
        : { x1: board.x, y1: board.y + at, x2: board.x + board.w, y2: board.y + at, order: 0, axis, at, source: board, pieces: [first, offcut] },
    );
  }
  for (const item of sortItems(pool, sort)) {
    const spot = findSpot(sheet, item, options, fit);
    if (spot) place(sheet, item, spot, split, options.kerf);
  }
  return sheet;
}

/** A repeatable shuffle (mulberry32): the same job always gets the same plan. */
function shuffled<T>(list: T[], seed: number): T[] {
  let t = seed >>> 0;
  const next = () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const usedArea = (sheet: OpenSheet) => sheet.placements.reduce((a, p) => a + p.w * p.h, 0);

/**
 * How much the leftover is kept together: the sum of each offcut's area
 * squared. One 1000 × 1000 offcut scores far above four 500 × 500 ones of
 * the same total, so higher means fewer, larger, more reusable pieces.
 */
const togetherness = (sheets: OpenSheet[]) => sheets.reduce((a, s) => a + consolidate(s).offcuts.reduce((n, o) => n + (o.w * o.h) ** 2, 0), 0);

const itemArea = (list: Item[]) => list.reduce((a, i) => a + i.l * i.w, 0);
const idOf = (item: { partRef: string; copy: number }) => `${item.partRef}#${item.copy}`;

/**
 * The shortest stretch of a board, along `axis`, for which `attempt` still
 * succeeds (found by halving), and what it returned there. The rest of that
 * board is then one full-width offcut.
 */
function shortest<T>(stock: StockInput, options: CutOptions, axis: "x" | "y", panelArea: number, attempt: (at: number) => T | null): T | null {
  const u = usable(stock, options);
  let hi = axis === "x" ? u.w : u.h;
  let lo = Math.max(1, Math.min(hi, Math.ceil(panelArea / (axis === "x" ? u.h : u.w))));
  let best = attempt(hi);
  if (!best) return null;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const found = attempt(mid);
    if (found) {
      best = found;
      hi = mid;
    } else lo = mid + 1;
  }
  return best;
}

/** All of `pool` on one board, kept to the shortest stretch of it. */
function compactBoard(pool: Item[], stock: StockInput, options: CutOptions): OpenSheet | null {
  let best: OpenSheet | null = null;
  for (const axis of ["x", "y"] as const) {
    const sheet = shortest(stock, options, axis, itemArea(pool), (at) => {
      for (const [sort, fit, split] of RULES) {
        const sheet = fillSheet(pool, stock, options, sort, fit, split, { axis, at });
        if (sheet && sheet.placements.length === pool.length) return sheet;
      }
      return null;
    });
    if (sheet && (!best || togetherness([sheet]) > togetherness([best]))) best = sheet;
  }
  return best;
}

/**
 * All of `pool` on two boards with the second kept to the shortest stretch:
 * the panels that pack tightest go on the last board, the rest fill the
 * first. Finding the split from the last board back is what puts the
 * leftover in one large piece.
 */
function compactPair(pool: Item[], stock: StockInput, options: CutOptions): [OpenSheet, OpenSheet] | null {
  const u = usable(stock, options);
  let best: [OpenSheet, OpenSheet] | null = null;
  for (const axis of ["x", "y"] as const) {
    const pair = shortest(stock, options, axis, Math.max(0, itemArea(pool) - u.w * u.h), (at) => {
      for (const [sort, fit, split] of RULES) {
        const last = fillSheet(pool, stock, options, sort, fit, split, { axis, at });
        if (!last || last.placements.length === 0 || last.placements.length === pool.length) continue;
        const placed = new Set(last.placements.map(idOf));
        const rest = pool.filter((item) => !placed.has(idOf(item)));
        for (const [sort2, fit2, split2] of RULES) {
          const first = fillSheet(rest, stock, options, sort2, fit2, split2);
          if (first && first.placements.length === rest.length) return [first, last] as [OpenSheet, OpenSheet];
        }
      }
      return null;
    });
    if (pair && (!best || togetherness(pair) > togetherness(best))) best = pair;
  }
  return best;
}

/**
 * Sheet by sheet: each board is filled as full as the remaining panels allow
 * before the next is opened, so the leftover gathers on the last board in as
 * few, as large pieces as possible, instead of a little on every board.
 *
 * Which panels go on the first board decides what is left for the rest, so
 * this keeps the `beam` best part-built plans at each board (each extended
 * by its `branch` fullest distinct fills, from the sorted rules and
 * `shuffles` seeded shuffles). When what is left fits on one board, or on two
 * of one kind, it also finishes with `compactBoard` or `compactPair`.
 * Every finished plan is returned; `optimise` ranks them with the rest.
 */
type Partial = { sheets: OpenSheet[]; left: Item[]; remaining: Map<string, number>; used: number };

function runFillFirst(items: Item[], stocks: StockInput[], options: CutOptions, beam: number, branch: number, shuffles: number, pairUpTo: number) {
  const invalid: Unplaced[] = [];
  const valid = items.filter((item) => {
    if (item.l > 0 && item.w > 0) return true;
    invalid.push({ partRef: item.partRef, copy: item.copy, reason: "INVALID_SIZE" });
    return false;
  });
  const finish = (sheets: OpenSheet[], left: Item[]) => ({
    sheets,
    unplaced: [...invalid, ...left.map((item) => ({ partRef: item.partRef, copy: item.copy, reason: reasonFor(item, stocks, options, sheets.length) }))],
  });

  const done: Array<ReturnType<typeof finish>> = [];
  let states: Partial[] = [{ sheets: [], left: valid, remaining: new Map(stocks.map((s) => [s.ref, s.quantity])), used: 0 }];
  while (states.length > 0) {
    const next: Partial[] = [];
    for (const state of states) {
      if (state.left.length === 0 || (options.singleSheet && state.sheets.length >= 1)) {
        done.push(finish(state.sheets, state.left));
        continue;
      }
      // Every distinct way to fill the next board, fullest first.
      const fills = new Map<string, { sheet: OpenSheet; key: number[] }>();
      const consider = (sheet: OpenSheet | null) => {
        if (!sheet || sheet.placements.length === 0) return;
        // The most panel area on this board, then its leftover kept together, then the smaller board.
        const key = [-usedArea(sheet), -togetherness([sheet]), sheet.stock.length * sheet.stock.width];
        const id = `${sheet.stock.ref}:${sheet.placements.map(idOf).sort().join(",")}`;
        const seen = fills.get(id);
        if (!seen || compareKeys(key, seen.key) < 0) fills.set(id, { sheet, key });
      };
      for (const stock of stocks) {
        const boards = state.remaining.get(stock.ref) ?? 0;
        if (boards <= 0) continue;
        const pool = state.left.filter((item) => compatible(item, stock, options));
        if (pool.length === 0) continue;
        for (const [sort, fit, split] of RULES) consider(fillSheet(pool, stock, options, sort, fit, split));
        // Shuffled orders reach mixes the sorted ones never try.
        for (let r = 0; r < shuffles; r++) {
          const order = shuffled(pool, r * 7919 + pool.length);
          for (const fit of FITS) for (const split of SPLITS) consider(fillSheet(order, stock, options, "given", fit, split));
        }
        if (pool.length !== state.left.length) continue;
        // The last board, or the last two: kept to the shortest stretch.
        const u = usable(stock, options);
        const panels = itemArea(pool);
        if (panels <= u.w * u.h) consider(compactBoard(pool, stock, options));
        if (boards >= 2 && !options.singleSheet && pool.length <= pairUpTo && panels > u.w * u.h && panels <= 2 * u.w * u.h) {
          const pair = compactPair(pool, stock, options);
          if (pair) done.push(finish([...state.sheets, ...pair], []));
        }
      }
      if (fills.size === 0) {
        done.push(finish(state.sheets, state.left));
        continue;
      }
      for (const { sheet } of [...fills.values()].sort((a, b) => compareKeys(a.key, b.key)).slice(0, branch)) {
        const placed = new Set(sheet.placements.map(idOf));
        const remaining = new Map(state.remaining);
        remaining.set(sheet.stock.ref, (remaining.get(sheet.stock.ref) ?? 0) - 1);
        next.push({ sheets: [...state.sheets, sheet], left: state.left.filter((item) => !placed.has(idOf(item))), remaining, used: state.used + usedArea(sheet) });
      }
    }
    // Keep the part-built plans that have placed the most so far.
    const together = new Map(next.map((st) => [st, togetherness(st.sheets)]));
    states = next.sort((a, b) => b.used - a.used || together.get(b)! - together.get(a)!).slice(0, beam);
  }
  return done;
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
const FITS: FitRule[] = ["shortSide", "area", "corner", "column"];
const SPLITS: SplitRule[] = ["shorterLeftover", "longerLeftover"];
const RULES = SORTS.flatMap((sort) => FITS.flatMap((fit) => SPLITS.map((split) => [sort, fit, split] as const)));

/**
 * How hard the sheet-by-sheet search works. "thorough" is for saved
 * cutlists; "quick" for previews that re-plan on every keystroke. Large jobs
 * narrow the search so a plan stays within a second or two.
 */
export type Effort = "thorough" | "quick";
function searchWidth(effort: Effort, panels: number) {
  if (effort === "quick") return { beam: 1, branch: 1, shuffles: 0, pairUpTo: 24 };
  if (panels <= 40) return { beam: 6, branch: 8, shuffles: 12, pairUpTo: 40 };
  if (panels <= 150) return { beam: 3, branch: 4, shuffles: 4, pairUpTo: 0 };
  return { beam: 1, branch: 1, shuffles: 0, pairUpTo: 0 };
}

export function optimise(parts: PartInput[], stocks: StockInput[], options: CutOptions, effort: Effort = "thorough"): Plan {
  const items = expandItems(parts, options);
  const { beam, branch, shuffles, pairUpTo } = searchWidth(effort, items.length);
  const candidates: Array<{ result: ReturnType<typeof runStrategy>; name: string }> = runFillFirst(items, stocks, options, beam, branch, shuffles, pairUpTo).map((result) => ({
    result,
    name: "fill-first",
  }));
  for (const sort of SORTS) {
    for (const fit of FITS) {
      for (const split of SPLITS) {
        candidates.push({ result: runStrategy(items, stocks, options, sort, fit, split), name: `${sort}/${fit}/${split}` });
      }
    }
  }

  let best: { result: ReturnType<typeof runStrategy>; name: string; key: number[] } | null = null;
  for (const { result, name } of candidates) {
    const sheetArea = result.sheets.reduce((a, s) => a + s.stock.length * s.stock.width, 0);
    const pieces = result.sheets.reduce((a, s) => a + consolidate(s).offcuts.length, 0);
    // Most parts placed, then fewest sheets, then least sheet area, then the
    // leftover kept together in the largest pieces, then in the fewest.
    const key = [result.unplaced.length, result.sheets.length, sheetArea, -togetherness(result.sheets), pieces];
    if (!best || compareKeys(key, best.key) < 0) best = { result, name, key };
  }
  return buildPlan(best!.result, best!.name, parts, stocks, options);
}

function compareKeys(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

/**
 * Drops cuts that only divide leftover (their piece holds no panel), so the
 * leftover stays in one piece, and lists the offcuts: the largest empty
 * pieces the remaining cuts leave.
 */
function consolidate(sheet: OpenSheet): { cuts: Cut[]; offcuts: Rect[] } {
  const holdsPanel = (r: Rect) => sheet.placements.some((p) => contains(r, p));
  const cuts = sheet.cuts.filter((c) => holdsPanel(c.source!));
  const offcuts = cuts
    .flatMap((c) => c.pieces!.filter((r): r is Rect => r !== null))
    .filter((r) => !holdsPanel(r))
    .sort((a, b) => b.w * b.h - a.w * a.h);
  return { cuts, offcuts };
}

function buildPlan(result: ReturnType<typeof runStrategy>, strategy: string, parts: PartInput[], stocks: StockInput[], options: CutOptions): Plan {
  const sheets: PlanSheet[] = result.sheets.map((s, i) => {
    const usedArea = s.placements.reduce((a, p) => a + p.w * p.h, 0);
    const { cuts, offcuts } = consolidate(s);
    return {
      index: i + 1,
      stockRef: s.stock.ref,
      length: s.stock.length,
      width: s.stock.width,
      materialKey: s.stock.materialKey,
      placements: s.placements,
      cuts: cuts.map((c, order) => ({ ...c, order: order + 1 })),
      offcuts,
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
      cutLength: sheets.reduce((a, s) => a + s.cuts.reduce((b, c) => b + Math.abs(c.x2 - c.x1) + Math.abs(c.y2 - c.y1), 0), 0),
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
