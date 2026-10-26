import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApproveCutlistButton } from "@/components/cutlist/CutlistActions";
import PlanSheet, { type PartInfo } from "@/components/cutlist/PlanSheet";
import Zoomable from "@/components/cutlist/Zoomable";
import Detail from "@/components/Detail";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import PrintButton from "@/components/PrintButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { estimateMinutes, formatMinutes } from "@/lib/cutlist";
import { WORK_NUMBER_PATTERN } from "@/lib/numbers";
import { UNPLACED_REASONS, areaM2, percent } from "@/lib/plan-text";
import { requireRole } from "@/server/auth/guards";
import { loadJobCutlist, planIsCurrent } from "@/server/services/cutlists";

export const metadata: Metadata = { title: "Cutting plan | Pacwoods" };

export default async function PlanPage({ params, searchParams }: PageProps<"/admin/jobs/[workNumber]/plan">) {
  await requireRole("SUPER_ADMIN", "ADMIN");
  const { workNumber } = await params;
  const showCuts = (await searchParams).cuts === "1";
  if (!WORK_NUMBER_PATTERN.test(workNumber)) notFound();
  const found = await loadJobCutlist(workNumber);
  if (!found) notFound();
  const { job, current } = found;
  const plan = current?.plan;

  const back = (
    <Link href={`/admin/jobs/${workNumber}`} className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground print:hidden">
      ← {workNumber}
    </Link>
  );
  if (!current || !plan) {
    return (
      <>
        {back}
        <PageHeader title="Cutting plan" />
        <EmptyState title="No cutting plan yet.">
          <Link href={`/admin/jobs/${workNumber}/cutlist`} className="underline underline-offset-4">
            Open the cutlist
          </Link>{" "}
          and press ▶ to generate one.
        </EmptyState>
      </>
    );
  }

  const current_ = planIsCurrent(current);
  const parts = new Map<string, PartInfo>(
    current.parts.map((p, i) => [p.ref, { label: p.label || `#${i + 1}`, length: p.length, width: p.width, edges: p.edges }]),
  );
  const stockLabel = new Map(
    current.stockSheets.map((s) => [s.ref, s.materialName ? `${s.materialName} ${s.thicknessMm} mm` : (s.label ?? "Stock sheet")]),
  );
  const t = plan.totals;
  const estimate = estimateMinutes(t, current, job.operations ?? { cutting: true, edging: false });
  const canApprove = job.status === "DRAFT" && current.state === "DRAFT" && current_ && plan.unplaced.length === 0;

  return (
    <>
      {back}
      <PageHeader
        title={`Cutting plan · ${workNumber}`}
        description={`Cutlist version ${current.version} · ${current.state === "APPROVED" ? "approved" : "draft"} · generated ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(current.planGeneratedAt ?? current.updatedAt)}`}
        actions={
          <span className="flex flex-wrap gap-2 print:hidden">
            <Link href={showCuts ? `?` : `?cuts=1`} className={buttonVariants({ variant: "outline" })}>
              {showCuts ? "Hide cut sequence" : "Show cut sequence"}
            </Link>
            <Link href={`/admin/jobs/${workNumber}/cutlist`} className={buttonVariants({ variant: "outline" })}>
              {job.status === "DRAFT" ? "Edit cutlist" : "View cutlist"}
            </Link>
            <PrintButton />
            {canApprove && <ApproveCutlistButton workNumber={workNumber} />}
          </span>
        }
      />

      {!current_ && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>The cutlist has changed since this plan was generated. Open the cutlist and press ▶ to regenerate it.</AlertDescription>
        </Alert>
      )}

      <section className="mb-6 rounded-lg bg-card p-5">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Panels placed">
            {t.partsPlaced} of {t.partsRequested}
          </Detail>
          <Detail label="Sheets used">
            {t.sheetsUsed} <span className="text-sm font-normal text-muted-foreground">(at least {t.sheetLowerBound} needed)</span>
          </Detail>
          <Detail label="Sheet utilisation">{percent(t.utilization)}</Detail>
          <Detail label="Waste">{areaM2(t.wasteArea)} m²</Detail>
          <Detail label="Panel area">{areaM2(t.requestedArea)} m²</Detail>
          <Detail label="Edge banding">{(t.edgingLengthMm / 1000).toFixed(2)} m</Detail>
          <Detail label="Saw cuts">{t.cutCount}</Detail>
          <Detail label="Kerf · trim">
            {current.options.kerf} mm · {current.options.edgeTrim} mm
          </Detail>
          <Detail label="Estimated cutting time">{job.operations?.cutting ? formatMinutes(estimate.cuttingMin) : "Not required"}</Detail>
          <Detail label="Estimated edging time">{job.operations?.edging ? formatMinutes(estimate.edgingMin) : "Not required"}</Detail>
          <Detail label="Estimated total">{formatMinutes(estimate.totalMin)}</Detail>
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          Layout by a guillotine heuristic: a good plan, not a guaranteed minimum. Times are estimates from standard assumptions, not a commitment.
        </p>
      </section>

      {plan.unplaced.length > 0 && (
        <section className="mb-6 rounded-lg bg-destructive/5 p-5">
          <h2 className="mb-2 font-semibold text-destructive">
            {plan.unplaced.length} panel{plan.unplaced.length === 1 ? "" : "s"} could not be placed
          </h2>
          <ul className="space-y-1 text-sm">
            {plan.unplaced.map((u) => {
              const p = parts.get(u.partRef);
              return (
                <li key={`${u.partRef}#${u.copy}`}>
                  <span className="font-medium">
                    {p?.label} ({p?.length} × {p?.width}), copy {u.copy}:
                  </span>{" "}
                  {UNPLACED_REASONS[u.reason]}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="space-y-6">
        {plan.sheets.map((sheet) => (
          <section key={sheet.index} className="rounded-lg bg-card p-5 break-inside-avoid">
            <h2 className="mb-1 font-semibold">
              Sheet {sheet.index} of {plan.sheets.length} · {stockLabel.get(sheet.stockRef)}
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">
              {sheet.length} × {sheet.width} mm · {sheet.placements.length} panels · {percent(sheet.utilization)} used · {sheet.cuts.length} cuts
            </p>
            <Zoomable>
              <PlanSheet
                sheet={sheet}
                parts={parts}
                showLabels={current.options.labelsOnPanels}
                showCuts={showCuts}
                title={`Sheet ${sheet.index}: ${sheet.placements.length} panels`}
              />
            </Zoomable>
          </section>
        ))}
      </div>
    </>
  );
}
