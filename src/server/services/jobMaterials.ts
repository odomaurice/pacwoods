import "server-only";
import type { Types } from "mongoose";
import type { JobMaterialInput } from "@/lib/job-materials";
import { connectDb } from "@/server/db/connect";
import { CutlistVersion, type CutlistVersionDoc } from "@/server/db/models/CutlistVersion";

/**
 * The sheets a job's cutting plan uses (the approved cutlist, else the draft),
 * as material lines: what the job page compares the recorded boards against,
 * and what a new material list starts from.
 */
export async function planMaterials(jobId: Types.ObjectId): Promise<JobMaterialInput[]> {
  await connectDb();
  const versions = (await CutlistVersion.find({ jobId, state: { $in: ["APPROVED", "DRAFT"] } })
    .sort({ version: -1 })
    .select("state stockSheets plan.sheets.stockRef")
    .lean()) as unknown as Array<Pick<CutlistVersionDoc, "state" | "stockSheets" | "plan">>;
  const v = versions.find((x) => x.state === "APPROVED") ?? versions[0];
  const sheets = v?.plan?.sheets;
  if (!v || !sheets) return [];
  return v.stockSheets
    .map((st) => ({
      materialId: st.materialId,
      name: st.materialName ?? st.label ?? "Unspecified material",
      thicknessMm: st.thicknessMm,
      sheetLengthMm: st.length,
      sheetWidthMm: st.width,
      sheets: sheets.filter((x) => x.stockRef === st.ref).length,
    }))
    .filter((m) => m.sheets > 0);
}
