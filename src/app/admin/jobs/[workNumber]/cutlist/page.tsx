import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CutlistEditor, { type MaterialOption } from "@/components/cutlist/CutlistEditor";
import PageHeader from "@/components/PageHeader";
import { pickPart, pickStock, type CutlistInput } from "@/lib/cutlist";
import { WORK_NUMBER_PATTERN } from "@/lib/numbers";
import { requireRole } from "@/server/auth/guards";
import { emptyCutlist, loadJobCutlist } from "@/server/services/cutlists";
import { listMaterials } from "@/server/services/materials";

export const metadata: Metadata = { title: "Cutlist | Pacwoods" };

export default async function CutlistPage({ params }: PageProps<"/admin/jobs/[workNumber]/cutlist">) {
  await requireRole("SUPER_ADMIN", "ADMIN");
  const { workNumber } = await params;
  if (!WORK_NUMBER_PATTERN.test(workNumber)) notFound();
  const found = await loadJobCutlist(workNumber);
  if (!found) notFound();
  const { job, current } = found;

  const materials: MaterialOption[] = (await listMaterials()).map((m) => ({
    id: m._id.toString(),
    label: `${m.name} ${m.thicknessMm} mm`,
    category: m.category,
    sheetLengthMm: m.sheetLengthMm,
    sheetWidthMm: m.sheetWidthMm,
    grained: m.grain === "LENGTHWISE",
  }));

  // The editor works on material ids; stored snapshots stay on the server.
  const initial: CutlistInput = current
    ? {
        parts: current.parts.map(pickPart),
        stockSheets: current.stockSheets.map(pickStock),
        options: current.options,
      }
    : emptyCutlist();

  return (
    <>
      <Link href={`/admin/jobs/${workNumber}`} className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← {workNumber}
      </Link>
      <PageHeader
        title="Cutlist"
        description={
          current ? `Version ${current.version}${current.state === "APPROVED" ? " · approved" : " · draft"}` : "Enter panels and stock sheets, then press ▶ to generate the cutting plan."
        }
      />
      <CutlistEditor workNumber={workNumber} initial={initial} materials={materials} readOnly={job.status !== "DRAFT"} />
    </>
  );
}
