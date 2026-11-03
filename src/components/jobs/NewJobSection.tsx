import NewJobFlow from "@/components/jobs/NewJobFlow";
import { listMaterials } from "@/server/services/materials";

/** The new-job flow with the materials catalogue it offers. */
export default async function NewJobSection() {
  const catalogue = await listMaterials();
  return (
    <NewJobFlow
      catalogue={catalogue.map((m) => ({ id: m._id.toString(), name: m.name, thicknessMm: m.thicknessMm, sheetLengthMm: m.sheetLengthMm, sheetWidthMm: m.sheetWidthMm }))}
    />
  );
}
