import QRCode from "qrcode";
import { LogoMark } from "@/components/Logo";
import { GRAIN_LABELS, describeEdges, estimateMinutes, formatMinutes } from "@/lib/cutlist";
import { edgingLength } from "@/lib/cutting/engine";
import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/jobs";
import type { StoredPart, StoredStock } from "@/server/db/models/CutlistVersion";
import type { Plan } from "@/lib/cutting/types";
import { estimateAssumptions } from "@/lib/settings";
import { getSettings } from "@/server/services/settings";

export type JobCardData = {
  workNumber: string;
  status: JobStatus;
  createdAt: Date;
  title?: string | null;
  operations: { cutting: boolean; edging: boolean };
  clientNotes?: string | null;
  internalNotes?: string | null;
  client: { name: string; businessName?: string | null; clientNumber: string; contact?: string | null };
  cutlist: {
    version: number;
    approved: boolean;
    parts: StoredPart[];
    stockSheets: StoredStock[];
    plan: Plan | null;
  } | null;
};

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

function materialName(row: { materialName?: string; thicknessMm?: number }) {
  return row.materialName ? `${row.materialName} ${row.thicknessMm} mm` : "Unspecified";
}

/**
 * The printable job card: what is to be done, to which panels, and how many
 * sides of each are edged. The QR holds only a link with an opaque token;
 * opening it still requires signing in and permission to see the job.
 */
export default async function JobCard({
  data,
  scanUrl,
  audience,
}: {
  data: JobCardData;
  scanUrl: string;
  audience: "staff" | "client";
}) {
  const qr = await QRCode.toString(scanUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  const cl = data.cutlist;
  const parts = cl?.parts ?? [];
  const totalPanels = parts.reduce((n, p) => n + p.quantity, 0);

  // Panels and sheets per material.
  const materials = new Map<string, { panels: number; sheets: number }>();
  for (const p of parts) {
    const m = materials.get(materialName(p)) ?? { panels: 0, sheets: 0 };
    m.panels += p.quantity;
    materials.set(materialName(p), m);
  }
  if (cl?.plan) {
    const stockByRef = new Map(cl.stockSheets.map((s) => [s.ref, s]));
    for (const sheet of cl.plan.sheets) {
      const name = materialName(stockByRef.get(sheet.stockRef) ?? {});
      const m = materials.get(name) ?? { panels: 0, sheets: 0 };
      m.sheets += 1;
      materials.set(name, m);
    }
  }
  const estimate = cl?.plan ? estimateMinutes(cl.plan.totals, cl, data.operations, estimateAssumptions(await getSettings())) : null;

  return (
    <article className="mx-auto max-w-[190mm] space-y-5 bg-white p-6 text-brand-charcoal print:max-w-none print:p-0">
      <header className="flex items-start justify-between gap-4 rounded-lg bg-brand-charcoal p-5 text-white print:rounded-none">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <LogoMark className="h-8 w-auto" />
            <span>
              Pa<span className="text-brand-gold">C</span> WOODS
            </span>
          </div>
          <p className="text-xs font-semibold tracking-[0.25em] text-brand-gold uppercase">Job card</p>
          <p className="font-mono text-2xl font-semibold">{data.workNumber}</p>
          {data.title && <p className="text-white/90">{data.title}</p>}
        </div>
        <div className="rounded-md bg-white p-2">
          <div className="size-28 text-brand-charcoal [&_svg]:size-full" role="img" aria-label={`QR code for ${data.workNumber}`} dangerouslySetInnerHTML={{ __html: qr }} />
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Client</dt>
          <dd className="font-medium">{data.client.businessName ?? data.client.name}</dd>
          <dd className="font-mono text-xs">{data.client.clientNumber}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Registered</dt>
          <dd className="font-medium">{dateFormat.format(data.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-medium">{JOB_STATUS_LABELS[data.status]}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Work requested</dt>
          <dd className="flex gap-3 font-medium">
            <Tick on={data.operations.cutting}>Cutting</Tick>
            <Tick on={data.operations.edging}>Edging</Tick>
          </dd>
        </div>
      </dl>

      {!cl ? (
        <p className="rounded-lg bg-muted p-4 text-sm">The cutlist for this job has not been prepared yet.</p>
      ) : (
        <>
          {!cl.approved && (
            <p className="rounded-lg bg-accent p-3 text-sm font-medium">Draft cutlist (version {cl.version}) — not yet approved; it may still change.</p>
          )}

          <section>
            <h2 className="mb-2 text-sm font-semibold tracking-wide uppercase">Materials</h2>
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              {[...materials].map(([name, m]) => (
                <li key={name} className="rounded-md bg-muted px-3 py-2">
                  <span className="font-medium">{name}</span>
                  <span className="block text-muted-foreground">
                    {m.panels} panel{m.panels === 1 ? "" : "s"}
                    {m.sheets ? ` · ${m.sheets} sheet${m.sheets === 1 ? "" : "s"}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold tracking-wide uppercase">Panels</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="[&>th]:px-2 [&>th]:py-1.5 [&>th]:font-medium">
                    <th>#</th>
                    <th>Label</th>
                    <th className="text-right">Length × Width (mm)</th>
                    <th className="text-right">Qty</th>
                    <th>Material</th>
                    <th>Grain</th>
                    <th>Edge banding</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((p, i) => (
                    <tr key={p.ref} className="odd:bg-muted/60 [&>td]:px-2 [&>td]:py-1.5">
                      <td className="tabular-nums">{i + 1}</td>
                      <td>{p.label || "—"}</td>
                      <td className="text-right tabular-nums">
                        {p.length} × {p.width}
                      </td>
                      <td className="text-right tabular-nums">{p.quantity}</td>
                      <td>{materialName(p)}</td>
                      <td>{GRAIN_LABELS[p.grain]}</td>
                      <td>{describeEdges(p.edges)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <dl className="grid grid-cols-2 gap-4 rounded-lg bg-muted p-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Total panels</dt>
              <dd className="font-semibold tabular-nums">{totalPanels}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sheets</dt>
              <dd className="font-semibold tabular-nums">{cl.plan ? cl.plan.totals.sheetsUsed : "Plan not generated"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Edge banding</dt>
              <dd className="font-semibold tabular-nums">{(edgingLength(parts) / 1000).toFixed(2)} m</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Estimated time</dt>
              <dd className="font-semibold">{estimate ? formatMinutes(estimate.totalMin) : "—"}</dd>
            </div>
          </dl>
        </>
      )}

      {data.clientNotes && (
        <section className="text-sm">
          <h2 className="mb-1 font-semibold">Notes</h2>
          <p className="whitespace-pre-line">{data.clientNotes}</p>
        </section>
      )}
      {audience === "staff" && data.internalNotes && (
        <section className="text-sm">
          <h2 className="mb-1 font-semibold">Internal notes (staff only)</h2>
          <p className="whitespace-pre-line">{data.internalNotes}</p>
        </section>
      )}
      <p className="text-xs text-muted-foreground">Times are estimates. Sizes are in millimetres.</p>
    </article>
  );
}

function Tick({ on, children }: { on: boolean; children: string }) {
  return (
    <span className={on ? "" : "text-muted-foreground line-through"}>
      <span aria-hidden>{on ? "☑" : "☐"}</span> {children}
      <span className="sr-only">{on ? " (required)" : " (not required)"}</span>
    </span>
  );
}
