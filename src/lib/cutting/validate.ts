/**
 * Independent checks on a finished plan. Run after every optimisation and in
 * tests: a plan that fails any of these is never saved or shown.
 */
import { allowedRotations, expandItems } from "./engine";
import type { CutOptions, PartInput, Plan, StockInput } from "./types";

export function validatePlan(plan: Plan, parts: PartInput[], stocks: StockInput[], options: CutOptions): string[] {
  const errors: string[] = [];
  const items = expandItems(parts, options);
  const itemByKey = new Map(items.map((i) => [`${i.partRef}#${i.copy}`, i]));
  const seen = new Set<string>();
  const stockByRef = new Map(stocks.map((s) => [s.ref, s]));
  const sheetsPerStock = new Map<string, number>();
  const t = options.edgeTrim;

  for (const sheet of plan.sheets) {
    const stock = stockByRef.get(sheet.stockRef);
    if (!stock) {
      errors.push(`Sheet ${sheet.index}: unknown stock ${sheet.stockRef}`);
      continue;
    }
    sheetsPerStock.set(stock.ref, (sheetsPerStock.get(stock.ref) ?? 0) + 1);

    sheet.placements.forEach((p, i) => {
      const key = `${p.partRef}#${p.copy}`;
      const item = itemByKey.get(key);
      if (!item) errors.push(`Sheet ${sheet.index}: unknown part ${key}`);
      if (seen.has(key)) errors.push(`Part ${key} placed twice`);
      seen.add(key);

      if (p.x < t || p.y < t || p.x + p.w > stock.length - t || p.y + p.h > stock.width - t) {
        errors.push(`Sheet ${sheet.index}: ${key} outside the usable area`);
      }
      if (item) {
        const expected = p.rotated ? [item.w, item.l] : [item.l, item.w];
        if (p.w !== expected[0] || p.h !== expected[1]) errors.push(`${key} has the wrong size`);
        if (!allowedRotations(item, stock, options).includes(p.rotated)) errors.push(`${key} breaks the grain rule`);
        if (options.considerMaterial && (item.materialKey ?? "") !== (stock.materialKey ?? "")) {
          errors.push(`${key} placed on the wrong material`);
        }
      }

      // Every pair must be separated by at least the kerf on one axis.
      for (const q of sheet.placements.slice(i + 1)) {
        const apart =
          p.x + p.w + options.kerf <= q.x + 1e-9 ||
          q.x + q.w + options.kerf <= p.x + 1e-9 ||
          p.y + p.h + options.kerf <= q.y + 1e-9 ||
          q.y + q.h + options.kerf <= p.y + 1e-9;
        if (!apart) errors.push(`Sheet ${sheet.index}: ${key} overlaps ${q.partRef}#${q.copy}`);
      }
    });
  }

  for (const [ref, used] of sheetsPerStock) {
    if (used > (stockByRef.get(ref)?.quantity ?? 0)) errors.push(`Stock ${ref}: ${used} sheets used, fewer available`);
  }
  for (const u of plan.unplaced) {
    const key = `${u.partRef}#${u.copy}`;
    if (seen.has(key)) errors.push(`${key} is both placed and unplaced`);
    seen.add(key);
  }
  if (seen.size !== items.length) errors.push(`${items.length - seen.size} part copies are missing from the plan`);
  if (options.singleSheet && plan.sheets.length > 1) errors.push("More than one sheet used");
  return errors;
}
