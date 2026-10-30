/**
 * Lengths are stored and cut in millimetres; a cutlist can be typed in any of
 * these units and is converted on the way in and out.
 */
export const LENGTH_UNITS = ["mm", "cm", "m", "in", "ft"] as const;
export type LengthUnit = (typeof LENGTH_UNITS)[number];

export const UNIT_LABELS: Record<LengthUnit, string> = { mm: "Millimetres (mm)", cm: "Centimetres (cm)", m: "Metres (m)", in: "Inches (in)", ft: "Feet (ft)" };

const MM_PER: Record<LengthUnit, number> = { mm: 1, cm: 10, m: 1000, in: 25.4, ft: 304.8 };
const DECIMALS: Record<LengthUnit, number> = { mm: 1, cm: 2, m: 4, in: 3, ft: 4 };

/** A typed length in `unit` to millimetres, to 0.1 mm; NaN stays NaN. */
export function toMm(value: number, unit: LengthUnit): number {
  return Math.round(value * MM_PER[unit] * 10) / 10;
}

/** Millimetres shown in `unit`, without trailing zeros. */
export function fromMm(mm: number, unit: LengthUnit): string {
  const v = mm / MM_PER[unit];
  return String(Number(v.toFixed(DECIMALS[unit])));
}

/** Re-expresses a typed value from one unit in another; text that is not a number is left alone. */
export function convertText(text: string, from: LengthUnit, to: LengthUnit): string {
  if (text.trim() === "" || from === to) return text;
  const n = Number(text);
  return Number.isFinite(n) ? fromMm(n * MM_PER[from], to) : text;
}
