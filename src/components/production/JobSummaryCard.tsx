import type { ReactNode } from "react";
import QRCode from "qrcode";
import type { JobCardData } from "@/components/JobCard";
import { bandedSides, edgingLength } from "@/lib/cutting/engine";

/**
 * A job at a glance, as a card: who it is for, what to do, which material,
 * how many panels and how many edged sides, with the job's QR code.
 */
export default async function JobSummaryCard({
  data,
  scanUrl,
  header,
  children,
}: {
  data: JobCardData;
  scanUrl: string;
  header?: ReactNode;
  children?: ReactNode;
}) {
  const qr = await QRCode.toString(scanUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  const parts = data.cutlist?.parts ?? [];
  const panels = parts.reduce((n, p) => n + p.quantity, 0);
  const banded = parts.filter((p) => bandedSides(p.edges) > 0);
  const bandedPanels = banded.reduce((n, p) => n + p.quantity, 0);
  const sides = banded.reduce((n, p) => n + bandedSides(p.edges) * p.quantity, 0);
  const materials = [...new Set(parts.map((p) => (p.materialName ? `${p.materialName} ${p.thicknessMm} mm` : "Unspecified")))];
  const sheets = data.cutlist?.plan?.totals.sheetsUsed;

  return (
    <article className="overflow-hidden rounded-lg bg-card">
      <div className="flex items-start gap-4 bg-brand-charcoal p-4 text-white">
        <div className="min-w-0 flex-1 space-y-1">
          {header}
          <p className="font-mono text-xl font-semibold">{data.workNumber}</p>
          {data.title && <p className="truncate text-white/90">{data.title}</p>}
          <p className="truncate text-sm text-white/80">
            {data.client.businessName ?? data.client.name} · <span className="font-mono">{data.client.clientNumber}</span>
          </p>
        </div>
        <div className="shrink-0 rounded bg-white p-1.5">
          <div className="size-16 text-brand-charcoal [&_svg]:size-full" role="img" aria-label={`QR code for ${data.workNumber}`} dangerouslySetInnerHTML={{ __html: qr }} />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-sm sm:grid-cols-4">
        <Fact label="Work">
          <span className={data.operations.cutting ? "" : "text-muted-foreground line-through"}>☑ Cutting</span>{" "}
          <span className={data.operations.edging ? "" : "text-muted-foreground line-through"}>{data.operations.edging ? "☑" : "☐"} Edging</span>
        </Fact>
        <Fact label="Material">{materials.join(", ") || "—"}</Fact>
        <Fact label="Panels">
          {panels}
          {sheets ? <span className="text-muted-foreground"> · {sheets} sheet{sheets === 1 ? "" : "s"}</span> : null}
        </Fact>
        <Fact label="Edge banding">
          {sides ? (
            <>
              {bandedPanels} panels, {sides} sides
              <span className="block text-muted-foreground">{(edgingLength(parts) / 1000).toFixed(2)} m</span>
            </>
          ) : (
            "None"
          )}
        </Fact>
      </dl>
      {children && <div className="border-t border-border p-4">{children}</div>}
    </article>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground uppercase">{label}</dt>
      <dd className="font-medium break-words">{children}</dd>
    </div>
  );
}
