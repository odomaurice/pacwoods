import type { DrawPart } from "@/components/cutlist/PlanDrawing";
import PlanViewer from "@/components/cutlist/PlanViewer";
import Detail from "@/components/Detail";
import { TaskStatusBadge } from "@/components/StatusBadge";
import { GRAIN_LABELS, describeEdges, estimateMinutes, formatMinutes } from "@/lib/cutlist";
import { edgingLength } from "@/lib/cutting/engine";
import { STAGE_LABELS, formatDuration, type Stage, type TaskStatus } from "@/lib/production";
import { PART_FILLS } from "@/lib/plan-view";
import type { CutlistVersionDoc } from "@/server/db/models/CutlistVersion";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export type TaskDetailProps = {
  stage: Stage;
  status: TaskStatus;
  queueSeq?: number | null;
  clientLabel: string;
  operations: { cutting: boolean; edging: boolean };
  clientNotes?: string | null;
  internalNotes?: string | null;
  cutlist: Pick<CutlistVersionDoc, "version" | "parts" | "stockSheets" | "options" | "plan"> | null;
  sessions: Array<{ startedAt: Date; endedAt?: Date | null; endReason?: string | null; note?: string | null }>;
  activeMs: number;
  results?: { quantityCompleted?: number | null; wastePanels?: number | null; defectivePanels?: number | null; downtimeMin?: number | null; notes?: string | null } | null;
};

/** What the operator needs at the machine for one stage of one job. */
export default function TaskDetail(p: TaskDetailProps) {
  const cl = p.cutlist;
  const totalPanels = cl?.parts.reduce((n, x) => n + x.quantity, 0) ?? 0;
  const estimate = cl?.plan ? estimateMinutes(cl.plan.totals, cl, { cutting: p.stage === "CUTTING", edging: p.stage === "EDGING" }) : null;
  const banded = cl?.parts.filter((x) => x.edges.length1 || x.edges.length2 || x.edges.width1 || x.edges.width2) ?? [];
  const drawParts: DrawPart[] = (cl?.parts ?? []).map((x, i) => ({ ref: x.ref, label: x.label || `#${i + 1}`, fill: PART_FILLS[i % PART_FILLS.length], edges: x.edges }));
  const stockLabels = Object.fromEntries(
    (cl?.stockSheets ?? []).map((s) => [s.ref, [s.label, s.materialName && `${s.materialName} ${s.thicknessMm} mm`].filter(Boolean).join(" · ") || `${s.length}×${s.width}`]),
  );
  const materials = [...new Set((cl?.parts ?? []).map((x) => (x.materialName ? `${x.materialName} ${x.thicknessMm} mm` : "Unspecified")))];

  return (
    <div className="space-y-6">
      <dl className="grid gap-4 rounded-lg bg-card p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Stage">{STAGE_LABELS[p.stage]}</Detail>
        <Detail label="Status">
          <TaskStatusBadge status={p.status} />
        </Detail>
        <Detail label="Queue ticket">{p.queueSeq != null ? `#${p.queueSeq}` : "—"}</Detail>
        <Detail label="Client">{p.clientLabel}</Detail>
        <Detail label="Material">{materials.join(", ") || "—"}</Detail>
        <Detail label="Panels">{totalPanels}</Detail>
        <Detail label="Estimated time (estimate)">
          {estimate ? formatMinutes(p.stage === "CUTTING" ? estimate.cuttingMin : estimate.edgingMin) : "—"}
        </Detail>
        <Detail label="Time worked">{formatDuration(p.activeMs)}</Detail>
        {p.stage === "CUTTING" && p.operations.edging && <Detail label="Next">Edging, after you complete cutting</Detail>}
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
      ) : (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{p.stage === "EDGING" ? "Edge banding" : "Panels"}</h2>
          <div className="overflow-x-auto rounded-lg bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                  <th>#</th>
                  <th>Label</th>
                  <th className="text-right">L × W (mm)</th>
                  <th className="text-right">Qty</th>
                  <th>Grain</th>
                  <th>Edges</th>
                </tr>
              </thead>
              <tbody>
                {(p.stage === "EDGING" ? banded : cl.parts).map((x, i) => (
                  <tr key={x.ref} className="odd:bg-muted/60 [&>td]:px-3 [&>td]:py-2">
                    <td className="tabular-nums">{i + 1}</td>
                    <td>{x.label || "—"}</td>
                    <td className="text-right tabular-nums">
                      {x.length} × {x.width}
                    </td>
                    <td className="text-right tabular-nums">{x.quantity}</td>
                    <td>{GRAIN_LABELS[x.grain]}</td>
                    <td>{describeEdges(x.edges)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {p.stage === "EDGING" && (
            <p className="text-sm text-muted-foreground">Total edge banding: {(edgingLength(cl.parts) / 1000).toFixed(2)} m</p>
          )}
        </section>
      )}

      {p.stage === "CUTTING" && cl?.plan && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Cutting plan</h2>
          <PlanViewer sheets={cl.plan.sheets} parts={drawParts} stockLabels={stockLabels} showLabels={cl.options.labelsOnPanels} />
        </section>
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
                  {s.endReason && ` · ${s.endReason === "PAUSE" ? "paused" : s.endReason === "COMPLETE" ? "completed" : "reassigned"}`}
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
