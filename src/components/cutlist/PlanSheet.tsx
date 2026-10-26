import type { Edges, PlanSheet as Sheet } from "@/lib/cutting/types";

export type PartInfo = { label: string; length: number; width: number; edges: Edges };

/**
 * One stock sheet drawn to scale from the stored plan: the same numbers the
 * engine produced, nothing redrawn by hand. X is the sheet length.
 */
export default function PlanSheet({
  sheet,
  parts,
  showLabels,
  showCuts,
  title,
}: {
  sheet: Sheet;
  parts: Map<string, PartInfo>;
  showLabels: boolean;
  showCuts: boolean;
  title: string;
}) {
  const L = sheet.length;
  const W = sheet.width;
  const pad = Math.max(L, W) * 0.04;
  const band = Math.max(10, Math.min(L, W) * 0.012);

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${L + pad * 2} ${W + pad * 2}`}
      className="h-auto w-full"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {/* Sheet and its dimensions */}
      <rect x={0} y={0} width={L} height={W} className="fill-brand-steel" />
      <text x={L / 2} y={-pad * 0.3} textAnchor="middle" fontSize={pad * 0.55} className="fill-brand-slate">
        {L} mm
      </text>
      <text x={-pad * 0.3} y={W / 2} textAnchor="middle" fontSize={pad * 0.55} transform={`rotate(-90 ${-pad * 0.3} ${W / 2})`} className="fill-brand-slate">
        {W} mm
      </text>

      {/* Offcuts: what is left after cutting */}
      {sheet.offcuts.map((o, i) => (
        <rect key={`o${i}`} x={o.x} y={o.y} width={o.w} height={o.h} className="fill-muted" />
      ))}

      {sheet.placements.map((p) => {
        const info = parts.get(p.partRef);
        const fs = Math.max(14, Math.min(p.w / 8, p.h / 3.2, 60));
        const edges = info?.edges;
        // Long edges run along the panel length: horizontal unless rotated.
        const top = edges && (p.rotated ? edges.width1 : edges.length1);
        const bottom = edges && (p.rotated ? edges.width2 : edges.length2);
        const left = edges && (p.rotated ? edges.length1 : edges.width1);
        const right = edges && (p.rotated ? edges.length2 : edges.width2);
        return (
          <g key={`${p.partRef}#${p.copy}`}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} className="fill-white stroke-brand-charcoal" strokeWidth={Math.max(2, band / 3)} />
            {top && <rect x={p.x} y={p.y} width={p.w} height={band} className="fill-brand-gold" />}
            {bottom && <rect x={p.x} y={p.y + p.h - band} width={p.w} height={band} className="fill-brand-gold" />}
            {left && <rect x={p.x} y={p.y} width={band} height={p.h} className="fill-brand-gold" />}
            {right && <rect x={p.x + p.w - band} y={p.y} width={band} height={p.h} className="fill-brand-gold" />}
            {p.w > fs * 2 && p.h > fs * 1.4 && (
              <text x={p.x + p.w / 2} y={p.y + p.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={fs} className="fill-brand-charcoal">
                {showLabels && info?.label && (
                  <tspan x={p.x + p.w / 2} dy={-fs * 0.6} fontWeight={600}>
                    {info.label}
                    {p.rotated ? " ⟳" : ""}
                  </tspan>
                )}
                <tspan x={p.x + p.w / 2} dy={showLabels && info?.label ? fs * 1.2 : 0}>
                  {p.rotated ? `${p.h} × ${p.w}` : `${p.w} × ${p.h}`}
                </tspan>
              </text>
            )}
          </g>
        );
      })}

      {showCuts &&
        sheet.cuts.map((c) => {
          const r = Math.max(16, Math.min(L, W) * 0.018);
          return (
            <g key={`c${c.order}`}>
              <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} className="stroke-destructive" strokeWidth={Math.max(2, band / 2)} />
              <circle cx={(c.x1 + c.x2) / 2} cy={(c.y1 + c.y2) / 2} r={r} className="fill-destructive" />
              <text x={(c.x1 + c.x2) / 2} y={(c.y1 + c.y2) / 2} textAnchor="middle" dominantBaseline="central" fontSize={r * 1.1} className="fill-white">
                {c.order}
              </text>
            </g>
          );
        })}
    </svg>
  );
}
