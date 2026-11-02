import NewJobFlow from "@/components/jobs/NewJobFlow";
import { listMaterials } from "@/server/services/materials";
import { listActiveClientOptions } from "@/server/services/users";

/** The new-job flow with what it needs: clients to pick from and the materials catalogue. */
export default async function NewJobSection({ compactHeader = false }: { compactHeader?: boolean }) {
  const [clients, catalogue] = await Promise.all([listActiveClientOptions(), listMaterials()]);
  return (
    <NewJobFlow
      compactHeader={compactHeader}
      // Phones are searchable as typed locally (0803…) as well as stored (+234803…).
      clients={clients.map((c) => ({ id: c.id, label: c.label, search: `${c.label} ${c.phone ?? ""} ${c.phone ? `0${c.phone.slice(4)}` : ""}`.toLowerCase().replace(/\s+/g, "") }))}
      catalogue={catalogue.map((m) => ({ id: m._id.toString(), name: m.name, thicknessMm: m.thicknessMm, sheetLengthMm: m.sheetLengthMm, sheetWidthMm: m.sheetWidthMm }))}
    />
  );
}
