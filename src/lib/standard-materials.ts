import type { MaterialInput } from "@/lib/schemas";

/**
 * Common sheet materials in their usual thicknesses, on the standard
 * 2440 × 1220 mm (8 × 4 ft) sheet. A starting catalogue only: the Super Admin
 * can retire any of these and add the workshop's own.
 */
const SHEET = { sheetLengthMm: 2440, sheetWidthMm: 1220 } as const;

export const STANDARD_MATERIALS: MaterialInput[] = [
  ...[6, 9, 12, 16, 18, 25].map((t) => ({ name: "MDF", category: "MDF", thicknessMm: t, grain: "NONE" as const, ...SHEET })),
  { name: "HDF", category: "MDF", thicknessMm: 3, grain: "NONE", ...SHEET },
  ...[16, 18].map((t) => ({ name: "Melamine MDF, plain colour", category: "Melamine-faced board", thicknessMm: t, grain: "NONE" as const, ...SHEET })),
  ...[16, 18].map((t) => ({ name: "Melamine chipboard (MFC), plain colour", category: "Melamine-faced board", thicknessMm: t, grain: "NONE" as const, ...SHEET })),
  { name: "Melamine chipboard (MFC), woodgrain", category: "Melamine-faced board", thicknessMm: 18, grain: "LENGTHWISE", ...SHEET },
  ...[6, 9, 12, 18, 25].map((t) => ({ name: "Plywood", category: "Plywood", thicknessMm: t, grain: "LENGTHWISE" as const, ...SHEET })),
  ...[12, 18].map((t) => ({ name: "Marine plywood", category: "Plywood", thicknessMm: t, grain: "LENGTHWISE" as const, ...SHEET })),
  ...[12, 18].map((t) => ({ name: "Chipboard (particleboard)", category: "Chipboard", thicknessMm: t, grain: "NONE" as const, ...SHEET })),
  { name: "Blockboard", category: "Blockboard", thicknessMm: 18, grain: "LENGTHWISE", ...SHEET },
  { name: "OSB", category: "OSB", thicknessMm: 18, grain: "NONE", ...SHEET },
  { name: "Hardboard", category: "Hardboard", thicknessMm: 3, grain: "NONE", ...SHEET },
];
