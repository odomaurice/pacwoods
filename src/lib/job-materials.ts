/** The boards for a job, as staff record them on the job page. */
import { z } from "zod";

export const SUPPLIED_BY = ["CLIENT", "WORKSHOP"] as const;
export type SuppliedBy = (typeof SUPPLIED_BY)[number];
export const SUPPLIED_BY_LABELS: Record<SuppliedBy, string> = { CLIENT: "Brought by the client", WORKSHOP: "From workshop stock" };

const size = (label: string) => z.number({ error: `${label}: enter a number.` }).int(`${label} must be whole millimetres.`).min(1).max(10000).optional();

export const jobMaterialSchema = z.object({
  /** Catalogue material, when picked from the list; the name and sizes are copied as they were then. */
  materialId: z.string().max(40).optional(),
  name: z.string().trim().min(1, "Name the material.").max(120),
  thicknessMm: z.number({ error: "Thickness: enter a number." }).min(0.1).max(200).optional(),
  sheetLengthMm: size("Sheet length"),
  sheetWidthMm: size("Sheet width"),
  sheets: z.number({ error: "Sheets: enter a number." }).int("Sheets must be a whole number.").min(1, "At least one sheet.").max(10000),
  suppliedBy: z.enum(SUPPLIED_BY).optional(),
  note: z.string().trim().max(300).optional(),
});
export type JobMaterialInput = z.infer<typeof jobMaterialSchema>;

export const jobMaterialsSchema = z.array(jobMaterialSchema).max(30, "At most 30 material lines.");

export function describeMaterial(m: { name: string; thicknessMm?: number | null }) {
  return m.thicknessMm ? `${m.name} ${m.thicknessMm} mm` : m.name;
}
