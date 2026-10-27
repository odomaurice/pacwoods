import type { ReactNode } from "react";
import QRCode from "qrcode";
import type { JobCardData } from "@/components/JobCard";
import { bandedSides, edgingLength } from "@/lib/cutting/engine";
import { cn } from "@/lib/utils";

/**
 * A job at a glance, as a card: who it is for, what to do, which material,
 * how many panels and how many edged sides, with the job's QR code.
 */
export default async function JobSummaryCard({
  data,
  scanUrl,
  header,
  children,
  compact = false,
}: {
  data: JobCardData;
  scanUrl: string;
  header?: ReactNode;
  children?: ReactNode;
  /** Tighter spacing, a smaller QR code and two columns of facts, for lists. */
  compact?: boolean;
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
      <div className={cn("flex items-start bg-brand-charcoal text-white", compact ? "gap-3 p-3" : "gap-4 p-4")}>
        <div className={cn("min-w-0 flex-1", compact ? "space-y-0.5" : "space-y-1")}>
          {header}
          <p className={cn("font-mono font-semibold", compact ? "text-base" : "text-xl")}>{data.workNumber}</p>
          {data.title && <p className={cn("truncate text-white/90", compact && "text-sm")}>{data.title}</p>}
          <p className={cn("truncate text-white/80", compact ? "text-xs" : "text-sm")}>
            {data.client.businessName ?? data.client.name} · <span className="font-mono">{data.client.clientNumber}</span>
          </p>
        </div>
        <div className={cn("shrink-0 rounded bg-white", compact ? "p-1" : "p-1.5")}>
          <div className={cn("text-brand-charcoal [&_svg]:size-full", compact ? "size-11" : "size-16")} role="img" aria-label={`QR code for ${data.workNumber}`} dangerouslySetInnerHTML={{ __html: qr }} />
        </div>
      </div>

      <dl className={cn("grid grid-cols-2", compact ? "gap-x-3 gap-y-2 p-3 text-xs" : "gap-x-4 gap-y-3 p-4 text-sm sm:grid-cols-4")}>
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
              <span className={cn("text-muted-foreground", !compact && "block")}>
                {compact && " · "}
                {(edgingLength(parts) / 1000).toFixed(2)} m
              </span>
            </>
          ) : (
            "None"
          )}
        </Fact>
      </dl>
      {children && <div className={cn("border-t border-border", compact ? "p-3" : "p-4")}>{children}</div>}
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
