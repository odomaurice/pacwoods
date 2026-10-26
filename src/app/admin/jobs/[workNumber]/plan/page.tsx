import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApproveCutlistButton } from "@/components/cutlist/CutlistActions";
import type { DrawPart } from "@/components/cutlist/PlanDrawing";
import PlanViewer, { Collapsible, Stats } from "@/components/cutlist/PlanViewer";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import PrintButton from "@/components/PrintButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { estimateMinutes, formatMinutes } from "@/lib/cutlist";
import { WORK_NUMBER_PATTERN } from "@/lib/numbers";
import { UNPLACED_REASONS, percent } from "@/lib/plan-text";
import { PART_FILLS, cutLength } from "@/lib/plan-view";
import { requireRole } from "@/server/auth/guards";
import { loadJobCutlist, planIsCurrent } from "@/server/services/cutlists";

export const metadata: Metadata = { title: "Cutting plan | Pacwoods" };

const n = (x: number) => x.toLocaleString("en-GB");

export default async function PlanPage({ params }: PageProps<"/admin/jobs/[workNumber]/plan">) {
  await requireRole("SUPER_ADMIN", "ADMIN");
  const { workNumber } = await params;
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

  const upToDate = planIsCurrent(current);
  const parts: DrawPart[] = current.parts.map((p, i) => ({
    ref: p.ref,
    label: p.label || `#${i + 1}`,
    fill: PART_FILLS[i % PART_FILLS.length],
    edges: p.edges,
  }));
  const partInfo = new Map(current.parts.map((p, i) => [p.ref, { label: p.label || `#${i + 1}`, length: p.length, width: p.width }]));
  const stockLabels = Object.fromEntries(
    current.stockSheets.map((s) => [s.ref, [s.label, s.materialName && `${s.materialName} ${s.thicknessMm} mm`].filter(Boolean).join(" · ") || `${s.length}×${s.width}`]),
  );
  const t = plan.totals;
  const ops = job.operations ?? { cutting: true, edging: false };
  const estimate = estimateMinutes(t, current, ops);
  const canApprove = job.status === "DRAFT" && current.state === "DRAFT" && upToDate && plan.unplaced.length === 0;

  // "64×45 ×6 · Brent": sheets used per stock size.
  const used = new Map<string, number>();
  for (const s of plan.sheets) used.set(s.stockRef, (used.get(s.stockRef) ?? 0) + 1);
  const stockBy = new Map(current.stockSheets.map((s) => [s.ref, s]));
  const totalCutLength = t.cutLength ?? plan.sheets.reduce((a, s) => a + cutLength(s), 0);

  return (
    <>
      {back}
      <PageHeader
        title={`Cutting plan · ${workNumber}`}
        description={`Cutlist version ${current.version} · ${current.state === "APPROVED" ? "approved" : "draft"} · generated ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(current.planGeneratedAt ?? current.updatedAt)}`}
        actions={
          <span className="flex flex-wrap gap-2 print:hidden">
            <Link href={`/admin/jobs/${workNumber}/cutlist`} className={buttonVariants({ variant: "outline" })}>
              {job.status === "DRAFT" ? "Edit cutlist" : "View cutlist"}
            </Link>
            <PrintButton />
            {canApprove && <ApproveCutlistButton workNumber={workNumber} />}
          </span>
        }
      />

      {!upToDate && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>The cutlist has changed since this plan was generated. Open the cutlist and press ▶ to regenerate it.</AlertDescription>
        </Alert>
      )}

      {plan.unplaced.length > 0 && (
        <section className="mb-6 rounded-lg bg-destructive/5 p-5">
          <h2 className="mb-2 font-semibold text-destructive">
            {plan.unplaced.length} panel{plan.unplaced.length === 1 ? "" : "s"} could not be placed
          </h2>
          <ul className="space-y-1 text-sm">
            {plan.unplaced.map((u) => {
              const p = partInfo.get(u.partRef);
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

      <section className="mb-6 rounded-lg bg-card p-3 sm:p-5">
        <h2 className="px-1 font-semibold">Global statistics</h2>
        <Stats
          rows={[
            [
              "Used stock sheets",
              <span key="u" className="block space-y-0.5">
                {[...used].map(([ref, count]) => {
                  const s = stockBy.get(ref);
                  return (
                    <span key={ref} className="block">
                      {s?.length}×{s?.width} <span className="text-muted-foreground">×{count}</span> · {stockLabels[ref]}
                    </span>
                  );
                })}
              </span>,
            ],
            ["Panels placed", `${t.partsPlaced} of ${t.partsRequested}`],
            ["Total used area", `${n(t.sheetArea - t.wasteArea)} mm² · ${percent(t.utilization)}`],
            ["Total wasted area", `${n(t.wasteArea)} mm² · ${percent(t.sheetArea ? t.wasteArea / t.sheetArea : 0)}`],
            ["Total cuts", String(t.cutCount)],
            ["Total cut length", `${n(totalCutLength)} mm`],
            ["Cut / blade / kerf thickness", `${current.options.kerf} mm`],
            ["Edge trim", `${current.options.edgeTrim} mm`],
            ["Edge banding", `${(t.edgingLengthMm / 1000).toFixed(2)} m`],
            ["Optimisation priority", "Fewest sheets, then least wasted area"],
            ["Fewest sheets possible", `${t.sheetLowerBound} (used ${t.sheetsUsed})`],
          ]}
        />
        <Collapsible title="Estimated time">
          <Stats
            rows={[
              ["Cutting", ops.cutting ? formatMinutes(estimate.cuttingMin) : "Not required"],
              ["Edging", ops.edging ? formatMinutes(estimate.edgingMin) : "Not required"],
              ["Total", formatMinutes(estimate.totalMin)],
            ]}
          />
          <p className="mt-2 text-xs text-muted-foreground">Estimates from standard assumptions, not a commitment.</p>
        </Collapsible>
        <p className="mt-3 px-1 text-xs text-muted-foreground">Layout by a guillotine heuristic: a good plan, not a guaranteed minimum. Sizes in millimetres.</p>
      </section>

      <PlanViewer sheets={plan.sheets} parts={parts} stockLabels={stockLabels} showLabels={current.options.labelsOnPanels} />
    </>
  );
}
