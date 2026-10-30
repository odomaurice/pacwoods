import type { ReactNode } from "react";
import type { DrawPart } from "@/components/cutlist/PlanDrawing";
import CuttingGuide from "@/components/cutlist/CuttingGuide";
import PlanViewer from "@/components/cutlist/PlanViewer";
import Detail from "@/components/Detail";
import { TaskStatusBadge } from "@/components/StatusBadge";
import { GRAIN_LABELS, describeEdges, estimateMinutes, formatMinutes } from "@/lib/cutlist";
import { edgingLength } from "@/lib/cutting/engine";
import type { Operations } from "@/lib/jobs";
import { STAGE_LABELS, formatDuration, nextStage, type Stage, type TaskStatus } from "@/lib/production";
import { PART_FILLS, guideParts } from "@/lib/plan-view";
import { estimateAssumptions } from "@/lib/settings";
import type { CutlistVersionDoc } from "@/server/db/models/CutlistVersion";
import { getSettings } from "@/server/services/settings";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export type TaskDetailProps = {
  stage: Stage;
  status: TaskStatus;
  queueSeq?: number | null;
  clientLabel: string;
  operations: Operations;
  clientNotes?: string | null;
  internalNotes?: string | null;
  cutlist: Pick<CutlistVersionDoc, "version" | "parts" | "stockSheets" | "options" | "plan"> | null;
  sessions: Array<{ startedAt: Date; endedAt?: Date | null; endReason?: string | null; note?: string | null }>;
  activeMs: number;
  results?: { quantityCompleted?: number | null; wastePanels?: number | null; defectivePanels?: number | null; downtimeMin?: number | null; notes?: string | null } | null;
  /** Cutting guide progress; canTick only for the operator working the stage. */
  guide?: { taskId: string; done: string[]; canTick: boolean };
};

/**
 * What the operator needs at the machine for one stage of one job, and
 * nothing from the other stages: the cutter gets the cutlist, the plan and
 * the step-by-step guide; CNC gets the panels to machine; edging gets the
 * panels to band.
 */
export default async function TaskDetail(p: TaskDetailProps) {
  const assumptions = estimateAssumptions(await getSettings());
  const cl = p.cutlist;
  const numbered = (cl?.parts ?? []).map((x, i) => ({ x, no: i + 1 }));
  const banded = numbered.filter(({ x }) => x.edges.length1 || x.edges.length2 || x.edges.width1 || x.edges.width2);
  const machined = numbered.filter(({ x }) => x.machining);
  const count = (rows: typeof numbered) => rows.reduce((n, { x }) => n + x.quantity, 0);
  const estimate =
    cl?.plan && p.stage !== "CNC" ? estimateMinutes(cl.plan.totals, cl, { cutting: p.stage === "CUTTING", edging: p.stage === "EDGING" }, assumptions) : null;
  const drawParts: DrawPart[] = (cl?.parts ?? []).map((x, i) => ({ ref: x.ref, label: x.label || `#${i + 1}`, fill: PART_FILLS[i % PART_FILLS.length], edges: x.edges }));
  const stockLabels = Object.fromEntries(
    (cl?.stockSheets ?? []).map((s) => [s.ref, [s.label, s.materialName && `${s.materialName} ${s.thicknessMm} mm`].filter(Boolean).join(" · ") || `${s.length}×${s.width}`]),
  );
  const materials = [...new Set((cl?.parts ?? []).map((x) => (x.materialName ? `${x.materialName} ${x.thicknessMm} mm` : "Unspecified")))];
  const next = nextStage(p.operations, p.stage);

  return (
    <div className="space-y-6">
      <dl className="grid gap-4 rounded-lg bg-card p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Stage">{STAGE_LABELS[p.stage]}</Detail>
        <Detail label="Status">
          <TaskStatusBadge status={p.status} />
        </Detail>
        <Detail label="Queue ticket">{p.queueSeq != null ? `#${p.queueSeq}` : "—"}</Detail>
        <Detail label="Client">{p.clientLabel}</Detail>
        {p.stage !== "EDGING" && <Detail label="Material">{materials.join(", ") || "—"}</Detail>}
        {p.stage === "CUTTING" && <Detail label="Panels to cut">{count(numbered)}</Detail>}
        {p.stage === "CNC" && <Detail label="Panels to machine">{count(machined)}</Detail>}
        {p.stage === "EDGING" && (
          <Detail label="Panels to band">
            {count(banded)} · {(edgingLength(cl?.parts ?? []) / 1000).toFixed(2)} m of banding
          </Detail>
        )}
        {estimate && (
          <Detail label="Estimated time (estimate)">{formatMinutes(p.stage === "CUTTING" ? estimate.cuttingMin : estimate.edgingMin)}</Detail>
        )}
        <Detail label="Time worked">{formatDuration(p.activeMs)}</Detail>
        {next && <Detail label="Next">{STAGE_LABELS[next]}, after you complete this stage</Detail>}
      </dl>

      {(p.clientNotes || p.internalNotes) && (
        <section className="grid gap-4 md:grid-cols-2">
          {p.clientNotes && (
            <div className="rounded-lg bg-card p-5">
              <h2 className="mb-1 font-semibold">Job notes</h2>
              <p className="text-sm whitespace-pre-line">{p.clientNotes}</p>
            </div>
          )}
          {p.internalNotes && (
            <div className="rounded-lg bg-accent p-5">
              <h2 className="mb-1 font-semibold">Workshop notes</h2>
              <p className="text-sm whitespace-pre-line">{p.internalNotes}</p>
            </div>
          )}
        </section>
      )}

      {p.results && p.status === "COMPLETED" && (
        <section className="rounded-lg bg-card p-5">
          <h2 className="mb-3 font-semibold">Recorded on completion</h2>
          <dl className="grid gap-4 sm:grid-cols-4">
            <Detail label="Panels completed">{p.results.quantityCompleted ?? "—"}</Detail>
            <Detail label="Waste">{p.results.wastePanels ?? 0}</Detail>
            <Detail label="Defective">{p.results.defectivePanels ?? 0}</Detail>
            <Detail label="Downtime">{p.results.downtimeMin ?? 0} min</Detail>
          </dl>
          {p.results.notes && <p className="mt-3 text-sm whitespace-pre-line">{p.results.notes}</p>}
        </section>
      )}

      {!cl ? (
        <p className="rounded-lg bg-muted p-4 text-sm">No approved cutlist for this job.</p>
      ) : p.stage === "CUTTING" ? (
        <>
          <PartsTable
            title="Cutlist"
            note="Panel numbers (3 = row 3) match the plan and the step-by-step guide; each copy is marked 3.1, 3.2 and so on."
            rows={numbered}
            columns={["Grain"]}
            cell={({ x }) => [GRAIN_LABELS[x.grain]]}
          />
          {cl.plan && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Cutting plan</h2>
              <PlanViewer sheets={cl.plan.sheets} parts={drawParts} stockLabels={stockLabels} showLabels={cl.options.labelsOnPanels} compact />
            </section>
          )}
          {cl.plan && (
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold">How to cut it</h2>
                <p className="text-sm text-muted-foreground">One saw cut at a time, in order: strips off the board first, then each strip into panels.</p>
              </div>
              <div className="max-w-5xl">
                <CuttingGuide
                  sheets={cl.plan.sheets}
                  parts={guideParts(cl.parts)}
                  stockLabels={stockLabels}
                  kerf={cl.options.kerf}
                  edgeTrim={cl.options.edgeTrim}
                  progress={p.guide}
                />
              </div>
            </section>
          )}
        </>
      ) : p.stage === "CNC" ? (
        machined.length === 0 ? (
          <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">No panel on this cutlist has CNC notes. Ask the office what needs machining before you start.</p>
        ) : (
          <PartsTable
            title="Panels to machine"
            note={`${count(numbered) - count(machined)} other panel(s) on this job need no machining.`}
            rows={machined}
            columns={["What to machine"]}
            cell={({ x }) => [<span key="m" className="font-medium whitespace-pre-line">{x.machining}</span>]}
          />
        )
      ) : banded.length === 0 ? (
        <p className="rounded-lg bg-muted p-4 text-sm">No panel on this cutlist has edge banding.</p>
      ) : (
        <PartsTable
          title="Panels to band"
          note={`Total edge banding: ${(edgingLength(cl.parts) / 1000).toFixed(2)} m. Panels are marked with their number at the saw.`}
          rows={banded}
          columns={["Edges"]}
          cell={({ x }) => [describeEdges(x.edges)]}
        />
      )}

      {p.sessions.length > 0 && (
        <section className="rounded-lg bg-card p-5">
          <h2 className="mb-3 font-semibold">Work sessions</h2>
          <ol className="space-y-2 text-sm">
            {p.sessions.map((s, i) => (
              <li key={i}>
                {dateFormat.format(s.startedAt)} → {s.endedAt ? dateFormat.format(s.endedAt) : "now"}
                <span className="text-muted-foreground">
                  {" "}
                  · {formatDuration((s.endedAt ?? new Date()).getTime() - s.startedAt.getTime())}
                  {s.endReason && ` · ${s.endReason === "PAUSE" ? "paused" : s.endReason === "COMPLETE" ? "completed" : "released by staff"}`}
                  {s.note && ` · ${s.note}`}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

type Row = { x: NonNullable<TaskDetailProps["cutlist"]>["parts"][number]; no: number };

/** The stage's panels: number, label, size and quantity, plus what this stage needs to know. */
function PartsTable({ title, note, rows, columns, cell }: { title: string; note?: string; rows: Row[]; columns: string[]; cell: (r: Row) => ReactNode[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="overflow-x-auto rounded-lg bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
              <th>#</th>
              <th>Label</th>
              <th className="text-right">L × W (mm)</th>
              <th className="text-right">Qty</th>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.x.ref} className="align-top odd:bg-muted/60 [&>td]:px-3 [&>td]:py-2">
                <td className="font-semibold tabular-nums">{r.no}</td>
                <td>{r.x.label || "—"}</td>
                <td className="text-right whitespace-nowrap tabular-nums">
                  {r.x.length} × {r.x.width}
                </td>
                <td className="text-right tabular-nums">{r.x.quantity}</td>
                {cell(r).map((c, i) => (
                  <td key={i}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </section>
  );
}
