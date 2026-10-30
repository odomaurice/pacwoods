import type { Types } from "mongoose";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, Clock01Icon } from "@hugeicons/core-free-icons";
import { MaterialsAvailableButton, MaterialsNotAvailableButton } from "@/components/MaterialActions";
import MaterialsPanel from "@/components/materials/MaterialsPanel";
import { describeMaterial, type JobMaterialInput } from "@/lib/job-materials";
import type { JobStatus } from "@/lib/jobs";
import { cn } from "@/lib/utils";
import { planMaterials } from "@/server/services/jobMaterials";
import { listMaterials } from "@/server/services/materials";

const day = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

/** Statuses in which the workshop can still say the boards have (or have not) arrived. */
const CAN_CONFIRM: JobStatus[] = ["DRAFT", "AWAITING_MATERIAL"];
const CAN_WITHDRAW: JobStatus[] = ["DRAFT", "QUEUED_FOR_CUTTING"];

/**
 * The job page's materials: whether the boards are in the workshop (green)
 * or still awaited (amber), what they are, and what the cutting plan needs.
 */
export default async function JobMaterialsSection({
  job,
  confirmedByName,
}: {
  job: {
    _id: Types.ObjectId;
    workNumber: string;
    status: JobStatus;
    materialConfirmedAt?: Date | null;
    materials?: Array<{
      materialId?: Types.ObjectId | null;
      name: string;
      thicknessMm?: number | null;
      sheetLengthMm?: number | null;
      sheetWidthMm?: number | null;
      sheets: number;
      suppliedBy?: JobMaterialInput["suppliedBy"] | null;
      note?: string | null;
    }> | null;
  };
  confirmedByName?: string;
}) {
  const [catalogue, planned] = await Promise.all([listMaterials(), planMaterials(job._id)]);
  const available = Boolean(job.materialConfirmedAt);
  const items: JobMaterialInput[] = (job.materials ?? []).map((m) => ({
    materialId: m.materialId?.toString(),
    name: m.name,
    thicknessMm: m.thicknessMm ?? undefined,
    sheetLengthMm: m.sheetLengthMm ?? undefined,
    sheetWidthMm: m.sheetWidthMm ?? undefined,
    sheets: m.sheets,
    suppliedBy: m.suppliedBy ?? undefined,
    note: m.note ?? undefined,
  }));

  const recorded = items.reduce((n, m) => n + m.sheets, 0);
  const needed = planned.reduce((n, m) => n + m.sheets, 0);
  const short = recorded > 0 && needed > recorded ? needed - recorded : 0;

  const next = available
    ? job.status === "QUEUED_FOR_CUTTING"
      ? "The job is in the cutting queue."
      : job.status === "DRAFT" || job.status === "AWAITING_APPROVAL"
        ? "Cutting can start as soon as the cutlist is approved."
        : "Production has the boards it needs."
    : job.status === "AWAITING_MATERIAL"
      ? "The cutlist is approved. The job joins the cutting queue the moment you mark the materials as received."
      : "This job cannot be cut until the boards are here. Mark them as received when they arrive.";

  return (
    <section aria-labelledby="materials-title" className="mb-8 space-y-4">
      <h2 id="materials-title" className="text-lg font-semibold">
        Materials
      </h2>

      <div
        role="status"
        className={cn(
          "flex flex-wrap items-center gap-4 rounded-lg p-5",
          available ? "bg-emerald-50 text-emerald-950" : "bg-amber-50 text-amber-950",
        )}
      >
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full text-white", available ? "bg-emerald-700" : "bg-amber-600")} aria-hidden>
          <HugeiconsIcon icon={available ? CheckmarkCircle02Icon : Clock01Icon} className="size-6" />
        </span>
        <div className="mr-auto min-w-0">
          <p className="text-base font-semibold">{available ? "Materials are in the workshop" : "Waiting for materials"}</p>
          <p className="text-sm opacity-90">{next}</p>
          {available && job.materialConfirmedAt && (
            <p className="mt-0.5 text-xs opacity-75">
              Marked received {confirmedByName ? `by ${confirmedByName} ` : ""}on {day.format(job.materialConfirmedAt)}
            </p>
          )}
        </div>
        {!available && CAN_CONFIRM.includes(job.status) && <MaterialsAvailableButton workNumber={job.workNumber} approved={job.status === "AWAITING_MATERIAL"} />}
        {available && CAN_WITHDRAW.includes(job.status) && <MaterialsNotAvailableButton workNumber={job.workNumber} queued={job.status === "QUEUED_FOR_CUTTING"} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg bg-card p-5">
          <h3 className="mb-3 font-semibold">Boards for this job</h3>
          <MaterialsPanel
            workNumber={job.workNumber}
            items={items}
            suggested={planned}
            catalogue={catalogue.map((m) => ({ id: m._id.toString(), name: m.name, thicknessMm: m.thicknessMm, sheetLengthMm: m.sheetLengthMm, sheetWidthMm: m.sheetWidthMm }))}
          />
        </div>
        <div className="rounded-lg bg-card p-5">
          <h3 className="mb-1 font-semibold">The cutting plan needs</h3>
          {short > 0 && (
            <p className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
              {recorded} sheet{recorded === 1 ? "" : "s"} recorded, the plan needs {needed}: {short} short.
            </p>
          )}
          {planned.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cutting plan yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {planned.map((m) => (
                <li key={`${m.name}|${m.thicknessMm}|${m.sheetLengthMm}x${m.sheetWidthMm}`}>
                  <span className="font-medium">{describeMaterial(m)}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {m.sheets} sheet{m.sheets === 1 ? "" : "s"}, {m.sheetLengthMm} × {m.sheetWidthMm}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
