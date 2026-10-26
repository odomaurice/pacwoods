import type { UnplacedReason } from "@/lib/cutting/types";

export const UNPLACED_REASONS: Record<UnplacedReason, string> = {
  LARGER_THAN_ANY_SHEET: "Larger than every available sheet (after edge trim).",
  GRAIN_PREVENTS_ROTATION: "Would only fit turned, which its grain direction does not allow.",
  NO_COMPATIBLE_STOCK: "No stock sheet of the same material.",
  STOCK_EXHAUSTED: "Not enough sheets in stock.",
  SINGLE_SHEET_LIMIT: "“Use only one sheet” is on and the sheet is full.",
  INVALID_SIZE: "The size is not valid after the edge-band deduction.",
};

export const areaM2 = (mm2: number) => (mm2 / 1_000_000).toFixed(2);
export const percent = (x: number) => `${(x * 100).toFixed(1)}%`;
